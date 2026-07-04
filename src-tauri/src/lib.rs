mod enhance;

use tauri_plugin_fs::FsExt;

// System-reserved roots that watch folders must never point at. Shared by the
// list_folder_files guard and the runtime fs-scope grant so both agree.
fn is_blocked_system_root(compare_path: &str) -> bool {
    const BLOCKED_ROOTS: &[&str] = &[
        r"C:\Windows",
        r"C:\Program Files",
        r"C:\Program Files (x86)",
        r"C:\ProgramData",
        r"C:\System Volume Information",
        "/etc",
        "/sys",
        "/proc",
        "/dev",
        "/boot",
        "/bin",
        "/sbin",
        "/usr/bin",
        "/usr/sbin",
    ];
    BLOCKED_ROOTS.iter().any(|root| compare_path.starts_with(root))
}

#[tauri::command]
async fn enhance_photo(
    input_path: String,
    output_path: String,
    brightness: Option<f32>,
    contrast: Option<f32>,
    saturation: Option<f32>,
    sharpen: Option<f32>,
) -> Result<String, String> {
    let br  = brightness.unwrap_or(0.0);
    let co  = contrast.unwrap_or(0.0);
    let sat = saturation.unwrap_or(1.08);
    let sh  = sharpen.unwrap_or(0.25);
    tauri::async_runtime::spawn_blocking(move || {
        enhance::enhance_image(&input_path, &output_path, br, co, sat, sh).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn apply_photo_adjustments(
    input_path: String,
    brightness: f32,
    contrast: f32,
    saturation: f32,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        enhance::apply_adjustments(&input_path, &input_path, brightness, contrast, saturation)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
struct FolderFileEntry {
    name: String,
    size: u64,
    modified_ms: Option<u64>,
}

#[tauri::command]
fn list_folder_files(path: String) -> Vec<FolderFileEntry> {
    let dir = std::path::Path::new(&path);

    // Must be an existing directory.
    if !dir.is_dir() {
        return vec![];
    }

    // Reject system-reserved roots. Operators may place watch folders on any
    // drive, so we can't enforce an allow-list here the way reveal_in_explorer
    // can. Instead, block the most dangerous system paths explicitly.
    let canonical = match std::fs::canonicalize(dir) {
        Ok(p) => p,
        Err(_) => return vec![],
    };
    // On Windows, canonicalize() prepends a \\?\ extended path prefix.
    // Strip it before string comparison so blocked_roots matches correctly.
    let canonical_str = canonical.to_string_lossy();
    let compare_path = canonical_str.strip_prefix(r"\\?\").unwrap_or(&canonical_str);
    if is_blocked_system_root(compare_path) {
        return vec![];
    }

    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return vec![];
    };
    let mut entries: Vec<FolderFileEntry> = read_dir
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let meta = entry.metadata().ok()?;
            if !meta.is_file() {
                return None;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            let size = meta.len();
            let modified_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);
            Some(FolderFileEntry { name, size, modified_ms })
        })
        .collect();
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    entries
}

/// Grant the fs plugin scope access to a validated, operator-chosen watch folder at
/// runtime. Watch paths are arbitrary directories that a static capability manifest can't
/// enumerate, so instead of allowing `**` (full filesystem) we extend the scope per path
/// here, gated by the same blocked-system-root guard as list_folder_files. The scope is
/// process-global and in-memory, so the frontend re-grants on every launch when it starts
/// the watchers.
#[tauri::command]
fn allow_watch_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Watch path is not an existing directory: {path}"));
    }

    let canonical = std::fs::canonicalize(dir).map_err(|e| e.to_string())?;
    let canonical_str = canonical.to_string_lossy();
    let compare_path = canonical_str.strip_prefix(r"\\?\").unwrap_or(&canonical_str);
    if is_blocked_system_root(compare_path) {
        return Err(format!("Watch path is inside a blocked system directory: {path}"));
    }

    // Pass the original path: tauri's push_pattern canonicalizes internally and stores
    // both forms, so requests using the operator's path string still match.
    app.fs_scope()
        .allow_directory(dir, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);

    // Guard 1: path must exist on disk.
    if !p.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    // Guard 2: path must be under an allowed root.
    // Windows: C:\PhotoFlow Desktop  or  %LOCALAPPDATA%\PhotoFlow Desktop
    // macOS/Linux: $HOME/PhotoFlow Desktop
    let canonical = std::fs::canonicalize(p).map_err(|e| e.to_string())?;

    let allowed = {
        let mut roots: Vec<std::path::PathBuf> = vec![
            std::path::PathBuf::from(r"C:\PhotoFlow Desktop"),
        ];
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            roots.push(std::path::PathBuf::from(local).join("PhotoFlow Desktop"));
        }
        if let Ok(home) = std::env::var("HOME") {
            roots.push(std::path::PathBuf::from(home).join("PhotoFlow Desktop"));
        }
        roots
    };

    if !allowed.iter().any(|root| canonical.starts_with(root)) {
        return Err(format!(
            "Path is outside the allowed PhotoFlow Desktop directories: {path}"
        ));
    }

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![reveal_in_explorer, list_folder_files, allow_watch_path, enhance_photo, apply_photo_adjustments])
        .run(tauri::generate_context!())
        .expect("error while running PhotoFlow Desktop");
}

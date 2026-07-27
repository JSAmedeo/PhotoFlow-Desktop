mod enhance;

use tauri_plugin_fs::FsExt;

// ── Shared path validation ─────────────────────────────────────────────────────
//
// Two distinct guards exist because the two command families have different trust
// models:
//  - Image commands (enhance_photo / apply_photo_adjustments) and reveal_in_explorer
//    only ever operate on app-managed storage, so they enforce an ALLOWLIST
//    (assert_within_allowed_roots).
//  - Watch-folder commands (list_folder_files / allow_watch_path) accept arbitrary
//    operator-chosen directories on any drive, so they enforce a DENYLIST of
//    system-reserved roots (is_blocked_system_root).

/// Canonicalize a path and strip the Windows `\\?\` extended-length prefix so the
/// result can be compared component-wise against configured roots (which are written
/// without the prefix). Also the form passed to explorer/open, which handle the
/// verbatim prefix poorly.
fn canonical_compare_path(path: &std::path::Path) -> Result<std::path::PathBuf, String> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("Cannot resolve path {}: {e}", path.display()))?;
    let canonical_str = canonical.to_string_lossy();
    let stripped = canonical_str
        .strip_prefix(r"\\?\UNC\")
        .map(|rest| format!(r"\\{rest}"))
        .or_else(|| canonical_str.strip_prefix(r"\\?\").map(str::to_string))
        .unwrap_or_else(|| canonical_str.to_string());
    Ok(std::path::PathBuf::from(stripped))
}

/// Component-wise, case-insensitive prefix check. Compares whole path components so
/// `C:\PhotoFlow Desktop2` does NOT match root `C:\PhotoFlow Desktop`, and lowercases
/// both sides so `c:\windows` matches `C:\Windows` (Windows paths are case-insensitive).
fn path_starts_with_ci(path: &std::path::Path, root: &std::path::Path) -> bool {
    let p: Vec<String> = path
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_lowercase())
        .collect();
    let r: Vec<String> = root
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_lowercase())
        .collect();
    p.len() >= r.len() && p[..r.len()] == r[..]
}

// System-reserved roots that watch folders must never point at. Shared by the
// list_folder_files guard and the runtime fs-scope grant so both agree.
fn is_blocked_system_root(path: &std::path::Path) -> bool {
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
    BLOCKED_ROOTS
        .iter()
        .any(|root| path_starts_with_ci(path, std::path::Path::new(root)))
}

/// Roots the image commands and reveal_in_explorer are allowed to touch.
/// Windows: C:\PhotoFlow Desktop or %LOCALAPPDATA%\PhotoFlow Desktop
/// macOS/Linux: $HOME/PhotoFlow Desktop
fn allowed_roots() -> Vec<std::path::PathBuf> {
    let mut roots: Vec<std::path::PathBuf> =
        vec![std::path::PathBuf::from(r"C:\PhotoFlow Desktop")];
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        roots.push(std::path::PathBuf::from(local).join("PhotoFlow Desktop"));
    }
    if let Ok(home) = std::env::var("HOME") {
        roots.push(std::path::PathBuf::from(home).join("PhotoFlow Desktop"));
    }
    roots
}

/// Canonicalize `path` and require it to live under an allowed root.
/// Returns the canonicalized path — callers must use the returned path for all
/// subsequent file operations, never the raw input string (TOCTOU hygiene).
fn assert_within_allowed_roots(path: &std::path::Path) -> Result<std::path::PathBuf, String> {
    let cleaned = canonical_compare_path(path)?;
    if allowed_roots()
        .iter()
        .any(|root| path_starts_with_ci(&cleaned, root))
    {
        Ok(cleaned)
    } else {
        Err(format!(
            "Path is outside the allowed PhotoFlow Desktop directories: {}",
            path.display()
        ))
    }
}

/// Validate an existing input file for the image commands.
fn validate_input_file(path_str: &str) -> Result<std::path::PathBuf, String> {
    let validated = assert_within_allowed_roots(std::path::Path::new(path_str))?;
    if !validated.is_file() {
        return Err(format!("Input path is not a file: {path_str}"));
    }
    Ok(validated)
}

/// Validate an output path that does not exist yet: its parent directory must
/// canonicalize into an allowed root, and the filename component must be a plain
/// name (no separators, not `..`).
fn validate_output_path(path_str: &str) -> Result<std::path::PathBuf, String> {
    let path = std::path::Path::new(path_str);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("Output path has no usable filename: {path_str}"))?;
    if file_name == ".." || file_name.contains('/') || file_name.contains('\\') {
        return Err(format!("Output filename is not a plain file name: {file_name}"));
    }
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| format!("Output path has no parent directory: {path_str}"))?;
    let canonical_parent = assert_within_allowed_roots(parent)?;
    Ok(canonical_parent.join(file_name))
}

// ── Image commands ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn enhance_photo(
    input_path: String,
    output_path: String,
    brightness: Option<f32>,
    contrast: Option<f32>,
    saturation: Option<f32>,
    sharpen: Option<f32>,
) -> Result<String, String> {
    let input = validate_input_file(&input_path)?;
    let output = validate_output_path(&output_path)?;
    let br = brightness.unwrap_or(0.0);
    let co = contrast.unwrap_or(0.0);
    let sat = saturation.unwrap_or(1.08);
    let sh = sharpen.unwrap_or(0.25);
    tauri::async_runtime::spawn_blocking(move || {
        enhance::enhance_image(
            &input.to_string_lossy(),
            &output.to_string_lossy(),
            br,
            co,
            sat,
            sh,
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn apply_photo_adjustments(
    input_path: String,
    output_path: Option<String>,
    brightness: f32,
    contrast: f32,
    saturation: f32,
) -> Result<String, String> {
    let input = validate_input_file(&input_path)?;
    // No output_path = bake in place (input already validated). A distinct output
    // path is how the workshop keeps the original untouched on first save.
    let output = match output_path {
        Some(ref out) if out != &input_path => validate_output_path(out)?,
        _ => input.clone(),
    };
    tauri::async_runtime::spawn_blocking(move || {
        enhance::apply_adjustments(
            &input.to_string_lossy(),
            &output.to_string_lossy(),
            brightness,
            contrast,
            saturation,
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── Folder / shell commands ────────────────────────────────────────────────────

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
    let canonical = match canonical_compare_path(dir) {
        Ok(p) => p,
        Err(_) => return vec![],
    };
    if is_blocked_system_root(&canonical) {
        return vec![];
    }

    let Ok(read_dir) = std::fs::read_dir(&canonical) else {
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

    let canonical = canonical_compare_path(dir)?;
    if is_blocked_system_root(&canonical) {
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

    // Guard 2: path must be under an allowed root. Spawn with the canonicalized
    // path, not the raw input — the validated and opened paths must be the same.
    let canonical = assert_within_allowed_roots(p)?;
    let open_path = canonical.as_os_str();

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(open_path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(open_path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(open_path)
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

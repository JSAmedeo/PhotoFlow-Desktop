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
    let blocked_roots: &[&str] = &[
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
    if blocked_roots.iter().any(|root| compare_path.starts_with(root)) {
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
        .invoke_handler(tauri::generate_handler![reveal_in_explorer, list_folder_files])
        .run(tauri::generate_context!())
        .expect("error while running PhotoFlow Desktop");
}

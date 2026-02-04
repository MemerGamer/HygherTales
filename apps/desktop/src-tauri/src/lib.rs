#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::{env, fs};

#[derive(serde::Serialize)]
struct EnsureModsDirResult {
    ok: bool,
    created: bool,
}

#[derive(serde::Serialize)]
struct CheckPathAccessResult {
    exists: bool,
    is_dir: bool,
    writable: bool,
}

/// Returns candidate paths for the default Hytale Mods folder per platform.
///
/// - Windows: %APPDATA%\Hytale\UserData\Mods
/// - macOS: ~/Library/Application Support/Hytale/UserData/Mods
/// - Linux: Official Flatpak uses com.hypixel.HytaleLauncher → ~/.var/app/com.hypixel.HytaleLauncher/data/Hytale/UserData/Mods; one XDG fallback for native/AUR.
#[tauri::command]
fn get_default_hytale_mods_paths() -> Vec<String> {
    let mut candidates: Vec<String> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // %APPDATA%\Hytale\UserData\Mods (e.g. C:\Users\<user>\AppData\Roaming\Hytale\UserData\Mods)
        if let Some(appdata) = env::var_os("APPDATA") {
            let path = PathBuf::from(appdata).join("Hytale").join("UserData").join("Mods");
            candidates.push(path.to_string_lossy().into_owned());
        }
    }

    #[cfg(target_os = "macos")]
    {
        // ~/Library/Application Support/Hytale/UserData/Mods
        if let Some(home) = env::var_os("HOME") {
            let path = PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("Hytale")
                .join("UserData")
                .join("Mods");
            candidates.push(path.to_string_lossy().into_owned());
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Official Linux build: Flatpak app id com.hypixel.HytaleLauncher
        if let Some(home) = env::var_os("HOME") {
            let path = PathBuf::from(home)
                .join(".var")
                .join("app")
                .join("com.hypixel.HytaleLauncher")
                .join("data")
                .join("Hytale")
                .join("UserData")
                .join("Mods");
            candidates.push(path.to_string_lossy().into_owned());
        }
        // Fallback for native/AUR installs
        if let Some(xdg) = env::var_os("XDG_DATA_HOME") {
            let path = PathBuf::from(xdg).join("Hytale").join("UserData").join("Mods");
            let s = path.to_string_lossy().into_owned();
            if !candidates.contains(&s) {
                candidates.push(s);
            }
        }
        if let Some(home) = env::var_os("HOME") {
            let path = PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("Hytale")
                .join("UserData")
                .join("Mods");
            let s = path.to_string_lossy().into_owned();
            if !candidates.contains(&s) {
                candidates.push(s);
            }
        }
    }

    candidates
}

/// Ensures the Mods directory exists. Creates it (and parents) if missing.
/// Does not delete or modify any existing files.
#[tauri::command]
fn ensure_mods_dir(path: String) -> Result<EnsureModsDirResult, String> {
    let p = PathBuf::from(path.trim());
    if p.as_os_str().is_empty() {
        return Err("Path is empty".to_string());
    }
    if p.exists() {
        if !p.is_dir() {
            return Err("Path exists but is not a directory".to_string());
        }
        return Ok(EnsureModsDirResult { ok: true, created: false });
    }
    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(EnsureModsDirResult { ok: true, created: true })
}

/// Checks path existence, whether it is a directory, and if it is writable.
#[tauri::command]
fn check_path_access(path: String) -> CheckPathAccessResult {
    let p = PathBuf::from(path.trim());
    let exists = p.exists();
    let is_dir = exists && p.is_dir();
    let writable = is_dir && check_writable(&p);
    CheckPathAccessResult {
        exists,
        is_dir,
        writable,
    }
}

fn check_writable(path: &std::path::Path) -> bool {
    let test_file = path.join(".hyghertales_write_test");
    match fs::File::create(&test_file) {
        Ok(f) => {
            drop(f);
            let _ = fs::remove_file(&test_file);
            true
        }
        Err(_) => false,
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_default_hytale_mods_paths,
            ensure_mods_dir,
            check_path_access,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

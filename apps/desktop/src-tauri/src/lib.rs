#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::{env, fs};
use tauri::Manager;

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

#[derive(serde::Serialize)]
struct LaunchGameResult {
    ok: bool,
}

/// Installed mod record (matches TS InstalledMod schema).
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModRecord {
    pub id: Option<i64>,
    pub provider: String,
    pub project_id: Option<i64>,
    pub resource_id: Option<String>,
    pub slug: String,
    pub name: String,
    pub installed_file_id: Option<serde_json::Value>,
    pub installed_filename: String,
    pub installed_at: String,
    pub source_url: Option<String>,
    pub enabled: bool,
    #[serde(default)]
    pub pinned: bool,
}

const INSTALLED_MODS_FILENAME: &str = "installed_mods.json";
const PROFILES_FILENAME: &str = "profiles.json";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRecord {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub enabled_mod_ids: Vec<i64>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProfilesData {
    pub next_id: i64,
    pub active_profile_id: Option<i64>,
    pub profiles: Vec<ProfileRecord>,
}

fn app_installed_mods_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("{e}"))?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(INSTALLED_MODS_FILENAME))
}

fn app_profiles_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("{e}"))?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(PROFILES_FILENAME))
}

#[tauri::command]
fn read_profiles(app: tauri::AppHandle) -> Result<ProfilesData, String> {
    let path = app_profiles_path(&app)?;
    if !path.exists() {
        return Ok(ProfilesData {
            next_id: 1,
            active_profile_id: None,
            profiles: Vec::new(),
        });
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let parsed: ProfilesData = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(parsed)
}

#[tauri::command]
fn write_profiles(app: tauri::AppHandle, data: ProfilesData) -> Result<(), String> {
    let path = app_profiles_path(&app)?;
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_installed_mods(app: tauri::AppHandle) -> Result<Vec<InstalledModRecord>, String> {
    let path = app_installed_mods_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mods: Vec<InstalledModRecord> = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    Ok(mods)
}

#[tauri::command]
fn write_installed_mods(app: tauri::AppHandle, mods: Vec<InstalledModRecord>) -> Result<(), String> {
    let path = app_installed_mods_path(&app)?;
    let data = serde_json::to_string_pretty(&mods).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

/// Ensures Mods.disabled exists (sibling of the given Mods dir).
#[tauri::command]
fn ensure_mods_disabled_dir(mods_dir: String) -> Result<EnsureModsDirResult, String> {
    let mods_path = PathBuf::from(mods_dir.trim());
    if mods_path.as_os_str().is_empty() {
        return Err("Mods path is empty".to_string());
    }
    let disabled_path = mods_path.with_extension("disabled");
    if disabled_path.exists() {
        if !disabled_path.is_dir() {
            return Err("Mods.disabled exists but is not a directory".to_string());
        }
        return Ok(EnsureModsDirResult { ok: true, created: false });
    }
    fs::create_dir_all(&disabled_path).map_err(|e| e.to_string())?;
    Ok(EnsureModsDirResult { ok: true, created: true })
}

/// Returns a path that doesn't exist yet; if `target` exists, appends (1), (2), etc.
fn unique_file_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }
    let stem = target.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = target.extension().and_then(|e| e.to_str());
    let parent = target.parent().unwrap_or(Path::new("."));
    for n in 1..1000 {
        let name = if let Some(ext) = ext {
            format!("{stem} ({n}).{ext}")
        } else {
            format!("{stem} ({n})")
        };
        let p = parent.join(name);
        if !p.exists() {
            return p;
        }
    }
    target.to_path_buf()
}

/// Move a file from one path to another. If destination exists, use a unique name.
/// Returns the final path where the file was moved (for DB update).
#[tauri::command]
fn move_mod_file(from_path: String, to_path: String) -> Result<String, String> {
    let from = PathBuf::from(from_path.trim());
    let to = PathBuf::from(to_path.trim());
    if !from.exists() {
        return Err("Source file does not exist".to_string());
    }
    if from.is_dir() {
        return Err("Source is a directory".to_string());
    }
    if let Some(p) = to.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    let final_to = unique_file_path(&to);
    fs::rename(&from, &final_to).map_err(|e| e.to_string())?;
    Ok(final_to.to_string_lossy().into_owned())
}

#[tauri::command]
fn move_file_to_trash(path: String) -> Result<(), String> {
    let p = PathBuf::from(path.trim());
    if !p.exists() {
        return Err("File does not exist".to_string());
    }
    trash::delete(&p).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_mod_dir_file_names(dir_path: String) -> Result<Vec<String>, String> {
    let dir = PathBuf::from(dir_path.trim());
    if !dir.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    let mut names = Vec::new();
    for e in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let e = e.map_err(|e| e.to_string())?;
        if e.path().is_file() {
            if let Some(name) = e.file_name().to_str() {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

/// Download URL to destination path. Creates parent dirs. Writes to temp then renames.
#[tauri::command]
fn download_file_to_path(url: String, dest_path: String) -> Result<String, String> {
    let url = url.trim();
    let dest = PathBuf::from(dest_path.trim());
    if url.is_empty() {
        return Err("URL is empty".to_string());
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let client = reqwest::blocking::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().map_err(|e| e.to_string())?;
    let temp_path = dest.with_extension("tmp");
    {
        let mut f = fs::File::create(&temp_path).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
    }
    let final_path = unique_file_path(&dest);
    fs::rename(&temp_path, &final_path).map_err(|e| e.to_string())?;
    Ok(final_path.to_string_lossy().into_owned())
}

/// Returns candidate paths for the default Hytale Mods folder per platform.
#[tauri::command]
fn get_default_hytale_mods_paths() -> Vec<String> {
    let mut candidates: Vec<String> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = env::var_os("APPDATA") {
            let path = PathBuf::from(appdata).join("Hytale").join("UserData").join("Mods");
            candidates.push(path.to_string_lossy().into_owned());
        }
    }

    #[cfg(target_os = "macos")]
    {
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

/// Safe update: move old file to backup (Mods.backup/name.bak), then move new temp file into place.
/// Returns the new filename (so the frontend can update the DB).
#[tauri::command]
fn apply_mod_update(
    old_path: String,
    new_temp_path: String,
    final_dir: String,
    new_filename: String,
) -> Result<String, String> {
    let old_p = PathBuf::from(old_path.trim());
    let new_temp = PathBuf::from(new_temp_path.trim());
    let final_dir_p = PathBuf::from(final_dir.trim());
    let new_filename = new_filename.trim();
    if !old_p.exists() {
        return Err("Existing mod file not found".to_string());
    }
    if !new_temp.exists() {
        return Err("New downloaded file not found".to_string());
    }
    if new_filename.is_empty() {
        return Err("New filename is empty".to_string());
    }
    let parent = final_dir_p.parent().unwrap_or_else(|| final_dir_p.as_path());
    let backup_dir = parent.join("Mods.backup");
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let old_name = old_p
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("mod");
    let backup_base = format!("{}.bak", old_name);
    let backup_path = unique_file_path(&backup_dir.join(&backup_base));
    fs::rename(&old_p, &backup_path).map_err(|e| e.to_string())?;
    let dest = final_dir_p.join(new_filename);
    fs::rename(&new_temp, &dest).map_err(|e| e.to_string())?;
    Ok(new_filename.to_string())
}

/// Write UTF-8 text to a file. Used for export (e.g. profile JSON). Creates parent dirs.
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(path.trim());
    if p.as_os_str().is_empty() {
        return Err("Path is empty".to_string());
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&p, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// Read a file as UTF-8 text. Used for import (e.g. profile JSON).
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(path.trim());
    if !p.exists() || !p.is_file() {
        return Err("File does not exist or is not a file".to_string());
    }
    fs::read_to_string(&p).map_err(|e| e.to_string())
}

/// Launch the game executable. No auth, no game file downloads. Validates path exists and is a file.
#[tauri::command]
fn launch_game(exe_path: String, args: Option<Vec<String>>) -> Result<LaunchGameResult, String> {
    let path = PathBuf::from(exe_path.trim());
    if path.as_os_str().is_empty() {
        return Err("Path is empty".to_string());
    }
    if !path.exists() {
        return Err("Path does not exist".to_string());
    }
    if path.is_dir() {
        return Err("Path is a directory, not an executable".to_string());
    }
    let args = args.unwrap_or_default();
    Command::new(&path)
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to launch: {e}"))?;
    Ok(LaunchGameResult { ok: true })
}

/// Open a path (file or folder) in the system file manager. Does not use the shell plugin
/// so file:// URLs are not needed; the shell plugin only allows http/https/mailto/tel.
#[tauri::command]
fn open_path_in_file_manager(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("Path is empty".to_string());
    }
    let p = PathBuf::from(path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(p.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&p)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&p)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = p;
        return Err("Opening path in file manager is not supported on this platform".to_string());
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_default_hytale_mods_paths,
            ensure_mods_dir,
            check_path_access,
            read_installed_mods,
            write_installed_mods,
            read_profiles,
            write_profiles,
            ensure_mods_disabled_dir,
            move_mod_file,
            move_file_to_trash,
            list_mod_dir_file_names,
            download_file_to_path,
            open_path_in_file_manager,
            apply_mod_update,
            write_text_file,
            read_text_file,
            launch_game,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

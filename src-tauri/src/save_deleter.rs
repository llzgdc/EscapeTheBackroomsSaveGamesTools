//! Save deleter module - Handles file deletion, restoration, and visibility operations
//! Extracted from save_commands.rs for better modularity

use crate::common::{
    add_save_to_mainsave, extract_archive_name, extract_archive_name_from_trash,
    get_save_games_dir, get_visible_saves_set, remove_save_from_mainsave, set_save_visibility,
    validate_save_games_path,
};
use crate::error::AppResult;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Helper: run a blocking closure via tokio::task::spawn_blocking,
/// mapping the join error into an AppResult.
async fn run_blocking<F, T>(f: F) -> AppResult<T>
where
    F: FnOnce() -> AppResult<T> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| format!("Task was cancelled: {}", e))?
}

/// Permanently delete a save file.
/// Removes from MAINSAVE records.
#[tauri::command]
pub async fn delete_file(file_path: String) -> AppResult<()> {
    run_blocking(move || {
        let path = Path::new(&file_path);
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid file path")?;

        if !filename.to_lowercase().ends_with(".sav") {
            return Err("Only .sav save files can be deleted".to_string().into());
        }

        validate_save_games_path(path)?;

        fs::remove_file(&file_path).map_err(|e| format!("Failed to delete file: {}", e))?;

        // Remove from MAINSAVE records (best-effort: the file removal above is what
        // actually deletes the archive — listings are directory-driven, so a stale
        // entry is harmless. Failing here would report failure after the fact.)
        if let Err(e) = remove_save_from_mainsave(extract_archive_name(filename)) {
            tracing::warn!("Failed to clean '{}' from MAINSAVE: {}", filename, e);
        }

        Ok(())
    })
    .await
}

/// Soft-deleted archives go to the OS temp directory so the game's
/// SaveGames folder stays clean. App-specific subfolder avoids clashes with
/// other software. Tradeoff: the OS may purge temp at any time, which only
/// affects restoring long-gone deletions — the undo window is in-session.
const TRASH_DIR_NAME: &str = "etbsavemanager";

/// Trash location for an archive: `%TEMP%/etbsavemanager/<name>.sav.trash`.
fn new_trash_path(original_sav_path: &Path) -> PathBuf {
    let filename = original_sav_path.file_name().unwrap_or_default();
    std::env::temp_dir()
        .join(TRASH_DIR_NAME)
        .join(filename)
        .with_extension("sav.trash")
}

/// Legacy pre-upgrade location: `.sav.trash` next to the original file.
fn legacy_trash_path(original_sav_path: &Path) -> PathBuf {
    original_sav_path.with_extension("sav.trash")
}

/// Move a file even when source and destination sit on different volumes
/// (SaveGames and %TEMP% may be separate drives): fall back to copy+delete.
fn move_file(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::rename(from, to).or_else(|_| {
        fs::copy(from, to)
            .and_then(|_| fs::remove_file(from))
            .map(|_| ())
    })
}

/// Move any root-level `.sav.trash` files from earlier versions into the OS
/// temp folder. Best-effort; called during metadata load.
pub fn migrate_legacy_trash() {
    let Ok(save_dir) = get_save_games_dir() else {
        return;
    };
    let Ok(entries) = fs::read_dir(&save_dir) else {
        return;
    };
    let trash_dir = std::env::temp_dir().join(TRASH_DIR_NAME);
    if fs::create_dir_all(&trash_dir).is_err() {
        return;
    }
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("trash") {
            continue;
        }
        let Some(filename) = path.file_name() else {
            continue;
        };
        match move_file(&path, &trash_dir.join(filename)) {
            Ok(()) => {
                tracing::info!("Migrated legacy trash file: {}", filename.to_string_lossy())
            }
            Err(e) => tracing::warn!(
                "Failed to migrate trash file '{}': {}",
                filename.to_string_lossy(),
                e
            ),
        }
    }
}

/// Soft-delete: rename .sav → temp/<name>.sav.trash so it can be restored later.
/// Removes from MAINSAVE records.
#[tauri::command]
pub async fn soft_delete_file(file_path: String) -> AppResult<()> {
    run_blocking(move || {
        let path = Path::new(&file_path);
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid file path")?;

        if !filename.to_lowercase().ends_with(".sav") {
            return Err("Only .sav save files can be soft-deleted"
                .to_string()
                .into());
        }

        validate_save_games_path(path)?;

        let trash_path = new_trash_path(path);
        if let Some(parent) = trash_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create trash folder: {}", e))?;
        }

        // Move to trash. An existing trashed copy of the same name is
        // replaced — recycle-bin semantics, only the newest deletion is kept.
        move_file(path, &trash_path).map_err(|e| format!("Failed to move file to trash: {}", e))?;

        // Remove from MAINSAVE records (best-effort — see delete_file. Failing
        // here AFTER the rename would report failure while the archive IS
        // trashed, and would skip registering the undo action on the frontend.)
        if let Err(e) = remove_save_from_mainsave(extract_archive_name(filename)) {
            tracing::warn!(
                "Failed to clean '{}' from MAINSAVE after trash: {}",
                filename,
                e
            );
        }

        Ok(())
    })
    .await
}

/// Restore a soft-deleted file: rename temp/<name>.sav.trash → <name>.sav.
/// Falls back to the legacy root-level location from older versions.
/// Adds back to MAINSAVE records.
#[tauri::command]
pub async fn restore_file(file_path: String) -> AppResult<()> {
    run_blocking(move || {
        let path = Path::new(&file_path);

        // New layout first (%TEMP%), then the pre-upgrade root-level location.
        let mut trash_path = new_trash_path(path);
        if !trash_path.exists() {
            trash_path = legacy_trash_path(path);
            validate_save_games_path(&trash_path)?;
        }

        if !trash_path.exists() {
            return Err(format!("Trash file not found: {}", trash_path.display()).into());
        }

        let filename = trash_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or("Invalid trash file path")?;

        // Validate the restore TARGET before moving any data there — this is
        // the only containment check for the temp-layout branch (the trash
        // file itself lives in %TEMP% by design), so it must run up front;
        // after the move the check cannot undo the write.
        validate_save_games_path(path)?;

        // Restore (may cross volumes between %TEMP% and SaveGames)
        move_file(&trash_path, path).map_err(|e| format!("Failed to restore file: {}", e))?;

        // Add back to MAINSAVE records. The trash filename ends in ".sav.trash",
        // so the plain ".sav" stripper would register the archive under a name
        // that never matches a listing — leaving restored archives hidden.
        // Best-effort (mirrors soft_delete_file): the rename above already put
        // the .sav back, and failing here would report failure after the fact.
        if let Err(e) = add_save_to_mainsave(extract_archive_name_from_trash(filename)) {
            tracing::warn!("Failed to re-register '{}' in MAINSAVE: {}", filename, e);
        }

        Ok(())
    })
    .await
}

/// Permanently delete a trashed file (.sav.trash).
/// Called after the undo window expires.
#[tauri::command]
pub async fn permanent_delete_file(file_path: String) -> AppResult<()> {
    run_blocking(move || {
        let path = Path::new(&file_path);
        // Remove both layouts if present (%TEMP% + legacy root next to saves).
        // Only the legacy path sits under SaveGames, so containment validation
        // applies there alone; the temp path lives outside by design.
        let legacy = legacy_trash_path(path);
        validate_save_games_path(&legacy)?;
        for trash_path in [new_trash_path(path), legacy] {
            if trash_path.exists() {
                fs::remove_file(&trash_path)
                    .map_err(|e| format!("Failed to delete trash file: {}", e))?;
            }
        }
        Ok(())
    })
    .await
}

/// Open the save games folder in the system file explorer.
#[tauri::command]
pub async fn open_save_games_folder() -> AppResult<()> {
    run_blocking(move || {
        let save_games_path = get_save_games_dir()?;

        if !save_games_path.exists() {
            return Err(format!(
                "Save directory does not exist: {}",
                save_games_path.display()
            )
            .into());
        }

        #[cfg(target_os = "windows")]
        {
            let path_str = save_games_path
                .to_str()
                .ok_or("Path contains invalid characters")?
                .replace('/', "\\");
            Command::new("explorer")
                .arg(&path_str)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }

        #[cfg(target_os = "macos")]
        Command::new("open")
            .arg(&save_games_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;

        #[cfg(target_os = "linux")]
        Command::new("xdg-open")
            .arg(&save_games_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;

        Ok(())
    })
    .await
}

/// Handle file operations: toggle/set visibility, read MAINSAVE.
///
/// The visibility mutation is atomic and returns the VERIFIED end state
/// (`isVisible`) so the frontend can reconcile its UI against what is actually
/// on disk instead of trusting an optimistic flip.
#[tauri::command]
pub async fn handle_file(
    file_path: String,
    action: Option<String>,
    _archive_name: Option<String>,
    visible: Option<bool>,
) -> AppResult<String> {
    run_blocking(move || {
        // Handle special request to read MAINSAVE file
        if action.as_deref() == Some("read") && file_path == "MAINSAVE.sav" {
            let visible_saves: Vec<String> = get_visible_saves_set().into_iter().collect();
            let response = json!({
                "success": true,
                "data": {
                    "SingleplayerSaves": visible_saves
                }
            });
            return Ok(response.to_string());
        }

        let file_path = PathBuf::from(&file_path);
        if !file_path.exists() {
            return Err("File does not exist".to_string().into());
        }

        validate_save_games_path(&file_path)?;

        match action.as_deref() {
            Some("toggle_visibility") => {
                let file_name = file_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .ok_or("Invalid filename")?;
                let archive_name = extract_archive_name(file_name);

                // `visible` pins the desired state (idempotent, race-free);
                // None falls back to a relative flip.
                let is_visible = set_save_visibility(archive_name, visible)?;

                tracing::info!(
                    "visibility for '{}' is now {}",
                    archive_name,
                    if is_visible { "visible" } else { "hidden" }
                );

                Ok(json!({"success": true, "isVisible": is_visible}).to_string())
            }
            // Unknown/no action: return the resolved path without mutating
            // anything. (Previously ANY unrecognized action fell through into
            // a visibility toggle.)
            _ => Ok(file_path.to_str().unwrap_or_default().to_string()),
        }
    })
    .await
}

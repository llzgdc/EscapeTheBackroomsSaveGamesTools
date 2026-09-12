//! Save deleter module - Handles file deletion, restoration, and visibility operations
//! Extracted from save_commands.rs for better modularity

use crate::common::{
    add_save_to_mainsave, extract_archive_name, extract_archive_name_from_trash,
    get_save_games_dir, get_visible_saves_set, remove_save_from_mainsave, set_save_visibility,
    validate_save_games_path,
};
use crate::error::{AppError, AppResult};
use serde::Serialize;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

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

/// Sidecar recording the archive's visibility at deletion time:
/// `%TEMP%/etbsavemanager/<name>.sav.trash.meta` (plain JSON, e.g.
/// `{"visible":false}`). Soft-deleting drops the archive from MAINSAVE, which
/// is the only place its visibility lived — without this the restore could not
/// tell a hidden archive from a visible one and always brought it back visible.
/// The ".meta" extension keeps it out of the trash listing, which only picks up
/// ".trash" entries.
fn new_trash_meta_path(original_sav_path: &Path) -> PathBuf {
    let filename = original_sav_path.file_name().unwrap_or_default();
    std::env::temp_dir()
        .join(TRASH_DIR_NAME)
        .join(filename)
        .with_extension("sav.trash.meta")
}

/// Record the pre-deletion visibility for a trashed archive.
///
/// `None` means the caller could not determine it (MAINSAVE unreadable): any
/// stale sidecar is removed so the restore falls back to its legacy behaviour
/// of re-registering the archive as visible.
fn write_trash_meta(original_sav_path: &Path, was_visible: Option<bool>) -> std::io::Result<()> {
    let meta_path = new_trash_meta_path(original_sav_path);
    match was_visible {
        Some(visible) => {
            let payload = serde_json::json!({ "visible": visible }).to_string();
            fs::write(&meta_path, payload)
        }
        None => match fs::remove_file(&meta_path) {
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            other => other,
        },
    }
}

/// Visibility recorded for a trashed archive. `None` when no (readable) sidecar
/// exists — legacy trash entries written by older versions, or a sidecar the OS
/// purged from temp.
fn read_trash_meta_visible(original_sav_path: &Path) -> Option<bool> {
    let content = fs::read_to_string(new_trash_meta_path(original_sav_path)).ok()?;
    serde_json::from_str::<serde_json::Value>(&content)
        .ok()?
        .get("visible")?
        .as_bool()
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
        //
        // The result doubles as the archive's visibility at deletion time:
        // Ok(true) = the name was registered (= visible), Ok(false) = absent
        // (= hidden). It is the last moment that information exists, so persist
        // it for restore_file before the entry is gone.
        let was_visible = match remove_save_from_mainsave(extract_archive_name(filename)) {
            Ok(removed) => Some(removed),
            Err(e) => {
                tracing::warn!(
                    "Failed to clean '{}' from MAINSAVE after trash: {}",
                    filename,
                    e
                );
                None
            }
        };

        if let Err(e) = write_trash_meta(path, was_visible) {
            tracing::warn!(
                "Failed to record visibility for trashed '{}': {} (restore will re-register it as visible)",
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
/// Re-registers the archive in MAINSAVE **with the visibility it had before it
/// was trashed** (see `write_trash_meta`) — a hidden archive used to come back
/// visible after delete→undo / recycle-bin restore. Trash entries without a
/// sidecar (written by older versions) keep the old always-visible behaviour.
///
/// Refuses to overwrite a live archive with the same name unless the caller
/// explicitly passes `overwrite: true` — the trash page uses the structured
/// `DuplicateName` rejection to offer a confirm dialog instead of silently
/// destroying an archive the user re-created after the deletion.
#[tauri::command]
pub async fn restore_file(file_path: String, overwrite: Option<bool>) -> AppResult<()> {
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
        let archive_name = extract_archive_name_from_trash(filename);

        // Visibility the archive had when it was trashed. No sidecar (legacy
        // entry, purged temp, or an unwritable sidecar) ⇒ treat as visible,
        // i.e. exactly the behaviour before the sidecar existed.
        let was_visible = read_trash_meta_visible(path).unwrap_or(true);

        // Validate the restore TARGET before moving any data there — this is
        // the only containment check for the temp-layout branch (the trash
        // file itself lives in %TEMP% by design), so it must run up front;
        // after the move the check cannot undo the write.
        validate_save_games_path(path)?;

        // Conflict guard: fs::rename replaces existing destinations on
        // Windows, so without this check a restore would silently clobber a
        // live archive created under the same name after the deletion.
        if path.exists() && overwrite != Some(true) {
            return Err(AppError::DuplicateName(archive_name.to_string()));
        }

        // Restore (may cross volumes between %TEMP% and SaveGames)
        move_file(&trash_path, path).map_err(|e| format!("Failed to restore file: {}", e))?;

        // Add back to MAINSAVE records. The trash filename ends in ".sav.trash",
        // so the plain ".sav" stripper would register the archive under a name
        // that never matches a listing — leaving restored archives hidden.
        // Best-effort (mirrors soft_delete_file): the rename above already put
        // the .sav back, and failing here would report failure after the fact.
        //
        // Only archives that were visible get re-registered: putting a
        // previously hidden archive into SingleplayerSaves would silently
        // un-hide it in the game's lobby list.
        if was_visible {
            if let Err(e) = add_save_to_mainsave(archive_name) {
                tracing::warn!("Failed to re-register '{}' in MAINSAVE: {}", filename, e);
            }
        } else {
            tracing::info!(
                "Restored '{}' as hidden — it was hidden before it was trashed",
                filename
            );
        }

        // The sidecar has served its purpose; drop it so a later trash entry
        // for the same name cannot inherit this visibility.
        let _ = fs::remove_file(new_trash_meta_path(path));

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

        // Drop the visibility sidecar with it, otherwise the trash folder
        // accumulates orphaned `*.meta` files for archives that are gone for good.
        let _ = fs::remove_file(new_trash_meta_path(path));

        Ok(())
    })
    .await
}

/// Metadata for one trashed archive, as returned by `list_trash_archives`.
#[derive(Serialize)]
pub struct TrashFileMeta {
    pub id: u32,
    /// Archive name parsed from the original filename (fallback: raw stem).
    pub name: String,
    pub difficulty: String,
    pub mode: String,
    /// Last-modified date of the trashed file ("YYYY-MM-DD", local time).
    /// Moving preserves mtime, so this matches the date shown while the
    /// archive was live; the deletion timestamp itself is not tracked.
    pub date: String,
    /// Full path to the `.sav.trash` file (diagnostics).
    pub path: String,
    /// Original `.sav` path in SaveGames. `restore_file` and
    /// `permanent_delete_file` are addressed by THIS path — both recompute
    /// the trash location from it.
    pub original_path: String,
    pub file_size: u64,
}

/// Derive trash metadata from one `.sav.trash` file. Returns None only for
/// unreadable entries (no filename / no metadata) so a single broken file
/// never hides the rest of the bin.
fn build_trash_meta(trash_path: &Path, save_dir: &Path) -> Option<TrashFileMeta> {
    let filename = trash_path.file_name()?.to_str()?;
    // Peel the ".trash" suffix first, then the ".sav" beneath it — so
    // hand-renamed files that only end in ".trash" still yield a clean stem.
    // "X.sav.trash" → "X.sav" → "X".
    let stem = extract_archive_name_from_trash(filename.strip_suffix(".trash").unwrap_or(filename));
    let original_sav = format!("{}.sav", stem);

    let file_size = fs::metadata(trash_path).ok()?.len();
    let date = crate::cli_handlers::get_modified_date(trash_path).unwrap_or_default();

    // Non-conforming names (renamed by hand in the temp folder) stay listed
    // with the raw stem as name and no mode/difficulty — the UI renders them
    // as generic trashed files.
    let parsed = crate::save_utils::parse_save_filename(&original_sav);
    let name = parsed.map(|(_, n, _)| n).unwrap_or(stem).to_string();
    let difficulty = parsed
        .map(|(_, _, d)| crate::save_utils::canonical_difficulty(d))
        .unwrap_or("")
        .to_string();
    let mode = if parsed.is_some() { "Multiplayer" } else { "" }.to_string();

    Some(TrashFileMeta {
        id: 0,
        name,
        difficulty,
        mode,
        date,
        path: trash_path.to_string_lossy().into_owned(),
        original_path: save_dir.join(&original_sav).to_string_lossy().into_owned(),
        file_size,
    })
}

/// List every soft-deleted archive currently sitting in the trash folder.
/// Legacy root-level `.sav.trash` files are migrated into the temp folder
/// first, so this is the single source of truth for the recycle-bin page.
#[tauri::command]
pub async fn list_trash_archives() -> AppResult<Vec<TrashFileMeta>> {
    run_blocking(list_trash_archives_sync).await
}

fn list_trash_archives_sync() -> AppResult<Vec<TrashFileMeta>> {
    let start_time = Instant::now();

    // Pull old-layout trash files into the temp folder before scanning.
    migrate_legacy_trash();

    let trash_dir = std::env::temp_dir().join(TRASH_DIR_NAME);
    let entries = match fs::read_dir(&trash_dir) {
        Ok(entries) => entries,
        // No trash folder yet = empty bin, not an error.
        Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("Failed to read trash folder: {}", e).into()),
    };

    let save_dir = get_save_games_dir()?;

    // (mtime, meta) so the bin lists most-recently-touched first; ids are
    // assigned after sorting to stay stable within one listing.
    let mut items: Vec<(std::time::SystemTime, TrashFileMeta)> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("trash") {
                return None;
            }
            let modified = entry
                .metadata()
                .and_then(|m| m.modified())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            build_trash_meta(&path, &save_dir).map(|meta| (modified, meta))
        })
        .collect();

    items.sort_by_key(|item| std::cmp::Reverse(item.0));

    let results: Vec<TrashFileMeta> = items
        .into_iter()
        .enumerate()
        .map(|(i, (_, mut meta))| {
            meta.id = i as u32;
            meta
        })
        .collect();

    tracing::info!(
        "list_trash_archives: {} items, took {:.2}ms",
        results.len(),
        start_time.elapsed().as_secs_f64() * 1000.0
    );

    Ok(results)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trash_path_maps_to_sav_trash_suffix() {
        let sav = Path::new("C:/saves/MULTIPLAYER_Demo_Easy.sav");
        let trash = new_trash_path(sav);
        assert_eq!(
            trash.file_name().and_then(|n| n.to_str()),
            Some("MULTIPLAYER_Demo_Easy.sav.trash")
        );
    }

    #[test]
    fn trash_path_keeps_dots_inside_archive_names() {
        // with_extension only replaces the final ".sav", so dotted archive
        // names survive the trash rename intact.
        let sav = Path::new("C:/saves/MULTIPLAYER_my.game_Easy.sav");
        let trash = new_trash_path(sav);
        assert_eq!(
            trash.file_name().and_then(|n| n.to_str()),
            Some("MULTIPLAYER_my.game_Easy.sav.trash")
        );
    }

    #[test]
    fn trash_meta_maps_back_to_original_sav_path() {
        let dir = std::env::temp_dir().join("etbsavemanager_test_meta");
        fs::create_dir_all(&dir).unwrap();
        let trash = dir.join("MULTIPLAYER_Demo_Easy.sav.trash");
        fs::write(&trash, b"x").unwrap();

        let save_dir = Path::new("C:/saves");
        let meta = build_trash_meta(&trash, save_dir).expect("meta should build");
        assert_eq!(meta.name, "Demo");
        assert_eq!(meta.difficulty, "Easy");
        assert_eq!(meta.mode, "Multiplayer");
        assert_eq!(
            Path::new(&meta.original_path)
                .file_name()
                .and_then(|n| n.to_str()),
            Some("MULTIPLAYER_Demo_Easy.sav")
        );
        assert_eq!(meta.file_size, 1);

        fs::remove_file(&trash).ok();
    }

    #[test]
    fn trash_meta_falls_back_for_nonconforming_names() {
        let dir = std::env::temp_dir().join("etbsavemanager_test_meta");
        fs::create_dir_all(&dir).unwrap();
        let trash = dir.join("hand_renamed.trash");
        fs::write(&trash, b"x").unwrap();

        let meta = build_trash_meta(&trash, Path::new("C:/saves")).expect("meta should build");
        assert_eq!(meta.name, "hand_renamed");
        assert_eq!(meta.difficulty, "");

        fs::remove_file(&trash).ok();
    }

    #[test]
    fn trash_sidecar_path_is_distinct_from_the_trash_file() {
        let sav = Path::new("C:/saves/MULTIPLAYER_Demo_Easy.sav");
        let trash = new_trash_path(sav);
        let meta = new_trash_meta_path(sav);

        assert_eq!(
            meta.file_name().and_then(|n| n.to_str()),
            Some("MULTIPLAYER_Demo_Easy.sav.trash.meta")
        );
        // "meta", not "trash" — the bin listing filters on that extension.
        assert_eq!(meta.extension().and_then(|e| e.to_str()), Some("meta"));
        assert_ne!(trash, meta);
    }

    #[test]
    fn trash_sidecar_round_trips_visibility() {
        let sav = std::env::temp_dir()
            .join("etbsavemanager_test_sidecar")
            .join("MULTIPLAYER_Sidecar_Easy.sav");
        let meta = new_trash_meta_path(&sav);
        fs::create_dir_all(meta.parent().unwrap()).unwrap();

        write_trash_meta(&sav, Some(false)).unwrap();
        assert_eq!(read_trash_meta_visible(&sav), Some(false));

        write_trash_meta(&sav, Some(true)).unwrap();
        assert_eq!(read_trash_meta_visible(&sav), Some(true));

        // Unknown visibility must clear the sidecar so restore falls back to
        // its legacy always-visible behaviour instead of guessing.
        write_trash_meta(&sav, None).unwrap();
        assert_eq!(read_trash_meta_visible(&sav), None);

        fs::remove_file(&meta).ok();
    }

    #[test]
    fn trash_sidecar_missing_or_corrupt_reads_as_unknown() {
        let sav = std::env::temp_dir()
            .join("etbsavemanager_test_sidecar_bad")
            .join("MULTIPLAYER_Corrupt_Easy.sav");
        let meta = new_trash_meta_path(&sav);
        fs::create_dir_all(meta.parent().unwrap()).unwrap();

        assert_eq!(read_trash_meta_visible(&sav), None);

        fs::write(&meta, b"{ not json").unwrap();
        assert_eq!(read_trash_meta_visible(&sav), None);

        fs::remove_file(&meta).ok();
    }
}

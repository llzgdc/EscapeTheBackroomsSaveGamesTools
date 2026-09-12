//! Save loader module - Handles save file loading operations
//! Extracted from save_commands.rs for better modularity

use crate::cli_handlers;
use std::fs;

/// Health report for the MAINSAVE registry, for UI diagnostics.
///
/// The list loader degrades gracefully when MAINSAVE is unreadable (the list
/// still renders; visibility is treated as hidden and write operations fail).
/// This probe lets the UI explain that state to the user instead of leaving
/// it a silent mystery — and the reported error is what users should quote
/// in feedback so the parser gap can be fixed.
#[derive(Debug, serde::Serialize)]
pub struct MainsaveStatus {
    /// MAINSAVE.sav does not exist (fresh game install) — normal, not an error.
    pub missing: bool,
    /// MAINSAVE exists and parses cleanly.
    pub readable: bool,
    /// Read/parse failure reason when neither `missing` nor `readable`.
    pub error: Option<String>,
}

fn mainsave_status_sync() -> MainsaveStatus {
    let path = match crate::common::get_mainsave_path() {
        Ok(p) => p,
        Err(e) => {
            return MainsaveStatus {
                missing: false,
                readable: false,
                error: Some(e.to_string()),
            };
        }
    };

    if !path.exists() {
        return MainsaveStatus {
            missing: true,
            readable: false,
            error: None,
        };
    }

    match crate::common::read_mainsave_with_retries() {
        Ok(_) => MainsaveStatus {
            missing: false,
            readable: true,
            error: None,
        },
        Err(e) => MainsaveStatus {
            missing: false,
            readable: false,
            error: Some(e.to_string()),
        },
    }
}

/// Diagnostic probe for the MAINSAVE registry (see `MainsaveStatus`).
#[tauri::command]
pub async fn get_mainsave_status() -> MainsaveStatus {
    tokio::task::spawn_blocking(mainsave_status_sync)
        .await
        .unwrap_or_else(|e| MainsaveStatus {
            missing: false,
            readable: false,
            error: Some(format!("Task was cancelled: {}", e)),
        })
}

/// Result of a SINGLEPLAYER_ to MULTIPLAYER_ archive conversion.
///
/// Only the count is consumed today (load_save_metadata logs it), but the
/// struct is kept public with its fields for diagnostics and future callers;
/// silence the dead-code lint explicitly rather than deleting context.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ConversionResult {
    /// Original filename (e.g., "SINGLEPLAYER_ArchiveName_Normal.sav")
    pub original: String,
    /// Converted filename (e.g., "MULTIPLAYER_ArchiveName_Normal.sav")
    pub converted: String,
    /// Whether the conversion was successful
    pub success: bool,
}

/// Convert SINGLEPLAYER_ prefixed filename to MULTIPLAYER_ prefix.
/// Preserves the archive name and difficulty suffix.
///
/// # Examples
///
/// ```text
/// convert_filename("SINGLEPLAYER_ArchiveName_Normal.sav")
/// // Returns: Some("MULTIPLAYER_ArchiveName_Normal.sav")
/// ```
fn convert_filename(original: &str) -> Option<String> {
    if original.starts_with("SINGLEPLAYER_") {
        Some(original.replace("SINGLEPLAYER_", "MULTIPLAYER_"))
    } else {
        None
    }
}

/// Scan SaveGames directory and convert any SINGLEPLAYER_ prefixed files
/// to MULTIPLAYER_ prefix. Returns the list of conversion results.
///
/// This function is called at the start of `load_save_metadata` to ensure
/// all archives are unified under the MULTIPLAYER_ prefix.
///
/// # Arguments
/// * `save_dir` - Path to the SaveGames directory
///
/// # Returns
/// A vector of `ConversionResult` indicating the outcome of each conversion attempt.
///
/// # Error Handling
/// - Individual file conversion errors are logged but do NOT block processing of other files
/// - The function continues processing even if some conversions fail
///
/// # Requirements
/// - Requirements 3.1, 3.2, 3.4, 3.5
pub fn convert_singleplayer_archives(save_dir: &Path) -> Vec<ConversionResult> {
    let mut conversions = Vec::new();

    // Read all entries in the SaveGames directory
    let entries = match fs::read_dir(save_dir) {
        Ok(entries) => entries,
        Err(e) => {
            tracing::error!("Failed to read SaveGames directory: {}", e);
            return conversions;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();

        // Only process .sav files
        if path.extension().and_then(|ext| ext.to_str()) != Some("sav") {
            continue;
        }

        // Get the filename as string
        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name,
            None => continue,
        };

        // Filter files starting with "SINGLEPLAYER_"
        if !filename.starts_with("SINGLEPLAYER_") {
            continue;
        }

        // Convert the filename
        let new_filename = match convert_filename(filename) {
            Some(name) => name,
            None => {
                // This shouldn't happen since we already checked the prefix,
                // but handle it gracefully
                tracing::warn!("convert_filename returned None for: {}", filename);
                continue;
            }
        };

        let new_path = save_dir.join(&new_filename);

        // fs::rename replaces existing destinations on Windows
        // (MOVEFILE_REPLACE_EXISTING), so converting over an already-present
        // MULTIPLAYER_ twin would silently destroy the newer save (e.g. an
        // old SINGLEPLAYER_ backup restored next to it). Skip instead,
        // mirroring plan_renames in gensave_rename.rs.
        if new_path.exists() {
            tracing::warn!("Conversion: target exists — skipping '{}'", filename);
            conversions.push(ConversionResult {
                original: filename.to_string(),
                converted: new_filename,
                success: false,
            });
            continue;
        }

        // Perform the rename operation
        match fs::rename(&path, &new_path) {
            Ok(()) => {
                // Update MAINSAVE.sav's SingleplayerSaves list. The registry
                // stores bare stems (no ".sav"), and a missed/failed update
                // would leave the renamed file permanently unregistered (listed
                // hidden forever) — so treat both as failure and REVERT the file
                // rename, keeping disk and registry consistent. The conversion
                // is retried on the next load.
                let registry_result = crate::common::update_mainsave_archive_name(
                    crate::common::extract_archive_name(filename),
                    crate::common::extract_archive_name(&new_filename),
                );

                match registry_result {
                    Ok(true) => {
                        tracing::info!("Converted archive: {} -> {}", filename, new_filename);
                        conversions.push(ConversionResult {
                            original: filename.to_string(),
                            converted: new_filename,
                            success: true,
                        });
                    }
                    Ok(false) => {
                        tracing::error!(
                            "MAINSAVE has no entry for '{}' — reverting rename",
                            filename
                        );
                        if let Err(revert_err) = fs::rename(&new_path, &path) {
                            tracing::error!(
                                "Failed to revert rename of {}: {}",
                                filename,
                                revert_err
                            );
                        }
                        conversions.push(ConversionResult {
                            original: filename.to_string(),
                            converted: new_filename,
                            success: false,
                        });
                    }
                    Err(e) => {
                        tracing::error!("Failed to update MAINSAVE for {}: {}", filename, e);
                        if let Err(revert_err) = fs::rename(&new_path, &path) {
                            tracing::error!(
                                "Failed to revert rename of {}: {}",
                                filename,
                                revert_err
                            );
                        }
                        conversions.push(ConversionResult {
                            original: filename.to_string(),
                            converted: new_filename,
                            success: false,
                        });
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to convert {}: {}", filename, e);
                conversions.push(ConversionResult {
                    original: filename.to_string(),
                    converted: new_filename,
                    success: false,
                });
                // Continue processing other files (Requirement 3.4)
            }
        }
    }

    conversions
}

use crate::common::extract_archive_name;
use crate::error::AppResult;
use crate::get_file_path;
use crate::save_utils;
use crate::save_utils::{SaveFileDetail, SaveFileInfo, SaveFileMeta};
use rayon::prelude::*;
use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

/// Helper: run a blocking closure via tokio::task::spawn_blocking,
/// mapping the join error into an AppResult. Directory walks and GVAS
/// parses must not occupy a tokio runtime worker — every other module
/// (save_batch, save_converter, save_deleter) wraps this kind of work
/// the same way.
async fn run_blocking<F, T>(f: F) -> AppResult<T>
where
    F: FnOnce() -> AppResult<T> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| format!("Task was cancelled: {}", e))?
}

/// Load all save files with full parsing
#[tauri::command]
pub async fn load_all_saves() -> AppResult<Vec<SaveFileInfo>> {
    run_blocking(load_all_saves_sync).await
}

fn load_all_saves_sync() -> AppResult<Vec<SaveFileInfo>> {
    let start_time = Instant::now();

    // Parallel fetch file list and visible saves set (+ display names;
    // this also backfills missing SaveDisplayNamesLookup entries).

    // Phase 0b: Rename GENSAVE archives to their in-game display names.
    let gensave_count = crate::gensave_rename::sync_gensave_filenames();
    if gensave_count > 0 {
        tracing::info!(
            "Renamed {} GENSAVE archives to display names",
            gensave_count
        );
    }

    // Phase 0c: Move legacy root-level .sav.trash files into the temp folder.
    crate::save_deleter::migrate_legacy_trash();

    let (paths_result, visible_state) = rayon::join(
        get_file_path::list_save_paths,
        crate::common::get_visible_saves_with_display_names,
    );

    let paths = paths_result?;
    let (visible_set, display_names) = visible_state;
    // Case-insensitive lookup: the game can rewrite MAINSAVE entries with a
    // different casing than the on-disk filename (NTFS treats them as the
    // same file), and an exact-match miss would list the archive as hidden.
    let visible_saves: Arc<HashSet<String>> =
        Arc::new(visible_set.iter().map(|s| s.to_lowercase()).collect());
    let path_count = paths.len();

    // Use rayon to process all save files in parallel
    let results: Vec<SaveFileInfo> = paths
        .into_par_iter()
        .enumerate()
        .filter_map(|(i, path)| process_save_file(i, &path, &visible_saves, Some(&display_names)))
        .collect();

    let elapsed = start_time.elapsed();
    tracing::info!(
        "load_all_saves: {}/{} saves, took {:.2}ms",
        results.len(),
        path_count,
        elapsed.as_secs_f64() * 1000.0
    );

    Ok(results)
}

/// Phase 1 of incremental loading: return only filename-derived metadata,
/// no .sav file parsing. Extremely fast even for 1000+ files.
#[tauri::command]
pub async fn load_save_metadata() -> AppResult<Vec<SaveFileMeta>> {
    run_blocking(load_save_metadata_sync).await
}

fn load_save_metadata_sync() -> AppResult<Vec<SaveFileMeta>> {
    let start_time = Instant::now();

    // Phase 0: Convert any SINGLEPLAYER_ archives to MULTIPLAYER_
    let save_dir = crate::common::get_save_games_dir()?;
    let conversions = convert_singleplayer_archives(&save_dir);
    if !conversions.is_empty() {
        tracing::info!("Converted {} singleplayer archives", conversions.len());
    }

    // Phase 0b: Rename GENSAVE archives to their in-game display names.
    let gensave_count = crate::gensave_rename::sync_gensave_filenames();
    if gensave_count > 0 {
        tracing::info!(
            "Renamed {} GENSAVE archives to display names",
            gensave_count
        );
    }

    // Phase 0c: Move legacy root-level .sav.trash files into the temp folder.
    crate::save_deleter::migrate_legacy_trash();

    let (paths_result, visible_state) = rayon::join(
        get_file_path::list_save_paths,
        crate::common::get_visible_saves_with_display_names,
    );

    let paths = paths_result?;
    let (visible_set, display_names) = visible_state;
    // Case-insensitive lookup: the game can rewrite MAINSAVE entries with a
    // different casing than the on-disk filename (NTFS treats them as the
    // same file), and an exact-match miss would list the archive as hidden.
    let visible_lookup: std::collections::HashSet<String> =
        visible_set.iter().map(|s| s.to_lowercase()).collect();

    let results: Vec<SaveFileMeta> = paths
        .into_par_iter()
        .enumerate()
        .filter_map(|(i, path)| {
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            let archive_name = extract_archive_name(file_name);
            let date = cli_handlers::get_modified_date(&path).unwrap_or_default();
            let is_visible = visible_lookup.contains(&archive_name.to_lowercase());

            save_utils::build_save_meta(
                i as u32,
                &path,
                date,
                is_visible,
                display_names.get(archive_name).cloned(),
            )
            .ok()
        })
        .collect();

    let elapsed = start_time.elapsed();
    tracing::info!(
        "load_save_metadata: {} saves, took {:.2}ms",
        results.len(),
        elapsed.as_secs_f64() * 1000.0
    );

    Ok(results)
}

/// Paginated metadata loading for progressive scroll.
/// Returns a page of SaveFileMeta starting from the given `offset`,
/// so the frontend can progressively fetch archives as the user scrolls.
/// Returns SaveFileMetaPage with the total count so the frontend knows when the list ends.
///
/// PRECONDITION — this is a read-only slice of an already-maintained directory.
/// Unlike `load_save_metadata` it deliberately does NOT run the Phase-0
/// maintenance (`convert_singleplayer_archives`, `sync_gensave_filenames`,
/// `migrate_legacy_trash`): that costs one MAINSAVE parse plus three directory
/// passes per call, which is exactly the repeated work pagination exists to
/// avoid. Call `load_save_metadata` (or `load_all_saves`) at least once before
/// paging, otherwise SINGLEPLAYER_/GENSAVE filenames come back unconverted and
/// legacy root-level `.sav.trash` files linger in SaveGames.
///
/// Skipping them cannot fail or corrupt anything: every entry goes through
/// `build_save_meta`, which rejects names that do not match the game's
/// `MODE_name_difficulty.sav` convention, and such entries are dropped — so the
/// worst case is a page that is missing rows the full listing would have
/// converted, never an error or a malformed result.
#[tauri::command]
pub async fn load_save_metadata_page(
    offset: u32,
    limit: u32,
) -> AppResult<save_utils::SaveFileMetaPage> {
    run_blocking(move || load_save_metadata_page_sync(offset, limit)).await
}

fn load_save_metadata_page_sync(
    offset: u32,
    limit: u32,
) -> AppResult<save_utils::SaveFileMetaPage> {
    let start_time = Instant::now();

    // No Phase-0 maintenance here on purpose — see the command's doc comment.
    let (paths_result, visible_state) = rayon::join(
        get_file_path::list_save_paths,
        crate::common::get_visible_saves_with_display_names,
    );

    let paths = paths_result?;
    let (visible_set, display_names) = visible_state;
    // Case-insensitive lookup: the game can rewrite MAINSAVE entries with a
    // different casing than the on-disk filename (NTFS treats them as the
    // same file), and an exact-match miss would list the archive as hidden.
    let visible_lookup: std::collections::HashSet<String> =
        visible_set.iter().map(|s| s.to_lowercase()).collect();
    let total = paths.len() as u32;

    // Clamp to valid range
    let start = offset.min(total) as usize;
    let end = (offset + limit).min(total) as usize;
    let page_paths = &paths[start..end];

    let mut results: Vec<SaveFileMeta> = Vec::with_capacity(page_paths.len());
    for (rel_i, path) in page_paths.iter().enumerate() {
        let global_idx = (start + rel_i) as u32;
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let archive_name = extract_archive_name(file_name);
        let date = cli_handlers::get_modified_date(path).unwrap_or_default();
        let is_visible = visible_lookup.contains(&archive_name.to_lowercase());

        if let Ok(meta) = save_utils::build_save_meta(
            global_idx,
            path,
            date,
            is_visible,
            display_names.get(archive_name).cloned(),
        ) {
            results.push(meta);
        }
    }

    let elapsed = start_time.elapsed();
    tracing::info!(
        "load_save_metadata_page(offset={}, limit={}): {} items of {}, took {:.2}ms",
        offset,
        limit,
        results.len(),
        total,
        elapsed.as_secs_f64() * 1000.0
    );

    Ok(save_utils::SaveFileMetaPage {
        items: results,
        total,
        offset,
        has_more: end < total as usize,
    })
}

/// Phase 2 of incremental loading: parse specific .sav files in batch
/// to get current_level and actual_difficulty.
#[tauri::command]
pub async fn load_save_details_batch(paths: Vec<String>) -> AppResult<Vec<SaveFileDetail>> {
    run_blocking(move || load_save_details_batch_sync(paths)).await
}

fn load_save_details_batch_sync(paths: Vec<String>) -> AppResult<Vec<SaveFileDetail>> {
    let start_time = Instant::now();
    let count = paths.len();

    let results: Vec<SaveFileDetail> = paths
        .into_par_iter()
        .filter_map(|path| {
            let p = Path::new(&path);
            // The paths come from the frontend; like every other command that
            // touches user-supplied paths, refuse anything outside SaveGames
            // so this parser entry point cannot be pointed at arbitrary files.
            if let Err(e) = crate::common::validate_save_games_path(p) {
                tracing::warn!("Skipping path outside SaveGames ({}): {}", e, path);
                return None;
            }
            cli_handlers::parse_sav_file(p).ok().map(|save| {
                let current_level = cli_handlers::extract_current_level(&save);
                let actual_difficulty =
                    cli_handlers::extract_difficulty_label(&save).map(|c| c.into_owned());
                SaveFileDetail {
                    path,
                    current_level,
                    actual_difficulty,
                }
            })
        })
        .collect();

    let elapsed = start_time.elapsed();
    tracing::info!(
        "load_save_details_batch: {}/{}, took {:.2}ms",
        results.len(),
        count,
        elapsed.as_secs_f64() * 1000.0
    );

    Ok(results)
}

/// Process a single save file (optimized version)
#[inline]
fn process_save_file(
    index: usize,
    path: &Path,
    visible_saves: &Arc<HashSet<String>>,
    display_names: Option<&std::collections::HashMap<String, String>>,
) -> Option<SaveFileInfo> {
    let file_name = path.file_name().and_then(|n| n.to_str())?;
    let archive_name = extract_archive_name(file_name);
    let date = cli_handlers::get_modified_date(path).unwrap_or_default();
    let is_visible = visible_saves.contains(&archive_name.to_lowercase());
    let display_name = display_names.and_then(|m| m.get(archive_name).cloned());

    // Skip parsing .sav if not visible (performance optimization)
    if !is_visible {
        return save_utils::build_save_file_info(
            index as u32,
            path,
            date,
            None,
            None,
            is_visible,
            display_name,
        )
        .ok();
    }

    // Parse .sav file for visible saves
    cli_handlers::parse_sav_file(path).ok().and_then(|save| {
        let current_level = cli_handlers::extract_current_level(&save);
        let actual_difficulty =
            cli_handlers::extract_difficulty_label(&save).map(|c| c.into_owned());
        save_utils::build_save_file_info(
            index as u32,
            path,
            date,
            Some(current_level),
            actual_difficulty,
            is_visible,
            display_name,
        )
        .ok()
    })
}

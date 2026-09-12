//! Save utilities module - Save file info building
//! Optimized version: Using phf perfect hash, Cow to reduce allocation

use crate::error::AppResult;
use regex::Regex;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Cached save file name regex
static SAVE_FILE_REGEX: OnceLock<Regex> = OnceLock::new();

#[inline]
fn get_save_file_regex() -> &'static Regex {
    SAVE_FILE_REGEX.get_or_init(|| {
        // Use greedy match (.+) to correctly handle archive names containing underscores
        // Pattern: MULTIPLAYER/SINGLEPLAYER_archiveName_difficulty.sav
        // Difficulty part must be Easy/Normal/Hard/Nightmare or a number
        Regex::new(r"(?i)^(MULTIPLAYER|SINGLEPLAYER)_(.+)_(Easy|Normal|Hard|Nightmare|\d+)\.sav$")
            .expect("Regex compilation failed")
    })
}

/// Cache SaveGames root directory.
///
/// Deliberately NOT filtered on `exists()`: the resolved path is what callers
/// compare `path.parent()` against, so caching "does not exist yet" as `None`
/// would make every archive report `hidden = true` for the rest of the process
/// — including after the game creates the directory (the app is normally
/// launched before the game, and the cached `None` is never recomputed).
static SAVE_GAMES_BASE_DIR: OnceLock<Option<PathBuf>> = OnceLock::new();

#[inline]
fn get_save_games_base_dir() -> Option<&'static PathBuf> {
    SAVE_GAMES_BASE_DIR
        .get_or_init(|| {
            std::env::var("LOCALAPPDATA").ok().map(|local_appdata| {
                PathBuf::from(local_appdata).join("EscapeTheBackrooms\\Saved\\SaveGames")
            })
        })
        .as_ref()
}

#[derive(Serialize)]
pub struct SaveFileInfo {
    pub id: u32,
    pub name: String,
    /// Display name from MAINSAVE's SaveDisplayNamesLookup (what the game
    /// shows in its lobby list). Falls back to the filename-derived name.
    pub display_name: Option<String>,
    pub difficulty: String,
    pub difficulty_class: String,
    pub actual_difficulty: String,
    pub mode: String,
    pub date: String,
    pub current_level: String,
    pub hidden: bool,
    pub path: String,
    pub is_visible: Option<bool>,
}

/// Lightweight save file metadata - derived from filename + filesystem only,
/// no .sav parsing. Used for fast incremental loading.
#[derive(Serialize)]
pub struct SaveFileMeta {
    pub id: u32,
    pub name: String,
    /// Display name from MAINSAVE's SaveDisplayNamesLookup (what the game
    /// shows in its lobby list). Falls back to the filename-derived name.
    pub display_name: Option<String>,
    pub difficulty: String,
    pub mode: String,
    pub date: String,
    pub hidden: bool,
    pub path: String,
    pub is_visible: Option<bool>,
    pub file_size: u64,
}

/// Paginated response for load_save_metadata_page.
/// Returns a slice of metadata items plus the total count so the
/// frontend can show progress and detect the end of the list.
#[derive(Serialize)]
pub struct SaveFileMetaPage {
    pub items: Vec<SaveFileMeta>,
    pub total: u32,
    pub offset: u32,
    pub has_more: bool,
}

/// Detailed info that requires .sav parsing, loaded on demand.
#[derive(Serialize)]
pub struct SaveFileDetail {
    pub path: String,
    pub current_level: String,
    pub actual_difficulty: Option<String>,
}

/// Parsed components of a save filename: `(mode_raw, archive_name, difficulty_raw)`.
pub type SaveFileNameParts<'a> = (&'a str, &'a str, &'a str);

/// Parse a `.sav` filename into its components without building a meta
/// struct. Returns None when the filename does not follow the game's
/// `MODE_name_difficulty.sav` convention.
pub fn parse_save_filename(file_name: &str) -> Option<SaveFileNameParts<'_>> {
    let caps = get_save_file_regex().captures(file_name)?;
    Some((
        caps.get(1)?.as_str(),
        caps.get(2)?.as_str(),
        caps.get(3)?.as_str(),
    ))
}

/// Canonical difficulty label ("Easy"/"Normal"/"Hard"/"Nightmare") for a raw
/// filename token. Unknown tokens fall back to "Normal", like map_difficulty.
#[inline]
pub fn canonical_difficulty(raw: &str) -> &'static str {
    map_difficulty(raw).0
}

/// Difficulty mapping
#[inline]
fn map_difficulty(raw: &str) -> (&'static str, &'static str) {
    match raw.to_lowercase().as_str() {
        "easy" => ("Easy", "Easy"),
        "hard" => ("Hard", "Hard"),
        "nightmare" => ("Nightmare", "Nightmare"),
        _ => ("Normal", "Normal"),
    }
}

/// Map mode to always return "Multiplayer" for unified mode handling.
/// Accepts both SINGLEPLAYER and MULTIPLAYER prefixes for backward compatibility
/// during parsing, but normalizes all modes to "Multiplayer".
#[inline]
fn map_mode(_raw: &str) -> &'static str {
    // Unified mode: always return "Multiplayer"
    // Input validation ensures only valid prefixes reach here
    "Multiplayer"
}

#[allow(dead_code)]
pub fn build_save_info<S: Into<String>>(
    index: u32,
    path: &Path,
    current_level: S,
    actual_difficulty: S,
    date: S,
) -> AppResult<SaveFileInfo> {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    let caps = get_save_file_regex()
        .captures(file_name)
        .ok_or_else(|| format!("Filename format mismatch: {}", file_name))?;

    let mode_raw = caps.get(1).ok_or("Failed to extract game mode")?.as_str();
    let name = caps.get(2).ok_or("Failed to extract save name")?.as_str();
    let difficulty_raw = caps.get(3).ok_or("Failed to extract difficulty")?.as_str();

    let (difficulty, difficulty_class) = map_difficulty(difficulty_raw);
    let hidden = path.parent() != get_save_games_base_dir().map(|p| p.as_path());

    Ok(SaveFileInfo {
        id: index,
        name: name.to_string(),
        display_name: None,
        difficulty: difficulty.to_string(),
        difficulty_class: difficulty_class.to_string(),
        actual_difficulty: actual_difficulty.into(),
        mode: map_mode(mode_raw).to_string(),
        date: date.into(),
        current_level: current_level.into(),
        hidden,
        path: path.to_str().unwrap_or_default().to_string(),
        is_visible: None,
    })
}

/// Build lightweight save metadata from filename + filesystem only.
/// No .sav file opening - very fast even for 1000+ files.
/// `display_name` comes from MAINSAVE's SaveDisplayNamesLookup (already
/// resolved by the caller; None when no mapping exists).
pub fn build_save_meta(
    index: u32,
    path: &Path,
    date: String,
    is_visible: bool,
    display_name: Option<String>,
) -> AppResult<SaveFileMeta> {
    use std::fs;

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    let caps = get_save_file_regex()
        .captures(file_name)
        .ok_or_else(|| format!("Filename format mismatch: {}", file_name))?;

    let mode_raw = caps.get(1).ok_or("Failed to extract game mode")?.as_str();
    let name = caps.get(2).ok_or("Failed to extract save name")?.as_str();
    let difficulty_raw = caps.get(3).ok_or("Failed to extract difficulty")?.as_str();

    let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    Ok(SaveFileMeta {
        id: index,
        name: name.to_string(),
        display_name,
        difficulty: map_difficulty(difficulty_raw).0.to_string(),
        mode: map_mode(mode_raw).to_string(),
        date,
        hidden: path.parent() != get_save_games_base_dir().map(|p| p.as_path()),
        path: path.to_str().unwrap_or_default().to_string(),
        is_visible: Some(is_visible),
        file_size,
    })
}

/// Build SaveFileInfo with optional current_level and actual_difficulty.
/// Used by save_loader for incremental loading where level/difficulty may not be parsed yet.
pub fn build_save_file_info(
    index: u32,
    path: &Path,
    date: String,
    current_level: Option<String>,
    actual_difficulty: Option<String>,
    is_visible: bool,
    display_name: Option<String>,
) -> AppResult<SaveFileInfo> {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    let caps = get_save_file_regex()
        .captures(file_name)
        .ok_or_else(|| format!("Filename format mismatch: {}", file_name))?;

    let mode_raw = caps.get(1).ok_or("Failed to extract game mode")?.as_str();
    let name = caps.get(2).ok_or("Failed to extract save name")?.as_str();
    let difficulty_raw = caps.get(3).ok_or("Failed to extract difficulty")?.as_str();

    let (difficulty, difficulty_class) = map_difficulty(difficulty_raw);
    let hidden = path.parent() != get_save_games_base_dir().map(|p| p.as_path());

    Ok(SaveFileInfo {
        id: index,
        name: name.to_string(),
        display_name,
        difficulty: difficulty.to_string(),
        difficulty_class: difficulty_class.to_string(),
        actual_difficulty: actual_difficulty.unwrap_or_else(|| difficulty.to_string()),
        mode: map_mode(mode_raw).to_string(),
        date,
        current_level: current_level.unwrap_or_default(),
        hidden,
        path: path.to_str().unwrap_or_default().to_string(),
        is_visible: Some(is_visible),
    })
}

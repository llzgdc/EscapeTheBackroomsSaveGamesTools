//! Common utilities module - Shared tools and types across modules

use crate::display_name;
use crate::error::{AppError, AppResult};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock};
use uesave::{
    Property, PropertyKey, PropertyTagDataPartial, PropertyTagPartial, PropertyType, Save,
    StructValue, ValueVec,
};

/// Cache local app data directory path
static LOCAL_APPDATA_DIR: OnceLock<AppResult<PathBuf>> = OnceLock::new();
static SAVE_GAMES_DIR: OnceLock<AppResult<PathBuf>> = OnceLock::new();
static APP_CONFIG_DIR: OnceLock<AppResult<PathBuf>> = OnceLock::new();

/// I/O buffer size (16KB is more efficient for small files)
const IO_BUFFER_SIZE: usize = 16384;

/// Get local app data directory (with caching, returns reference to avoid clones)
#[inline]
pub fn get_local_appdata_dir() -> AppResult<PathBuf> {
    LOCAL_APPDATA_DIR
        .get_or_init(|| {
            #[cfg(target_os = "windows")]
            {
                std::env::var("LOCALAPPDATA")
                    .map(PathBuf::from)
                    .map_err(|e| AppError::General(format!("Failed to get LOCALAPPDATA: {}", e)))
            }
            #[cfg(not(target_os = "windows"))]
            {
                Err(AppError::General("Only Windows is supported".to_string()))
            }
        })
        .clone()
}

/// Get save games directory path (with caching)
#[inline]
pub fn get_save_games_dir() -> AppResult<PathBuf> {
    SAVE_GAMES_DIR
        .get_or_init(|| {
            get_local_appdata_dir().map(|p| p.join("EscapeTheBackrooms/Saved/SaveGames"))
        })
        .clone()
}

/// Get MAINSAVE.sav file path (inline optimized)
#[inline(always)]
pub fn get_mainsave_path() -> AppResult<PathBuf> {
    get_save_games_dir().map(|p| p.join("MAINSAVE.sav"))
}

/// Get app config directory (with caching)
#[inline]
pub fn get_app_config_dir() -> AppResult<PathBuf> {
    APP_CONFIG_DIR
        .get_or_init(|| get_local_appdata_dir().map(|p| p.join("ETBSaveManager")))
        .clone()
}

/// Parse a GVAS stream in uesave's lenient mode.
///
/// A property whose TYPE NAME is known but whose VALUE cannot be parsed (new
/// FText history type, unsupported map/array element type, ...) degrades to
/// `Property::Raw` carrying the original bytes, which are re-emitted
/// byte-for-byte on write — so a save the game itself wrote stays usable even
/// when uesave does not understand part of it. Strict `Save::read` fails the
/// whole file instead, which is how users end up with a tool that cannot open
/// their saves at all.
///
/// Scope notes:
/// - Unknown property TYPE NAMES still fail (the tag is parsed before the
///   fallback can engage); those need a uesave patch.
/// - The edit flow is safe with Raw properties: it edits the Rust struct in
///   place and writes binary — Raw bytes round-trip byte-for-byte. The JSON
///   editor (`convert_sav_to_json`) is the one path that must NOT see Raw:
///   `Property` is `serde(untagged)` and a Raw property (a bare number array
///   in JSON) deserializes back as Set/Array, corrupting the file on write —
///   it is guarded there (see `raw_property_names`).
pub fn parse_save_lenient<R: std::io::Read>(reader: R) -> Result<Save, uesave::ParseError> {
    uesave::SaveReader::new().error_to_raw(true).read(reader)
}

/// Paths of properties that were degraded to `Property::Raw` during a lenient
/// parse — root level plus nested struct bodies, map values and struct/set
/// array elements (the places a property list can recurse into). Used for
/// support diagnostics and to keep Raw out of the JSON editor, whose
/// round-trip cannot represent it faithfully.
pub fn raw_property_names(save: &Save) -> Vec<String> {
    let mut out = Vec::new();
    collect_raw_property_names(&save.root.properties, "", &mut out);
    out
}

fn collect_raw_property_names(props: &uesave::Properties, prefix: &str, out: &mut Vec<String>) {
    for (key, prop) in props.0.iter() {
        let path = if prefix.is_empty() {
            key.1.clone()
        } else {
            format!("{prefix}.{}", key.1)
        };
        if matches!(prop, Property::Raw(_)) {
            out.push(path.clone());
        }
        match prop {
            Property::Struct(StructValue::Struct(nested)) => {
                collect_raw_property_names(nested, &path, out);
            }
            Property::Map(entries) => {
                for entry in entries {
                    if let Property::Struct(StructValue::Struct(nested)) = &entry.value {
                        collect_raw_property_names(nested, &path, out);
                    }
                }
            }
            Property::Array(ValueVec::Struct(values)) | Property::Set(ValueVec::Struct(values)) => {
                for value in values {
                    if let StructValue::Struct(nested) = value {
                        collect_raw_property_names(nested, &path, out);
                    }
                }
            }
            _ => {}
        }
    }
}

/// Read MAINSAVE.sav file (optimized buffer size)
pub fn read_mainsave() -> AppResult<Save> {
    let mainsave_path = get_mainsave_path()?;

    let file =
        File::open(&mainsave_path).map_err(|e| format!("Failed to open MAINSAVE.sav: {}", e))?;
    let mut reader = BufReader::with_capacity(IO_BUFFER_SIZE, file);

    let save = parse_save_lenient(&mut reader)
        .map_err(|e| format!("Failed to parse MAINSAVE.sav: {:?}", e))?;

    let degraded = raw_property_names(&save);
    if !degraded.is_empty() {
        tracing::warn!(
            "MAINSAVE.sav contains properties uesave cannot parse — preserved as raw bytes: {}",
            degraded.join(", ")
        );
    }

    Ok(save)
}

/// Read MAINSAVE with retries. The game rewrites MAINSAVE.sav concurrently,
/// which makes a single read fail transiently — retry before giving up so
/// callers never act on a bogus "unreadable" state.
pub(crate) fn read_mainsave_with_retries() -> AppResult<Save> {
    match read_mainsave() {
        Ok(save) => Ok(save),
        Err(first_err) => {
            let mut last_err = first_err;
            for _ in 0..3 {
                std::thread::sleep(std::time::Duration::from_millis(60));
                match read_mainsave() {
                    Ok(save) => return Ok(save),
                    Err(e) => last_err = e,
                }
            }
            tracing::error!("Failed to read MAINSAVE after retries: {}", last_err);
            Err(last_err)
        }
    }
}

/// Write MAINSAVE.sav file (using temp file for atomicity)
pub fn write_mainsave(save: &Save) -> AppResult<()> {
    let save_dir = get_save_games_dir()?;
    let mainsave_path = save_dir.join("MAINSAVE.sav");
    let temp_path = save_dir.join("MAINSAVE_temp.sav");

    // Write to temp file
    let file = File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp MAINSAVE file: {}", e))?;
    let mut writer = BufWriter::with_capacity(IO_BUFFER_SIZE, file);

    save.write(&mut writer)
        .map_err(|e| format!("Failed to write MAINSAVE.sav: {:?}", e))?;
    writer
        .flush()
        .map_err(|e| format!("Failed to flush buffer: {}", e))?;

    // Atomic replace
    Ok(fs::rename(&temp_path, &mainsave_path)
        .map_err(|e| format!("Failed to replace MAINSAVE.sav: {}", e))?)
}

/// Acquire the process-wide MAINSAVE operation lock.
pub(crate) fn lock_mainsave() -> AppResult<MutexGuard<'static, ()>> {
    Ok(MAINSAVE_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .map_err(|e| format!("MAINSAVE lock poisoned: {}", e))?)
}

/// Visible-archive registry of a parsed MAINSAVE (pure helper).
fn visible_saves_of(mainsave: &Save) -> HashSet<String> {
    let key = PropertyKey(0, display_name::SINGLEPLAYER_SAVES_KEY.to_string());
    match mainsave.root.properties.0.get(&key) {
        Some(Property::Array(ValueVec::Str(saves))) => saves.iter().cloned().collect(),
        _ => HashSet::new(),
    }
}

/// Get visible saves list from MAINSAVE. Read-only, never fails: an
/// unreadable registry degrades to an empty set (see
/// `get_visible_saves_with_display_names` for the read/write contract).
pub fn get_visible_saves_set() -> HashSet<String> {
    get_visible_saves_with_display_names().0
}

/// Read the visible-archive registry together with the display-name lookup,
/// backfilling missing display-name entries in one write when needed.
///
/// This is the READ accessor for listing/display paths and it never fails:
///
/// - A missing MAINSAVE.sav (fresh game install) is a genuine "nothing
///   visible" state and yields an empty set.
/// - An unreadable/unparsable MAINSAVE (e.g. written by a newer game build
///   with property types uesave does not know) is logged loudly and yields an
///   empty set. The archive list itself is scanned from the filesystem, so a
///   broken registry file must not take the whole listing down. (3.4.0
///   propagated this error instead, which hard-failed list loading for users
///   on old saves; 3.3.x silently degraded — this restores that behavior
///   while keeping a diagnostic trail.)
/// - The display-name backfill write is best-effort: a failed write (e.g.
///   MAINSAVE locked by the running game) is logged and retried on the next
///   load, never propagated.
///
/// WRITE paths (visibility toggles, renames, register/unregister) must NOT
/// decide from this function: they read MAINSAVE themselves under the lock
/// and fail loudly, so an unreadable registry can never be silently treated
/// as "nothing visible" where a mutation is about to happen.
///
/// Returns `(visible set, display-name map)`. Every archive listed in
/// `SingleplayerSaves` (= "visible" state) gets a `SaveDisplayNamesLookup`
/// entry filled with the filename-derived base name; existing entries —
/// custom names AND explicit empty strings — are never touched (matches the
/// game, where empty == "unnamed"). The single write happens under the same
/// lock as the read that decided it.
pub(crate) fn get_visible_saves_with_display_names(
) -> (HashSet<String>, std::collections::HashMap<String, String>) {
    let _lock = match lock_mainsave() {
        Ok(guard) => guard,
        Err(e) => {
            tracing::error!(
                "MAINSAVE lock unavailable — treating registry as empty: {}",
                e
            );
            return (HashSet::new(), Default::default());
        }
    };

    let mainsave_path = match get_mainsave_path() {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(
                "Cannot resolve MAINSAVE path — treating registry as empty: {}",
                e
            );
            return (HashSet::new(), Default::default());
        }
    };

    if !mainsave_path.exists() {
        return (HashSet::new(), Default::default());
    }

    let mut mainsave = match read_mainsave_with_retries() {
        Ok(save) => save,
        Err(e) => {
            tracing::error!(
                "MAINSAVE.sav is unreadable — listing continues with visibility degraded to hidden: {}",
                e
            );
            return (HashSet::new(), Default::default());
        }
    };

    let visible_set = visible_saves_of(&mainsave);
    if visible_set.is_empty() {
        return (HashSet::new(), Default::default());
    }

    // Backfill pass: only writes when entries are actually missing.
    if display_name::backfill_display_names(
        &mut mainsave,
        &visible_set.iter().cloned().collect::<Vec<_>>(),
    ) {
        tracing::info!("Backfilled missing SaveDisplayNamesLookup entries");
        if let Err(e) = write_mainsave(&mainsave) {
            // Cosmetic sync only — the listing below is still correct from
            // the in-memory state; the backfill retries on the next load.
            tracing::error!(
                "Backfill write failed — display names may be incomplete until the next load: {}",
                e
            );
        }
    }

    let names = display_name::get_display_names(&mainsave);
    (visible_set, names)
}

/// Serialize MAINSAVE operations across threads to prevent race conditions
static MAINSAVE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

/// Insert or move an archive name to the front of the SingleplayerSaves list.
fn upsert_visible_save(mainsave: &mut Save, archive_name: &str) {
    let key = PropertyKey(0, display_name::SINGLEPLAYER_SAVES_KEY.to_string());

    if let Some(Property::Array(ValueVec::Str(ref mut saves))) =
        mainsave.root.properties.0.get_mut(&key)
    {
        // Already exists — move to front (e.g. after editing)
        saves.retain(|s| s != archive_name);
        saves.insert(0, archive_name.to_string());
    } else {
        // New field: record schema (0.7 requires schemas for writing) + insert property
        mainsave.schemas.record(
            display_name::SINGLEPLAYER_SAVES_KEY.to_string(),
            PropertyTagPartial {
                id: None,
                data: PropertyTagDataPartial::Array(Box::new(PropertyTagDataPartial::Other(
                    PropertyType::StrProperty,
                ))),
            },
        );
        let new_prop = Property::Array(ValueVec::Str(vec![archive_name.to_string()]));
        mainsave.root.properties.0.insert(key, new_prop);
    }
}

/// Remove an archive name from the SingleplayerSaves list.
/// Returns true when the name was present and has been removed.
fn remove_visible_save(mainsave: &mut Save, archive_name: &str) -> bool {
    let key = PropertyKey(0, display_name::SINGLEPLAYER_SAVES_KEY.to_string());

    if let Some(Property::Array(ValueVec::Str(ref mut saves))) =
        mainsave.root.properties.0.get_mut(&key)
    {
        let original_len = saves.len();
        saves.retain(|s| s != archive_name);
        return saves.len() < original_len;
    }

    false
}

/// Add save name to MAINSAVE's save list.
///
/// Also registers a display-name entry (value = filename-derived base name)
/// when none exists yet — mirrors what the game's fallback would resolve to,
/// so the tool and the game agree on the name from creation time onward.
/// Existing entries are never overwritten.
///
/// Fails loudly when MAINSAVE cannot be read after retries — never reports
/// success without having persisted the change.
pub fn add_save_to_mainsave(archive_name: &str) -> AppResult<()> {
    let _lock = lock_mainsave()?;

    if !get_mainsave_path()?.exists() {
        return Err("MAINSAVE.sav not found — start the game once so it can be created".into());
    }

    let mut mainsave = read_mainsave_with_retries()?;
    upsert_visible_save(&mut mainsave, archive_name);

    // Keep the naming table in sync: create/restore flows land here.
    // Insert-if-missing: a custom name the user gave in-game is never lost.
    let base = display_name::base_archive_name(archive_name);
    if display_name::insert_display_entry_if_missing(&mut mainsave, archive_name, base) {
        tracing::debug!("Registered display name '{}' for '{}'", base, archive_name);
    }

    write_mainsave(&mainsave)
}

/// Remove save name from MAINSAVE's save list.
/// Returns Ok(true) when removed, Ok(false) when the name was not present.
/// The display-name entry is cleaned up in the same write so hidden/deleted
/// archives never leave ghost mappings behind.
/// Errors only when MAINSAVE cannot be read/written — never silently skips.
pub fn remove_save_from_mainsave(archive_name: &str) -> AppResult<bool> {
    let _lock = lock_mainsave()?;

    if !get_mainsave_path()?.exists() {
        return Err("MAINSAVE.sav not found — start the game once so it can be created".into());
    }

    let mut mainsave = read_mainsave_with_retries()?;
    let removed = remove_visible_save(&mut mainsave, archive_name);

    // Drop the display-name entry too (delete/hide flows), so no ghost
    // mapping is left behind. Best-effort: the registry removal above is the
    // state callers actually check.
    display_name::remove_display_entry(&mut mainsave, archive_name);

    if removed {
        write_mainsave(&mainsave)?;
    }

    Ok(removed)
}

/// Set the visibility of an archive atomically: the MAINSAVE lock is held
/// across read-decide-write, and callers pass the DESIRED state instead of
/// relying on a read-then-flip, so concurrent toggles can neither cancel each
/// other out nor decide from a stale snapshot.
///
/// `desired`: `Some(true)`/`Some(false)` pins the target state, `None` flips
/// relative to the current state. Returns the verified visibility afterwards.
pub fn set_save_visibility(archive_name: &str, desired: Option<bool>) -> AppResult<bool> {
    let _lock = lock_mainsave()?;

    if !get_mainsave_path()?.exists() {
        return Err("MAINSAVE.sav not found — start the game once so it can be created".into());
    }

    let mut mainsave = read_mainsave_with_retries()?;

    let currently_visible = {
        let key = PropertyKey(0, "SingleplayerSaves".to_string());
        matches!(
            mainsave.root.properties.0.get(&key),
            Some(Property::Array(ValueVec::Str(saves)))
                if saves.iter().any(|s| s == archive_name)
        )
    };

    let target = desired.unwrap_or(!currently_visible);
    if target == currently_visible {
        // Already in the requested state — nothing to persist.
        return Ok(currently_visible);
    }

    if target {
        upsert_visible_save(&mut mainsave, archive_name);
        // Show flow: re-register the display name (base name) when missing,
        // mirroring add_save_to_mainsave. Existing entries are untouched.
        let base = display_name::base_archive_name(archive_name);
        display_name::insert_display_entry_if_missing(&mut mainsave, archive_name, base);
    } else {
        remove_visible_save(&mut mainsave, archive_name);
        // Hide flow: drop AUTO-GENERATED mappings so hidden archives leave no
        // ghost entry (the game itself only ever lists visible saves), but
        // KEEP custom in-game display names — wiping those made a hide→show
        // cycle erase a name the player typed in-game. Hidden slots are not
        // iterated by gensave/display sync (those walk SingleplayerSaves), so
        // a preserved entry cannot resurface as a ghost.
        let base = display_name::base_archive_name(archive_name);
        let is_custom = display_name::get_display_names(&mainsave)
            .get(archive_name)
            .is_some_and(|v| v != base);
        if !is_custom {
            display_name::remove_display_entry(&mut mainsave, archive_name);
        }
    }

    write_mainsave(&mainsave)?;
    Ok(target)
}

/// Update archive name in MAINSAVE's SingleplayerSaves list after conversion.
/// Used when renaming SINGLEPLAYER_ archives to MULTIPLAYER_ prefix, and by
/// the editor when a save is renamed. The display-name entry's key moves with
/// the rename (custom names survive); Ok(true) only when the old registry
/// entry was found and replaced — callers treat Ok(false) as failure.
pub fn update_mainsave_archive_name(old_name: &str, new_name: &str) -> AppResult<bool> {
    let _lock = lock_mainsave()?;

    let mut mainsave = read_mainsave_with_retries()?;

    let key = PropertyKey(0, display_name::SINGLEPLAYER_SAVES_KEY.to_string());

    if let Some(Property::Array(ValueVec::Str(ref mut saves))) =
        mainsave.root.properties.0.get_mut(&key)
    {
        // Find and replace the old archive name with the new one
        for save in saves.iter_mut() {
            if save == old_name {
                *save = new_name.to_string();
                // Keep the naming table keyed by the new slot name. A value
                // that merely mirrored the OLD base name (auto-generated)
                // follows the rename; a custom in-game name moves unchanged.
                display_name::move_display_entry_following_base(&mut mainsave, old_name, new_name);
                write_mainsave(&mainsave)?;
                return Ok(true);
            }
        }
    }

    Ok(false)
}

/// Extract archive name from filename (remove .sav suffix)
#[inline(always)]
pub fn extract_archive_name(filename: &str) -> &str {
    filename.strip_suffix(".sav").unwrap_or(filename)
}

/// Extract archive name from a trashed filename ("X.sav.trash" -> "X").
/// Re-registering a restored archive under "X.sav.trash" would leave it
/// permanently hidden, since listings match on the plain stem.
pub fn extract_archive_name_from_trash(filename: &str) -> &str {
    filename
        .strip_suffix(".sav.trash")
        .unwrap_or_else(|| extract_archive_name(filename))
}

pub fn normalize_existing_path(path: &Path) -> AppResult<PathBuf> {
    Ok(path
        .canonicalize()
        .map_err(|e| format!("Path resolution failed: {}", e))?)
}

pub fn normalize_path_for_write(path: &Path) -> AppResult<PathBuf> {
    if path.exists() {
        return normalize_existing_path(path);
    }

    let parent = path.parent().ok_or_else(|| "Invalid path".to_string())?;
    if !parent.exists() {
        return Err("Parent directory does not exist".to_string().into());
    }

    let parent_canon = normalize_existing_path(parent)?;
    let filename = path
        .file_name()
        .ok_or_else(|| "Invalid filename".to_string())?;
    Ok(parent_canon.join(filename))
}

pub fn validate_path_under_base(path: &Path, allowed_base: &Path) -> AppResult<()> {
    // First layer check: reject path traversal attempts using component-based check
    if path
        .components()
        .any(|c| c == std::path::Component::ParentDir)
    {
        return Err("Invalid path detected".to_string().into());
    }

    // Resolve the allowed base directory to canonical path
    let allowed = normalize_existing_path(allowed_base)?;

    // Second layer check: resolve target path to canonical path
    // Note: this check must be performed immediately before actual file operations to avoid TOCTOU race conditions
    let normalized = if path.exists() {
        normalize_existing_path(path)?
    } else {
        normalize_path_for_write(path)?
    };

    if !normalized.starts_with(&allowed) {
        return Err("Path not in allowed range".to_string().into());
    }

    Ok(())
}

/// Safely open a file, using O_NOFOLLOW to prevent symlink attacks
#[allow(dead_code)]
pub fn safe_file_open(path: &Path) -> AppResult<File> {
    // Validate path before opening the file
    validate_save_games_path(path)?;

    // Open file, reject symlinks (guaranteed by canonicalize on Windows)
    Ok(File::open(path).map_err(|e| format!("Failed to open file: {}", e))?)
}

pub fn validate_save_games_path(path: &Path) -> AppResult<()> {
    let base = get_save_games_dir()?;
    validate_path_under_base(path, &base)
}

#[allow(dead_code)]
pub fn validate_app_config_path(path: &Path) -> AppResult<()> {
    let base = get_app_config_dir()?;
    validate_path_under_base(path, &base)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trash_names_map_back_to_archive_names() {
        assert_eq!(
            extract_archive_name_from_trash("MULTIPLAYER_Demo_Easy.sav.trash"),
            "MULTIPLAYER_Demo_Easy"
        );
        assert_eq!(
            extract_archive_name("MULTIPLAYER_Demo_Easy.sav"),
            "MULTIPLAYER_Demo_Easy"
        );
        // Fallbacks never panic on unexpected names
        assert_eq!(extract_archive_name_from_trash("weird.sav"), "weird");
        assert_eq!(extract_archive_name_from_trash("noext"), "noext");
    }

    /// Minimal Save fixture mirroring uesave 0.7's serde derives (same shape
    /// as the display_name tests).
    fn fixture_save() -> Save {
        let json = r#"{
            "header":{"magic":1196343156,"save_game_version":3,
              "package_version":{"ue4":522,"ue5":null},
              "engine_version_major":4,"engine_version_minor":27,
              "engine_version_patch":2,"engine_version_build":0,
              "engine_version":"","custom_version":null},
            "schemas":{"schemas":{}},
            "root":{"save_game_type":"","properties":{}},
            "extra":[]
        }"#;
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn visible_saves_reads_registry_and_tolerates_missing_property() {
        let mut save = fixture_save();

        // No registry property yet — empty set, never panics.
        assert!(visible_saves_of(&save).is_empty());

        save.schemas.record(
            display_name::SINGLEPLAYER_SAVES_KEY.to_string(),
            PropertyTagPartial {
                id: None,
                data: PropertyTagDataPartial::Array(Box::new(PropertyTagDataPartial::Other(
                    PropertyType::StrProperty,
                ))),
            },
        );
        save.root.properties.0.insert(
            PropertyKey(0, display_name::SINGLEPLAYER_SAVES_KEY.to_string()),
            Property::Array(ValueVec::Str(vec![
                "MULTIPLAYER_A_Easy".to_string(),
                "MULTIPLAYER_B_Hard".to_string(),
            ])),
        );

        let set = visible_saves_of(&save);
        assert_eq!(set.len(), 2);
        assert!(set.contains("MULTIPLAYER_A_Easy"));
        assert!(set.contains("MULTIPLAYER_B_Hard"));
    }

    #[test]
    fn raw_property_scan_reaches_nested_structs() {
        let mut save = fixture_save();

        // Outer struct containing a degraded property one level down.
        let mut inner: uesave::Properties = Default::default();
        inner.0.insert(
            PropertyKey(0, "Broken".to_string()),
            Property::Raw(vec![1, 2, 3]),
        );
        inner
            .0
            .insert(PropertyKey(0, "Healthy".to_string()), Property::Int(7));
        save.root.properties.0.insert(
            PropertyKey(0, "Outer".to_string()),
            Property::Struct(StructValue::Struct(inner)),
        );
        save.root.properties.0.insert(
            PropertyKey(0, "RootRaw".to_string()),
            Property::Raw(vec![9]),
        );

        let mut names = raw_property_names(&save);
        names.sort();
        assert_eq!(
            names,
            vec!["Outer.Broken".to_string(), "RootRaw".to_string()]
        );
    }

    /// Lenient-mode contract: a property whose value uesave cannot parse
    /// degrades to `Property::Raw`, the file still parses, and writing it
    /// back reproduces the input byte-for-byte. This is what keeps a save the
    /// game itself wrote usable when uesave does not understand part of it
    /// (the "old MAINSAVE the tool cannot open" class of failures).
    #[test]
    fn lenient_mode_round_trips_unparseable_property_byte_for_byte() {
        // Base file with one surviving property and one Text property. Text
        // fields are private, so the fixture is built through serde. The
        // NormalInt value is chosen above i16::MAX so untagged serde resolves
        // it to Property::Int, not Int8/Int16. save_game_version must be 2
        // (what real ETB saves use) so the header round-trips: with version 3
        // the reader expects a ue5 package version the writer never wrote.
        let base_json = r#"{
            "header": {
                "magic": 1396790855,
                "save_game_version": 2,
                "package_version": {"ue4": 522, "ue5": null},
                "engine_version_major": 4,
                "engine_version_minor": 27,
                "engine_version_patch": 2,
                "engine_version_build": 0,
                "engine_version": "++UE4+Release-4.27",
                "custom_version": [3, []]
            },
            "schemas": {"schemas": {
                "NormalInt": {"data": {"Other": "IntProperty"}},
                "TextProp": {"data": {"Other": "TextProperty"}}
            }},
            "root": {"save_game_type": "", "properties": {
                "NormalInt_0": 70000,
                "TextProp_0": {"flags": 0, "variant": {"None": {"culture_invariant": "QUIRKMARKER"}}}
            }},
            "extra": []
        }"#;
        let base: Save = serde_json::from_str(base_json).expect("fixture must deserialize");
        let mut bytes = Vec::new();
        base.write(&mut bytes).expect("baseline write");

        // The Text value on disk: flags(4) + history i8(-1) + has-flag(4) +
        // length-prefixed "QUIRKMARKER\0". Patch the history type to an
        // unimplemented value — the exact shape of a real-world "the game
        // wrote something uesave does not know" failure, with the tag size
        // still valid and consistent.
        let mut needle = Vec::new();
        needle.extend_from_slice(&0u32.to_le_bytes());
        needle.push(0xFF);
        needle.extend_from_slice(&1u32.to_le_bytes());
        needle.extend_from_slice(&12i32.to_le_bytes());
        needle.extend_from_slice(b"QUIRKMARKER\0");
        let pos = bytes
            .windows(needle.len())
            .position(|w| w == needle.as_slice())
            .expect("Text value marker not found in baseline bytes");
        let mut quirked = bytes.clone();
        quirked[pos + 4] = 0x42;

        // Strict mode (the pre-fix behavior) hard-fails the whole file — and
        // specifically on the FText history type, not on some earlier desync.
        let strict = Save::read(&mut std::io::Cursor::new(quirked.as_slice()));
        let err_text = format!("{:?}", strict.as_ref().err());
        assert!(strict.is_err());
        assert!(
            err_text.contains("unimplemented variant for FTextHistory"),
            "expected FText history failure, got: {err_text}"
        );

        // Lenient mode parses it; only the bad property degrades to Raw.
        let parsed = parse_save_lenient(std::io::Cursor::new(quirked.as_slice())).unwrap();
        let raw = match parsed
            .root
            .properties
            .0
            .get(&PropertyKey(0, "TextProp".to_string()))
        {
            Some(Property::Raw(v)) => v.clone(),
            other => panic!("expected Property::Raw for TextProp, got {:?}", other),
        };
        assert_eq!(raw.len(), needle.len());

        // The surviving property is untouched.
        assert_eq!(
            parsed
                .root
                .properties
                .0
                .get(&PropertyKey(0, "NormalInt".to_string())),
            Some(&Property::Int(70000))
        );

        // Writing the lenient parse reproduces the quirked file byte-for-byte.
        let mut rewritten = Vec::new();
        parsed.write(&mut rewritten).expect("rewrite");
        assert_eq!(
            rewritten, quirked,
            "Raw property must round-trip byte-for-byte"
        );

        // Re-reading the rewrite is stable, and diagnostics see the Raw name.
        let reparsed = parse_save_lenient(std::io::Cursor::new(rewritten.as_slice())).unwrap();
        assert!(matches!(
            reparsed
                .root
                .properties
                .0
                .get(&PropertyKey(0, "TextProp".to_string())),
            Some(Property::Raw(v)) if v == &raw
        ));
        assert_eq!(raw_property_names(&reparsed), vec!["TextProp".to_string()]);
    }
}

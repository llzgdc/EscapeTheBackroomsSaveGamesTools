//! SaveDisplayNamesLookup helpers — pure functions over a parsed MAINSAVE.
//!
//! The game stores an optional display name per archive in
//! `MAINSAVE.sav → SaveDisplayNamesLookup` (a `Map<Str, Str>` keyed by the
//! full slot name, e.g. `MULTIPLAYER_GENSAVE25_Hard`). When the entry is
//! missing or empty, the game falls back to the base name parsed from the
//! filename (`MULTIPLAYER_{base}_{difficulty}`), so an empty value and an
//! absent entry are equivalent "unnamed" states.
//!
//! All mutation goes through `common.rs`, which owns the MAINSAVE lock and
//! the atomic write; this module never touches the filesystem itself.

use std::collections::HashMap;

use uesave::{Property, PropertyKey};

/// Property name of the display-name map inside MAINSAVE (no `_0` suffix —
/// that is rendered by uesave from the `PropertyKey(0, …)` index).
pub(crate) const DISPLAY_NAMES_KEY: &str = "SaveDisplayNamesLookup";

/// Property name of the visible-archive registry inside MAINSAVE.
pub(crate) const SINGLEPLAYER_SAVES_KEY: &str = "SingleplayerSaves";

#[inline]
pub(crate) fn property_key(name: &str) -> PropertyKey {
    PropertyKey(0, name.to_string())
}

/// Extract the display-name lookup table as a plain HashMap.
///
/// Entries whose key or value is not a string are skipped (defensive: the
/// game only ever writes strings here). A missing property yields an empty
/// map.
pub fn get_display_names(mainsave: &uesave::Save) -> HashMap<String, String> {
    let mut out = HashMap::new();

    if let Some(Property::Map(entries)) = mainsave
        .root
        .properties
        .0
        .get(&property_key(DISPLAY_NAMES_KEY))
    {
        for entry in entries {
            if let (Property::Str(k), Property::Str(v)) = (&entry.key, &entry.value) {
                out.insert(k.clone(), v.clone());
            }
        }
    }

    out
}

/// Base archive name from a full slot name:
/// `MULTIPLAYER_GENSAVE25_Hard` -> `GENSAVE25`.
///
/// Mirrors the game's fallback in `BP_MySaveGame::GetSaveGameDisplayName`:
/// split on `_`, drop the prefix and the difficulty suffix. Returns the whole
/// input when it does not have the expected shape.
pub fn base_archive_name(archive_name: &str) -> &str {
    let Some((_, rest)) = archive_name.split_once('_') else {
        return archive_name;
    };
    // A well-formed slot name is prefix_base_difficulty; only strip a
    // difficulty suffix when something remains after it.
    match rest.rsplit_once('_') {
        Some((base, difficulty)) if !difficulty.is_empty() => base,
        _ => rest,
    }
}

/// Record the uesave schema for the display-name map (required before
/// writing a newly created property with uesave 0.7).
fn record_schema(save: &mut uesave::Save) {
    use uesave::{PropertyTagDataPartial, PropertyTagPartial, PropertyType};

    save.schemas.record(
        DISPLAY_NAMES_KEY.to_string(),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Map {
                key_type: Box::new(PropertyTagDataPartial::Other(PropertyType::StrProperty)),
                value_type: Box::new(PropertyTagDataPartial::Other(PropertyType::StrProperty)),
            },
        },
    );
}

/// Make sure the SaveDisplayNamesLookup map property exists (with schema).
pub(crate) fn ensure_map_property(mainsave: &mut uesave::Save) {
    let key = property_key(DISPLAY_NAMES_KEY);
    if mainsave.root.properties.0.contains_key(&key) {
        return;
    }
    record_schema(mainsave);
    mainsave
        .root
        .properties
        .0
        .insert(key, Property::Map(Vec::new()));
}

/// Ensure every visible archive has a display-name entry.
///
/// Missing entries are filled with the filename-derived base name; entries
/// that already exist (custom names like `dllhook` OR explicit empty strings)
/// are left untouched. Returns whether anything was added.
pub fn backfill_display_names(mainsave: &mut uesave::Save, visible_saves: &[String]) -> bool {
    let existing = get_display_names(mainsave);
    let to_add: Vec<(&String, String)> = visible_saves
        .iter()
        .filter(|name| !existing.contains_key(*name))
        .map(|name| (name, base_archive_name(name).to_string()))
        .collect();

    if to_add.is_empty() {
        return false;
    }

    ensure_map_property(mainsave);
    if let Some(Property::Map(entries)) = mainsave
        .root
        .properties
        .0
        .get_mut(&property_key(DISPLAY_NAMES_KEY))
    {
        for (name, base) in to_add {
            tracing::debug!("Backfilling display name for '{}' -> '{}'", name, base);
            entries.push(uesave::MapEntry {
                key: Property::Str(name.clone()),
                value: Property::Str(base),
            });
        }
    }

    true
}

/// Insert the entry for one archive only when it does not exist yet.
///
/// Existing entries — including explicit empty strings and custom names —
/// are never overwritten. Returns whether an entry was inserted.
pub fn insert_display_entry_if_missing(
    mainsave: &mut uesave::Save,
    archive_name: &str,
    value: &str,
) -> bool {
    if get_display_names(mainsave).contains_key(archive_name) {
        return false;
    }

    ensure_map_property(mainsave);
    if let Some(Property::Map(entries)) = mainsave
        .root
        .properties
        .0
        .get_mut(&property_key(DISPLAY_NAMES_KEY))
    {
        entries.push(uesave::MapEntry {
            key: Property::Str(archive_name.to_string()),
            value: Property::Str(value.to_string()),
        });
        return true;
    }

    false
}

/// Remove the entry for one archive. Returns whether anything was removed.
pub fn remove_display_entry(mainsave: &mut uesave::Save, archive_name: &str) -> bool {
    if let Some(Property::Map(entries)) = mainsave
        .root
        .properties
        .0
        .get_mut(&property_key(DISPLAY_NAMES_KEY))
    {
        let original_len = entries.len();
        entries.retain(|entry| !matches!(&entry.key, Property::Str(k) if k == archive_name));
        return entries.len() < original_len;
    }
    false
}

/// Rename the key of an archive's entry (`old_name` -> `new_name`),
/// preserving its value and position. Any stale entry under the new name is
/// dropped first. Used when editing renames the underlying file so custom
/// names survive. Returns whether anything changed.
pub fn move_display_entry(mainsave: &mut uesave::Save, old_name: &str, new_name: &str) -> bool {
    if old_name == new_name {
        return false;
    }

    let Some(Property::Map(entries)) = mainsave
        .root
        .properties
        .0
        .get_mut(&property_key(DISPLAY_NAMES_KEY))
    else {
        return false;
    };

    let mut changed = false;

    // Drop any stale entry under the new name.
    let original_len = entries.len();
    entries.retain(|entry| !matches!(&entry.key, Property::Str(k) if k == new_name));
    changed |= entries.len() != original_len;

    // Rename old -> new, keeping the value and relative order.
    for entry in entries.iter_mut() {
        if matches!(&entry.key, Property::Str(k) if k == old_name) {
            entry.key = Property::Str(new_name.to_string());
            changed = true;
            break;
        }
    }

    changed
}

/// Move an archive's display entry on a rename (`old_name` -> `new_name`),
/// letting an AUTO-GENERATED value follow the rename.
///
/// `move_display_entry` keeps the value unconditionally, which is right for a
/// custom in-game name but wrong when the value merely mirrors the old base
/// name: the renamed archive would keep displaying its OLD name in the game
/// and the manager list, reading as "the rename never happened". Here a value
/// equal to the old base name is updated to the new base name; any other
/// (truly custom) value is preserved unchanged.
pub fn move_display_entry_following_base(
    mainsave: &mut uesave::Save,
    old_name: &str,
    new_name: &str,
) -> bool {
    if old_name == new_name {
        return false;
    }

    let old_base = base_archive_name(old_name).to_string();
    let new_base = base_archive_name(new_name).to_string();

    let Some(Property::Map(entries)) = mainsave
        .root
        .properties
        .0
        .get_mut(&property_key(DISPLAY_NAMES_KEY))
    else {
        return false;
    };

    let mut changed = false;

    // Drop any stale entry under the new name.
    let original_len = entries.len();
    entries.retain(|entry| !matches!(&entry.key, Property::Str(k) if k == new_name));
    changed |= entries.len() != original_len;

    // Rename old -> new; auto-generated values follow the rename.
    for entry in entries.iter_mut() {
        if matches!(&entry.key, Property::Str(k) if k == old_name) {
            entry.key = Property::Str(new_name.to_string());
            if let Property::Str(value) = &mut entry.value {
                if *value == old_base {
                    *value = new_base;
                }
            }
            changed = true;
            break;
        }
    }

    changed
}

#[cfg(test)]
mod tests {
    use super::*;
    use uesave::Save;

    /// Minimal Save fixture for pure-function tests. uesave::Save has no
    /// Default and Header/PackageVersion fields are private, so build one by
    /// writing a tiny GVAS stream through uesave itself and reading it back.
    fn empty_save() -> Save {
        let mut save = empty_save_via_roundtrip();
        // Start each test from a clean property set; keep schemas.
        save.root.properties = Default::default();
        save
    }

    fn empty_save_via_roundtrip() -> Save {
        // Field names mirror uesave 0.7's Header/Root serde derives
        // (PackageVersion's private fields still serialize as ue4/ue5).
        let json = r#"{
            "header": {
                "magic": 1196343156,
                "save_game_version": 3,
                "package_version": {"ue4": 522, "ue5": null},
                "engine_version_major": 4,
                "engine_version_minor": 27,
                "engine_version_patch": 2,
                "engine_version_build": 0,
                "engine_version": "",
                "custom_version": null
            },
            "schemas": {"schemas": {}},
            "root": {"save_game_type": "", "properties": {}},
            "extra": []
        }"#;
        serde_json::from_str(json).expect("test save fixture must deserialize")
    }

    #[test]
    fn base_name_matches_game_fallback() {
        assert_eq!(base_archive_name("MULTIPLAYER_GENSAVE25_Hard"), "GENSAVE25");
        assert_eq!(base_archive_name("MULTIPLAYER_dllhook_Easy"), "dllhook");
        assert_eq!(base_archive_name("MULTIPLAYER_a_b_c_Hard"), "a_b_c");
        // Degenerate shapes fall back to something sane, never panic.
        assert_eq!(base_archive_name("weird"), "weird");
        // Two segments only: prefix dropped, remainder kept (no recognizable
        // difficulty suffix).
        assert_eq!(base_archive_name("one_two"), "two");
    }

    #[test]
    fn get_missing_map_is_empty() {
        let save = empty_save();
        assert!(get_display_names(&save).is_empty());
    }

    #[test]
    fn backfill_adds_missing_and_keeps_existing() {
        let mut save = empty_save();
        ensure_map_property(&mut save);
        if let Some(Property::Map(entries)) = save
            .root
            .properties
            .0
            .get_mut(&property_key(DISPLAY_NAMES_KEY))
        {
            entries.push(uesave::MapEntry {
                key: Property::Str("MULTIPLAYER_A_Easy".to_string()),
                value: Property::Str("dllhook".to_string()),
            });
        }

        let visible = vec![
            "MULTIPLAYER_A_Easy".to_string(),
            "MULTIPLAYER_GENSAVE25_Hard".to_string(),
        ];
        assert!(backfill_display_names(&mut save, &visible));

        let names = get_display_names(&save);
        // Existing custom name untouched.
        assert_eq!(names.get("MULTIPLAYER_A_Easy").unwrap(), "dllhook");
        // Missing entry backfilled from filename base name.
        assert_eq!(
            names.get("MULTIPLAYER_GENSAVE25_Hard").unwrap(),
            "GENSAVE25"
        );

        // Second run is a no-op.
        assert!(!backfill_display_names(&mut save, &visible));
    }

    #[test]
    fn insert_if_missing_never_overwrites() {
        let mut save = empty_save();

        // First insert lands.
        assert!(insert_display_entry_if_missing(
            &mut save,
            "MULTIPLAYER_X_Hard",
            "myname"
        ));
        assert_eq!(
            get_display_names(&save).get("MULTIPLAYER_X_Hard").unwrap(),
            "myname"
        );

        // Second insert with a different value is a no-op (custom names are
        // never overwritten).
        assert!(!insert_display_entry_if_missing(
            &mut save,
            "MULTIPLAYER_X_Hard",
            "other"
        ));
        assert_eq!(
            get_display_names(&save).get("MULTIPLAYER_X_Hard").unwrap(),
            "myname"
        );

        // Removing a non-existent entry reports no change; removing the real
        // one reports the removal.
        assert!(!remove_display_entry(&mut save, "MULTIPLAYER_Y_Hard"));
        assert!(remove_display_entry(&mut save, "MULTIPLAYER_X_Hard"));
        assert!(get_display_names(&save).is_empty());
    }

    #[test]
    fn move_renames_key_preserving_value() {
        let mut save = empty_save();
        assert!(insert_display_entry_if_missing(
            &mut save,
            "MULTIPLAYER_OLD_Hard",
            "keepme"
        ));

        assert!(move_display_entry(
            &mut save,
            "MULTIPLAYER_OLD_Hard",
            "MULTIPLAYER_NEW_Hard"
        ));
        let names = get_display_names(&save);
        assert!(!names.contains_key("MULTIPLAYER_OLD_Hard"));
        assert_eq!(names.get("MULTIPLAYER_NEW_Hard").unwrap(), "keepme");

        // No-op move reports no change.
        assert!(!move_display_entry(
            &mut save,
            "MULTIPLAYER_NEW_Hard",
            "MULTIPLAYER_NEW_Hard"
        ));
        // Old entry is gone after the move.
        assert!(!names.contains_key("MULTIPLAYER_OLD_Hard"));
    }

    #[test]
    fn move_following_base_updates_auto_generated_value() {
        let mut save = empty_save();
        // Value mirrors the old base name — auto-generated, not custom.
        assert!(insert_display_entry_if_missing(
            &mut save,
            "MULTIPLAYER_12315_Normal",
            "12315"
        ));

        assert!(move_display_entry_following_base(
            &mut save,
            "MULTIPLAYER_12315_Normal",
            "MULTIPLAYER_123 (2)_Normal"
        ));
        let names = get_display_names(&save);
        assert!(!names.contains_key("MULTIPLAYER_12315_Normal"));
        // The value followed the rename — the list/game shows the NEW name.
        assert_eq!(
            names.get("MULTIPLAYER_123 (2)_Normal").unwrap(),
            "123 (2)"
        );
    }

    #[test]
    fn move_following_base_preserves_custom_value() {
        let mut save = empty_save();
        // Custom in-game name ("llll" displayed as "123" in the game).
        assert!(insert_display_entry_if_missing(
            &mut save,
            "MULTIPLAYER_llll_Normal",
            "123"
        ));

        assert!(move_display_entry_following_base(
            &mut save,
            "MULTIPLAYER_llll_Normal",
            "MULTIPLAYER_renamed_Normal"
        ));
        // Custom value survives the rename untouched.
        assert_eq!(
            get_display_names(&save)
                .get("MULTIPLAYER_renamed_Normal")
                .unwrap(),
            "123"
        );
    }

    #[test]
    fn move_following_base_drops_stale_new_key_entry() {
        let mut save = empty_save();
        assert!(insert_display_entry_if_missing(
            &mut save,
            "MULTIPLAYER_OLD_Hard",
            "OLD"
        ));
        // A stale leftover under the target key gets dropped by the move.
        assert!(insert_display_entry_if_missing(
            &mut save,
            "MULTIPLAYER_NEW_Hard",
            "ghost"
        ));

        assert!(move_display_entry_following_base(
            &mut save,
            "MULTIPLAYER_OLD_Hard",
            "MULTIPLAYER_NEW_Hard"
        ));
        let names = get_display_names(&save);
        assert_eq!(names.get("MULTIPLAYER_NEW_Hard").unwrap(), "NEW");
    }

    #[test]
    fn move_following_base_no_op_reports_no_change() {
        let mut save = empty_save();
        assert!(!move_display_entry_following_base(
            &mut save,
            "MULTIPLAYER_A_Hard",
            "MULTIPLAYER_B_Hard"
        ));
    }
}

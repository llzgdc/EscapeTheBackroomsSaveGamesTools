use crate::common::{
    add_save_to_mainsave, extract_archive_name, get_local_appdata_dir, get_mainsave_path,
};
use crate::error::AppResult;
use crate::save_shared;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::fs;
use std::io::{BufWriter, Write};
use uesave::{
    FGuid, Properties, Property, PropertyKey, PropertyTagDataPartial, PropertyTagPartial,
    PropertyType, Save, StructType, StructValue, ValueVec,
};

/// Main storyline level data: (DisplayName, LevelName)
/// Arranged by game progress order - first 17 of endingLevelsData[0]
pub(crate) const MAIN_STORYLINE_LEVELS: &[(&str, &str)] = &[
    ("Level 0", "Level0"),
    ("Habitable Zone", "TopFloor"),
    ("Habitable Zone", "MiddleFloor"),
    ("Habitable Zone", "GarageLevel2"),
    ("Habitable Zone", "BottomFloor"),
    ("The Hub", "TheHub"),
    ("Pipe Dreams", "Pipes1"),
    ("Electrical Station", "ElectricalStation"),
    ("Abandoned Office", "Office"),
    ("Terror Hotel", "Hotel"),
    ("Terror Hotel", "Floor3"),
    ("Terror Hotel", "BoilerRoom"),
    ("Pipe Dreams", "Pipes2"),
    ("Level Fun", "LevelFun"),
    ("The Poolrooms", "Poolrooms"),
    ("Run for your Life!", "LevelRun"),
    ("The End", "TheEnd"),
];

/// All level data (complete list from endingLevelsData[0]): (DisplayName, LevelName)
/// Used for generating all levels in side storyline
pub const ALL_LEVELS: &[(&str, &str)] = &[
    ("Level 0", "Level0"),
    ("Habitable Zone", "TopFloor"),
    ("Habitable Zone", "MiddleFloor"),
    ("Habitable Zone", "GarageLevel2"),
    ("Habitable Zone", "BottomFloor"),
    ("The Hub", "TheHub"),
    ("Pipe Dreams", "Pipes1"),
    ("Electrical Station", "ElectricalStation"),
    ("Abandoned Office", "Office"),
    ("Terror Hotel", "Hotel"),
    ("Terror Hotel", "Floor3"),
    ("Terror Hotel", "BoilerRoom"),
    ("Pipe Dreams", "Pipes2"),
    ("Level Fun", "LevelFun"),
    ("The Poolrooms", "Poolrooms"),
    ("Run for your Life!", "LevelRun"),
    ("The End", "TheEnd"),
    ("Level 94", "Level94"),
    ("Level 94", "AnimatedKingdom"),
    ("Lights Out", "LightsOut"),
    ("Thalassophobia", "OceanMap"),
    ("Cave System", "CaveLevel"),
    ("Level 188", "Level05"),
    ("Level 9", "Level9"),
    ("Level 9", "AbandonedBase"),
    ("Level 10", "Level10"),
    ("Level 3999", "Level3999"),
    ("Level 0.2", "Level07"),
    ("Snackrooms", "Snackrooms"),
    ("Level !~!", "LevelDash"),
    ("Level 188 Expanded", "Level188_Expanded"),
    ("The Poolrooms Expanded", "Poolrooms_Expanded"),
    ("The Poolrooms Expanded", "WaterPark_Level01_P"),
    ("The Poolrooms Expanded", "WaterPark_Level02_P"),
    ("The Poolrooms Expanded", "WaterPark_Level03_P"),
    ("Level Fun Expanded", "LevelFun_Expanded"),
    ("Level Fun Expanded", "Zone1_Modified"),
    ("Level Fun Expanded", "Zone2_Modified"),
    ("Level Fun Expanded", "Zone3_Baked"),
    ("Level Fun Expanded", "Zone4"),
    ("Level 52", "Level52"),
    ("Level 55.1", "TunnelLevel"),
    ("LP_LevelPlasticMariana", "LP_LevelPlasticMariana"),
];

#[derive(Debug, Deserialize, Serialize)]
pub struct SaveData {
    pub archive_name: String,
    pub level: String,
    pub game_mode: String,
    pub difficulty: String,
    pub actual_difficulty: String,
    pub players: Vec<PlayerData>,
    pub basic_archive: JsonValue,
    pub main_ending: bool,
    pub meg_unlocked: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PlayerData {
    pub steam_id: String,
    pub inventory: Vec<i32>,
    pub sanity: f32,
}

pub fn create_new_save(save_data: SaveData) -> AppResult<()> {
    tracing::info!("Received new save request:");
    tracing::info!("  Archive name: {}", save_data.archive_name);
    tracing::info!("  Level: {}", save_data.level);
    tracing::info!("  Game mode: {}", save_data.game_mode);
    tracing::info!("  Archive difficulty: {}", save_data.difficulty);
    tracing::info!("  Actual difficulty: {}", save_data.actual_difficulty);
    tracing::info!("  Player count: {}", save_data.players.len());
    tracing::info!("  Is main ending: {}", !save_data.main_ending);

    // Validate archive_name: must not be empty, only safe filename characters
    if save_data.archive_name.trim().is_empty() {
        return Err("Save name cannot be empty".to_string().into());
    }
    if !save_data
        .archive_name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == ' ' || c == '_' || c == '(' || c == ')')
    {
        return Err(
            "Save name can only contain letters, numbers, hyphens, underscores, parentheses, and spaces"
                .to_string()
                .into(),
        );
    }

    // Sanitize difficulty: only allow alphanumeric characters
    let sanitized_difficulty: String = save_data
        .difficulty
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect();
    if sanitized_difficulty.is_empty() {
        return Err(
            "Difficulty must contain at least one alphanumeric character"
                .to_string()
                .into(),
        );
    }

    // Process level mapping
    let processed_level = match save_data.level.as_str() {
        "Pipes1" | "Pipes2" => "Pipes".to_string(),
        _ => save_data.level.clone(),
    };

    // Build target path
    let app_data_dir = get_local_appdata_dir()?;
    let save_dir = app_data_dir.join("EscapeTheBackrooms/Saved/SaveGames");

    if !save_dir.exists() {
        fs::create_dir_all(&save_dir)
            .map_err(|e| format!("Failed to create save directory: {}", e))?;
    }

    let file_name = format!(
        "MULTIPLAYER_{}_{}.sav",
        save_data.archive_name, sanitized_difficulty
    );
    let save_path = save_dir.join(&file_name);

    // The write below replaces existing targets silently. Refuse to overwrite
    // an existing archive — same guard as edit_save_file's rename — otherwise
    // creating an archive whose name+difficulty collides with one on disk
    // destroys the old save with no warning.
    if save_path.exists() {
        return Err(format!(
            "An archive named '{}' already exists. Please choose a different name.",
            save_data.archive_name
        )
        .into());
    }

    tracing::info!("Target save path: {:?}", save_path);

    // Construct Save object from BasicArchive.json
    // NOTE (uesave 0.7): JSON must contain "schemas" before "root" (hand-written Deserialize)
    let mut save: Save = serde_json::from_value(save_data.basic_archive.clone()).map_err(|e| {
        format!(
            "Failed to convert JSON to Save: {:?}, JSON content: {}",
            e, save_data.basic_archive
        )
    })?;

    // Modify CurrentLevel field
    if processed_level == "Level0" {
        remove_current_level(&mut save);
    } else {
        save_shared::modify_current_level(&mut save, processed_level.clone());
    }

    // Handle Pipes UnlockedFun_0 field
    handle_pipes_unlocked_fun(&mut save, &save_data.level);

    // Update difficulty settings
    save_shared::update_difficulty(&mut save, &save_data.actual_difficulty);

    // Handle MainEnding parameter
    update_bool_property(&mut save, "HasCompletedMainEnding", save_data.main_ending)?;

    // Handle MEG status
    update_meg_status(&mut save, save_data.meg_unlocked)?;

    // Generate LevelsCompleted_0 data
    // main_ending being true means side story (non-main ending) is selected
    generate_levels_completed(&mut save, &save_data.level, save_data.main_ending)?;

    // Update player data
    if !save_data.players.is_empty() {
        update_player_data(&mut save, &save_data.players)?;
    } else {
        // No players provided: remove template PlayerData to avoid ghost player records
        let player_data_key = PropertyKey(0, "PlayerData".to_string());
        if save
            .root
            .properties
            .0
            .shift_remove(&player_data_key)
            .is_some()
        {
            tracing::info!("Removed template PlayerData (no players provided)");
        }
    }

    // Refuse early when there is no MAINSAVE registry: creating the .sav without
    // being able to register it would leave an invisible orphan file on disk.
    if !get_mainsave_path()?.exists() {
        return Err("MAINSAVE.sav not found — start the game once so it can be created".into());
    }

    // Write as .sav file
    let file =
        fs::File::create(&save_path).map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut writer = BufWriter::new(file);
    save.write(&mut writer)
        .map_err(|e| format!("Failed to write save: {:?}", e))?;
    writer
        .flush()
        .map_err(|e| format!("Failed to flush buffer: {}", e))?;

    tracing::info!("Save successfully saved to: {:?}", save_path);

    // Update MAINSAVE.sav file
    let archive_name = extract_archive_name(&file_name);
    add_save_to_mainsave(archive_name)?;

    Ok(())
}

/// Delete the entire CurrentLevel_0 field
pub fn remove_current_level(save: &mut Save) -> bool {
    let key = PropertyKey(0, "CurrentLevel".to_string());

    if save.root.properties.0.shift_remove(&key).is_some() {
        tracing::info!("CurrentLevel_0 has been completely removed");
        true
    } else {
        tracing::warn!("CurrentLevel_0 field not found");
        false
    }
}

/// Handle Pipes UnlockedFun_0 field
fn handle_pipes_unlocked_fun(save: &mut Save, level: &str) {
    let unlocked_fun_key = PropertyKey(0, "UnlockedFun".to_string());

    match level {
        "Pipes1" => {
            if save
                .root
                .properties
                .0
                .shift_remove(&unlocked_fun_key)
                .is_some()
            {
                tracing::info!("Deleted UnlockedFun_0 field (Pipes1)");
            }
        }
        "Pipes2" => {
            save_shared::record_root_schema(
                save,
                "UnlockedFun",
                PropertyTagPartial {
                    id: None,
                    data: PropertyTagDataPartial::Other(PropertyType::BoolProperty),
                },
            );
            save.root
                .properties
                .0
                .insert(unlocked_fun_key, Property::Bool(true));
            tracing::info!("Created UnlockedFun_0 field with value true (Pipes2)");
        }
        _ => {}
    }
}

/// Update boolean property
pub(crate) fn update_bool_property(save: &mut Save, name: &str, value: bool) -> AppResult<()> {
    save_shared::record_root_schema(
        save,
        name,
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Other(PropertyType::BoolProperty),
        },
    );
    save.root
        .properties
        .0
        .insert(PropertyKey(0, name.to_string()), Property::Bool(value));

    tracing::info!("Set {} field to {}", name, value);
    Ok(())
}

/// Update MEG status field
pub(crate) fn update_meg_status(save: &mut Save, meg_unlocked: bool) -> AppResult<()> {
    let meg_fields = ["IsMEGUnlocked", "IsMEGPowerOn", "IsMEGSecurityUnlocked"];

    for field in &meg_fields {
        update_bool_property(save, field, meg_unlocked)?;
    }

    if meg_unlocked {
        tracing::info!("MEG related fields set to true (MEG unlocked)");
    } else {
        tracing::info!("MEG related fields set to false (MEG locked)");
    }

    Ok(())
}

/// Record schemas for all fields inside a LevelsCompleted struct element.
/// In uesave 0.7 the schema path is "LevelsCompleted.<field>".
fn record_level_struct_schemas(save: &mut Save) {
    let parent = "LevelsCompleted";
    save.schemas.record(
        format!("{}.{}", parent, save_shared::DISPLAY_NAME_FIELD),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Other(PropertyType::StrProperty),
        },
    );
    save.schemas.record(
        format!("{}.{}", parent, save_shared::HAS_COMPLETED_FIELD),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Other(PropertyType::BoolProperty),
        },
    );
    save.schemas.record(
        format!("{}.{}", parent, save_shared::HAS_UNLOCKED_HUB_FIELD),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Other(PropertyType::BoolProperty),
        },
    );
    save.schemas.record(
        format!("{}.{}", parent, save_shared::LEVEL_NAME_FIELD),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Other(PropertyType::NameProperty),
        },
    );
    save.schemas.record(
        format!("{}.{}", parent, save_shared::TIME_FIELD),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Other(PropertyType::FloatProperty),
        },
    );
    // World struct + nested Items/SanityLevel schemas
    save_shared::create_default_world_property(save, parent);
}

/// Generate LevelsCompleted_0 data based on selected level
///
/// Logic:
/// - If is_side_storyline is false (main ending), generate records based on level position
///   - 1st to (n-1)th: HasCompleted=true, HasUnlockedHub=true
///   - nth (current level): HasCompleted=false, HasUnlockedHub=false
/// - If is_side_storyline is true (side ending), generate all levels, all set as completed
fn generate_levels_completed(
    save: &mut Save,
    level: &str,
    is_side_storyline: bool,
) -> AppResult<()> {
    tracing::info!(
        "Generating LevelsCompleted_0 data, target level: {}, side storyline: {}",
        level,
        is_side_storyline
    );

    let levels_to_generate: Vec<(&str, &str, bool)>; // (display_name, level_name, is_completed)

    if is_side_storyline {
        // Side storyline: generate all levels, all set as completed
        tracing::info!(
            "Side storyline detected, generating all {} levels, all set as completed",
            ALL_LEVELS.len()
        );
        levels_to_generate = ALL_LEVELS
            .iter()
            .map(|(display, level_name)| (*display, *level_name, true))
            .collect();
    } else {
        // Main storyline: generate records based on level position
        // Find the level position in the main storyline (only check first 17 main storyline levels)
        let main_index = MAIN_STORYLINE_LEVELS.iter().position(|(_, l)| *l == level);

        if let Some(index) = main_index {
            // Main storyline level: generate from 1st to selected level
            tracing::info!("Main storyline level detected, index: {}", index);
            levels_to_generate = MAIN_STORYLINE_LEVELS[..=index]
                .iter()
                .enumerate()
                .map(|(i, (display, level_name))| {
                    let is_completed = i < index; // Last one (current level) is not completed
                    (*display, *level_name, is_completed)
                })
                .collect();
        } else {
            // In main ending mode, a non-main storyline level was selected (e.g., side level)
            // Find position in ALL_LEVELS
            let all_index = ALL_LEVELS.iter().position(|(_, l)| *l == level);

            if let Some(index) = all_index {
                tracing::info!(
                    "Non-main storyline level detected (main ending mode), index: {}",
                    index
                );
                levels_to_generate = ALL_LEVELS[..=index]
                    .iter()
                    .enumerate()
                    .map(|(i, (display, level_name))| {
                        let is_completed = i < index; // Last one (current level) is not completed
                        (*display, *level_name, is_completed)
                    })
                    .collect();
            } else {
                // Unknown level, only generate Level0
                tracing::warn!("Unknown level {}, using default configuration", level);
                levels_to_generate = vec![("Level 0", "Level0", false)];
            }
        }
    }

    tracing::info!("Will generate {} level records", levels_to_generate.len());

    // Get existing LevelsCompleted_0 as template
    let levels_completed_key = PropertyKey(0, "LevelsCompleted".to_string());

    // Get template structure info from existing schemas (0.7: struct_type/id live in schemas)
    let template_struct = save
        .schemas
        .get("LevelsCompleted")
        .and_then(|tag| match &tag.data {
            PropertyTagDataPartial::Array(inner) => match &**inner {
                PropertyTagDataPartial::Struct { struct_type, id } => {
                    Some((struct_type.clone(), *id))
                }
                _ => None,
            },
            _ => None,
        });

    let (struct_type, struct_id) =
        template_struct.ok_or("Failed to get LevelsCompleted template structure")?;

    // Generate new level records
    let mut new_values: Vec<StructValue> = Vec::new();

    // Record schemas for the struct fields (used both for new save creation and write-back)
    record_level_struct_schemas(save);

    for (display_name, level_name, is_completed) in levels_to_generate {
        let mut level_props = Properties::default();

        // DisplayName
        level_props.0.insert(
            PropertyKey(0, save_shared::DISPLAY_NAME_FIELD.to_string()),
            Property::Str(display_name.to_string()),
        );

        // HasCompleted
        level_props.0.insert(
            PropertyKey(0, save_shared::HAS_COMPLETED_FIELD.to_string()),
            Property::Bool(is_completed),
        );

        // HasUnlockedHub
        level_props.0.insert(
            PropertyKey(0, save_shared::HAS_UNLOCKED_HUB_FIELD.to_string()),
            Property::Bool(is_completed),
        );

        // LevelName
        level_props.0.insert(
            PropertyKey(0, save_shared::LEVEL_NAME_FIELD.to_string()),
            Property::Name(level_name.to_string()),
        );

        // Time
        level_props.0.insert(
            PropertyKey(0, save_shared::TIME_FIELD.to_string()),
            Property::Float(uesave::Float(-1.0)),
        );

        // World - Create default World structure
        let world_prop = save_shared::create_default_world_property(save, "LevelsCompleted");
        level_props.0.insert(
            PropertyKey(0, save_shared::WORLD_FIELD.to_string()),
            world_prop,
        );

        new_values.push(StructValue::Struct(level_props));
        tracing::info!(
            "Added level: {} ({}) - Completed: {}",
            display_name,
            level_name,
            is_completed
        );
    }

    // Create new LevelsCompleted_0 property
    // 0.7: struct id is FGuid (not Option<Uuid>)
    save.schemas.record(
        "LevelsCompleted".to_string(),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Array(Box::new(PropertyTagDataPartial::Struct {
                struct_type: struct_type.clone(),
                id: struct_id,
            })),
        },
    );
    let new_levels_completed = Property::Array(ValueVec::Struct(new_values));

    // Replace the original LevelsCompleted_0
    save.root
        .properties
        .0
        .insert(levels_completed_key, new_levels_completed);

    tracing::info!("LevelsCompleted_0 has been updated");
    Ok(())
}

/// Update player data
fn update_player_data(save: &mut Save, players: &[PlayerData]) -> AppResult<()> {
    if players.is_empty() {
        return Ok(());
    }

    tracing::info!("Processing player data...");

    let map_entries: Vec<_> = players
        .iter()
        .map(|player| {
            // Create inventory items list
            let mut inventory_items: Vec<String> = player
                .inventory
                .iter()
                .take(save_shared::INVENTORY_SLOTS)
                .map(|&id| save_shared::map_item_id_to_name(id).to_string())
                .collect();

            inventory_items.resize(save_shared::INVENTORY_SLOTS, "None".to_string());

            // Create player struct properties
            let mut player_struct_properties = Properties::default();

            // Sanity property
            let sanity_prop = Property::Float(uesave::Float(player.sanity.clamp(0.0, 100.0)));

            // Inventory property
            let inventory_prop = Property::Array(ValueVec::Name(inventory_items));

            player_struct_properties.0.insert(
                PropertyKey(0, save_shared::SANITY_PROP_NAME.to_string()),
                sanity_prop,
            );
            player_struct_properties.0.insert(
                PropertyKey(0, save_shared::INVENTORY_PROP_NAME.to_string()),
                inventory_prop,
            );

            // PlayerData map key: the game only binds player data to
            // `<steam id>_+_|<EOS PUID>` keys. A bare steam id yields an entry the
            // game ignores (empty backpack, sanity reset to 100), so resolve the real
            // EOS-suffixed key from the cache or an existing save; keep the raw id
            // only when no reusable PUID exists anywhere.
            let resolved_key = crate::save_batch::resolve_player_full_key(&player.steam_id)
                .unwrap_or_else(|| player.steam_id.clone());

            uesave::MapEntry {
                key: Property::Str(resolved_key),
                value: Property::Struct(StructValue::Struct(player_struct_properties)),
            }
        })
        .collect();

    // Record schemas for PlayerData map and its nested struct fields
    save.schemas.record(
        "PlayerData".to_string(),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Map {
                key_type: Box::new(PropertyTagDataPartial::Other(PropertyType::StrProperty)),
                value_type: Box::new(PropertyTagDataPartial::Struct {
                    struct_type: StructType::Struct(None),
                    id: FGuid::nil(),
                }),
            },
        },
    );
    save.schemas.record(
        format!("PlayerData.{}", save_shared::SANITY_PROP_NAME),
        PropertyTagPartial {
            id: None,
            data: PropertyTagDataPartial::Other(PropertyType::FloatProperty),
        },
    );
    save.schemas.record(
        format!("PlayerData.{}", save_shared::INVENTORY_PROP_NAME),
        save_shared::array_scalar_tag(PropertyTagDataPartial::Other(PropertyType::NameProperty)),
    );

    // Create PlayerData_0 property
    let player_data_prop = Property::Map(map_entries);

    save.root
        .properties
        .0
        .insert(PropertyKey(0, "PlayerData".to_string()), player_data_prop);
    tracing::info!("PlayerData_0 Map created");

    Ok(())
}

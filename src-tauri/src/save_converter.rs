//! Save converter module - Handles format conversion between .sav and JSON
//! Extracted from save_commands.rs for better modularity

use crate::cli_handlers;
use crate::common::validate_save_games_path;
use crate::error::AppResult;
use crate::new_save;
use serde_json::json;
use serde_json::Value;
use std::fs;
use std::io::{BufWriter, Write};
use std::path::Path;

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

/// Convert a .sav file to JSON format for editing.
#[tauri::command]
pub async fn convert_sav_to_json(file_path: String) -> AppResult<Value> {
    run_blocking(move || {
        let path = Path::new(&file_path);
        validate_save_games_path(path)?;
        if !path.exists() {
            return Err(format!("File does not exist: {}", file_path).into());
        }

        let save = cli_handlers::parse_sav_file(path)?;

        // Guard: a lenient parse degrades unparseable properties to
        // `Property::Raw`, whose untagged serde form (a bare number array in
        // JSON) deserializes back as Set/Array — saving from the JSON editor
        // would corrupt the file. Refuse up front; the normal edit flow
        // (binary in-place) is unaffected.
        let raw_props = crate::common::raw_property_names(&save);
        if !raw_props.is_empty() {
            return Err(format!(
                "This save contains data the tool cannot fully parse ({}). \
                 The JSON editor would corrupt it on save, so it is unavailable \
                 for this archive; the normal editor still works.",
                raw_props.join(", ")
            )
            .into());
        }

        // NOTE (uesave 0.7): serialize directly to a string to preserve field order
        // (header → schemas → root → extra); serde_json::to_value would reorder keys
        // alphabetically (BTreeMap) and break Deserialize on the way back.
        let json_string = serde_json::to_string_pretty(&save)
            .map_err(|e| format!("JSON formatting failed: {}", e))?;

        Ok(json!({
            "success": true,
            "json": json_string
        }))
    })
    .await
}

/// Convert JSON content back to .sav format.
#[tauri::command]
pub async fn convert_json_to_sav(json_content: String, output_path: String) -> AppResult<Value> {
    run_blocking(move || {
        let out_path = Path::new(&output_path);
        validate_save_games_path(out_path)?;
        if !output_path.to_lowercase().ends_with(".sav") {
            return Err("Output file must be .sav".to_string().into());
        }

        // Verify output directory exists
        if let Some(parent) = Path::new(&output_path).parent() {
            if !parent.exists() {
                return Err(
                    format!("Output directory does not exist: {}", parent.display()).into(),
                );
            }
        }

        // Parse JSON content
        let json_value: Value = serde_json::from_str(&json_content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        // Validate JSON structure
        if json_value.get("root").is_none() {
            return Err("JSON data missing required root field".to_string().into());
        }
        if json_value.get("schemas").is_none() {
            return Err(
                "JSON data missing required schemas field (regenerate with convert_sav_to_json)"
                    .to_string()
                    .into(),
            );
        }

        // Rebuild Save object from JSON string (preserves field order for uesave 0.7)
        let save: uesave::Save = serde_json::from_str(&json_content)
            .map_err(|e| format!("Failed to rebuild Save object from JSON: {}", e))?;

        // Write to a temp file first and rename over the target: File::create
        // would truncate the output (typically the archive being overwritten
        // from the JSON editor) up front, so a mid-write failure would destroy
        // the original with no recovery path.
        let temp_path = out_path.with_extension("sav.tmp");
        let file = fs::File::create(&temp_path)
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        let mut writer = BufWriter::with_capacity(16384, file);

        save.write(&mut writer)
            .map_err(|e| format!("Failed to write sav file: {:?}", e))?;

        writer
            .flush()
            .map_err(|e| format!("Failed to flush buffer: {}", e))?;

        fs::rename(&temp_path, out_path)
            .map_err(|e| format!("Failed to replace sav file: {}", e))?;

        Ok(json!({
            "success": true,
            "message": "JSON data successfully converted and saved to sav file"
        }))
    })
    .await
}

/// Ensure a directory exists within the save games path.
#[tauri::command]
pub async fn ensure_dir_exists(path: String) -> AppResult<()> {
    run_blocking(move || {
        let path = Path::new(&path);
        validate_save_games_path(path)?;

        if !path.exists() {
            fs::create_dir_all(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
}

/// Handle new save creation.
#[tauri::command]
pub async fn handle_new_save(save_data: new_save::SaveData) -> AppResult<()> {
    run_blocking(move || new_save::create_new_save(save_data)).await
}

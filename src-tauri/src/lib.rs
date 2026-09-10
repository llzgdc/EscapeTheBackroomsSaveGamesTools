pub mod cli_handlers;
pub mod common;
pub mod display_name;
mod error;
mod gensave_rename;
mod get_file_path;
mod gpu_settings;
pub mod mods;
pub mod new_save;
pub mod player_data;
mod save_batch;

mod save_converter;
mod save_deleter;
pub mod save_editor;
mod save_loader;
pub mod save_shared;
mod save_utils;
mod system_commands;
mod theme_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    // Get GPU acceleration settings
    let browser_args = gpu_settings::get_browser_args();
    let args_string = browser_args.join(" ");
    tracing::info!("Applying GPU acceleration settings: {}", args_string);

    // Build Tauri application
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_loader::load_all_saves,
            save_loader::load_save_metadata,
            save_loader::load_save_metadata_page,
            save_loader::load_save_details_batch,
            save_loader::get_mainsave_status,
            save_deleter::delete_file,
            save_deleter::soft_delete_file,
            save_deleter::restore_file,
            save_deleter::permanent_delete_file,
            save_deleter::handle_file,
            save_batch::get_player_data,
            save_batch::get_player_unique_ids,
            save_batch::unlock_all_hub_doors,
            save_batch::handle_edit_save,
            save_batch::check_archive_name,
            system_commands::get_local_appdata,
            save_converter::ensure_dir_exists,
            save_converter::handle_new_save,
            save_deleter::open_save_games_folder,
            gpu_settings::get_gpu_acceleration_status,
            gpu_settings::set_gpu_acceleration,
            gpu_settings::set_process_priority,
            system_commands::restart_app,
            save_converter::convert_sav_to_json,
            save_converter::convert_json_to_sav,
            system_commands::set_window_title,
            system_commands::add_backend_log,
            theme_commands::get_theme_config,
            theme_commands::set_active_theme,
            mods::validate_game_path,
            mods::get_mods_status,
            mods::detect_game_path,
            mods::install_ue4ss,
            mods::install_nsu,
            mods::set_nsu_enabled,
            mods::uninstall_nsu,
            mods::uninstall_ue4ss,
            mods::open_mods_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

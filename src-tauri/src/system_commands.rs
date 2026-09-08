use crate::error::AppResult;
use std::env;
use tauri::Window;

#[tauri::command]
pub fn get_local_appdata() -> AppResult<String> {
    Ok(env::var("LOCALAPPDATA")?)
}

#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
pub fn set_window_title(title: String, window: Window) -> AppResult<()> {
    window.set_title(&title)?;
    Ok(())
}

/// Forward a frontend log line into the backend tracing pipeline so webview
/// console output lands in the same log stream as Rust diagnostics.
#[tauri::command]
pub fn add_backend_log(level: String, message: String) {
    match level.as_str() {
        "error" => tracing::error!("[webview] {}", message),
        "warn" => tracing::warn!("[webview] {}", message),
        "debug" => tracing::debug!("[webview] {}", message),
        // "log" and "info" (console.log has no direct tracing equivalent)
        _ => tracing::info!("[webview] {}", message),
    }
}

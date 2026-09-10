use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Error)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),
    #[error("Parse error: {0}")]
    Parse(String),
    /// A create/rename target name collides with an existing archive.
    /// Typed variant (instead of General) so the frontend can detect
    /// `type == "duplicate_name"` and offer a fix instead of a dead-end error.
    #[error("An archive named '{0}' already exists. Please choose a different name.")]
    DuplicateName(String),
    #[error("Validation error: {0}")]
    #[allow(dead_code)]
    Validation(String),
    #[error("{0}")]
    General(String),
}

/// Serialize as `{"type":"io","message":"..."}` so the frontend
/// can display `error.message` and inspect `error.type` for
/// error-type-specific handling.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let (ty, msg) = match self {
            AppError::Io(msg) => ("io", msg),
            AppError::Parse(msg) => ("parse", msg),
            AppError::DuplicateName(msg) => ("duplicate_name", msg),
            AppError::Validation(msg) => ("validation", msg),
            AppError::General(msg) => ("general", msg),
        };
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("type", ty)?;
        state.serialize_field("message", msg)?;
        state.end()
    }
}

impl From<String> for AppError {
    fn from(value: String) -> Self {
        Self::General(value)
    }
}

impl From<&str> for AppError {
    fn from(value: &str) -> Self {
        Self::General(value.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        Self::Parse(value.to_string())
    }
}

impl From<std::env::VarError> for AppError {
    fn from(value: std::env::VarError) -> Self {
        Self::General(value.to_string())
    }
}

impl From<tauri::Error> for AppError {
    fn from(value: tauri::Error) -> Self {
        Self::General(value.to_string())
    }
}

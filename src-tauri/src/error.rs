use serde::Serialize;
use std::fmt::{Display, Formatter};

pub type CommandResult<T> = Result<T, CommandError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remediation: Option<String>,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            remediation: None,
        }
    }

    pub fn with_remediation(
        code: impl Into<String>,
        message: impl Into<String>,
        remediation: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            remediation: Some(remediation.into()),
        }
    }

    pub fn internal(context: &str, error: impl Display) -> Self {
        log::error!("{context}: {error}");
        Self::new(
            "INTERNAL",
            "ShowME could not complete that operation safely.",
        )
    }
}

impl Display for CommandError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for CommandError {}

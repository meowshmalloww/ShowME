use crate::{
    error::{CommandError, CommandResult},
    models::ProviderId,
};
use keyring::Entry;

const SERVICE: &str = "com.showme.visual.provider";

fn entry(provider: ProviderId) -> CommandResult<Entry> {
    Entry::new(SERVICE, provider.as_str()).map_err(|error| {
        CommandError::with_remediation(
            "CREDENTIAL_VAULT_UNAVAILABLE",
            "The operating-system credential vault is unavailable.",
            format!("Unlock your credential vault and try again ({error})."),
        )
    })
}

pub fn set_key(provider: ProviderId, key: &str) -> CommandResult<()> {
    let trimmed = key.trim();
    if !(12..=512).contains(&trimmed.len()) || trimmed.chars().any(char::is_whitespace) {
        return Err(CommandError::new(
            "INVALID_API_KEY",
            "The API key format is not valid.",
        ));
    }
    entry(provider)?.set_password(trimmed).map_err(|error| {
        CommandError::with_remediation(
            "CREDENTIAL_SAVE_FAILED",
            "ShowME could not save this key in the operating-system credential vault.",
            format!("Check credential-vault access and try again ({error})."),
        )
    })
}

pub fn get_key(provider: ProviderId) -> CommandResult<String> {
    entry(provider)?.get_password().map_err(|_| {
        CommandError::with_remediation(
            "PROVIDER_NOT_CONFIGURED",
            format!("No {} API key is configured.", provider.as_str()),
            "Open Settings → Providers, save a key, then run the connection test.",
        )
    })
}

pub fn has_key(provider: ProviderId) -> bool {
    entry(provider)
        .and_then(|credential| {
            credential
                .get_password()
                .map_err(|error| CommandError::new("CREDENTIAL_READ_FAILED", error.to_string()))
        })
        .is_ok_and(|key| !key.trim().is_empty())
}

pub fn delete_key(provider: ProviderId) -> CommandResult<()> {
    match entry(provider)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(CommandError::with_remediation(
            "CREDENTIAL_DELETE_FAILED",
            "ShowME could not remove this provider key.",
            format!("Check credential-vault access and try again ({error})."),
        )),
    }
}

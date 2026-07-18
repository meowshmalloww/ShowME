use crate::{
    credentials,
    error::{CommandError, CommandResult},
    models::ProviderId,
    providers,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::{Client, multipart};
use serde_json::{Value, json};

const MAX_AUDIO_BYTES: usize = 25 * 1024 * 1024;

pub async fn transcribe(
    client: &Client,
    mime_type: &str,
    audio_base64: &str,
) -> CommandResult<String> {
    let key = credentials::get_key(ProviderId::Openai)?;
    let audio = STANDARD.decode(audio_base64).map_err(|_| {
        CommandError::new(
            "INVALID_AUDIO",
            "The microphone recording could not be decoded.",
        )
    })?;
    if audio.is_empty() || audio.len() > MAX_AUDIO_BYTES {
        return Err(CommandError::new(
            "INVALID_AUDIO",
            "Voice recordings must be non-empty and no larger than 25 MB.",
        ));
    }
    let (safe_mime, extension) = match mime_type.split(';').next().unwrap_or_default() {
        "audio/webm" => ("audio/webm", "webm"),
        "audio/mp4" | "audio/m4a" => ("audio/mp4", "m4a"),
        "audio/mpeg" => ("audio/mpeg", "mp3"),
        "audio/wav" | "audio/x-wav" => ("audio/wav", "wav"),
        _ => {
            return Err(CommandError::new(
                "UNSUPPORTED_AUDIO_FORMAT",
                "ShowME supports WebM, M4A, MP3, and WAV microphone recordings.",
            ));
        }
    };
    let part = multipart::Part::bytes(audio)
        .file_name(format!("showme-question.{extension}"))
        .mime_str(safe_mime)
        .map_err(|error| CommandError::internal("prepare audio upload", error))?;
    let form = multipart::Form::new()
        .text("model", "gpt-4o-mini-transcribe")
        .part("file", part);
    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .bearer_auth(key)
        .multipart(form)
        .send()
        .await
        .map_err(|error| {
            CommandError::with_remediation(
                "NETWORK_ERROR",
                format!("ShowME could not reach OpenAI transcription: {error}"),
                "Check the network connection and OpenAI provider settings.",
            )
        })?;
    if !response.status().is_success() {
        return Err(audio_response_error("transcription", response).await);
    }
    let value: Value = response
        .json()
        .await
        .map_err(|error| CommandError::internal("decode transcription", error))?;
    let text = value
        .get("text")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .ok_or_else(|| {
            CommandError::new(
                "EMPTY_TRANSCRIPTION",
                "No speech was detected. Hold the button while speaking and try again.",
            )
        })?;
    Ok(text.chars().take(4_000).collect())
}

pub async fn synthesize(
    client: &Client,
    text: &str,
    voice: &str,
    speed: f64,
) -> CommandResult<String> {
    let key = credentials::get_key(ProviderId::Openai)?;
    if text.trim().is_empty() || text.len() > 4_000 {
        return Err(CommandError::new(
            "INVALID_NARRATION",
            "Narration must contain between 1 and 4,000 characters.",
        ));
    }
    let safe_voice = match voice {
        "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" => voice,
        _ => "nova",
    };
    if !speed.is_finite() || !(0.5..=2.0).contains(&speed) {
        return Err(CommandError::new(
            "INVALID_SPEECH_RATE",
            "Narration speed must be between 0.5× and 2×.",
        ));
    }
    let response = client
        .post("https://api.openai.com/v1/audio/speech")
        .bearer_auth(key)
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": "tts-1",
            "voice": safe_voice,
            "input": text,
            "speed": speed,
            "response_format": "mp3"
        }))
        .send()
        .await
        .map_err(|error| {
            CommandError::with_remediation(
                "NETWORK_ERROR",
                format!("ShowME could not reach OpenAI speech generation: {error}"),
                "Check the network connection and OpenAI provider settings.",
            )
        })?;
    if !response.status().is_success() {
        return Err(audio_response_error("speech generation", response).await);
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| CommandError::internal("read speech audio", error))?;
    if bytes.is_empty() || bytes.len() > 30 * 1024 * 1024 {
        return Err(CommandError::new(
            "INVALID_AUDIO_RESPONSE",
            "The speech service returned an invalid audio payload.",
        ));
    }
    Ok(STANDARD.encode(bytes))
}

async fn audio_response_error(operation: &str, response: reqwest::Response) -> CommandError {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    let detail = serde_json::from_str::<Value>(&body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/error/message")
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .unwrap_or_else(|| status.canonical_reason().unwrap_or("request failed").into());
    let safe_detail: String = detail.chars().take(400).collect();
    CommandError::with_remediation(
        "AUDIO_PROVIDER_FAILED",
        format!(
            "OpenAI {operation} failed (HTTP {}): {safe_detail}",
            status.as_u16()
        ),
        "Verify the OpenAI key, quota, and audio model access in Settings.",
    )
}

#[allow(dead_code)]
fn _provider_contract_reference() {
    let _ = providers::definition(ProviderId::Openai);
}

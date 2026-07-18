use super::{GeneratedResponse, ProviderDefinition, lesson_schema, network_error, response_error};
use crate::{
    error::{CommandError, CommandResult},
    models::{GenerateLessonRequest, PreparedCapture, ProviderCapabilities, ProviderId},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::Client;
use serde_json::{Value, json};

#[allow(clippy::too_many_arguments)]
pub async fn generate(
    client: &Client,
    api_key: &str,
    provider: &ProviderDefinition,
    capabilities: &ProviderCapabilities,
    request: &GenerateLessonRequest,
    capture: &PreparedCapture,
    prompt: &str,
    system_prompt: &str,
) -> CommandResult<GeneratedResponse> {
    let body = build_body(
        provider,
        capabilities,
        request,
        capture,
        prompt,
        system_prompt,
    )?;

    let mut request_builder = client
        .post(provider.base_url)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json");
    if provider.id == ProviderId::Openrouter {
        request_builder = request_builder.header("X-Title", "ShowME Visual Lesson Compiler");
    }
    let response = request_builder
        .json(&body)
        .send()
        .await
        .map_err(|error| network_error(provider.name, error))?;
    if !response.status().is_success() {
        return Err(response_error(provider.name, response).await);
    }
    let value: Value = response
        .json()
        .await
        .map_err(|error| CommandError::internal("decode provider response", error))?;
    let content = value
        .pointer("/choices/0/message/content")
        .and_then(extract_content)
        .ok_or_else(|| {
            CommandError::with_remediation(
                "EMPTY_PROVIDER_OUTPUT",
                format!("{} returned no lesson content.", provider.name),
                "Choose a model that supports the enabled input and structured-output capabilities.",
            )
        })?;
    Ok(GeneratedResponse {
        text: strip_markdown_fence(&content),
        citations: Vec::new(),
    })
}

fn build_body(
    provider: &ProviderDefinition,
    capabilities: &ProviderCapabilities,
    request: &GenerateLessonRequest,
    capture: &PreparedCapture,
    prompt: &str,
    system_prompt: &str,
) -> CommandResult<Value> {
    let user_content = if capabilities.vision {
        let mut content = vec![
            json!({"type":"text","text":prompt}),
            json!({"type":"text","text":"PRIMARY SELECTED CROP — learner-approved focus."}),
            json!({"type":"image_url","image_url":{"url": format!("data:image/png;base64,{}", STANDARD.encode(&capture.png)), "detail":"high"}}),
        ];
        if request.include_nearby_context {
            content.push(json!({"type":"text","text":"APPROVED NEARBY SCREEN CONTEXT — disambiguation only."}));
            content.push(json!({"type":"image_url","image_url":{"url": format!("data:image/png;base64,{}", STANDARD.encode(&capture.nearby_context_png)), "detail":"low"}}));
        }
        if request.include_active_window
            && let Some(active_window) = &capture.active_window_png
        {
            content.push(json!({"type":"text","text":format!("APPROVED ACTIVE WINDOW CONTEXT — title: {}", capture.active_window_title.as_deref().unwrap_or("Unknown"))}));
            content.push(json!({"type":"image_url","image_url":{"url": format!("data:image/png;base64,{}", STANDARD.encode(active_window)), "detail":"low"}}));
        }
        Value::Array(content)
    } else {
        Value::String(prompt.into())
    };
    let response_format = if capabilities.structured_output {
        json!({
            "type": "json_schema",
            "json_schema": {
                "name": "showme_visual_lesson",
                "strict": true,
                "schema": lesson_schema()?
            }
        })
    } else {
        json!({ "type": "json_object" })
    };
    let mut body = json!({
        "model": request.model,
        "messages": [
            {"role":"system","content":system_prompt},
            {"role":"user","content":user_content}
        ],
        "response_format": response_format,
        "max_tokens": 16000,
        "stream": false
    });
    if provider.id == ProviderId::Openrouter && capabilities.structured_output {
        body["provider"] = json!({"require_parameters": true});
    }
    Ok(body)
}

fn extract_content(value: &Value) -> Option<String> {
    if let Some(content) = value.as_str() {
        return Some(content.into());
    }
    value.as_array().and_then(|items| {
        items
            .iter()
            .find_map(|item| item.get("text").and_then(Value::as_str).map(str::to_owned))
    })
}

fn strip_markdown_fence(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.starts_with("```json") && trimmed.ends_with("```") {
        return trimmed
            .trim_start_matches("```json")
            .trim_end_matches("```")
            .trim()
            .into();
    }
    if trimmed.starts_with("```") && trimmed.ends_with("```") {
        return trimmed
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
            .into();
    }
    trimmed.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_fences_are_removed_for_legacy_json_mode() {
        assert_eq!(
            strip_markdown_fence("```json\n{\"ok\":true}\n```"),
            "{\"ok\":true}"
        );
    }
}

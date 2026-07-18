use super::{GeneratedResponse, GroundedCitation, lesson_schema, network_error, response_error};
use crate::{
    error::{CommandError, CommandResult},
    models::{GenerateLessonRequest, PreparedCapture},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::Client;
use serde_json::{Map, Value, json};

pub async fn generate(
    client: &Client,
    api_key: &str,
    request: &GenerateLessonRequest,
    capture: &PreparedCapture,
    prompt: &str,
    system_prompt: &str,
) -> CommandResult<GeneratedResponse> {
    let body = build_body(request, capture, prompt, system_prompt)?;

    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| network_error("OpenAI", error))?;
    if !response.status().is_success() {
        return Err(response_error("OpenAI", response).await);
    }
    let value: Value = response
        .json()
        .await
        .map_err(|error| CommandError::internal("decode OpenAI response", error))?;
    let text = extract_output_text(&value).ok_or_else(|| {
        CommandError::with_remediation(
            "EMPTY_PROVIDER_OUTPUT",
            "OpenAI completed the request without a visual lesson payload.",
            "Retry the request. If it persists, verify that the selected model supports structured Responses output.",
        )
    })?;
    Ok(GeneratedResponse {
        text,
        citations: extract_citations(&value),
    })
}

fn build_body(
    request: &GenerateLessonRequest,
    capture: &PreparedCapture,
    prompt: &str,
    system_prompt: &str,
) -> CommandResult<Value> {
    let image_url = format!("data:image/png;base64,{}", STANDARD.encode(&capture.png));
    let mut content = vec![
        json!({ "type": "input_text", "text": prompt }),
        json!({ "type": "input_text", "text": "PRIMARY SELECTED CROP — this is the learner-approved focus." }),
        json!({ "type": "input_image", "image_url": image_url, "detail": "high" }),
    ];
    if request.include_nearby_context {
        content.push(json!({ "type": "input_text", "text": "APPROVED NEARBY SCREEN CONTEXT — use only to disambiguate the primary crop." }));
        content.push(json!({
            "type": "input_image",
            "image_url": format!("data:image/png;base64,{}", STANDARD.encode(&capture.nearby_context_png)),
            "detail": "low"
        }));
    }
    if request.include_active_window
        && let Some(active_window) = &capture.active_window_png
    {
        content.push(json!({
            "type": "input_text",
            "text": format!("APPROVED ACTIVE WINDOW CONTEXT — title: {}", capture.active_window_title.as_deref().unwrap_or("Unknown"))
        }));
        content.push(json!({
            "type": "input_image",
            "image_url": format!("data:image/png;base64,{}", STANDARD.encode(active_window)),
            "detail": "low"
        }));
    }
    let mut body = json!({
        "model": request.model,
        "store": false,
        "instructions": system_prompt,
        "input": [{ "role": "user", "content": content }],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "showme_visual_lesson",
                "strict": true,
                "schema": lesson_schema()?
            }
        },
        "max_output_tokens": 16000
    });
    if request.allow_web_research {
        body["tools"] = json!([{ "type": "web_search" }]);
    }
    Ok(body)
}

fn extract_output_text(value: &Value) -> Option<String> {
    if let Some(text) = value.get("output_text").and_then(Value::as_str) {
        return Some(text.to_owned());
    }
    value
        .get("output")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("content").and_then(Value::as_array))
        .flatten()
        .find_map(|content| {
            (content.get("type").and_then(Value::as_str) == Some("output_text"))
                .then(|| {
                    content
                        .get("text")
                        .and_then(Value::as_str)
                        .map(str::to_owned)
                })
                .flatten()
        })
}

fn extract_citations(value: &Value) -> Vec<GroundedCitation> {
    let mut citations = Vec::new();
    walk_citations(value, &mut citations);
    citations.sort_by(|left, right| left.url.cmp(&right.url));
    citations.dedup_by(|left, right| left.url == right.url);
    citations
}

fn walk_citations(value: &Value, citations: &mut Vec<GroundedCitation>) {
    match value {
        Value::Object(object) => {
            if is_url_citation(object)
                && let Some(url) = object.get("url").and_then(Value::as_str)
            {
                citations.push(GroundedCitation {
                    title: object
                        .get("title")
                        .and_then(Value::as_str)
                        .unwrap_or("Retrieved web source")
                        .to_owned(),
                    url: url.to_owned(),
                });
            }
            for child in object.values() {
                walk_citations(child, citations);
            }
        }
        Value::Array(items) => {
            for child in items {
                walk_citations(child, citations);
            }
        }
        _ => {}
    }
}

fn is_url_citation(object: &Map<String, Value>) -> bool {
    object.get("url").and_then(Value::as_str).is_some()
        && object
            .get("type")
            .and_then(Value::as_str)
            .is_some_and(|kind| kind == "url_citation" || kind == "citation")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Complexity, ProviderId, TeachingStyle};

    fn request() -> GenerateLessonRequest {
        GenerateLessonRequest {
            capture_id: "capture".into(),
            question: "Show me".into(),
            copied_text: None,
            source_url: None,
            include_nearby_context: false,
            include_active_window: false,
            allow_web_research: false,
            allow_image_aids: false,
            language: "en".into(),
            teaching_style: TeachingStyle::ExperimentFirst,
            complexity: Complexity::Standard,
            provider: ProviderId::Openai,
            model: "gpt-test".into(),
        }
    }

    fn capture() -> PreparedCapture {
        PreparedCapture {
            capture_id: "capture".into(),
            png: vec![1, 2],
            nearby_context_png: vec![3, 4],
            active_window_png: Some(vec![5, 6]),
            active_window_title: Some("Notes".into()),
            regions: Vec::new(),
            pixel_width: 200,
            pixel_height: 100,
            contains_annotations: false,
        }
    }

    #[test]
    fn output_text_is_read_from_raw_response_items() {
        let value = json!({
            "output": [{"type":"message","content":[{"type":"output_text","text":"{\"version\":1}"}]}]
        });
        assert_eq!(
            extract_output_text(&value).as_deref(),
            Some("{\"version\":1}")
        );
    }

    #[test]
    fn annotations_become_grounded_citations() {
        let value = json!({"annotations":[{"type":"url_citation","url":"https://example.edu","title":"Example"}]});
        let citations = extract_citations(&value);
        assert_eq!(citations.len(), 1);
        assert_eq!(citations[0].title, "Example");
    }

    #[test]
    fn request_body_is_private_and_context_is_opt_in() {
        let mut request = request();
        let capture = capture();
        let body = build_body(&request, &capture, "prompt", "system").unwrap();
        assert_eq!(body.get("store"), Some(&Value::Bool(false)));
        assert!(body.get("tools").is_none());
        assert_eq!(
            body.pointer("/input/0/content")
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(3)
        );

        request.include_nearby_context = true;
        request.include_active_window = true;
        request.allow_web_research = true;
        let opted_in = build_body(&request, &capture, "prompt", "system").unwrap();
        assert_eq!(
            opted_in
                .pointer("/input/0/content")
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(7)
        );
        assert_eq!(
            opted_in.pointer("/tools/0/type"),
            Some(&json!("web_search"))
        );
    }
}

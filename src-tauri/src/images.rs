use crate::{
    error::{CommandError, CommandResult},
    models::ImageAsset,
};
use reqwest::Client;
use serde_json::Value;
use sha2::{Digest, Sha256};
use url::Url;

const COMMONS_API: &str = "https://commons.wikimedia.org/w/api.php";

pub async fn search_commons(client: &Client, query: &str) -> CommandResult<Vec<ImageAsset>> {
    let query = query.trim();
    if query.len() < 2 || query.len() > 160 {
        return Err(CommandError::new(
            "INVALID_IMAGE_QUERY",
            "Image-aid searches must contain between 2 and 160 characters.",
        ));
    }
    let response = client
        .get(COMMONS_API)
        .header(
            "User-Agent",
            "ShowME/0.1 (educational visual lesson compiler; local desktop app)",
        )
        .query(&[
            ("action", "query"),
            ("generator", "search"),
            ("gsrsearch", query),
            ("gsrnamespace", "6"),
            ("gsrlimit", "10"),
            ("prop", "imageinfo"),
            ("iiprop", "url|extmetadata|mime"),
            ("iiurlwidth", "720"),
            ("format", "json"),
            ("formatversion", "2"),
            ("origin", "*"),
        ])
        .send()
        .await
        .map_err(|error| {
            CommandError::with_remediation(
                "IMAGE_SEARCH_FAILED",
                format!("Wikimedia Commons could not be reached: {error}"),
                "Check the network connection or continue without an external image aid.",
            )
        })?;
    if !response.status().is_success() {
        return Err(CommandError::with_remediation(
            "IMAGE_SEARCH_FAILED",
            format!(
                "Wikimedia Commons returned HTTP {}.",
                response.status().as_u16()
            ),
            "Continue with ShowME's original vector diagram and retry later.",
        ));
    }
    let value: Value = response
        .json()
        .await
        .map_err(|error| CommandError::internal("decode Commons response", error))?;
    let pages = value
        .pointer("/query/pages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(pages.iter().filter_map(parse_page).take(6).collect())
}

fn parse_page(page: &Value) -> Option<ImageAsset> {
    let title = page.get("title")?.as_str()?.trim_start_matches("File:");
    let info = page.get("imageinfo")?.as_array()?.first()?;
    let mime = info.get("mime")?.as_str()?;
    if !matches!(
        mime,
        "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml"
    ) {
        return None;
    }
    let metadata = info.get("extmetadata")?;
    let license = metadata_value(metadata, "LicenseShortName")?;
    if !is_allowed_license(&license) {
        return None;
    }
    let license_url = metadata_value(metadata, "LicenseUrl").unwrap_or_default();
    if Url::parse(&license_url)
        .ok()
        .is_none_or(|url| !matches!(url.scheme(), "http" | "https"))
    {
        return None;
    }
    let original_url = info.get("url")?.as_str()?.to_owned();
    let thumbnail_url = info
        .get("thumburl")
        .and_then(Value::as_str)
        .unwrap_or(&original_url)
        .to_owned();
    if !is_upload_wikimedia_url(&original_url) || !is_upload_wikimedia_url(&thumbnail_url) {
        return None;
    }
    let page_url = info
        .get("descriptionurl")
        .and_then(Value::as_str)
        .filter(|value| value.starts_with("https://commons.wikimedia.org/"))
        .unwrap_or("https://commons.wikimedia.org/")
        .to_owned();
    let artist = clean_html(
        &metadata_value(metadata, "Artist").unwrap_or_else(|| "Unknown contributor".into()),
    );
    let description =
        clean_html(&metadata_value(metadata, "ImageDescription").unwrap_or_else(|| title.into()));
    let mut hasher = Sha256::new();
    hasher.update(original_url.as_bytes());
    let id = format!("commons-{:x}", hasher.finalize());
    Some(ImageAsset {
        id,
        title: title.chars().take(240).collect(),
        thumbnail_url,
        original_url,
        page_url,
        artist: artist.chars().take(240).collect(),
        license: license.chars().take(120).collect(),
        license_url,
        description: description.chars().take(500).collect(),
    })
}

fn metadata_value(metadata: &Value, key: &str) -> Option<String> {
    metadata
        .get(key)
        .and_then(|value| value.get("value"))
        .and_then(Value::as_str)
        .map(str::to_owned)
}

fn is_allowed_license(license: &str) -> bool {
    let normalized = license.to_ascii_lowercase();
    normalized.contains("cc0")
        || normalized.contains("public domain")
        || normalized.contains("cc by")
        || normalized.contains("cc-by")
        || normalized.contains("creative commons attribution")
}

fn is_upload_wikimedia_url(value: &str) -> bool {
    Url::parse(value)
        .is_ok_and(|url| url.scheme() == "https" && url.host_str() == Some("upload.wikimedia.org"))
}

fn clean_html(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    let mut inside_tag = false;
    for character in value.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => result.push(character),
            _ => {}
        }
    }
    result
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rejects_non_free_or_non_wikimedia_assets() {
        assert!(is_allowed_license("CC BY-SA 4.0"));
        assert!(!is_allowed_license("All rights reserved"));
        assert!(is_upload_wikimedia_url(
            "https://upload.wikimedia.org/wikipedia/commons/a/a1/test.png"
        ));
        assert!(!is_upload_wikimedia_url("https://example.com/test.png"));
    }

    #[test]
    fn metadata_html_is_never_rendered_as_markup() {
        assert_eq!(clean_html("<b>Alice</b> &amp; Bob"), "Alice & Bob");
    }

    #[test]
    fn page_parser_requires_an_allowed_license() {
        let page = json!({
          "title":"File:Diagram.png",
          "imageinfo":[{
            "mime":"image/png",
            "url":"https://upload.wikimedia.org/diagram.png",
            "thumburl":"https://upload.wikimedia.org/thumb.png",
            "descriptionurl":"https://commons.wikimedia.org/wiki/File:Diagram.png",
            "extmetadata":{
              "LicenseShortName":{"value":"All rights reserved"},
              "LicenseUrl":{"value":"https://example.com/license"}
            }
          }]
        });
        assert!(parse_page(&page).is_none());
    }
}

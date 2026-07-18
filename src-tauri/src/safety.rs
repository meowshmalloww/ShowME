use crate::{
    error::{CommandError, CommandResult},
    models::{
        AppSettings, Citation, GenerateLessonRequest, LessonPlan, SelectionKind, SelectionRegion,
        SimulationSpec,
    },
};
use std::collections::HashSet;
use url::Url;

pub fn validate_settings(settings: &AppSettings) -> CommandResult<()> {
    if settings.pet_name.trim().is_empty() || settings.pet_name.chars().count() > 32 {
        return Err(CommandError::new(
            "INVALID_SETTINGS",
            "The pet name must contain between 1 and 32 characters.",
        ));
    }
    if settings.language.trim().is_empty()
        || settings.language.chars().count() > 32
        || settings.language.chars().any(char::is_control)
    {
        return Err(CommandError::new(
            "INVALID_SETTINGS",
            "The lesson language must contain between 1 and 32 printable characters.",
        ));
    }
    if !(0.5..=2.0).contains(&settings.speech_rate) {
        return Err(CommandError::new(
            "INVALID_SETTINGS",
            "Speech rate must be between 0.5× and 2×.",
        ));
    }
    if !settings.pet_scale.is_finite() || !(0.8..=1.45).contains(&settings.pet_scale) {
        return Err(CommandError::new(
            "INVALID_SETTINGS",
            "Pet size must be between 80% and 145%.",
        ));
    }
    if settings.hotkey.trim().len() > 100 || settings.hotkey.trim().is_empty() {
        return Err(CommandError::new(
            "INVALID_SETTINGS",
            "The global shortcut is not valid.",
        ));
    }
    for model in settings.models.values() {
        if model.trim().is_empty() || model.len() > 200 || model.chars().any(char::is_control) {
            return Err(CommandError::new(
                "INVALID_SETTINGS",
                "Provider model names must contain between 1 and 200 printable characters.",
            ));
        }
    }
    Ok(())
}

pub fn validate_regions(regions: &[SelectionRegion]) -> CommandResult<()> {
    if regions.is_empty() || regions.len() > 40 {
        return Err(CommandError::new(
            "INVALID_SELECTION",
            "Choose at least one region (up to 40) before continuing.",
        ));
    }
    for region in regions {
        if region.id.is_empty() || region.id.len() > 80 || region.points.len() > 300 {
            return Err(CommandError::new(
                "INVALID_SELECTION",
                "One of the selected regions is malformed.",
            ));
        }
        let minimum_points = match region.kind {
            SelectionKind::Point | SelectionKind::Label => 1,
            SelectionKind::Lasso => 3,
            _ => 2,
        };
        if region.points.len() < minimum_points
            || region.points.iter().any(|point| {
                !point.x.is_finite()
                    || !point.y.is_finite()
                    || !(0.0..=1000.0).contains(&point.x)
                    || !(0.0..=1000.0).contains(&point.y)
            })
        {
            return Err(CommandError::new(
                "INVALID_SELECTION",
                "One of the selected regions falls outside the captured screen.",
            ));
        }
        if region.label.as_ref().is_some_and(|label| label.len() > 240) {
            return Err(CommandError::new(
                "INVALID_SELECTION",
                "Selection labels are limited to 240 characters.",
            ));
        }
    }
    Ok(())
}

pub fn validate_generation_request(request: &GenerateLessonRequest) -> CommandResult<()> {
    if request.question.trim().is_empty() || request.question.len() > 4_000 {
        return Err(CommandError::new(
            "INVALID_QUESTION",
            "Ask a question between 1 and 4,000 characters.",
        ));
    }
    if request
        .copied_text
        .as_ref()
        .is_some_and(|text| text.len() > 50_000)
    {
        return Err(CommandError::new(
            "CONTEXT_TOO_LARGE",
            "Copied context is limited to 50,000 characters per lesson.",
        ));
    }
    if request.model.trim().is_empty() || request.model.len() > 200 {
        return Err(CommandError::new(
            "INVALID_MODEL",
            "Choose a valid provider model.",
        ));
    }
    if request.language.trim().is_empty()
        || request.language.chars().count() > 32
        || request.language.chars().any(char::is_control)
    {
        return Err(CommandError::new(
            "INVALID_LANGUAGE",
            "Choose a valid lesson language.",
        ));
    }
    if let Some(source_url) = request
        .source_url
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        validate_http_url(source_url)?;
    }
    Ok(())
}

pub fn validate_http_url(value: &str) -> CommandResult<Url> {
    let parsed = Url::parse(value).map_err(|_| {
        CommandError::new(
            "INVALID_URL",
            "Source links must be valid HTTPS or HTTP URLs.",
        )
    })?;
    if !matches!(parsed.scheme(), "https" | "http") || parsed.host_str().is_none() {
        return Err(CommandError::new(
            "INVALID_URL",
            "Only HTTPS and HTTP source links are allowed.",
        ));
    }
    Ok(parsed)
}

pub fn validate_lesson(plan: &LessonPlan) -> CommandResult<()> {
    if plan.version != 1
        || plan.title.trim().is_empty()
        || plan.title.len() > 120
        || plan.summary.len() > 600
        || plan.narration.is_empty()
        || plan.narration.len() > 4_000
        || plan.primitives.len() > 160
        || plan.steps.is_empty()
        || plan.steps.len() > 16
        || plan.controls.len() > 12
        || plan.claims.len() > 40
        || plan.citations.len() > 24
    {
        return Err(CommandError::new(
            "INVALID_LESSON_PLAN",
            "The provider returned a lesson plan outside ShowME's safe scene limits.",
        ));
    }

    let primitive_ids: HashSet<&str> = plan
        .primitives
        .iter()
        .map(|primitive| primitive.id.as_str())
        .collect();
    if primitive_ids.len() != plan.primitives.len() {
        return Err(CommandError::new(
            "INVALID_LESSON_PLAN",
            "The lesson plan contains duplicate visual element IDs.",
        ));
    }
    for primitive in &plan.primitives {
        if !valid_coordinate(primitive.x)
            || !valid_coordinate(primitive.y)
            || primitive.x2.is_some_and(|value| !valid_coordinate(value))
            || primitive.y2.is_some_and(|value| !valid_coordinate(value))
            || primitive.points.as_ref().is_some_and(|points| {
                points.len() > 120
                    || points
                        .iter()
                        .any(|point| !valid_coordinate(point.x) || !valid_coordinate(point.y))
            })
        {
            return Err(CommandError::new(
                "INVALID_LESSON_PLAN",
                "The provider returned visual coordinates outside the normalized canvas.",
            ));
        }
    }

    for step in &plan.steps {
        if step.duration_ms < 250
            || step.duration_ms > 30_000
            || step
                .primitive_ids
                .iter()
                .any(|id| !primitive_ids.contains(id.as_str()))
        {
            return Err(CommandError::new(
                "INVALID_LESSON_PLAN",
                "A lesson step references an invalid visual element.",
            ));
        }
    }

    for control in &plan.controls {
        if !control.min.is_finite()
            || !control.max.is_finite()
            || !control.value.is_finite()
            || !control.step.is_finite()
            || control.max <= control.min
            || control.step <= 0.0
            || control.value < control.min
            || control.value > control.max
        {
            return Err(CommandError::new(
                "INVALID_LESSON_PLAN",
                "A lesson control contains an unsafe or invalid numeric range.",
            ));
        }
    }

    for citation in &plan.citations {
        validate_citation(citation)?;
    }

    if let Some(SimulationSpec::Custom {
        duration_seconds,
        entities,
        motions,
    }) = &plan.simulation
    {
        if !(0.1..=60.0).contains(duration_seconds) || entities.len() > 40 || motions.len() > 40 {
            return Err(CommandError::new(
                "INVALID_LESSON_PLAN",
                "The custom motion plan exceeds the sandbox budget.",
            ));
        }
        let entity_ids: HashSet<&str> = entities.iter().map(|entity| entity.id.as_str()).collect();
        if motions
            .iter()
            .any(|motion| !entity_ids.contains(motion.entity_id.as_str()))
        {
            return Err(CommandError::new(
                "INVALID_LESSON_PLAN",
                "The custom motion plan references an unknown entity.",
            ));
        }
    }
    Ok(())
}

fn valid_coordinate(value: f64) -> bool {
    value.is_finite() && (0.0..=1000.0).contains(&value)
}

fn validate_citation(citation: &Citation) -> CommandResult<()> {
    validate_http_url(&citation.url)?;
    if citation.id.is_empty()
        || citation.title.is_empty()
        || citation.title.len() > 300
        || citation.source.len() > 160
    {
        return Err(CommandError::new(
            "INVALID_LESSON_PLAN",
            "A source card returned by the provider is malformed.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Point;

    #[test]
    fn source_urls_reject_non_http_schemes() {
        assert!(validate_http_url("https://example.edu/lesson").is_ok());
        assert!(validate_http_url("file:///private/notes.txt").is_err());
        assert!(validate_http_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn regions_must_stay_in_normalized_space() {
        let region = SelectionRegion {
            id: "one".into(),
            kind: SelectionKind::Rectangle,
            points: vec![Point { x: 0.0, y: 0.0 }, Point { x: 1001.0, y: 4.0 }],
            label: None,
        };
        assert!(validate_regions(&[region]).is_err());
    }
}

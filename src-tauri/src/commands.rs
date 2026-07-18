use crate::{
    audio, capture, credentials, db,
    error::{CommandError, CommandResult},
    images,
    models::{
        AppBootstrap, AppSettings, AppState, CapturePayload, GenerateLessonRequest, ImageAsset,
        LauncherMode, LessonPlan, LessonPresentation, LessonReceipt, PermissionStatus,
        PreparedContext, ProviderId, ProviderModel, ProviderSummary, SelectionRegion, StoredLesson,
    },
    providers, safety, windows,
};
use tauri::{AppHandle, Emitter, State, WebviewWindow};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[tauri::command]
pub fn bootstrap(app: AppHandle, state: State<'_, AppState>) -> CommandResult<AppBootstrap> {
    bootstrap_value(&app, &state)
}

fn bootstrap_value(app: &AppHandle, state: &AppState) -> CommandResult<AppBootstrap> {
    let settings = db::get_settings(&state.database_path)?;
    Ok(AppBootstrap {
        providers: providers::summaries(&settings),
        recent_lessons: db::list_lessons(&state.database_path, 20)?,
        settings,
        platform: std::env::consts::OS.into(),
        app_version: app.package_info().version.to_string(),
        capture_supported: matches!(std::env::consts::OS, "windows" | "macos" | "linux"),
    })
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: AppSettings,
) -> CommandResult<AppBootstrap> {
    safety::validate_settings(&settings)?;
    let previous = db::get_settings(&state.database_path)?;
    if previous.hotkey != settings.hotkey {
        let shortcut = app.global_shortcut();
        shortcut.unregister(previous.hotkey.as_str()).ok();
        if let Err(error) = shortcut.register(settings.hotkey.as_str()) {
            shortcut.register(previous.hotkey.as_str()).ok();
            return Err(CommandError::with_remediation(
                "HOTKEY_REGISTRATION_FAILED",
                format!("The shortcut could not be registered: {error}"),
                "Choose a different shortcut that is not reserved by another application.",
            ));
        }
    }
    db::save_settings(&state.database_path, &settings)?;
    if !previous.onboarding_complete && settings.onboarding_complete {
        windows::reveal_pet(&app);
    }
    if let Err(error) = app.emit("showme:settings-changed", &settings) {
        log::warn!("could not broadcast updated settings: {error}");
    }
    bootstrap_value(&app, &state)
}

#[tauri::command]
pub fn provider_summaries(state: State<'_, AppState>) -> CommandResult<Vec<ProviderSummary>> {
    let settings = db::get_settings(&state.database_path)?;
    Ok(providers::summaries(&settings))
}

#[tauri::command]
pub fn set_provider_key(
    state: State<'_, AppState>,
    provider: ProviderId,
    key: String,
) -> CommandResult<Vec<ProviderSummary>> {
    credentials::set_key(provider, &key)?;
    let settings = db::get_settings(&state.database_path)?;
    Ok(providers::summaries(&settings))
}

#[tauri::command]
pub fn delete_provider_key(
    state: State<'_, AppState>,
    provider: ProviderId,
) -> CommandResult<Vec<ProviderSummary>> {
    credentials::delete_key(provider)?;
    let settings = db::get_settings(&state.database_path)?;
    Ok(providers::summaries(&settings))
}

#[tauri::command]
pub async fn test_provider(
    state: State<'_, AppState>,
    provider: ProviderId,
    model: String,
) -> CommandResult<String> {
    if model.trim().is_empty() || model.len() > 200 {
        return Err(CommandError::new(
            "INVALID_MODEL",
            "Enter a valid model ID.",
        ));
    }
    providers::test_connection(&state.http, provider, &model).await
}

#[tauri::command]
pub async fn begin_capture(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CommandResult<CapturePayload> {
    capture::begin(&app, &state).await
}

#[tauri::command]
pub fn get_pending_capture(state: State<'_, AppState>) -> CommandResult<CapturePayload> {
    capture::pending(&state)
}

#[tauri::command]
pub fn commit_selection(
    app: AppHandle,
    state: State<'_, AppState>,
    capture_id: String,
    regions: Vec<SelectionRegion>,
) -> CommandResult<PreparedContext> {
    capture::commit(&app, &state, &capture_id, regions)
}

#[tauri::command]
pub fn cancel_capture(app: AppHandle, state: State<'_, AppState>) -> CommandResult<()> {
    capture::cancel(&app, &state)
}

#[tauri::command]
pub fn get_prepared_context(state: State<'_, AppState>) -> CommandResult<Option<PreparedContext>> {
    capture::prepared(&state)
}

#[tauri::command]
pub async fn generate_lesson(
    state: State<'_, AppState>,
    request: GenerateLessonRequest,
) -> CommandResult<LessonPlan> {
    let capture = state
        .prepared_capture
        .lock()
        .map_err(|error| CommandError::internal("lock prepared capture", error))?
        .clone()
        .ok_or_else(|| {
            CommandError::new(
                "NO_PREPARED_CONTEXT",
                "The selected screen context has expired. Start a new capture.",
            )
        })?;
    if capture.capture_id != request.capture_id {
        return Err(CommandError::new(
            "CAPTURE_MISMATCH",
            "The question does not belong to the current screen selection.",
        ));
    }
    let settings = db::get_settings(&state.database_path)?;
    let plan = providers::generate(&state.http, &settings, &capture, &request).await?;
    if settings.memory_enabled {
        db::save_lesson(&state.database_path, &request, &plan)?;
    }
    Ok(plan)
}

#[tauri::command]
pub fn present_lesson(app: AppHandle, presentation: LessonPresentation) -> CommandResult<()> {
    windows::show_main(&app, None)?;
    app.emit("showme:lesson-ready", presentation)
        .map_err(|error| CommandError::internal("present lesson", error))
}

#[tauri::command]
pub fn set_launcher_mode(
    app: AppHandle,
    state: State<'_, AppState>,
    mode: LauncherMode,
) -> CommandResult<()> {
    let settings = db::get_settings(&state.database_path)?;
    windows::set_launcher_mode(&app, mode, settings.pet_scale)
}

#[tauri::command]
pub async fn list_provider_models(
    state: State<'_, AppState>,
    provider: ProviderId,
) -> CommandResult<Vec<ProviderModel>> {
    providers::list_models(&state.http, provider).await
}

#[tauri::command]
pub fn end_lesson_context(state: State<'_, AppState>) {
    capture::clear_prepared(&state);
}

#[tauri::command]
pub async fn transcribe_audio(
    state: State<'_, AppState>,
    mime_type: String,
    audio_base64: String,
) -> CommandResult<String> {
    audio::transcribe(&state.http, &mime_type, &audio_base64).await
}

#[tauri::command]
pub async fn synthesize_speech(
    state: State<'_, AppState>,
    text: String,
    voice: String,
    speed: f64,
) -> CommandResult<String> {
    audio::synthesize(&state.http, &text, &voice, speed).await
}

#[tauri::command]
pub async fn search_commons_images(
    state: State<'_, AppState>,
    query: String,
) -> CommandResult<Vec<ImageAsset>> {
    images::search_commons(&state.http, &query).await
}

#[tauri::command]
pub fn list_lessons(state: State<'_, AppState>) -> CommandResult<Vec<LessonReceipt>> {
    db::list_lessons(&state.database_path, 500)
}

#[tauri::command]
pub fn get_lesson(state: State<'_, AppState>, id: String) -> CommandResult<StoredLesson> {
    db::get_lesson(&state.database_path, &id)
}

#[tauri::command]
pub fn delete_lesson(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    db::delete_lesson(&state.database_path, &id)
}

#[tauri::command]
pub fn delete_all_memory(state: State<'_, AppState>) -> CommandResult<()> {
    db::delete_all_memory(&state.database_path)
}

#[tauri::command]
pub fn export_memory(state: State<'_, AppState>) -> CommandResult<String> {
    db::export_memory(&state.database_path)
}

#[tauri::command]
pub fn set_lesson_feedback(
    state: State<'_, AppState>,
    id: String,
    helpful: bool,
) -> CommandResult<()> {
    db::set_feedback(&state.database_path, &id, helpful)
}

#[tauri::command]
pub fn check_capture_permission() -> PermissionStatus {
    capture::check_permission()
}

#[tauri::command]
pub fn show_main(app: AppHandle, section: Option<String>) -> CommandResult<()> {
    windows::show_main(&app, section.as_deref())
}

#[tauri::command]
pub fn hide_main(app: AppHandle) -> CommandResult<()> {
    windows::hide_main(&app)
}

#[tauri::command]
pub fn window_action(window: WebviewWindow, action: String) -> CommandResult<()> {
    match action.as_str() {
        "minimize" => window.minimize(),
        "close" | "hide" => window.hide(),
        _ => {
            return Err(CommandError::new(
                "INVALID_WINDOW_ACTION",
                "That window action is not allowed.",
            ));
        }
    }
    .map_err(|error| CommandError::internal("window action", error))
}

#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> CommandResult<()> {
    let parsed = safety::validate_http_url(&url)?;
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(parsed.as_str(), None::<&str>)
        .map_err(|error| CommandError::internal("open external source", error))
}

pub fn emit_error(app: &AppHandle, error: &CommandError) {
    app.emit("showme:error", error).ok();
}

mod audio;
mod capture;
pub mod commands;
mod credentials;
mod db;
mod error;
mod images;
mod models;
mod providers;
mod safety;
mod windows;

use crate::{
    error::CommandError,
    models::{AppSettings, AppState},
};
use std::{fs, sync::Mutex, time::Duration};
use tauri::Manager;
use tauri_plugin_global_shortcut::{Builder as ShortcutBuilder, ShortcutState};
use tauri_plugin_log::{Target, TargetKind};

pub fn run() {
    let shortcut_plugin = ShortcutBuilder::new()
        .with_shortcut("CommandOrControl+Shift+Space")
        .expect("default shortcut must be valid")
        .with_handler(|app, _shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<AppState>();
                if let Err(error) = capture::begin(&handle, &state).await {
                    log::warn!("global shortcut capture failed: {}", error.code);
                    commands::emit_error(&handle, &error);
                    windows::show_main(&handle, None).ok();
                }
            });
        })
        .build();

    let application = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::LogDir {
                        file_name: Some("showme".into()),
                    }),
                    Target::new(TargetKind::Stdout),
                ])
                .max_file_size(2_000_000)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            windows::show_main(app, None).ok();
        }))
        .plugin(shortcut_plugin)
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .map_err(|error| CommandError::internal("resolve app data directory", error))?;
            fs::create_dir_all(&app_data)
                .map_err(|error| CommandError::internal("create app data directory", error))?;
            let database_path = app_data.join("showme.sqlite3");
            db::initialize(&database_path)?;
            let settings = db::get_settings(&database_path).unwrap_or_else(|error| {
                log::warn!("settings could not be restored: {}", error.code);
                AppSettings::default()
            });
            let http = reqwest::Client::builder()
                .user_agent("ShowME/0.1 desktop visual lesson compiler")
                .connect_timeout(Duration::from_secs(12))
                .timeout(Duration::from_secs(120))
                .redirect(reqwest::redirect::Policy::limited(3))
                .https_only(true)
                .build()
                .map_err(|error| CommandError::internal("build HTTP client", error))?;
            app.manage(AppState {
                database_path,
                pending_capture: Mutex::new(None),
                prepared_capture: Mutex::new(None),
                http,
            });
            windows::create(app, &settings)?;
            log::info!("ShowME initialized without background capture or microphone access");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::save_settings,
            commands::provider_summaries,
            commands::set_provider_key,
            commands::delete_provider_key,
            commands::test_provider,
            commands::begin_capture,
            commands::get_pending_capture,
            commands::commit_selection,
            commands::cancel_capture,
            commands::get_prepared_context,
            commands::generate_lesson,
            commands::present_lesson,
            commands::set_launcher_mode,
            commands::end_lesson_context,
            commands::transcribe_audio,
            commands::synthesize_speech,
            commands::search_commons_images,
            commands::list_lessons,
            commands::get_lesson,
            commands::delete_lesson,
            commands::delete_all_memory,
            commands::export_memory,
            commands::set_lesson_feedback,
            commands::check_capture_permission,
            commands::show_main,
            commands::hide_main,
            commands::window_action,
            commands::open_external,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build ShowME");

    application.run(|_, _| {});
}

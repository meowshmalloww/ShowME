use crate::{
    error::{CommandError, CommandResult},
    models::{AppSettings, LauncherMode},
};
use tauri::{
    App, AppHandle, LogicalSize, Manager, PhysicalPosition, Size, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const LAUNCHER_PEEK_WIDTH: f64 = 96.0;
const LAUNCHER_PEEK_HEIGHT: f64 = 26.0;
const LAUNCHER_READY_WIDTH: f64 = 320.0;
const LAUNCHER_READY_HEIGHT: f64 = 58.0;
const LAUNCHER_MENU_HEIGHT: f64 = 178.0;
const MAC_CAMERA_SAFE_PEEK_WIDTH: f64 = 220.0;
const MAC_CAMERA_SAFE_READY_WIDTH: f64 = 448.0;
const LAUNCHER_PANEL_WIDTH: f64 = 468.0;
const LAUNCHER_PANEL_HEIGHT: f64 = 520.0;

pub fn create(app: &App, settings: &AppSettings) -> CommandResult<()> {
    let main = create_main_window(app, settings.onboarding_complete)?;
    let pet = create_pet_window(app, settings.onboarding_complete, settings.pet_scale)?;
    position_launcher(&pet);
    install_close_to_hide(&main);
    create_tray(app)?;
    Ok(())
}

fn create_main_window(app: &App, visible: bool) -> CommandResult<WebviewWindow> {
    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html?view=main".into()))
        .title("ShowME — Visual Lesson Compiler")
        .inner_size(1180.0, 760.0)
        .min_inner_size(940.0, 620.0)
        .decorations(false)
        .resizable(true)
        .center()
        .visible(!visible)
        .build()
        .map_err(|error| CommandError::internal("create main window", error))
}

fn create_pet_window(
    app: &App,
    onboarding_complete: bool,
    pet_scale: f64,
) -> CommandResult<WebviewWindow> {
    let (width, height) = launcher_dimensions(LauncherMode::Peek, pet_scale);
    WebviewWindowBuilder::new(app, "pet", WebviewUrl::App("index.html?view=pet".into()))
        .title("ShowME")
        .inner_size(width, height)
        .decorations(false)
        .transparent(true)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .visible(onboarding_complete)
        .build()
        .map_err(|error| CommandError::internal("create pet window", error))
}

fn position_launcher(window: &WebviewWindow) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let position = monitor.position();
        let size = monitor.size();
        let window_size = window.outer_size().unwrap_or_default();
        let monitor_width = i32::try_from(size.width).unwrap_or(0);
        let launcher_width = i32::try_from(window_size.width).unwrap_or(0);
        let x = position.x + (monitor_width - launcher_width) / 2;
        let y = position.y;
        window.set_position(PhysicalPosition::new(x, y)).ok();
    }
}

fn launcher_dimensions(mode: LauncherMode, scale: f64) -> (f64, f64) {
    launcher_dimensions_for_platform(mode, scale, std::env::consts::OS)
}

fn launcher_dimensions_for_platform(mode: LauncherMode, scale: f64, platform: &str) -> (f64, f64) {
    let safe_scale = scale.clamp(0.8, 1.45);
    let macos = platform == "macos";
    match mode {
        LauncherMode::Peek => (
            if macos {
                MAC_CAMERA_SAFE_PEEK_WIDTH
            } else {
                LAUNCHER_PEEK_WIDTH
            },
            if macos { 34.0 } else { LAUNCHER_PEEK_HEIGHT },
        ),
        LauncherMode::Ready => (
            (if macos {
                MAC_CAMERA_SAFE_READY_WIDTH
            } else {
                LAUNCHER_READY_WIDTH
            }) * safe_scale,
            LAUNCHER_READY_HEIGHT * safe_scale,
        ),
        LauncherMode::Menu => (
            (if macos {
                MAC_CAMERA_SAFE_READY_WIDTH
            } else {
                LAUNCHER_READY_WIDTH
            }) * safe_scale,
            LAUNCHER_MENU_HEIGHT * safe_scale,
        ),
        LauncherMode::Panel => (
            LAUNCHER_PANEL_WIDTH,
            LAUNCHER_PANEL_HEIGHT + (safe_scale - 1.0).max(0.0) * 24.0,
        ),
    }
}

pub fn set_launcher_mode(app: &AppHandle, mode: LauncherMode, scale: f64) -> CommandResult<()> {
    let window = app.get_webview_window("pet").ok_or_else(|| {
        CommandError::new(
            "WINDOW_UNAVAILABLE",
            "The ShowME launcher window is unavailable.",
        )
    })?;
    let previous_position = window.outer_position().ok();
    let previous_size = window.outer_size().ok();
    let (width, height) = launcher_dimensions(mode, scale);
    let factor = window.scale_factor().unwrap_or(1.0);
    window
        .set_size(Size::Logical(LogicalSize::new(width, height)))
        .map_err(|error| CommandError::internal("resize launcher window", error))?;
    if let (Some(position), Some(size)) = (previous_position, previous_size) {
        let target_width = (width * factor).round() as i32;
        let previous_width = i32::try_from(size.width).unwrap_or(0);
        let next_x = position.x + (previous_width - target_width) / 2;
        let next_y = position.y;
        window
            .set_position(PhysicalPosition::new(next_x, next_y))
            .ok();
    }
    Ok(())
}

fn install_close_to_hide(window: &WebviewWindow) {
    let cloned = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            cloned.hide().ok();
        }
    });
}

fn create_tray(app: &App) -> CommandResult<()> {
    let new_lesson = MenuItem::with_id(app, "new-lesson", "New visual lesson", true, None::<&str>)
        .map_err(|error| CommandError::internal("create tray item", error))?;
    let open = MenuItem::with_id(app, "open", "Open ShowME", true, None::<&str>)
        .map_err(|error| CommandError::internal("create tray item", error))?;
    let show_pet = MenuItem::with_id(app, "show-pet", "Show capture bar", true, None::<&str>)
        .map_err(|error| CommandError::internal("create tray item", error))?;
    let separator = PredefinedMenuItem::separator(app)
        .map_err(|error| CommandError::internal("create tray separator", error))?;
    let quit = MenuItem::with_id(app, "quit", "Quit ShowME", true, None::<&str>)
        .map_err(|error| CommandError::internal("create tray item", error))?;
    let menu = Menu::with_items(app, &[&new_lesson, &open, &show_pet, &separator, &quit])
        .map_err(|error| CommandError::internal("create tray menu", error))?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("ShowME — Don’t explain it. Make it visible.")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "new-lesson" => start_capture_from_event(app),
            "open" => {
                show_main(app, None).ok();
            }
            "show-pet" => reveal_pet(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle(), None).ok();
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder
        .build(app)
        .map_err(|error| CommandError::internal("create tray icon", error))?;
    Ok(())
}

fn start_capture_from_event(app: &AppHandle) {
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let state = handle.state::<crate::models::AppState>();
        if let Err(error) = crate::capture::begin(&handle, &state).await {
            log::warn!("capture invocation failed: {}", error.code);
            crate::commands::emit_error(&handle, &error);
            show_main(&handle, None).ok();
        }
    });
}

pub fn show_main(app: &AppHandle, section: Option<&str>) -> CommandResult<()> {
    let window = app.get_webview_window("main").ok_or_else(|| {
        CommandError::new(
            "WINDOW_UNAVAILABLE",
            "The ShowME lesson window is unavailable.",
        )
    })?;
    window
        .show()
        .and_then(|_| window.unminimize())
        .and_then(|_| window.set_focus())
        .map_err(|error| CommandError::internal("show main window", error))?;
    if let Some(section) = section {
        use tauri::Emitter;
        app.emit("showme:navigate", section)
            .map_err(|error| CommandError::internal("navigate main window", error))?;
    }
    Ok(())
}

pub fn reveal_pet(app: &AppHandle) {
    if let Some(pet) = app.get_webview_window("pet") {
        pet.show().ok();
        pet.unminimize().ok();
    }
}

pub fn hide_main(app: &AppHandle) -> CommandResult<()> {
    app.get_webview_window("main")
        .ok_or_else(|| {
            CommandError::new(
                "WINDOW_UNAVAILABLE",
                "The ShowME lesson window is unavailable.",
            )
        })?
        .hide()
        .map_err(|error| CommandError::internal("hide main window", error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launcher_peek_has_no_large_transparent_hit_area() {
        assert_eq!(
            launcher_dimensions_for_platform(LauncherMode::Peek, 1.0, "windows"),
            (96.0, 26.0)
        );
        assert_eq!(
            launcher_dimensions_for_platform(LauncherMode::Peek, 1.45, "windows"),
            (96.0, 26.0)
        );
        assert_eq!(
            launcher_dimensions_for_platform(LauncherMode::Peek, 1.0, "macos"),
            (220.0, 34.0)
        );
    }

    #[test]
    fn revealed_launcher_dimensions_follow_the_saved_scale() {
        assert_eq!(
            launcher_dimensions_for_platform(LauncherMode::Ready, 1.0, "windows"),
            (320.0, 58.0)
        );
        assert_eq!(
            launcher_dimensions_for_platform(LauncherMode::Ready, 1.25, "windows"),
            (400.0, 72.5)
        );
        let clamped = launcher_dimensions_for_platform(LauncherMode::Ready, 9.0, "windows");
        assert!((clamped.0 - 464.0).abs() < 0.001);
        assert!((clamped.1 - 84.1).abs() < 0.001);
        assert_eq!(
            launcher_dimensions_for_platform(LauncherMode::Ready, 1.0, "macos"),
            (448.0, 58.0)
        );
    }

    #[test]
    fn expanded_request_panel_stays_compact() {
        assert_eq!(
            launcher_dimensions(LauncherMode::Panel, 0.8),
            (468.0, 520.0)
        );
        assert_eq!(
            launcher_dimensions(LauncherMode::Panel, 1.45),
            (468.0, 530.8)
        );
    }
}

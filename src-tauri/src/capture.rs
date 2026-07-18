use crate::{
    error::{CommandError, CommandResult},
    models::{
        AppState, CapturePayload, MonitorInfo, PendingCapture, PreparedCapture, PreparedContext,
        SelectionKind, SelectionRegion,
    },
    safety,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use chrono::Utc;
use image::{ColorType, ImageEncoder, codecs::png::PngEncoder};
use std::io::Cursor;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};
use tokio::time::{Duration, sleep};
use uuid::Uuid;
use xcap::{Monitor, Window};

impl PendingCapture {
    pub fn payload(&self) -> CapturePayload {
        CapturePayload {
            capture_id: self.capture_id.clone(),
            image_data_url: format!("data:image/png;base64,{}", STANDARD.encode(&self.png)),
            monitor: self.monitor.clone(),
            captured_at: self.captured_at.clone(),
        }
    }
}

pub async fn begin(app: &AppHandle, state: &AppState) -> CommandResult<CapturePayload> {
    if let Some(existing) = state
        .pending_capture
        .lock()
        .map_err(|error| CommandError::internal("lock pending capture", error))?
        .clone()
    {
        show_selection_window(app, &existing.monitor)?;
        return Ok(existing.payload());
    }

    let point = invocation_monitor_point(app);
    let active_window = capture_active_window();
    hide_window(app, "main");
    hide_window(app, "pet");
    hide_window(app, "selection");
    sleep(Duration::from_millis(90)).await;

    let captured = tauri::async_runtime::spawn_blocking(move || capture_monitor(point))
        .await
        .map_err(|error| CommandError::internal("join capture task", error))??;
    let pending = PendingCapture {
        capture_id: Uuid::new_v4().to_string(),
        png: captured.0,
        active_window_png: active_window.as_ref().map(|item| item.0.clone()),
        active_window_title: active_window.map(|item| item.1),
        monitor: captured.1,
        captured_at: Utc::now().to_rfc3339(),
    };
    let payload = pending.payload();
    *state
        .pending_capture
        .lock()
        .map_err(|error| CommandError::internal("store pending capture", error))? = Some(pending);
    show_selection_window(app, &payload.monitor)?;
    log::info!("capture ready for explicit selection");
    Ok(payload)
}

fn invocation_monitor_point(app: &AppHandle) -> Option<(i32, i32)> {
    app.get_webview_window("pet").and_then(|window| {
        let position = window.outer_position().ok()?;
        let size = window.outer_size().ok()?;
        Some((
            position.x + i32::try_from(size.width / 2).ok()?,
            position.y + i32::try_from(size.height / 2).ok()?,
        ))
    })
}

fn capture_monitor(point: Option<(i32, i32)>) -> CommandResult<(Vec<u8>, MonitorInfo)> {
    let monitor = match point {
        Some((x, y)) => Monitor::from_point(x, y).or_else(|_| primary_monitor()),
        None => primary_monitor(),
    }
    .map_err(|error| capture_error(error.to_string()))?;
    let image = monitor
        .capture_image()
        .map_err(|error| capture_error(error.to_string()))?;
    let info = MonitorInfo {
        id: monitor.id().unwrap_or_default(),
        name: monitor
            .friendly_name()
            .or_else(|_| monitor.name())
            .unwrap_or_else(|_| "Display".into()),
        x: monitor.x().unwrap_or_default(),
        y: monitor.y().unwrap_or_default(),
        width: image.width(),
        height: image.height(),
        scale_factor: monitor.scale_factor().unwrap_or(1.0),
    };
    Ok((encode_rgba(&image)?, info))
}

fn primary_monitor() -> xcap::XCapResult<Monitor> {
    let monitors = Monitor::all()?;
    if let Some(primary) = monitors
        .iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
    {
        return Ok(primary.clone());
    }
    monitors
        .into_iter()
        .next()
        .ok_or_else(|| xcap::XCapError::new("No display is available"))
}

fn capture_active_window() -> Option<(Vec<u8>, String)> {
    let current_pid = std::process::id();
    let window = Window::all().ok()?.into_iter().find(|window| {
        window.pid().ok() != Some(current_pid)
            && window.is_focused().unwrap_or(false)
            && !window.is_minimized().unwrap_or(true)
    })?;
    let title = window.title().unwrap_or_else(|_| "Active window".into());
    let image = window.capture_image().ok()?;
    encode_rgba(&image).ok().map(|png| (png, title))
}

fn encode_rgba(image: &image::RgbaImage) -> CommandResult<Vec<u8>> {
    let mut output = Cursor::new(Vec::new());
    PngEncoder::new(&mut output)
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ColorType::Rgba8.into(),
        )
        .map_err(|error| CommandError::internal("encode capture", error))?;
    Ok(output.into_inner())
}

fn capture_error(detail: String) -> CommandError {
    CommandError::with_remediation(
        "SCREEN_CAPTURE_FAILED",
        "ShowME could not take an invocation-only screen snapshot.",
        format!(
            "Grant Screen Recording permission on macOS or allow graphics capture on Windows, then retry ({detail})."
        ),
    )
}

fn show_selection_window(app: &AppHandle, monitor: &MonitorInfo) -> CommandResult<()> {
    if let Some(existing) = app.get_webview_window("selection") {
        existing.close().ok();
    }
    let window = WebviewWindowBuilder::new(
        app,
        "selection",
        WebviewUrl::App("index.html?view=selection".into()),
    )
    .title("ShowME selection")
    .decorations(false)
    .transparent(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .visible(false)
    .build()
    .map_err(|error| CommandError::internal("create selection window", error))?;
    window
        .set_position(PhysicalPosition::new(monitor.x, monitor.y))
        .and_then(|_| window.set_size(PhysicalSize::new(monitor.width, monitor.height)))
        .and_then(|_| window.show())
        .and_then(|_| window.set_focus())
        .map_err(|error| CommandError::internal("show selection window", error))?;
    Ok(())
}

fn hide_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        window.hide().ok();
    }
}

pub fn pending(state: &AppState) -> CommandResult<CapturePayload> {
    state
        .pending_capture
        .lock()
        .map_err(|error| CommandError::internal("lock pending capture", error))?
        .as_ref()
        .map(PendingCapture::payload)
        .ok_or_else(|| {
            CommandError::new(
                "NO_PENDING_CAPTURE",
                "This capture has expired. Start a new selection.",
            )
        })
}

pub fn commit(
    app: &AppHandle,
    state: &AppState,
    capture_id: &str,
    regions: Vec<SelectionRegion>,
) -> CommandResult<PreparedContext> {
    safety::validate_regions(&regions)?;
    let pending = state
        .pending_capture
        .lock()
        .map_err(|error| CommandError::internal("lock pending capture", error))?
        .take()
        .ok_or_else(|| {
            CommandError::new(
                "NO_PENDING_CAPTURE",
                "This capture has expired. Start a new selection.",
            )
        })?;
    if pending.capture_id != capture_id {
        return Err(CommandError::new(
            "CAPTURE_MISMATCH",
            "The selection does not belong to the current capture.",
        ));
    }
    let image = image::load_from_memory(&pending.png)
        .map_err(|error| CommandError::internal("decode pending capture", error))?;
    let (x, y, width, height) = crop_bounds(&regions, image.width(), image.height());
    let cropped = image.crop_imm(x, y, width, height).to_rgba8();
    let crop_regions =
        regions_to_crop_space(&regions, image.width(), image.height(), x, y, width, height);
    let prepared = PreparedCapture {
        capture_id: pending.capture_id,
        png: encode_rgba(&cropped)?,
        nearby_context_png: pending.png,
        active_window_png: pending.active_window_png,
        active_window_title: pending.active_window_title,
        regions: crop_regions,
        pixel_width: cropped.width(),
        pixel_height: cropped.height(),
        contains_annotations: regions.iter().any(|region| {
            matches!(
                region.kind,
                SelectionKind::Circle
                    | SelectionKind::Arrow
                    | SelectionKind::Label
                    | SelectionKind::Line
            )
        }),
    };
    let payload = prepared.payload();
    *state
        .prepared_capture
        .lock()
        .map_err(|error| CommandError::internal("store prepared capture", error))? = Some(prepared);
    if let Some(window) = app.get_webview_window("selection") {
        window.close().ok();
    }
    if let Some(window) = app.get_webview_window("pet") {
        window.show().ok();
        window.unminimize().ok();
        window.set_focus().ok();
    }
    use tauri::Emitter;
    app.emit("showme:capture-ready", &payload)
        .map_err(|error| CommandError::internal("notify capture ready", error))?;
    Ok(payload)
}

fn crop_bounds(
    regions: &[SelectionRegion],
    image_width: u32,
    image_height: u32,
) -> (u32, u32, u32, u32) {
    let image_width_f = f64::from(image_width);
    let image_height_f = f64::from(image_height);
    let mut min_x = image_width_f;
    let mut min_y = image_height_f;
    let mut max_x = 0.0_f64;
    let mut max_y = 0.0_f64;
    for region in regions {
        if region.kind == SelectionKind::Circle && region.points.len() >= 2 {
            let center = &region.points[0];
            let edge = &region.points[region.points.len() - 1];
            let center_x = (center.x / 1000.0) * image_width_f;
            let center_y = (center.y / 1000.0) * image_height_f;
            let edge_x = (edge.x / 1000.0) * image_width_f;
            let edge_y = (edge.y / 1000.0) * image_height_f;
            let radius = (edge_x - center_x).hypot(edge_y - center_y);
            min_x = min_x.min(center_x - radius);
            min_y = min_y.min(center_y - radius);
            max_x = max_x.max(center_x + radius);
            max_y = max_y.max(center_y + radius);
        } else {
            for point in &region.points {
                let point_x = (point.x / 1000.0) * image_width_f;
                let point_y = (point.y / 1000.0) * image_height_f;
                min_x = min_x.min(point_x);
                min_y = min_y.min(point_y);
                max_x = max_x.max(point_x);
                max_y = max_y.max(point_y);
            }
        }
        if matches!(region.kind, SelectionKind::Point | SelectionKind::Label) {
            min_x -= 56.0;
            min_y -= 56.0;
            max_x += 56.0;
            max_y += 56.0;
        }
    }
    let padding = 24.0;
    min_x = (min_x - padding).clamp(0.0, image_width_f);
    min_y = (min_y - padding).clamp(0.0, image_height_f);
    max_x = (max_x + padding).clamp(0.0, image_width_f);
    max_y = (max_y + padding).clamp(0.0, image_height_f);
    let x = min_x.floor() as u32;
    let y = min_y.floor() as u32;
    let right = (max_x.ceil() as u32).clamp(x.saturating_add(1), image_width);
    let bottom = (max_y.ceil() as u32).clamp(y.saturating_add(1), image_height);
    (x, y, right - x, bottom - y)
}

fn regions_to_crop_space(
    regions: &[SelectionRegion],
    image_width: u32,
    image_height: u32,
    crop_x: u32,
    crop_y: u32,
    crop_width: u32,
    crop_height: u32,
) -> Vec<SelectionRegion> {
    let image_width = f64::from(image_width);
    let image_height = f64::from(image_height);
    let crop_x = f64::from(crop_x);
    let crop_y = f64::from(crop_y);
    let crop_width = f64::from(crop_width.max(1));
    let crop_height = f64::from(crop_height.max(1));
    regions
        .iter()
        .cloned()
        .map(|mut region| {
            for point in &mut region.points {
                let screen_x = (point.x / 1000.0) * image_width;
                let screen_y = (point.y / 1000.0) * image_height;
                point.x = (((screen_x - crop_x) / crop_width) * 1000.0).clamp(0.0, 1000.0);
                point.y = (((screen_y - crop_y) / crop_height) * 1000.0).clamp(0.0, 1000.0);
            }
            region
        })
        .collect()
}

pub fn prepared(state: &AppState) -> CommandResult<Option<PreparedContext>> {
    Ok(state
        .prepared_capture
        .lock()
        .map_err(|error| CommandError::internal("lock prepared capture", error))?
        .as_ref()
        .map(PreparedCapture::payload))
}

pub fn cancel(app: &AppHandle, state: &AppState) -> CommandResult<()> {
    *state
        .pending_capture
        .lock()
        .map_err(|error| CommandError::internal("clear pending capture", error))? = None;
    if let Some(window) = app.get_webview_window("selection") {
        window.close().ok();
    }
    if let Some(window) = app.get_webview_window("pet") {
        window.show().ok();
    }
    Ok(())
}

pub fn clear_prepared(state: &AppState) {
    if let Ok(mut capture) = state.prepared_capture.lock() {
        *capture = None;
    }
}

pub fn check_permission() -> crate::models::PermissionStatus {
    use crate::models::{PermissionStatus, PermissionValue};
    let result = primary_monitor().and_then(|monitor| monitor.capture_region(0, 0, 2, 2));
    match result {
        Ok(_) => PermissionStatus {
            capture: PermissionValue::Granted,
            microphone: PermissionValue::Unknown,
            note: "An invocation-only test frame was captured and immediately discarded.".into(),
        },
        Err(error) => PermissionStatus {
            capture: PermissionValue::Denied,
            microphone: PermissionValue::Unknown,
            note: format!(
                "Screen capture is not currently available. Grant the operating-system permission and restart if required: {error}"
            ),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalized_regions_map_to_physical_crop() {
        let regions = vec![SelectionRegion {
            id: "box".into(),
            kind: SelectionKind::Rectangle,
            points: vec![
                crate::models::Point { x: 250.0, y: 100.0 },
                crate::models::Point { x: 750.0, y: 600.0 },
            ],
            label: None,
        }];
        let (x, y, width, height) = crop_bounds(&regions, 2000, 1000);
        assert!(x < 500 && y < 100);
        assert!(width > 1000 && height > 500);
        assert!(x + width <= 2000 && y + height <= 1000);
    }

    #[test]
    fn circle_crop_contains_the_entire_screen_space_radius() {
        let regions = vec![SelectionRegion {
            id: "circle".into(),
            kind: SelectionKind::Circle,
            points: vec![
                crate::models::Point { x: 500.0, y: 500.0 },
                crate::models::Point { x: 600.0, y: 500.0 },
            ],
            label: None,
        }];
        let (x, y, width, height) = crop_bounds(&regions, 2000, 1000);
        assert!(x <= 800);
        assert!(y <= 300);
        assert!(x + width >= 1200);
        assert!(y + height >= 700);
    }

    #[test]
    fn selection_points_are_remapped_to_the_attached_crop() {
        let regions = vec![SelectionRegion {
            id: "arrow".into(),
            kind: SelectionKind::Arrow,
            points: vec![
                crate::models::Point { x: 250.0, y: 250.0 },
                crate::models::Point { x: 750.0, y: 750.0 },
            ],
            label: Some("velocity".into()),
        }];
        let mapped = regions_to_crop_space(&regions, 2000, 1000, 400, 200, 1200, 600);
        assert!((mapped[0].points[0].x - 83.333).abs() < 0.01);
        assert!((mapped[0].points[0].y - 83.333).abs() < 0.01);
        assert!((mapped[0].points[1].x - 916.666).abs() < 0.01);
        assert!((mapped[0].points[1].y - 916.666).abs() < 0.01);
        assert_eq!(mapped[0].label.as_deref(), Some("velocity"));
    }
}

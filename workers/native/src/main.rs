use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::io::{self, Read};

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
struct Point {
    x: f64,
    y: f64,
}

#[derive(Debug, Deserialize)]
struct Region {
    kind: String,
    points: Vec<Point>,
}

#[derive(Debug, Clone, Copy, Serialize)]
struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
enum Command {
    CropBounds {
        width: u32,
        height: u32,
        padding: f64,
        regions: Vec<Region>,
    },
    LogicalToPhysical {
        point: Point,
        scale_factor: f64,
        display_origin: Point,
    },
    HitTest {
        point: Point,
        tolerance: f64,
        regions: Vec<Region>,
    },
}

fn main() {
    let mut input = String::new();
    if let Err(error) = io::stdin().read_to_string(&mut input) {
        emit_error(&format!("Could not read input: {error}"));
        return;
    }
    let command: Command = match serde_json::from_str(&input) {
        Ok(value) => value,
        Err(error) => {
            emit_error(&format!("Invalid JSON request: {error}"));
            return;
        }
    };
    match execute(command) {
        Ok(result) => println!("{}", json!({ "ok": true, "result": result })),
        Err(error) => emit_error(&error),
    }
}

fn execute(command: Command) -> Result<Value, String> {
    match command {
        Command::CropBounds {
            width,
            height,
            padding,
            regions,
        } => {
            if width == 0 || height == 0 {
                return Err("Capture dimensions must be positive".into());
            }
            validate_regions(&regions)?;
            let normalized = combined_bounds(&regions, padding);
            let bounds = to_pixels(normalized, width, height);
            Ok(json!({ "bounds": bounds }))
        }
        Command::LogicalToPhysical {
            point,
            scale_factor,
            display_origin,
        } => {
            if !scale_factor.is_finite() || scale_factor <= 0.0 {
                return Err("Scale factor must be a positive finite number".into());
            }
            let physical = Point {
                x: (point.x - display_origin.x) * scale_factor,
                y: (point.y - display_origin.y) * scale_factor,
            };
            Ok(json!({ "point": physical }))
        }
        Command::HitTest {
            point,
            tolerance,
            regions,
        } => {
            validate_regions(&regions)?;
            let index = regions
                .iter()
                .enumerate()
                .rev()
                .find(|(_, region)| point_hits_region(point, region, tolerance.max(0.0)))
                .map(|(index, _)| index as i64)
                .unwrap_or(-1);
            Ok(json!({ "index": index }))
        }
    }
}

fn validate_regions(regions: &[Region]) -> Result<(), String> {
    if regions.len() > 256 {
        return Err("Too many selection regions".into());
    }
    for region in regions {
        if region.points.is_empty() || region.points.len() > 256 {
            return Err("A selection has an invalid point count".into());
        }
        if region.points.iter().any(|point| {
            !point.x.is_finite()
                || !point.y.is_finite()
                || !(0.0..=1000.0).contains(&point.x)
                || !(0.0..=1000.0).contains(&point.y)
        }) {
            return Err("Selection coordinates must be finite and normalized".into());
        }
    }
    Ok(())
}

fn combined_bounds(regions: &[Region], padding: f64) -> Bounds {
    let content: Vec<&Region> = regions.iter().filter(|region| region.kind != "label").collect();
    if content.is_empty() {
        return Bounds { x: 0.0, y: 0.0, width: 1000.0, height: 1000.0 };
    }
    let mut min_x: f64 = 1000.0;
    let mut min_y: f64 = 1000.0;
    let mut max_x: f64 = 0.0;
    let mut max_y: f64 = 0.0;
    for region in content {
        for point in &region.points {
            min_x = min_x.min(point.x);
            min_y = min_y.min(point.y);
            max_x = max_x.max(point.x);
            max_y = max_y.max(point.y);
        }
    }
    let safe_padding = if padding.is_finite() { padding.clamp(0.0, 200.0) } else { 0.0 };
    min_x = (min_x - safe_padding).max(0.0);
    min_y = (min_y - safe_padding).max(0.0);
    max_x = (max_x + safe_padding).min(1000.0);
    max_y = (max_y + safe_padding).min(1000.0);
    Bounds { x: min_x, y: min_y, width: max_x - min_x, height: max_y - min_y }
}

fn to_pixels(bounds: Bounds, width: u32, height: u32) -> Bounds {
    let pixel_width = width as f64;
    let pixel_height = height as f64;
    let x = (bounds.x / 1000.0 * pixel_width).floor().clamp(0.0, pixel_width - 1.0);
    let y = (bounds.y / 1000.0 * pixel_height).floor().clamp(0.0, pixel_height - 1.0);
    let crop_width = (bounds.width / 1000.0 * pixel_width)
        .ceil()
        .max(1.0)
        .min(pixel_width - x);
    let crop_height = (bounds.height / 1000.0 * pixel_height)
        .ceil()
        .max(1.0)
        .min(pixel_height - y);
    Bounds { x, y, width: crop_width, height: crop_height }
}

fn point_hits_region(point: Point, region: &Region, tolerance: f64) -> bool {
    if region.points.len() == 1 {
        return distance(point, region.points[0]) <= tolerance;
    }
    let bounds = combined_bounds(std::slice::from_ref(region), tolerance);
    point.x >= bounds.x
        && point.x <= bounds.x + bounds.width
        && point.y >= bounds.y
        && point.y <= bounds.y + bounds.height
}

fn distance(a: Point, b: Point) -> f64 {
    ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt()
}

fn emit_error(message: &str) {
    println!("{}", json!({ "ok": false, "error": message }));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crops_normalized_region_at_physical_resolution() {
        let regions = vec![Region {
            kind: "rectangle".into(),
            points: vec![Point { x: 250.0, y: 200.0 }, Point { x: 750.0, y: 800.0 }],
        }];
        let bounds = to_pixels(combined_bounds(&regions, 0.0), 2000, 1000);
        assert_eq!(bounds.x, 500.0);
        assert_eq!(bounds.y, 200.0);
        assert_eq!(bounds.width, 1000.0);
        assert_eq!(bounds.height, 600.0);
    }

    #[test]
    fn empty_selection_keeps_full_capture() {
        let bounds = to_pixels(combined_bounds(&[], 16.0), 2560, 1440);
        assert_eq!(bounds.width, 2560.0);
        assert_eq!(bounds.height, 1440.0);
    }
}

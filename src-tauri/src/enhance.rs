use image::{DynamicImage, ImageBuffer, RgbImage};
use imageproc::filter::gaussian_blur_f32;
use rayon::prelude::*;
use std::path::Path;

// ── Step 0: EXIF orientation ──────────────────────────────────────────────────

fn read_exif_orientation(path: &str) -> u32 {
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return 1,
    };
    let mut bufreader = std::io::BufReader::new(file);
    let exif = match exif::Reader::new().read_from_container(&mut bufreader) {
        Ok(e) => e,
        Err(_) => return 1,
    };
    exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
        .unwrap_or(1)
}

fn apply_exif_orientation(img: DynamicImage, orientation: u32) -> DynamicImage {
    use image::imageops;
    match orientation {
        2 => DynamicImage::ImageRgb8(imageops::flip_horizontal(&img.to_rgb8())),
        3 => DynamicImage::ImageRgb8(imageops::rotate180(&img.to_rgb8())),
        4 => DynamicImage::ImageRgb8(imageops::flip_vertical(&img.to_rgb8())),
        5 => {
            let rotated = imageops::rotate90(&img.to_rgb8());
            DynamicImage::ImageRgb8(imageops::flip_horizontal(&rotated))
        }
        6 => DynamicImage::ImageRgb8(imageops::rotate90(&img.to_rgb8())),
        7 => {
            let rotated = imageops::rotate270(&img.to_rgb8());
            DynamicImage::ImageRgb8(imageops::flip_horizontal(&rotated))
        }
        8 => DynamicImage::ImageRgb8(imageops::rotate270(&img.to_rgb8())),
        _ => img,
    }
}

// ── Step 1: Gentle global saturation lift ─────────────────────────────────────
// Uniform 1.08× boost across all pixels — no selective logic, no channel imbalance.

fn rgb_to_hsv(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let delta = max - min;

    let v = max;
    let s = if max == 0.0 { 0.0 } else { delta / max };
    let h = if delta == 0.0 {
        0.0
    } else if max == r {
        60.0 * (((g - b) / delta) % 6.0)
    } else if max == g {
        60.0 * ((b - r) / delta + 2.0)
    } else {
        60.0 * ((r - g) / delta + 4.0)
    };
    let h = if h < 0.0 { h + 360.0 } else { h };
    (h, s, v)
}

fn hsv_to_rgb(h: f32, s: f32, v: f32) -> (f32, f32, f32) {
    if s == 0.0 {
        return (v, v, v);
    }
    let h = h / 60.0;
    let i = h.floor() as i32;
    let f = h - i as f32;
    let p = v * (1.0 - s);
    let q = v * (1.0 - s * f);
    let t = v * (1.0 - s * (1.0 - f));
    match i % 6 {
        0 => (v, t, p),
        1 => (q, v, p),
        2 => (p, v, t),
        3 => (p, q, v),
        4 => (t, p, v),
        _ => (v, p, q),
    }
}

fn saturation_boost(img: RgbImage) -> RgbImage {
    let (width, height) = img.dimensions();
    let mut out = img.into_raw();
    out.par_chunks_mut(3).for_each(|chunk| {
        let r = chunk[0] as f32 / 255.0;
        let g = chunk[1] as f32 / 255.0;
        let b = chunk[2] as f32 / 255.0;

        let (h, s, v) = rgb_to_hsv(r, g, b);
        let (nr, ng, nb) = hsv_to_rgb(h, (s * 1.08).min(1.0), v);

        chunk[0] = (nr * 255.0).clamp(0.0, 255.0) as u8;
        chunk[1] = (ng * 255.0).clamp(0.0, 255.0) as u8;
        chunk[2] = (nb * 255.0).clamp(0.0, 255.0) as u8;
    });
    ImageBuffer::from_raw(width, height, out).expect("saturation buffer size unchanged")
}

// ── Step 2: Gentle unsharp mask ───────────────────────────────────────────────

fn unsharp_mask(img: RgbImage, sigma: f32, amount: f32) -> RgbImage {
    let blurred = gaussian_blur_f32(&img, sigma);
    let (width, height) = img.dimensions();
    let orig = img.into_raw();
    let blur = blurred.into_raw();

    let sharpened: Vec<u8> = orig
        .par_iter()
        .zip(blur.par_iter())
        .map(|(&o, &b)| {
            let o = o as f32;
            let b = b as f32;
            (o + amount * (o - b)).clamp(0.0, 255.0) as u8
        })
        .collect();

    ImageBuffer::from_raw(width, height, sharpened).expect("unsharp buffer size unchanged")
}

// ── Public entry point ────────────────────────────────────────────────────────

pub fn enhance_image(
    input_path: &str,
    output_path: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let ext = Path::new(input_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(ext.as_str(), "jpg" | "jpeg" | "png") {
        return Err(format!("Unsupported format for enhancement: .{ext}").into());
    }

    let orientation = read_exif_orientation(input_path);
    let img = image::open(input_path)?;
    let img = apply_exif_orientation(img, orientation);
    let rgb = img.to_rgb8();

    // Step 1: gentle global saturation lift (1.08×, uniform, no channel imbalance).
    let rgb = saturation_boost(rgb);

    // Step 2: gentle unsharp mask (sigma=1.0, amount=0.25).
    let rgb = unsharp_mask(rgb, 1.0, 0.25);

    // Encode at JPEG quality 92.
    let dyn_img = DynamicImage::ImageRgb8(rgb);
    let mut out_file = std::fs::File::create(output_path)?;
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out_file, 92);
    encoder.encode_image(&dyn_img)?;

    Ok(output_path.to_string())
}

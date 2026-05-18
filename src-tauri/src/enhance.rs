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
        _ => img, // 1 or unknown: no transform needed
    }
}

// ── Step 1: Auto levels (per-channel histogram stretch) ──────────────────────

fn percentile_value(histogram: &[u32; 256], total_pixels: u32, percentile: f32) -> u8 {
    let threshold = (total_pixels as f32 * percentile / 100.0) as u32;
    let mut cumulative = 0u32;
    for (value, &count) in histogram.iter().enumerate() {
        cumulative += count;
        if cumulative >= threshold {
            return value as u8;
        }
    }
    255
}

fn auto_levels(img: RgbImage) -> RgbImage {
    let (width, height) = img.dimensions();
    let total_pixels = width * height;
    let raw = img.as_raw();

    // Build per-channel histograms.
    let mut hist_r = [0u32; 256];
    let mut hist_g = [0u32; 256];
    let mut hist_b = [0u32; 256];
    for chunk in raw.chunks_exact(3) {
        hist_r[chunk[0] as usize] += 1;
        hist_g[chunk[1] as usize] += 1;
        hist_b[chunk[2] as usize] += 1;
    }

    let lo_r = percentile_value(&hist_r, total_pixels, 2.0) as f32;
    let hi_r = percentile_value(&hist_r, total_pixels, 98.0) as f32;
    let lo_g = percentile_value(&hist_g, total_pixels, 2.0) as f32;
    let hi_g = percentile_value(&hist_g, total_pixels, 98.0) as f32;
    let lo_b = percentile_value(&hist_b, total_pixels, 2.0) as f32;
    let hi_b = percentile_value(&hist_b, total_pixels, 98.0) as f32;

    // Avoid divide-by-zero when the range is too narrow.
    let range_r = (hi_r - lo_r).max(1.0);
    let range_g = (hi_g - lo_g).max(1.0);
    let range_b = (hi_b - lo_b).max(1.0);

    // Apply linear stretch in parallel over the pixel buffer.
    let mut out = raw.to_vec();
    out.par_chunks_mut(3).for_each(|chunk| {
        chunk[0] = (((chunk[0] as f32 - lo_r) / range_r * 255.0).clamp(0.0, 255.0)) as u8;
        chunk[1] = (((chunk[1] as f32 - lo_g) / range_g * 255.0).clamp(0.0, 255.0)) as u8;
        chunk[2] = (((chunk[2] as f32 - lo_b) / range_b * 255.0).clamp(0.0, 255.0)) as u8;
    });

    ImageBuffer::from_raw(width, height, out).unwrap_or(img)
}

// ── Step 2: Vibrance boost (selective saturation) ────────────────────────────

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

fn vibrance_boost(img: RgbImage) -> RgbImage {
    let (width, height) = img.dimensions();
    let mut out = img.into_raw();
    out.par_chunks_mut(3).for_each(|chunk| {
        let r = chunk[0] as f32 / 255.0;
        let g = chunk[1] as f32 / 255.0;
        let b = chunk[2] as f32 / 255.0;

        let (h, s, v) = rgb_to_hsv(r, g, b);

        // Only lift muted pixels — leave already-saturated ones alone.
        let s_boosted = if s < 0.7 { (s * 1.25).min(1.0) } else { s };

        let (nr, ng, nb) = hsv_to_rgb(h, s_boosted, v);
        chunk[0] = (nr * 255.0).clamp(0.0, 255.0) as u8;
        chunk[1] = (ng * 255.0).clamp(0.0, 255.0) as u8;
        chunk[2] = (nb * 255.0).clamp(0.0, 255.0) as u8;
    });
    ImageBuffer::from_raw(width, height, out).expect("vibrance buffer size unchanged")
}

// ── Step 3: Gentle unsharp mask ───────────────────────────────────────────────

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
    // Reject non-JPEG/PNG inputs — RAW files are not supported this phase.
    let ext = Path::new(input_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(ext.as_str(), "jpg" | "jpeg" | "png") {
        return Err(format!("Unsupported format for enhancement: .{ext}").into());
    }

    // Step 0: read EXIF orientation before decoding the image.
    let orientation = read_exif_orientation(input_path);

    // Decode.
    let img = image::open(input_path)?;

    // Step 0: apply orientation correction.
    let img = apply_exif_orientation(img, orientation);
    let rgb = img.to_rgb8();

    // Step 1: auto levels.
    let rgb = auto_levels(rgb);

    // Step 2: vibrance boost.
    let rgb = vibrance_boost(rgb);

    // Step 3: unsharp mask (sigma=1.0, amount=0.4).
    let rgb = unsharp_mask(rgb, 1.0, 0.4);

    // Step 4: save as JPEG quality 92.
    let dyn_img = DynamicImage::ImageRgb8(rgb);
    dyn_img.save_with_format(output_path, image::ImageFormat::Jpeg)?;

    // Override the JPEG quality — `save_with_format` uses the default (75 for libjpeg).
    // Re-encode explicitly at quality 92.
    let mut out_file = std::fs::File::create(output_path)?;
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out_file, 92);
    encoder.encode_image(&dyn_img)?;

    Ok(output_path.to_string())
}

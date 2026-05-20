use image::{DynamicImage, ImageBuffer, RgbImage};
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

fn saturation_boost_by(img: RgbImage, factor: f32) -> RgbImage {
    let (width, height) = img.dimensions();
    let mut out = img.into_raw();
    out.par_chunks_mut(3).for_each(|chunk| {
        let r = chunk[0] as f32 / 255.0;
        let g = chunk[1] as f32 / 255.0;
        let b = chunk[2] as f32 / 255.0;

        let (h, s, v) = rgb_to_hsv(r, g, b);
        let (nr, ng, nb) = hsv_to_rgb(h, (s * factor).min(1.0), v);

        chunk[0] = (nr * 255.0).clamp(0.0, 255.0) as u8;
        chunk[1] = (ng * 255.0).clamp(0.0, 255.0) as u8;
        chunk[2] = (nb * 255.0).clamp(0.0, 255.0) as u8;
    });
    ImageBuffer::from_raw(width, height, out).expect("saturation buffer size unchanged")
}

// ── Tonal adjustments (brightness + contrast) ────────────────────────────────
// Used by both the import pipeline and the workshop save-changes command.
// brightness: offset as a fraction of full scale, e.g. 0.15 = +15%
// contrast:   scale around midpoint 128, e.g. 0.20 = +20% contrast

fn apply_brightness_contrast(img: RgbImage, brightness: f32, contrast: f32) -> RgbImage {
    if brightness.abs() < 0.001 && contrast.abs() < 0.001 {
        return img;
    }
    let (width, height) = img.dimensions();
    let mut out = img.into_raw();
    let b_add = brightness * 255.0;
    let c_factor = 1.0 + contrast;
    out.par_chunks_mut(3).for_each(|chunk| {
        for ch in chunk.iter_mut() {
            let v = *ch as f32;
            let v = (v - 128.0) * c_factor + 128.0 + b_add;
            *ch = v.clamp(0.0, 255.0) as u8;
        }
    });
    ImageBuffer::from_raw(width, height, out).expect("tonal buffer size unchanged")
}

// ── Step 2: Gentle unsharp mask (parallel separable gaussian blur) ───────────
// Replaces imageproc::gaussian_blur_f32 which is single-threaded.
// Two-pass separable convolution: horizontal (rayon over rows) then vertical
// (rayon over columns). For sigma=1.0 the kernel is 7 taps, so the per-pixel
// cost is small and the parallelism across rows/columns is the main win.

fn gaussian_kernel(sigma: f32) -> Vec<f32> {
    let radius = (3.0 * sigma).ceil() as i32;
    let mut k: Vec<f32> = (-radius..=radius)
        .map(|x| (-(x * x) as f32 / (2.0 * sigma * sigma)).exp())
        .collect();
    let sum: f32 = k.iter().sum();
    k.iter_mut().for_each(|v| *v /= sum);
    k
}

fn blur_horizontal(src: &[u8], width: usize, _height: usize, kernel: &[f32]) -> Vec<u8> {
    let radius = kernel.len() / 2;
    let mut dst = vec![0u8; src.len()];
    dst.par_chunks_mut(width * 3)
        .enumerate()
        .for_each(|(y, row_dst)| {
            for x in 0..width {
                for c in 0..3 {
                    let mut acc = 0.0f32;
                    for (ki, &kv) in kernel.iter().enumerate() {
                        let sx = (x as i64 + ki as i64 - radius as i64)
                            .clamp(0, width as i64 - 1) as usize;
                        acc += src[y * width * 3 + sx * 3 + c] as f32 * kv;
                    }
                    row_dst[x * 3 + c] = acc.clamp(0.0, 255.0) as u8;
                }
            }
        });
    dst
}

fn blur_vertical(src: &[u8], width: usize, height: usize, kernel: &[f32]) -> Vec<u8> {
    let radius = kernel.len() / 2;
    let mut dst = vec![0u8; src.len()];
    // Parallelise over output rows — same pattern as blur_horizontal but kernel
    // is applied vertically (sy varies, x is fixed within each row).
    dst.par_chunks_mut(width * 3)
        .enumerate()
        .for_each(|(y, row_dst)| {
            for x in 0..width {
                for c in 0..3 {
                    let mut acc = 0.0f32;
                    for (ki, &kv) in kernel.iter().enumerate() {
                        let sy = (y as i64 + ki as i64 - radius as i64)
                            .clamp(0, height as i64 - 1) as usize;
                        acc += src[sy * width * 3 + x * 3 + c] as f32 * kv;
                    }
                    row_dst[x * 3 + c] = acc.clamp(0.0, 255.0) as u8;
                }
            }
        });
    dst
}

fn parallel_gaussian_blur(img: &RgbImage, sigma: f32) -> RgbImage {
    let (width, height) = img.dimensions();
    let (w, h) = (width as usize, height as usize);
    let kernel = gaussian_kernel(sigma);
    let h_pass = blur_horizontal(img.as_raw(), w, h, &kernel);
    let v_pass = blur_vertical(&h_pass, w, h, &kernel);
    ImageBuffer::from_raw(width, height, v_pass).expect("blur buffer size unchanged")
}

fn unsharp_mask(img: RgbImage, sigma: f32, amount: f32) -> RgbImage {
    let blurred = parallel_gaussian_blur(&img, sigma);
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
    brightness: f32,
    contrast: f32,
    saturation: f32,
    sharpen: f32,
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

    // Step 1: brightness + contrast.
    let rgb = apply_brightness_contrast(rgb, brightness, contrast);

    // Step 2: global saturation lift (caller-controlled, default 1.08).
    let rgb = if (saturation - 1.0).abs() > 0.001 {
        saturation_boost_by(rgb, saturation)
    } else {
        rgb
    };

    // Step 3: unsharp mask (sigma=1.0, amount controlled by caller, default 0.25).
    let rgb = if sharpen > 0.001 {
        unsharp_mask(rgb, 1.0, sharpen)
    } else {
        rgb
    };

    // Encode at JPEG quality 92.
    let dyn_img = DynamicImage::ImageRgb8(rgb);
    let mut out_file = std::fs::File::create(output_path)?;
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out_file, 92);
    encoder.encode_image(&dyn_img)?;

    Ok(output_path.to_string())
}

/// Bake workshop slider adjustments into an existing image file.
/// brightness/contrast/saturation are in the same -50..+50 range as the UI sliders
/// (divided by 100 internally). Output overwrites input when paths are identical.
pub fn apply_adjustments(
    input_path: &str,
    output_path: &str,
    brightness: f32,
    contrast: f32,
    saturation: f32,
) -> Result<String, Box<dyn std::error::Error>> {
    let img = image::open(input_path)?;
    let rgb = img.to_rgb8();

    let rgb = apply_brightness_contrast(rgb, brightness / 100.0, contrast / 100.0);
    let sat_factor = 1.0 + saturation / 100.0;
    let rgb = if (sat_factor - 1.0).abs() > 0.001 {
        saturation_boost_by(rgb, sat_factor)
    } else {
        rgb
    };

    let dyn_img = DynamicImage::ImageRgb8(rgb);
    let mut out_file = std::fs::File::create(output_path)?;
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out_file, 92);
    encoder.encode_image(&dyn_img)?;

    Ok(output_path.to_string())
}

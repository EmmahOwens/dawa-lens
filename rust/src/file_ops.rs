use image::GenericImageView;
use std::io::Cursor;

pub fn get_image_dimensions(data: &[u8]) -> Result<(u32, u32), String> {
    let img = image::load_from_memory(data).map_err(|e| e.to_string())?;
    Ok(img.dimensions())
}

pub fn compress_image_mock(data: &[u8]) -> Vec<u8> {
    // Mock compression
    data.to_vec()
}

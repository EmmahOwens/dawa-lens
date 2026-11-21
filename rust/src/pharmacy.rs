//! High-Performance Spatial & Text Index for NDA Uganda Pharmacies and Drug Shops (Rust Core)
//!
//! Eliminates thousands of per-keystroke JS string allocations, object clones, and individual
//! JS<->WASM Haversine calls when searching or ranking 9,600+ licensed outlets on mobile devices.
//!
//! Design:
//! - Ingests compact outlet metadata once per dataset (`0` = pharmacies, `1` = drug shops) and
//!   precomputes radians, `cos(lat)`, and lowercased search blobs.
//! - Uses a fast latitude bounding-box pre-filter when a radius cap is active.
//! - Uses O(N) `select_nth_unstable_by` partial selection for top-K distance ranking so only the
//!   winning `limit` records are sorted and returned back across the FFI boundary.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const EARTH_RADIUS_KM: f64 = 6371.0;
const KM_PER_DEGREE_LAT: f64 = 110.574;

#[derive(Debug, Deserialize)]
pub struct OutletInput {
    /// Original index in the caller's JS/Kotlin array
    pub i: u32,
    pub la: f64,
    pub lo: f64,
    pub r: bool,
    pub d: String,
    pub s: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutletQuery {
    pub dataset_id: u32,
    pub user_lat: f64,
    pub user_lng: f64,
    #[serde(default = "default_radius")]
    pub radius_km: f64,
    #[serde(default)]
    pub district: String,
    #[serde(default)]
    pub query: String,
    #[serde(default)]
    pub only_retail: bool,
    #[serde(default = "default_limit")]
    pub limit: usize,
    /// When true, bypasses the radius cap (used by findTopNearestPharmacies / DrugShops)
    #[serde(default)]
    pub ignore_radius: bool,
}

fn default_radius() -> f64 {
    25.0
}

fn default_limit() -> usize {
    50
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OutletHit {
    /// Original index in the caller's array
    pub i: u32,
    /// Great-circle Haversine distance in km (rounded to 0.01 km)
    pub d: f64,
}

struct IndexedOutlet {
    idx: u32,
    lat_deg: f64,
    lat_rad: f64,
    lon_rad: f64,
    cos_lat: f64,
    is_retail: bool,
    district_lower: String,
    search_lower: String,
}

static PHARMACY_STORE: Mutex<Vec<IndexedOutlet>> = Mutex::new(Vec::new());
static DRUG_SHOP_STORE: Mutex<Vec<IndexedOutlet>> = Mutex::new(Vec::new());

fn store_for(dataset_id: u32) -> &'static Mutex<Vec<IndexedOutlet>> {
    if dataset_id == 1 {
        &DRUG_SHOP_STORE
    } else {
        &PHARMACY_STORE
    }
}

/// Loads and indexes an outlet dataset from compact JSON.
/// Returns the number of indexed outlets (or -1 on parse failure).
pub fn load_outlets(dataset_id: u32, json_str: &str) -> i32 {
    let parsed: Vec<OutletInput> = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(_) => return -1,
    };

    let mut indexed = Vec::with_capacity(parsed.len());
    for item in parsed {
        if !item.la.is_finite() || !item.lo.is_finite() {
            continue;
        }
        let lat_rad = item.la.to_radians();
        let lon_rad = item.lo.to_radians();
        indexed.push(IndexedOutlet {
            idx: item.i,
            lat_deg: item.la,
            lat_rad,
            lon_rad,
            cos_lat: lat_rad.cos(),
            is_retail: item.r,
            district_lower: item.d.trim().to_ascii_lowercase(),
            search_lower: item.s.to_ascii_lowercase(),
        });
    }

    let count = indexed.len() as i32;
    if let Ok(mut guard) = store_for(dataset_id).lock() {
        *guard = indexed;
        count
    } else {
        -1
    }
}

#[inline]
fn fast_haversine_km(
    user_lat_rad: f64,
    user_lon_rad: f64,
    user_cos_lat: f64,
    outlet: &IndexedOutlet,
) -> f64 {
    let d_lat = outlet.lat_rad - user_lat_rad;
    let d_lon = outlet.lon_rad - user_lon_rad;
    let sin_dlat = (d_lat * 0.5).sin();
    let sin_dlon = (d_lon * 0.5).sin();
    let a = sin_dlat * sin_dlat + user_cos_lat * outlet.cos_lat * sin_dlon * sin_dlon;
    let clamped_a = a.clamp(0.0, 1.0);
    let c = 2.0 * clamped_a.sqrt().atan2((1.0 - clamped_a).sqrt());
    let dist = EARTH_RADIUS_KM * c;
    (dist * 100.0).round() / 100.0
}

/// Filters and ranks outlets by ascending Haversine distance using O(N) partial selection.
pub fn query_outlets(query_json: &str) -> Vec<OutletHit> {
    let q: OutletQuery = match serde_json::from_str(query_json) {
        Ok(parsed) => parsed,
        Err(_) => return Vec::new(),
    };

    if !q.user_lat.is_finite() || !q.user_lng.is_finite() || q.limit == 0 {
        return Vec::new();
    }

    let guard = match store_for(q.dataset_id).lock() {
        Ok(g) => g,
        Err(_) => return Vec::new(),
    };

    if guard.is_empty() {
        return Vec::new();
    }

    let district_q = q.district.trim().to_ascii_lowercase();
    let has_district = !district_q.is_empty() && district_q != "all";
    let text_q = q.query.trim().to_ascii_lowercase();
    let has_text = !text_q.is_empty();
    let has_specific_filter = has_district || has_text;

    let apply_radius =
        !q.ignore_radius && !has_specific_filter && q.radius_km > 0.0 && q.radius_km < 1000.0;
    // Slight margin (+0.2 deg) avoids floating-point edge drops near radius boundary
    let max_lat_delta = if apply_radius {
        (q.radius_km / KM_PER_DEGREE_LAT) + 0.2
    } else {
        f64::INFINITY
    };

    let user_lat_rad = q.user_lat.to_radians();
    let user_lon_rad = q.user_lng.to_radians();
    let user_cos_lat = user_lat_rad.cos();

    let mut matches: Vec<OutletHit> = Vec::with_capacity(guard.len().min(256));

    for outlet in guard.iter() {
        if q.only_retail && !outlet.is_retail {
            continue;
        }
        if has_district && outlet.district_lower != district_q {
            continue;
        }
        if has_text && !outlet.search_lower.contains(&text_q) {
            continue;
        }
        if apply_radius && (outlet.lat_deg - q.user_lat).abs() > max_lat_delta {
            continue;
        }

        let dist = fast_haversine_km(user_lat_rad, user_lon_rad, user_cos_lat, outlet);
        if apply_radius && dist > q.radius_km {
            continue;
        }

        matches.push(OutletHit {
            i: outlet.idx,
            d: dist,
        });
    }

    let cmp = |a: &OutletHit, b: &OutletHit| {
        a.d.total_cmp(&b.d).then_with(|| a.i.cmp(&b.i))
    };

    let limit = q.limit.min(matches.len());
    if limit == 0 {
        return Vec::new();
    }

    if matches.len() > limit {
        // O(N) quickselect puts the closest `limit` outlets in the first slice
        matches.select_nth_unstable_by(limit, cmp);
        matches.truncate(limit);
    }
    matches.sort_unstable_by(cmp);
    matches
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_filters_and_ranks_outlets_by_distance() {
        let sample = r#"[
            {"i": 0, "la": 0.3476, "lo": 32.5825, "r": true,  "d": "Kampala", "s": "central pharmacy kampala"},
            {"i": 1, "la": 0.0512, "lo": 32.4637, "r": true,  "d": "Wakiso",  "s": "entebbe care pharmacy wakiso"},
            {"i": 2, "la": 0.3500, "lo": 32.5850, "r": false, "d": "Kampala", "s": "wholesale depot kampala"}
        ]"#;
        assert_eq!(load_outlets(0, sample), 3);

        // Retail only within 25km of Kampala -> only index 0 (index 2 is wholesale, index 1 is ~35km away)
        let hits = query_outlets(
            r#"{"datasetId":0,"userLat":0.3476,"userLng":32.5825,"radiusKm":25,"onlyRetail":true,"limit":10}"#,
        );
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].i, 0);
        assert_eq!(hits[0].d, 0.0);

        // Explicit district bypasses 25km radius cap
        let wakiso = query_outlets(
            r#"{"datasetId":0,"userLat":0.3476,"userLng":32.5825,"radiusKm":10,"district":"Wakiso","onlyRetail":true,"limit":10}"#,
        );
        assert_eq!(wakiso.len(), 1);
        assert_eq!(wakiso[0].i, 1);
        assert!(wakiso[0].d > 30.0 && wakiso[0].d < 40.0);

        // Explicit query bypasses radius cap
        let search = query_outlets(
            r#"{"datasetId":0,"userLat":0.3476,"userLng":32.5825,"radiusKm":5,"query":"entebbe","onlyRetail":true,"limit":10}"#,
        );
        assert_eq!(search.len(), 1);
        assert_eq!(search[0].i, 1);
    }
}

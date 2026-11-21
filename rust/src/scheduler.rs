//! Zero-Dependency Adherence Analytics & Recurrence Math (Rust Core)
//!
//! Computes 7-day vitality & adherence summaries in a single O(N) pass and resolves
//! reminder recurrence slot offsets without pulling heavy datetime crates into the WASM binary.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VitalityDoseEntry {
    pub day_key: i32,
    pub taken: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VitalityWellnessEntry {
    pub day_key: i32,
    pub ts: f64,
    pub mood: Option<f64>,
    pub energy: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VitalityRequest {
    pub day_keys: Vec<i32>,
    pub day_names: Vec<String>,
    pub dose_logs: Vec<VitalityDoseEntry>,
    pub wellness_logs: Vec<VitalityWellnessEntry>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct VitalityDataPoint {
    pub name: String,
    pub adherence: f64,
    pub energy: Option<i32>,
    pub mood: Option<i32>,
}

/// Computes the 7-day vitality summary in a single linear pass over dose logs and wellness logs.
/// Matches `calculateVitalitySummary` in `src/lib/vitalityUtils.ts` 1:1.
pub fn compute_vitality_summary(request_json: &str) -> Vec<VitalityDataPoint> {
    let req: VitalityRequest = match serde_json::from_str(request_json) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    let n = req.day_keys.len().min(req.day_names.len());
    if n == 0 {
        return Vec::new();
    }

    let mut taken_counts = vec![0u32; n];
    let mut total_counts = vec![0u32; n];
    let mut latest_energy_ts = vec![f64::NEG_INFINITY; n];
    let mut latest_energy_val: Vec<Option<i32>> = vec![None; n];
    let mut latest_mood_ts = vec![f64::NEG_INFINITY; n];
    let mut latest_mood_val: Vec<Option<i32>> = vec![None; n];

    // Linear bucket lookup (n is typically 7 — faster than hashing with zero heap allocation)
    let find_slot = |day_key: i32| -> Option<usize> {
        req.day_keys[..n].iter().position(|&k| k == day_key)
    };

    for dose in &req.dose_logs {
        if let Some(slot) = find_slot(dose.day_key) {
            total_counts[slot] += 1;
            if dose.taken {
                taken_counts[slot] += 1;
            }
        }
    }

    for entry in &req.wellness_logs {
        if let Some(slot) = find_slot(entry.day_key) {
            if let Some(e) = entry.energy {
                if e.is_finite() && e > 0.0 && entry.ts >= latest_energy_ts[slot] {
                    latest_energy_ts[slot] = entry.ts;
                    let clamped = (e.round() as i32).clamp(1, 5);
                    latest_energy_val[slot] = Some(clamped * 20);
                }
            }
            if let Some(m) = entry.mood {
                if m.is_finite() && m > 0.0 && entry.ts >= latest_mood_ts[slot] {
                    latest_mood_ts[slot] = entry.ts;
                    let clamped = (m.round() as i32).clamp(1, 5);
                    latest_mood_val[slot] = Some(clamped * 20);
                }
            }
        }
    }

    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let adherence = if total_counts[i] > 0 {
            (taken_counts[i] as f64 / total_counts[i] as f64) * 100.0
        } else {
            100.0
        };
        out.push(VitalityDataPoint {
            name: req.day_names[i].clone(),
            adherence,
            energy: latest_energy_val[i],
            mood: latest_mood_val[i],
        });
    }
    out
}

/// Parses comma-separated `HH:mm` schedule times and returns the next `count` upcoming
/// occurrence minute-offsets relative to `now_minutes_since_midnight`.
pub fn calculate_next_occurrence_offsets(
    times_csv: &str,
    now_minutes_since_midnight: u32,
    count: usize,
) -> Vec<u32> {
    let mut parsed_times: Vec<u32> = times_csv
        .split(',')
        .filter_map(|part| {
            let trimmed = part.trim();
            let mut split = trimmed.split(':');
            let h: u32 = split.next()?.trim().parse().ok()?;
            let m: u32 = split.next()?.trim().parse().ok()?;
            if h <= 23 && m <= 59 {
                Some(h * 60 + m)
            } else {
                None
            }
        })
        .collect();

    if parsed_times.is_empty() || count == 0 {
        return Vec::new();
    }

    parsed_times.sort_unstable();
    parsed_times.dedup();

    let mut results = Vec::with_capacity(count.min(32));
    let mut day_offset = 0u32;
    let max_days = 30u32;

    while results.len() < count && day_offset <= max_days {
        for &slot_min in &parsed_times {
            let abs_min = day_offset * 1440 + slot_min;
            if abs_min > now_minutes_since_midnight {
                results.push(abs_min - now_minutes_since_midnight);
                if results.len() >= count {
                    break;
                }
            }
        }
        day_offset += 1;
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_7_day_vitality_accurately() {
        let req = r#"{
            "dayKeys": [20261115, 20261116],
            "dayNames": ["Nov 15", "Nov 16"],
            "doseLogs": [
                {"dayKey": 20261115, "taken": true},
                {"dayKey": 20261115, "taken": false}
            ],
            "wellnessLogs": [
                {"dayKey": 20261115, "ts": 1000, "mood": 2, "energy": 3},
                {"dayKey": 20261115, "ts": 2000, "mood": 4, "energy": null}
            ]
        }"#;
        let res = compute_vitality_summary(req);
        assert_eq!(res.len(), 2);
        assert_eq!(res[0].adherence, 50.0);
        assert_eq!(res[0].mood, Some(80));
        assert_eq!(res[0].energy, Some(60));
        assert_eq!(res[1].adherence, 100.0);
        assert_eq!(res[1].mood, None);
    }

    #[test]
    fn calculates_next_recurrence_offsets() {
        // Now is 09:00 (540m), slots at 08:00 (480m) and 20:00 (1200m)
        let next = calculate_next_occurrence_offsets("08:00, 20:00", 540, 3);
        assert_eq!(next, vec![660, 1380, 2100]);
    }
}

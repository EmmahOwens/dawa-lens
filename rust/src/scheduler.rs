use chrono::{DateTime, Utc, Duration, Timelike};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct Reminder {
    pub id: String,
    pub time: String, // "HH:mm,HH:mm"
    pub repeat_schedule: String, // "daily", "weekly", etc.
}

pub fn calculate_next_occurrences(reminder: &Reminder, start_from: DateTime<Utc>, count: usize) -> Vec<DateTime<Utc>> {
    let mut occurrences = Vec::new();
    let times: Vec<&str> = reminder.time.split(',').collect();

    let mut current = start_from;
    while occurrences.len() < count {
        for time_str in &times {
            let parts: Vec<&str> = time_str.split(':').collect();
            if parts.len() == 2 {
                if let (Ok(h), Ok(m)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                    let mut candidate = current.with_hour(h).unwrap().with_minute(m).unwrap().with_second(0).unwrap();
                    if candidate > start_from {
                        occurrences.push(candidate);
                    }
                }
            }
        }
        current = current + Duration::days(1);
        if occurrences.len() > 100 || current > start_from + Duration::days(30) {
            break;
        }
    }

    occurrences.sort();
    occurrences.into_iter().take(count).collect()
}

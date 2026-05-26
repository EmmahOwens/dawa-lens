use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
struct PgnData {
    event: String,
    site: String,
    date: String,
    moves: Vec<String>,
}

pub fn parse_pgn_mock(pgn: &str) -> String {
    // In a real app, use a real PGN parser. For now, we mock it to show offloading.
    format!("Parsed PGN of length {}", pgn.len())
}

pub fn parse_large_json(json: &str) -> Result<Value, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

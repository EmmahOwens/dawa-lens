use rusqlite::{params, Connection, ToSql};
use std::sync::Mutex;

static DB: Mutex<Option<Connection>> = Mutex::new(None);

const CREATE_STATEMENTS: &[&str] = &[
    "CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, generic_name TEXT,
        dosage TEXT, form TEXT, current_quantity REAL DEFAULT 0,
        dosage_per_dose REAL DEFAULT 1, color TEXT, icon TEXT,
        patient_id TEXT, user_id TEXT, added_at TEXT NOT NULL,
        updated_at TEXT, is_conflict INTEGER DEFAULT 0,
        image_url TEXT, notes TEXT
    )",
    "CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY, medicine_id TEXT, medicine_name TEXT NOT NULL,
        dose TEXT NOT NULL, time TEXT NOT NULL, repeat_schedule TEXT NOT NULL,
        repeat_days TEXT, notes TEXT, enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, color TEXT, icon TEXT,
        patient_id TEXT, patient_name TEXT
    )",
    "CREATE TABLE IF NOT EXISTS dose_logs (
        id TEXT PRIMARY KEY, reminder_id TEXT NOT NULL,
        medicine_name TEXT NOT NULL, dose TEXT NOT NULL,
        scheduled_time TEXT NOT NULL, action_time TEXT NOT NULL,
        action TEXT NOT NULL, is_snoozed INTEGER DEFAULT 0,
        snooze_until TEXT, patient_id TEXT
    )",
    "CREATE INDEX IF NOT EXISTS idx_dose_pid_time ON dose_logs (patient_id, action_time)",
    "CREATE INDEX IF NOT EXISTS idx_dose_rid_time ON dose_logs (reminder_id, action_time)",
    "CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER,
        gender TEXT, weight REAL, conditions TEXT,
        managed_by TEXT, created_at TEXT NOT NULL
    )",
    "CREATE TABLE IF NOT EXISTS wellness_logs (
        id TEXT PRIMARY KEY, type TEXT NOT NULL,
        timestamp TEXT NOT NULL, data TEXT NOT NULL,
        user_id TEXT, patient_id TEXT
    )",
    "CREATE INDEX IF NOT EXISTS idx_wellness_pid_ts ON wellness_logs (patient_id, timestamp)"
];

pub fn db_initialize(path: &str) -> Result<(), String> {
    let mut db_lock = DB.lock().map_err(|e| e.to_string())?;
    if db_lock.is_some() {
        return Ok(());
    }
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    
    // Enable WAL mode for performance/concurrency
    let _ = conn.execute("PRAGMA journal_mode=WAL;", []);
    let _ = conn.execute("PRAGMA synchronous=NORMAL;", []);
    
    for sql in CREATE_STATEMENTS {
        conn.execute(sql, []).map_err(|e| format!("Schema init failed: {}", e))?;
    }
    
    *db_lock = Some(conn);
    Ok(())
}

fn json_to_sqlite_value(val: &serde_json::Value) -> rusqlite::types::Value {
    match val {
        serde_json::Value::Null => rusqlite::types::Value::Null,
        serde_json::Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                rusqlite::types::Value::Real(f)
            } else {
                rusqlite::types::Value::Null
            }
        }
        serde_json::Value::String(s) => rusqlite::types::Value::Text(s.clone()),
        _ => rusqlite::types::Value::Text(val.to_string()),
    }
}

pub fn db_execute(sql: &str, params_json: &str) -> Result<(usize, i64), String> {
    let db_lock = DB.lock().map_err(|e| e.to_string())?;
    let conn = db_lock.as_ref().ok_or("Database not initialized")?;
    
    let params_val: serde_json::Value = serde_json::from_str(params_json).map_err(|e| e.to_string())?;
    let params_arr = params_val.as_array().ok_or("Params must be a JSON array")?;
    
    let sqlite_params: Vec<rusqlite::types::Value> = params_arr.iter().map(json_to_sqlite_value).collect();
    
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let params_ref: Vec<&dyn ToSql> = sqlite_params.iter().map(|v| v as &dyn ToSql).collect();
    
    let rows_affected = stmt.execute(&*params_ref).map_err(|e| e.to_string())?;
    let last_insert_id = conn.last_insert_rowid();
    
    Ok((rows_affected, last_insert_id))
}

pub fn db_query(sql: &str, params_json: &str) -> Result<String, String> {
    let db_lock = DB.lock().map_err(|e| e.to_string())?;
    let conn = db_lock.as_ref().ok_or("Database not initialized")?;
    
    let params_val: serde_json::Value = serde_json::from_str(params_json).map_err(|e| e.to_string())?;
    let params_arr = params_val.as_array().ok_or("Params must be a JSON array")?;
    
    let sqlite_params: Vec<rusqlite::types::Value> = params_arr.iter().map(json_to_sqlite_value).collect();
    
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let params_ref: Vec<&dyn ToSql> = sqlite_params.iter().map(|v| v as &dyn ToSql).collect();
    
    let col_names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();
    
    let mut rows = stmt.query(&*params_ref).map_err(|e| e.to_string())?;
    
    let mut results = Vec::new();
    
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut row_map = serde_json::Map::new();
        for (i, name) in col_names.iter().enumerate() {
            let val = row.get_ref(i).map_err(|e| e.to_string())?;
            let json_val = match val {
                rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                rusqlite::types::ValueRef::Integer(n) => serde_json::Value::Number(serde_json::Number::from(n)),
                rusqlite::types::ValueRef::Real(f) => {
                    if let Some(num) = serde_json::Number::from_f64(f) {
                        serde_json::Value::Number(num)
                    } else {
                        serde_json::Value::Null
                    }
                }
                rusqlite::types::ValueRef::Text(s) => {
                    let s_str = std::str::from_utf8(s).map_err(|e| e.to_string())?;
                    serde_json::Value::String(s_str.to_string())
                }
                rusqlite::types::ValueRef::Blob(b) => {
                    if let Ok(s) = std::str::from_utf8(b) {
                        serde_json::Value::String(s.to_string())
                    } else {
                        serde_json::Value::Null
                    }
                }
            };
            row_map.insert(name.clone(), json_val);
        }
        results.push(serde_json::Value::Object(row_map));
    }
    
    let json_res = serde_json::Value::Array(results);
    serde_json::to_string(&json_res).map_err(|e| e.to_string())
}

pub fn db_close() -> Result<(), String> {
    let mut db_lock = DB.lock().map_err(|e| e.to_string())?;
    *db_lock = None;
    Ok(())
}

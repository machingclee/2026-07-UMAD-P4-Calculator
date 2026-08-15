use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overlay_x: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overlay_y: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_x: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_y: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_width: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_height: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
}

/// Same as python/main.py: config.json lives next to the executable.
pub fn config_path() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("config.json")))
        .unwrap_or_else(|| PathBuf::from("config.json"))
}

pub fn load() -> Config {
    match fs::read_to_string(config_path()) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

pub fn save(cfg: &Config) {
    if let Ok(raw) = serde_json::to_string_pretty(cfg) {
        let _ = fs::write(config_path(), raw);
    }
}

pub fn update(f: impl FnOnce(&mut Config)) {
    let mut cfg = load();
    f(&mut cfg);
    save(&cfg);
}

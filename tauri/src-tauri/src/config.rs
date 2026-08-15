use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

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

fn exe_dir_config() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("config.json")))
        .unwrap_or_else(|| PathBuf::from("config.json"))
}

/// Release: `%AppData%\com.ff14.p4calculator\config.json`.
/// Debug: next to the exe so local iteration is easy.
pub fn config_path(app: &AppHandle) -> PathBuf {
    #[cfg(not(debug_assertions))]
    {
        if let Ok(dir) = app.path().app_config_dir() {
            let dest = dir.join("config.json");
            if !dest.exists() {
                let _ = fs::create_dir_all(&dir);
                let legacy = exe_dir_config();
                if legacy.exists() {
                    let _ = fs::copy(&legacy, &dest);
                }
            }
            return dest;
        }
    }
    #[cfg(debug_assertions)]
    {
        let _ = app;
    }
    exe_dir_config()
}

pub fn load(app: &AppHandle) -> Config {
    match fs::read_to_string(config_path(app)) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

pub fn save(app: &AppHandle, cfg: &Config) {
    let path = config_path(app);
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(raw) = serde_json::to_string_pretty(cfg) {
        let _ = fs::write(path, raw);
    }
}

pub fn update(app: &AppHandle, f: impl FnOnce(&mut Config)) {
    let mut cfg = load(app);
    f(&mut cfg);
    save(app, &cfg);
}

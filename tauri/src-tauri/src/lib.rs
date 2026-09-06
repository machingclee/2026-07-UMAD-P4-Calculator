mod calculate;
mod config;
mod constants;
mod win32;

use calculate::State;
use constants::{
    APP_HEIGHT, APP_WIDTH, DEBUG, ICON_OVERLAY_HEIGHT, ICON_OVERLAY_WIDTH, ICON_OVERLAY_X,
    ICON_OVERLAY_Y, OVERLAY_HEIGHT, OVERLAY_HINT, OVERLAY_WIDTH, OVERLAY_X, OVERLAY_Y,
};
use std::collections::HashMap;
use tauri::{
    Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

fn overlay_hint(labels: &HashMap<String, String>) -> String {
    match labels.get("overlayHint") {
        Some(value) => value.clone(),
        None => OVERLAY_HINT.to_string(),
    }
}

#[tauri::command]
fn calculate_text(
    app: tauri::AppHandle,
    state: State,
    labels: Option<HashMap<String, String>>,
) -> String {
    let labels = match labels {
        Some(map) => config::sanitize_labels(map),
        None => config::load(&app).labels,
    };
    let started = state.values().any(|v| !v.is_empty());
    let text = if !started {
        String::new()
    } else {
        let body = calculate::calculate_labeled(&state, &labels);
        let hint_raw = overlay_hint(&labels);
        if hint_raw.is_empty() {
            body
        } else {
            let hint = hint_raw.replace("\\n", "\n");
            if body.is_empty() {
                hint
            } else {
                format!("{hint}\n{body}")
            }
        }
    };
    let _ = app.emit("overlay-text", &text);
    text
}

#[tauri::command]
fn get_theme(app: tauri::AppHandle) -> String {
    config::load(&app)
        .theme
        .filter(|t| t == "dark" || t == "light")
        .unwrap_or_else(|| "light".into())
}

#[tauri::command]
fn set_theme(app: tauri::AppHandle, theme: String) {
    let theme = if theme == "dark" {
        "dark"
    } else {
        "light"
    };
    config::update(&app, |c| c.theme = Some(theme.into()));
}

fn parse_shade_edge(value: Option<&str>) -> &'static str {
    if value == Some("top") {
        "top"
    } else {
        "bottom"
    }
}

#[tauri::command]
fn get_shade_edge(app: tauri::AppHandle) -> String {
    parse_shade_edge(config::load(&app).shade_edge.as_deref()).into()
}

#[tauri::command]
fn set_shade_edge(app: tauri::AppHandle, edge: String) {
    let edge = parse_shade_edge(Some(edge.as_str()));
    config::update(&app, |c| c.shade_edge = Some(edge.into()));
    win32::set_shade_from_bottom(edge == "bottom");
}

fn parse_line_gap(value: Option<i32>) -> i32 {
    match value {
        Some(n) if n < 0 => 0,
        Some(n) if n > 15 => 15,
        Some(n) => n,
        None => 0,
    }
}

#[tauri::command]
fn get_line_gap(app: tauri::AppHandle) -> i32 {
    parse_line_gap(config::load(&app).line_gap)
}

#[tauri::command]
fn set_line_gap(app: tauri::AppHandle, px: i32) {
    let px = parse_line_gap(Some(px));
    config::update(&app, |c| c.line_gap = Some(px));
    let _ = app.emit("overlay-line-gap", px);
}

#[tauri::command]
fn get_labels(app: tauri::AppHandle) -> HashMap<String, String> {
    config::load(&app).labels
}

#[tauri::command]
fn set_labels(app: tauri::AppHandle, labels: HashMap<String, String>) {
    config::update(&app, |c| c.labels = config::sanitize_labels(labels));
}

#[tauri::command]
fn set_input_mode(app: tauri::AppHandle, enabled: bool) {
    if let Some(main) = app.get_webview_window("main") {
        win32::set_input_enabled(&main, enabled);
    }
}

/// Open a file in VS Code via the vscode:// URL scheme.
/// Used by TauriClickToComponent in dev mode — WKWebView can't navigate
/// vscode:// URLs directly, so the frontend invokes this command instead.
#[tauri::command]
async fn open_in_vscode(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path = path.replace('\\', "/");
    let url = if path.starts_with('/') {
        format!("vscode://file{}", path)
    } else {
        format!("vscode://file/{}", path)
    };
    app.opener()
        .open_url(&url, None::<String>)
        .map_err(|e| e.to_string())
}

fn persist_moved(window: &tauri::Window, x: i32, y: i32) {
    let app = window.app_handle();
    let label = window.label();
    if label == "main" {
        if win32::is_titlebar_shaded() {
            return;
        }
        if x > 0 && y > 0 {
            config::update(app, |c| {
                c.app_x = Some(x);
                c.app_y = Some(y);
            });
        }
    } else if label == "overlay" {
        config::update(app, |c| {
            c.overlay_x = Some(x);
            c.overlay_y = Some(y);
        });
    } else if label == "overlay-icons" {
        let bottom = window
            .outer_size()
            .ok()
            .map(|size| y.saturating_add(size.height as i32));
        config::update(app, |c| {
            c.overlay_icons_x = Some(x);
            c.overlay_icons_y = Some(y);
            if let Some(value) = bottom {
                c.overlay_icons_bottom = Some(value);
            }
        });
    }
}

fn open_overlay(
    app: &mut tauri::App,
    label: &str,
    title: &str,
    width: f64,
    height: f64,
    x: i32,
    y: i32,
) -> tauri::Result<tauri::WebviewWindow> {
    let win = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(width, height)
        .decorations(false)
        .always_on_top(true)
        .transparent(true)
        .background_color(tauri::window::Color(0, 0, 0, 0))
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .focused(false)
        .focusable(false)
        .visible(true)
        .build()?;
    let _ = win.set_position(PhysicalPosition::new(x, y));
    Ok(win)
}

#[tauri::command]
fn get_expanded() -> bool {
    !win32::is_titlebar_shaded()
}

fn parse_debuff_overlay(value: Option<bool>) -> bool {
    value.unwrap_or(true)
}

#[tauri::command]
fn get_debuff_overlay(app: tauri::AppHandle) -> bool {
    parse_debuff_overlay(config::load(&app).debuff_overlay)
}

#[tauri::command]
fn set_debuff_overlay(app: tauri::AppHandle, enabled: bool) {
    config::update(&app, |c| c.debuff_overlay = Some(enabled));
    win32::sync_icon_overlay_visibility();
    let _ = app.emit("debuff-overlay", enabled);
}

fn parse_original_menu(value: Option<bool>) -> bool {
    value.unwrap_or(true)
}

#[tauri::command]
fn get_original_menu(app: tauri::AppHandle) -> bool {
    parse_original_menu(config::load(&app).original_menu)
}

#[tauri::command]
fn set_original_menu(app: tauri::AppHandle, enabled: bool) {
    config::update(&app, |c| c.original_menu = Some(enabled));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Same as python/main.py: mutex check happens before any window is created.
    if win32::already_running() {
        let _ = win32::bring_existing_to_front();
        std::process::exit(0);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            calculate_text,
            get_theme,
            set_theme,
            get_shade_edge,
            set_shade_edge,
            get_line_gap,
            set_line_gap,
            get_labels,
            set_labels,
            set_input_mode,
            open_in_vscode,
            get_expanded,
            get_debuff_overlay,
            set_debuff_overlay,
            get_original_menu,
            set_original_menu,
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(pos) => {
                persist_moved(window, pos.x, pos.y);
                if DEBUG && window.label() == "overlay" {
                    if let Some(main) = window.app_handle().get_webview_window("main") {
                        let _ = main.set_title(&format!(
                            "OVERLAY_X={}  OVERLAY_Y={}",
                            pos.x, pos.y
                        ));
                    }
                    let _ = window.app_handle().emit("overlay-pos", (pos.x, pos.y));
                }
                if DEBUG && window.label() == "overlay-icons" {
                    let _ = window
                        .app_handle()
                        .emit("overlay-icons-pos", (pos.x, pos.y));
                }
            }
            WindowEvent::Destroyed if window.label() == "main" => {
                for label in ["overlay", "overlay-icons"] {
                    if let Some(ovl) = window.app_handle().get_webview_window(label) {
                        let _ = ovl.close();
                    }
                }
            }
            _ => {}
        })
        .setup(|app| {
            let cfg = config::load(&app.handle());
            win32::set_app_handle(app.handle().clone());
            let main = app
                .get_webview_window("main")
                .expect("main window missing from tauri.conf.json");

            let _ = main.set_size(LogicalSize::new(APP_WIDTH, APP_HEIGHT));
            let _ = main.set_resizable(false);
            let _ = main.set_theme(Some(if cfg.theme.as_deref() == Some("dark") {
                tauri::Theme::Dark
            } else {
                tauri::Theme::Light
            }));

            if let (Some(x), Some(y)) = (cfg.app_x, cfg.app_y) {
                let _ = main.set_position(PhysicalPosition::new(x, y));
            }
            let _ = main.set_focusable(false);
            win32::set_shade_from_bottom(parse_shade_edge(cfg.shade_edge.as_deref()) == "bottom");
            win32::force_topmost_window(&main);
            win32::prevent_activation(&main);
            win32::enable_titlebar_shade(&main);
            let _ = main.show();

            let ovl_x = cfg.overlay_x.unwrap_or(OVERLAY_X as i32);
            let ovl_y = cfg.overlay_y.unwrap_or(OVERLAY_Y as i32);
            let overlay = open_overlay(
                app,
                "overlay",
                "FF14 P4 Calculator Overlay",
                OVERLAY_WIDTH,
                OVERLAY_HEIGHT,
                ovl_x,
                ovl_y,
            )?;
            if DEBUG {
                let _ = main.set_title(&format!("OVERLAY_X={ovl_x}  OVERLAY_Y={ovl_y}"));
                let _ = overlay.emit("overlay-pos", (ovl_x, ovl_y));
            }

            let icon_x = cfg.overlay_icons_x.unwrap_or(ICON_OVERLAY_X as i32);
            let icon_h = ICON_OVERLAY_HEIGHT as i32;
            let icon_y = match cfg.overlay_icons_bottom {
                Some(bottom) => bottom - icon_h,
                None => cfg.overlay_icons_y.unwrap_or(ICON_OVERLAY_Y as i32),
            };
            let icon_overlay = open_overlay(
                app,
                "overlay-icons",
                "FF14 P4 Calculator Icon Overlay",
                ICON_OVERLAY_WIDTH,
                ICON_OVERLAY_HEIGHT,
                icon_x,
                icon_y,
            )?;
            if DEBUG {
                let _ = icon_overlay.emit("overlay-icons-pos", (icon_x, icon_y));
            }
            if !parse_debuff_overlay(cfg.debuff_overlay) {
                let _ = icon_overlay.hide();
            }

            let main_hwnd = main.clone();
            let overlay_hwnds = vec![overlay.clone(), icon_overlay.clone()];
            std::thread::spawn(move || {
                // WebView2 child HWNDs appear after the host window; retry so they
                // also get WS_EX_NOACTIVATE + WM_MOUSEACTIVATE subclassing.
                for delay_ms in [100u64, 400, 1200] {
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                    let main_for_thread = main_hwnd.clone();
                    let main_w = main_hwnd.clone();
                    let _ = main_for_thread.run_on_main_thread(move || {
                        win32::force_topmost_window(&main_w);
                        win32::prevent_activation(&main_w);
                        win32::enable_titlebar_shade(&main_w);
                    });
                    for ovl in &overlay_hwnds {
                        let overlay_for_thread = ovl.clone();
                        let overlay_w = ovl.clone();
                        let _ = overlay_for_thread.run_on_main_thread(move || {
                            win32::apply_overlay_style(&overlay_w);
                            win32::prevent_activation(&overlay_w);
                            win32::sync_icon_overlay_visibility();
                        });
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

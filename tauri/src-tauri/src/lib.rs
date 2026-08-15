mod calculate;
mod config;
mod constants;
mod win32;

use calculate::State;
use constants::{
    DEBUG, OVERLAY_HEIGHT, OVERLAY_HINT, OVERLAY_WIDTH, OVERLAY_X, OVERLAY_Y,
};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

/// Ignore the create-time Resized event so it does not overwrite a saved size.
static PERSIST_SIZE: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn calculate_text(app: tauri::AppHandle, state: State) -> String {
    let started = state.values().any(|v| !v.is_empty());
    let text = if !started {
        String::new()
    } else {
        let body = calculate::calculate(&state);
        if body.is_empty() {
            OVERLAY_HINT.to_string()
        } else {
            format!("{OVERLAY_HINT}\n\n{body}")
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

fn persist_resized(app: &tauri::AppHandle, label: &str, size: PhysicalSize<u32>, scale: f64) {
    if !PERSIST_SIZE.load(Ordering::SeqCst) || label != "main" || scale <= 0.0 {
        return;
    }
    let width = (size.width as f64 / scale).round() as i32;
    let height = (size.height as f64 / scale).round() as i32;
    if width > 0 && height > 0 {
        config::update(app, |c| {
            c.app_width = Some(width);
            c.app_height = Some(height);
        });
    }
}

fn persist_moved(app: &tauri::AppHandle, label: &str, x: i32, y: i32) {
    if label == "main" {
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
    }
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
        .invoke_handler(tauri::generate_handler![calculate_text, get_theme, set_theme])
        .on_window_event(|window, event| match event {
            WindowEvent::Resized(size) => {
                persist_resized(
                    window.app_handle(),
                    window.label(),
                    *size,
                    window.scale_factor().unwrap_or(1.0),
                );
            }
            WindowEvent::Moved(pos) => {
                persist_moved(window.app_handle(), window.label(), pos.x, pos.y);
                if DEBUG && window.label() == "overlay" {
                    if let Some(main) = window.app_handle().get_webview_window("main") {
                        let _ = main.set_title(&format!(
                            "OVERLAY_X={}  OVERLAY_Y={}",
                            pos.x, pos.y
                        ));
                    }
                    let _ = window.app_handle().emit("overlay-pos", (pos.x, pos.y));
                }
            }
            WindowEvent::Destroyed if window.label() == "main" => {
                if let Some(ovl) = window.app_handle().get_webview_window("overlay") {
                    let _ = ovl.close();
                }
            }
            _ => {}
        })
        .setup(|app| {
            let cfg = config::load(&app.handle());
            let main = app
                .get_webview_window("main")
                .expect("main window missing from tauri.conf.json");

            if let (Some(width), Some(height)) = (cfg.app_width, cfg.app_height) {
                if width > 0 && height > 0 {
                    let _ = main.set_size(LogicalSize::new(width as f64, height as f64));
                }
            }
            let _ = main.set_theme(Some(if cfg.theme.as_deref() == Some("dark") {
                tauri::Theme::Dark
            } else {
                tauri::Theme::Light
            }));

            if let (Some(x), Some(y)) = (cfg.app_x, cfg.app_y) {
                let _ = main.set_position(PhysicalPosition::new(x, y));
            }
            let _ = main.show();
            PERSIST_SIZE.store(true, Ordering::SeqCst);

            let ovl_x = cfg.overlay_x.unwrap_or(OVERLAY_X as i32);
            let ovl_y = cfg.overlay_y.unwrap_or(OVERLAY_Y as i32);

            let overlay = WebviewWindowBuilder::new(
                app,
                "overlay",
                WebviewUrl::App("index.html".into()),
            )
            .title("FF14 P4 Calculator Overlay")
            .inner_size(OVERLAY_WIDTH, OVERLAY_HEIGHT)
            .decorations(false)
            .always_on_top(true)
            .transparent(true)
            .background_color(tauri::window::Color(0, 0, 0, 0))
            .shadow(false)
            .resizable(false)
            .skip_taskbar(true)
            .focused(false)
            .visible(true)
            .build()?;
            let _ = overlay.set_position(PhysicalPosition::new(ovl_x, ovl_y));
            if DEBUG {
                let _ = main.set_title(&format!("OVERLAY_X={ovl_x}  OVERLAY_Y={ovl_y}"));
                let _ = overlay.emit("overlay-pos", (ovl_x, ovl_y));
            }

            let main_hwnd = main.clone();
            let overlay_hwnd = overlay.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(100));
                win32::force_topmost_window(&main_hwnd);
                win32::apply_overlay_style(&overlay_hwnd);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

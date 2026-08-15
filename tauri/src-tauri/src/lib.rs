mod calculate;
mod config;
mod win32;

use calculate::State;
use tauri::{
    Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

const APP_WIDTH: f64 = 420.0;
const APP_HEIGHT: f64 = 220.0;
const OVERLAY_WIDTH: f64 = 400.0;
const OVERLAY_HEIGHT: f64 = 320.0;
const OVERLAY_X: f64 = 865.0;
const OVERLAY_Y: f64 = 345.0;

#[tauri::command]
fn calculate_text(app: tauri::AppHandle, state: State) -> String {
    let text = calculate::calculate(&state);
    let _ = app.emit("overlay-text", &text);
    text
}

fn persist_moved(label: &str, x: i32, y: i32) {
    if label == "main" {
        if x > 0 && y > 0 {
            config::update(|c| {
                c.app_x = Some(x);
                c.app_y = Some(y);
            });
        }
    } else if label == "overlay" {
        config::update(|c| {
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
        .invoke_handler(tauri::generate_handler![calculate_text])
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(pos) => persist_moved(window.label(), pos.x, pos.y),
            WindowEvent::Destroyed if window.label() == "main" => {
                if let Some(ovl) = window.app_handle().get_webview_window("overlay") {
                    let _ = ovl.close();
                }
            }
            _ => {}
        })
        .setup(|app| {
            let cfg = config::load();
            let main = app
                .get_webview_window("main")
                .expect("main window missing from tauri.conf.json");

            match (cfg.app_x, cfg.app_y) {
                (Some(x), Some(y)) => {
                    let _ = main.set_position(PhysicalPosition::new(x, y));
                }
                _ => {
                    if let Ok(Some(monitor)) = main.primary_monitor() {
                        let size = monitor.size();
                        let scale = monitor.scale_factor();
                        let width = (APP_WIDTH * scale) as i32;
                        let height = (APP_HEIGHT * scale) as i32;
                        let x = (size.width as i32 - width) / 2;
                        let y = (size.height as i32 - height) / 2;
                        let _ = main.set_position(PhysicalPosition::new(x, y));
                    }
                }
            }
            let _ = main.show();

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
            .shadow(false)
            .resizable(false)
            .skip_taskbar(true)
            .focused(false)
            .visible(true)
            .build()?;
            let _ = overlay.set_position(PhysicalPosition::new(ovl_x, ovl_y));

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

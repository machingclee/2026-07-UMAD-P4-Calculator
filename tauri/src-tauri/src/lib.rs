mod calculate;
mod config;
mod constants;
mod win32;

use calculate::State;
use constants::{
    APP_HEIGHT, APP_WIDTH, DEBUG, OVERLAY_HEIGHT, OVERLAY_HINT, OVERLAY_WIDTH, OVERLAY_X,
    OVERLAY_Y,
};
use tauri::{
    Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};

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

fn persist_moved(app: &tauri::AppHandle, label: &str, x: i32, y: i32) {
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
        .invoke_handler(tauri::generate_handler![
            calculate_text,
            get_theme,
            set_theme,
            get_shade_edge,
            set_shade_edge
        ])
        .on_window_event(|window, event| match event {
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
            .focusable(false)
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
                // WebView2 child HWNDs appear after the host window; retry so they
                // also get WS_EX_NOACTIVATE + WM_MOUSEACTIVATE subclassing.
                for delay_ms in [100u64, 400, 1200] {
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                    let main_for_thread = main_hwnd.clone();
                    let main_w = main_hwnd.clone();
                    let overlay_for_thread = overlay_hwnd.clone();
                    let overlay_w = overlay_hwnd.clone();
                    let _ = main_for_thread.run_on_main_thread(move || {
                        win32::force_topmost_window(&main_w);
                        win32::prevent_activation(&main_w);
                        win32::enable_titlebar_shade(&main_w);
                    });
                    let _ = overlay_for_thread.run_on_main_thread(move || {
                        win32::apply_overlay_style(&overlay_w);
                        win32::prevent_activation(&overlay_w);
                    });
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

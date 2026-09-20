//! HTTP client for the PostNamazu ACT plugin (`POST /command` with `/e …`).
//!
//! Network failures must never panic the app: every I/O path returns `Result`,
//! background echo swallows errors, and worker panics are caught.

use std::io::{Read, Write};
use std::net::{Shutdown, TcpStream};
use std::panic::{self, AssertUnwindSafe};
use std::sync::Mutex;
use std::time::Duration;

use crate::calculate::{echo_commands, wizard_step, Labels, State};
use crate::config;

pub const DEFAULT_PORT: u16 = 2019;
const ECHO_GAP: Duration = Duration::from_millis(80);

static LAST_STEP: Mutex<u8> = Mutex::new(0);

pub fn parse_port(value: Option<u16>) -> u16 {
    match value {
        Some(0) | None => DEFAULT_PORT,
        Some(port) => port,
    }
}

pub fn parse_enabled(value: Option<bool>) -> bool {
    value.unwrap_or(false)
}

fn lock_last_step() -> std::sync::MutexGuard<'static, u8> {
    LAST_STEP
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn catch_err<T>(f: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    panic::catch_unwind(AssertUnwindSafe(f)).unwrap_or_else(|_| Err("PostNamazu request failed".into()))
}

fn sanitize_action(command: &str) -> Result<&str, String> {
    let command = command.trim().trim_matches('/');
    if command.is_empty()
        || command.len() > 32
        || !command.chars().all(|c| c.is_ascii_alphanumeric())
    {
        return Err("invalid PostNamazu command".into());
    }
    Ok(command)
}

/// `POST http://127.0.0.1:{port}/{command}` with a UTF-8 body.
pub fn http_post(port: u16, command: &str, payload: &str) -> Result<String, String> {
    catch_err(|| http_post_inner(port, command, payload))
}

fn http_post_inner(port: u16, command: &str, payload: &str) -> Result<String, String> {
    let action = sanitize_action(command)?;
    let body = payload.as_bytes();
    let header = format!(
        "POST /{action} HTTP/1.1\r\n\
         Host: 127.0.0.1:{port}\r\n\
         Content-Type: text/plain; charset=utf-8\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n",
        body.len()
    );

    let mut stream = TcpStream::connect(("127.0.0.1", port)).map_err(|e| {
        format!(
            "PostNamazu not reachable on 127.0.0.1:{port} ({e}). Start its HTTP listener in ACT."
        )
    })?;
    let timeout = Some(Duration::from_secs(2));
    let _ = stream.set_read_timeout(timeout);
    let _ = stream.set_write_timeout(timeout);
    stream
        .write_all(header.as_bytes())
        .map_err(|e| format!("PostNamazu write failed: {e}"))?;
    stream
        .write_all(body)
        .map_err(|e| format!("PostNamazu write failed: {e}"))?;
    let _ = stream.shutdown(Shutdown::Write);

    let mut resp = Vec::new();
    let _ = stream.read_to_end(&mut resp);
    let resp = String::from_utf8_lossy(&resp).into_owned();
    if let Some(status_line) = resp.lines().next() {
        if !status_line.contains(" 200") {
            return Err(format!("PostNamazu HTTP error: {status_line}"));
        }
    }
    Ok(resp)
}

fn echo_payloads(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| {
            if line.starts_with('/') {
                line.to_string()
            } else {
                format!("/e {line}")
            }
        })
        .collect()
}

fn send_payloads(port: u16, payloads: &[String]) -> Result<(), String> {
    let mut last_err = None;
    for (i, payload) in payloads.iter().enumerate() {
        if i > 0 {
            std::thread::sleep(ECHO_GAP);
        }
        if let Err(err) = http_post(port, "command", payload) {
            last_err = Some(err);
        }
    }
    match last_err {
        Some(err) => Err(err),
        None => Ok(()),
    }
}

fn send_echo_lines(port: u16, text: &str) -> Result<(), String> {
    send_payloads(port, &echo_payloads(text))
}

/// When the wizard first reaches step 7, `/e` every overlay line in order.
/// Never panics; failures are ignored.
pub fn maybe_echo_overlay(app: &tauri::AppHandle, state: &State, labels: &Labels) {
    let _ = panic::catch_unwind(AssertUnwindSafe(|| {
        maybe_echo_overlay_inner(app, state, labels);
    }));
}

fn maybe_echo_overlay_inner(app: &tauri::AppHandle, state: &State, labels: &Labels) {
    let step = wizard_step(state);
    let prev = {
        let mut last = lock_last_step();
        let prev = *last;
        *last = step;
        prev
    };
    let cfg = config::load(app);
    if !parse_enabled(cfg.postnamazu_enabled) {
        return;
    }
    if !(prev > 0 && prev < 7 && step == 7) {
        return;
    }
    let payloads = echo_commands(state, labels);
    if payloads.is_empty() {
        return;
    }
    let port = parse_port(cfg.postnamazu_port);
    let _ = std::thread::Builder::new()
        .name("postnamazu-echo".into())
        .spawn(move || {
            let _ = catch_err(|| send_payloads(port, &payloads));
        });
}

async fn run_blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    match tauri::async_runtime::spawn_blocking(move || catch_err(f)).await {
        Ok(result) => result,
        Err(_) => Err("PostNamazu request failed".into()),
    }
}

#[tauri::command]
pub fn get_postnamazu_port(app: tauri::AppHandle) -> u16 {
    parse_port(config::load(&app).postnamazu_port)
}

#[tauri::command]
pub fn set_postnamazu_port(app: tauri::AppHandle, port: u16) {
    let port = parse_port(Some(port));
    config::update(&app, |c| c.postnamazu_port = Some(port));
}

#[tauri::command]
pub fn get_postnamazu_enabled(app: tauri::AppHandle) -> bool {
    parse_enabled(config::load(&app).postnamazu_enabled)
}

#[tauri::command]
pub fn set_postnamazu_enabled(app: tauri::AppHandle, enabled: bool) {
    config::update(&app, |c| c.postnamazu_enabled = Some(enabled));
}

/// POST `{payload}` to `http://127.0.0.1:{port}/{command}`.
/// `port` falls back to the saved PostNamazu port (default 2019).
/// Failures return `Err` to JS; they never panic.
#[tauri::command]
pub async fn postnamazu_command(
    app: tauri::AppHandle,
    command: String,
    payload: String,
    port: Option<u16>,
) -> Result<String, String> {
    let port = parse_port(port.or_else(|| config::load(&app).postnamazu_port));
    run_blocking(move || http_post(port, &command, &payload)).await
}

/// Send each non-empty line as `/e …` (or as-is if it already starts with `/`).
/// Failures return `Err` to JS; they never panic.
#[tauri::command]
pub async fn postnamazu_echo(
    app: tauri::AppHandle,
    text: String,
    port: Option<u16>,
) -> Result<(), String> {
    let port = parse_port(port.or_else(|| config::load(&app).postnamazu_port));
    run_blocking(move || send_echo_lines(port, &text)).await
}

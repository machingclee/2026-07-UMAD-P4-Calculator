//! OverlayPlugin WebSocket: match FFXIV log lines, then ACT TTS (`say`).
//! Failures never panic the app.

use std::panic::{self, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use regex::Regex;
use serde_json::{json, Value};
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{connect, Message};

use crate::calculate::{tts_slots, Labels, State};
use crate::config::{self, Config};
use tauri::AppHandle;

static APP: Mutex<Option<AppHandle>> = Mutex::new(None);

pub const DEFAULT_WS_PORT: u16 = 10501;
pub const DEFAULT_LOG_REGEX: &str = r"ネオエクスデスは「無の氾濫」の構え";
pub const TTS_SLOT_COUNT: usize = 6;
const DEFAULT_TTS_DELAYS_MS: [u32; TTS_SLOT_COUNT] = [5751, 14250, 22850, 25850, 40350, 46150];
const MAX_DELAY_MS: u32 = 120_000;

static STARTED: AtomicBool = AtomicBool::new(false);
static WS_UP: AtomicBool = AtomicBool::new(false);
static TTS_GEN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
static SNAPSHOT: Mutex<Option<(State, Labels)>> = Mutex::new(None);
static SAY_TX: Mutex<Option<Sender<(u64, String)>>> = Mutex::new(None);

pub fn parse_ws_port(value: Option<u16>) -> u16 {
    match value {
        Some(0) | None => DEFAULT_WS_PORT,
        Some(port) => port,
    }
}

pub fn parse_enabled(value: Option<bool>) -> bool {
    value.unwrap_or(true)
}

pub fn parse_delay_ms(value: Option<u32>) -> u32 {
    value.unwrap_or(0).min(MAX_DELAY_MS)
}

pub fn parse_delays(cfg: &Config) -> [u32; TTS_SLOT_COUNT] {
    let mut out = DEFAULT_TTS_DELAYS_MS;
    if let Some(list) = cfg.tts_delays_ms.as_ref() {
        if list.len() == TTS_SLOT_COUNT && list.iter().all(|value| *value == 0) {
            return out;
        }
        for (i, value) in list.iter().take(TTS_SLOT_COUNT).enumerate() {
            out[i] = (*value).min(MAX_DELAY_MS);
        }
        return out;
    }
    if cfg.tts_delay_1_ms.is_some() || cfg.tts_delay_2_ms.is_some() {
        let d1 = cfg.tts_delay_1_ms.map_or(out[0], |value| parse_delay_ms(Some(value)));
        let d2 = cfg.tts_delay_2_ms.map_or(out[3], |value| parse_delay_ms(Some(value)));
        return [d1, d1, d1, d2, d2, d2];
    }
    out
}

pub fn parse_log_regex(value: Option<&str>) -> String {
    let trimmed = value.map(str::trim).unwrap_or("");
    if trimmed.is_empty() {
        DEFAULT_LOG_REGEX.to_string()
    } else {
        trimmed.to_string()
    }
}

fn load_cfg() -> Config {
    let Ok(guard) = APP.lock() else {
        return Config::default();
    };
    match guard.as_ref() {
        Some(app) => config::load(app),
        None => Config::default(),
    }
}

fn compile_regex(pattern: &str) -> Option<Regex> {
    Regex::new(pattern)
        .ok()
        .or_else(|| Regex::new(&regex::escape(pattern)).ok())
}

pub fn update_snapshot(state: &State, labels: &Labels) {
    if let Ok(mut guard) = SNAPSHOT.lock() {
        *guard = Some((state.clone(), labels.clone()));
    }
}

fn current_slots() -> [String; TTS_SLOT_COUNT] {
    let empty = [(); TTS_SLOT_COUNT].map(|_| String::new());
    let Ok(guard) = SNAPSHOT.lock() else {
        return empty;
    };
    match guard.as_ref() {
        Some((state, labels)) => tts_slots(state, labels),
        None => empty,
    }
}

fn queue_say(text: String) -> Result<(), String> {
    let text = text.trim();
    if text.is_empty() {
        return Ok(());
    }
    if !WS_UP.load(Ordering::SeqCst) {
        return Err(
            "OverlayPlugin WS not connected. Start OverlayPlugin WSServer (default port 10501)."
                .into(),
        );
    }
    let Ok(guard) = SAY_TX.lock() else {
        return Err("TTS queue unavailable".into());
    };
    match guard.as_ref() {
        Some(tx) => tx
            .send((TTS_GEN.load(Ordering::SeqCst), text.to_string()))
            .map_err(|_| "TTS queue closed".into()),
        None => Err("OverlayPlugin WS not connected. Start OverlayPlugin WSServer.".into()),
    }
}

fn bump_tts_gen() {
    TTS_GEN.fetch_add(1, Ordering::SeqCst);
}

fn queue_say_gen(gen: u64, text: String) {
    let text = text.trim();
    if text.is_empty() {
        return;
    }
    if let Ok(guard) = SAY_TX.lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send((gen, text.to_string()));
        }
    }
}

fn event_haystack(msg: &Value) -> String {
    let mut out = String::new();
    let mut push = |s: &str| {
        if !s.is_empty() {
            if !out.is_empty() {
                out.push('\n');
            }
            out.push_str(s);
        }
    };
    if let Some(raw) = msg.get("rawLine").and_then(Value::as_str) {
        push(raw);
    }
    if let Some(line) = msg.get("line") {
        if let Some(s) = line.as_str() {
            push(s);
        } else if let Some(arr) = line.as_array() {
            for item in arr {
                if let Some(s) = item.as_str() {
                    push(s);
                }
            }
        }
    }
    if let Some(detail) = msg.get("detail") {
        push(&event_haystack(detail));
    }
    if let Some(message) = msg.get("message").and_then(Value::as_str) {
        push(message);
    }
    out
}

fn schedule_tts() {
    let cfg = load_cfg();
    if !parse_enabled(cfg.act_tts_enabled) {
        return;
    }
    if !WS_UP.load(Ordering::SeqCst) {
        return;
    }
    let slots = current_slots();
    let delays = parse_delays(&cfg);
    let gen = TTS_GEN.load(Ordering::SeqCst);
    for (i, text) in slots.into_iter().enumerate() {
        if text.is_empty() {
            continue;
        }
        let wait = Duration::from_millis(delays[i] as u64);
        let _ = thread::Builder::new()
            .name(format!("act-tts-{i}").into())
            .spawn(move || {
                let _ = panic::catch_unwind(AssertUnwindSafe(|| {
                    thread::sleep(wait);
                    if TTS_GEN.load(Ordering::SeqCst) != gen {
                        return;
                    }
                    queue_say_gen(gen, text);
                }));
            });
    }
}

fn line_matches(hay: &str, re: Option<&Regex>, pattern: &str) -> bool {
    if hay.is_empty() {
        return false;
    }
    if let Some(re) = re {
        re.is_match(hay)
    } else {
        hay.contains(pattern)
    }
}

fn handle_message(text: &str, re: Option<&Regex>, pattern: &str, last_fire: &mut Instant) {
    let Ok(msg) = serde_json::from_str::<Value>(text) else {
        return;
    };
    if msg.get("rseq").is_some() {
        return;
    }
    let kind = msg
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("");
    if kind != "LogLine" && kind != "onLogLine" && kind != "logLine" {
        return;
    }
    let hay = event_haystack(&msg);
    if !line_matches(&hay, re, pattern) {
        return;
    }
    let now = Instant::now();
    if now.duration_since(*last_fire) < Duration::from_millis(750) {
        return;
    }
    *last_fire = now;
    schedule_tts();
}

fn session(port: u16, rx: &Receiver<(u64, String)>) -> Result<(), ()> {
    struct Down;
    impl Drop for Down {
        fn drop(&mut self) {
            WS_UP.store(false, Ordering::SeqCst);
        }
    }
    let _down = Down;
    let url = format!("ws://127.0.0.1:{port}/ws");
    let (mut ws, _) = connect(url).map_err(|_| ())?;
    match ws.get_mut() {
        MaybeTlsStream::Plain(stream) => {
            let _ = stream.set_read_timeout(Some(Duration::from_millis(200)));
        }
        _ => {}
    }
    ws.send(Message::Text(
        json!({
            "call": "subscribe",
            "events": ["LogLine"]
        })
        .to_string(),
    ))
    .map_err(|_| ())?;
    WS_UP.store(true, Ordering::SeqCst);

    let mut last_fire = Instant::now() - Duration::from_secs(10);
    let mut last_pattern = String::new();
    let mut re = compile_regex(DEFAULT_LOG_REGEX);

    loop {
        while let Ok((gen, text)) = rx.try_recv() {
            if gen != TTS_GEN.load(Ordering::SeqCst) {
                continue;
            }
            let payload = json!({ "call": "say", "text": text }).to_string();
            ws.send(Message::Text(payload)).map_err(|_| ())?;
        }

        let cfg = load_cfg();
        if parse_ws_port(cfg.overlay_ws_port) != port {
            return Ok(());
        }
        let pattern = parse_log_regex(cfg.log_regex.as_deref());
        if pattern != last_pattern {
            re = compile_regex(&pattern);
            last_pattern = pattern.clone();
        }

        match ws.read() {
            Ok(Message::Text(text)) => {
                handle_message(&text, re.as_ref(), &last_pattern, &mut last_fire)
            }
            Ok(Message::Ping(p)) => {
                let _ = ws.send(Message::Pong(p));
            }
            Ok(Message::Close(_)) => return Err(()),
            Ok(_) => {}
            Err(tungstenite::Error::Io(err))
                if err.kind() == std::io::ErrorKind::WouldBlock
                    || err.kind() == std::io::ErrorKind::TimedOut => {}
            Err(_) => return Err(()),
        }
    }
}

fn worker() {
    let (tx, rx) = mpsc::channel::<(u64, String)>();
    if let Ok(mut guard) = SAY_TX.lock() {
        *guard = Some(tx);
    }
    loop {
        let port = parse_ws_port(load_cfg().overlay_ws_port);
        let _ = panic::catch_unwind(AssertUnwindSafe(|| {
            let _ = session(port, &rx);
        }));
        thread::sleep(Duration::from_secs(3));
    }
}

pub fn start(app: AppHandle) {
    if STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Ok(mut guard) = APP.lock() {
        *guard = Some(app);
    }
    let _ = thread::Builder::new()
        .name("act-overlay-ws".into())
        .spawn(worker);
}

#[tauri::command]
pub fn get_act_tts_enabled(app: tauri::AppHandle) -> bool {
    parse_enabled(config::load(&app).act_tts_enabled)
}

#[tauri::command]
pub fn set_act_tts_enabled(app: tauri::AppHandle, enabled: bool) {
    config::update(&app, |c| c.act_tts_enabled = Some(enabled));
    if !enabled {
        bump_tts_gen();
    }
}

#[tauri::command]
pub fn get_overlay_ws_port(app: tauri::AppHandle) -> u16 {
    parse_ws_port(config::load(&app).overlay_ws_port)
}

#[tauri::command]
pub fn set_overlay_ws_port(app: tauri::AppHandle, port: u16) {
    config::update(&app, |c| c.overlay_ws_port = Some(parse_ws_port(Some(port))));
}

#[tauri::command]
pub fn get_log_regex(app: tauri::AppHandle) -> String {
    parse_log_regex(config::load(&app).log_regex.as_deref())
}

#[tauri::command]
pub fn set_log_regex(app: tauri::AppHandle, pattern: String) {
    config::update(&app, |c| c.log_regex = Some(parse_log_regex(Some(&pattern))));
}

#[tauri::command]
pub fn get_tts_delays_ms(app: tauri::AppHandle) -> Vec<u32> {
    parse_delays(&config::load(&app)).to_vec()
}

#[tauri::command]
pub fn set_tts_delays_ms(app: tauri::AppHandle, delays: Vec<u32>) {
    let mut out = vec![0u32; TTS_SLOT_COUNT];
    for (i, value) in delays.iter().take(TTS_SLOT_COUNT).enumerate() {
        out[i] = (*value).min(MAX_DELAY_MS);
    }
    config::update(&app, |c| {
        c.tts_delays_ms = Some(out);
        c.tts_delay_1_ms = None;
        c.tts_delay_2_ms = None;
    });
}

#[tauri::command]
pub fn act_tts_connected() -> bool {
    WS_UP.load(Ordering::SeqCst)
}

#[tauri::command]
pub fn act_tts_say(text: String) -> Result<(), String> {
    queue_say(text)
}

#[tauri::command]
pub fn cancel_scheduled_tts() {
    bump_tts_gen();
}

#[tauri::command]
pub fn act_tts_trigger() -> Result<String, String> {
    bump_tts_gen();
    let cfg = load_cfg();
    if !parse_enabled(cfg.act_tts_enabled) {
        return Err("ACT TTS 已關閉".into());
    }
    if !WS_UP.load(Ordering::SeqCst) {
        return Err("OverlayPlugin WS 未連線，已略過 TTS 排程".into());
    }
    let n = current_slots()
        .iter()
        .filter(|s| !s.is_empty())
        .count();
    if n == 0 {
        return Err("沒有可播放的 (1)/(2) 文字".into());
    }
    schedule_tts();
    Ok(format!("已排程 {n} 句"))
}

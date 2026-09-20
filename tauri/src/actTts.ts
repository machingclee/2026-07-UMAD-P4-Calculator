const ENABLED_KEY = "p4-act-tts-enabled";
const PORT_KEY = "p4-overlay-ws-port";
const REGEX_KEY = "p4-log-regex";
const DELAYS_KEY = "p4-tts-delays-ms";

export const DEFAULT_ACT_TTS_ENABLED = true;
export const DEFAULT_OVERLAY_WS_PORT = 10501;
export const DEFAULT_LOG_REGEX = "ネオエクスデスは「無の氾濫」の構え";
export const DEFAULT_TTS_DELAY_MS = 0;
export const DEFAULT_TTS_DELAYS_MS = [5751, 14250, 22850, 25850, 40350, 46150] as const;
export const MAX_TTS_DELAY_MS = 120000;
export const TTS_SLOT_COUNT = 6;

export const TTS_SLOT_LABELS = [
  "(1) 行動",
  "(1) 眼",
  "(1) 鋼鐵月環",
  "(2) 行動",
  "(2) 眼",
  "(2) 鋼鐵月環",
] as const;

export function parseActTtsEnabled(value: unknown): boolean {
  if (value === false || value === "false" || value === "off" || value === 0 || value === "0") {
    return false;
  }
  if (value === true || value === "true" || value === "on" || value === 1 || value === "1") {
    return true;
  }
  return DEFAULT_ACT_TTS_ENABLED;
}

export function parseOverlayWsPort(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    return DEFAULT_OVERLAY_WS_PORT;
  }
  return Math.trunc(n);
}

export function parseLogRegex(value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return DEFAULT_LOG_REGEX;
}

export function parseTtsDelayMs(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_TTS_DELAY_MS;
  }
  return Math.min(MAX_TTS_DELAY_MS, Math.trunc(n));
}

export function parseTtsDelays(value: unknown): number[] {
  const out: number[] = [...DEFAULT_TTS_DELAYS_MS];
  if (!Array.isArray(value)) {
    return out;
  }
  for (let i = 0; i < TTS_SLOT_COUNT && i < value.length; i++) {
    out[i] = parseTtsDelayMs(value[i]);
  }
  return out;
}

export function loadActTtsEnabledLocal(): boolean {
  try {
    return parseActTtsEnabled(localStorage.getItem(ENABLED_KEY));
  } catch {
    return DEFAULT_ACT_TTS_ENABLED;
  }
}

export function persistActTtsEnabledLocal(enabled: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function loadOverlayWsPortLocal(): number {
  try {
    return parseOverlayWsPort(localStorage.getItem(PORT_KEY));
  } catch {
    return DEFAULT_OVERLAY_WS_PORT;
  }
}

export function persistOverlayWsPortLocal(port: number) {
  try {
    localStorage.setItem(PORT_KEY, String(parseOverlayWsPort(port)));
  } catch {
    /* ignore */
  }
}

export function loadLogRegexLocal(): string {
  try {
    return parseLogRegex(localStorage.getItem(REGEX_KEY));
  } catch {
    return DEFAULT_LOG_REGEX;
  }
}

export function persistLogRegexLocal(pattern: string) {
  try {
    localStorage.setItem(REGEX_KEY, parseLogRegex(pattern));
  } catch {
    /* ignore */
  }
}

export function loadTtsDelaysLocal(): number[] {
  try {
    const raw = localStorage.getItem(DELAYS_KEY);
    if (!raw) return parseTtsDelays(null);
    return parseTtsDelays(JSON.parse(raw));
  } catch {
    return parseTtsDelays(null);
  }
}

export function persistTtsDelaysLocal(delays: number[]) {
  try {
    localStorage.setItem(DELAYS_KEY, JSON.stringify(parseTtsDelays(delays)));
  } catch {
    /* ignore */
  }
}

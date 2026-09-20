const ENABLED_KEY = "p4-postnamazu-enabled";
const PORT_KEY = "p4-postnamazu-port";

export const DEFAULT_POSTNAMAZU_ENABLED = false;
export const DEFAULT_POSTNAMAZU_PORT = 2019;

export function parsePostnamazuEnabled(value: unknown): boolean {
  if (value === false || value === "false" || value === "off" || value === 0 || value === "0") {
    return false;
  }
  if (value === true || value === "true" || value === "on" || value === 1 || value === "1") {
    return true;
  }
  return DEFAULT_POSTNAMAZU_ENABLED;
}

export function parsePostnamazuPort(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    return DEFAULT_POSTNAMAZU_PORT;
  }
  return Math.trunc(n);
}

export function loadPostnamazuEnabledLocal(): boolean {
  try {
    return parsePostnamazuEnabled(localStorage.getItem(ENABLED_KEY));
  } catch {
    return DEFAULT_POSTNAMAZU_ENABLED;
  }
}

export function persistPostnamazuEnabledLocal(enabled: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function loadPostnamazuPortLocal(): number {
  try {
    return parsePostnamazuPort(localStorage.getItem(PORT_KEY));
  } catch {
    return DEFAULT_POSTNAMAZU_PORT;
  }
}

export function persistPostnamazuPortLocal(port: number) {
  try {
    localStorage.setItem(PORT_KEY, String(parsePostnamazuPort(port)));
  } catch {
    /* ignore */
  }
}

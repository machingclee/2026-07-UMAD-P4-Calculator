const LOCAL_KEY = "p4-debuff-overlay";

export const DEFAULT_DEBUFF_OVERLAY = true;

export function parseDebuffOverlay(value: unknown): boolean {
  if (value === false || value === "false" || value === "off" || value === 0 || value === "0") {
    return false;
  }
  if (value === true || value === "true" || value === "on" || value === 1 || value === "1") {
    return true;
  }
  return DEFAULT_DEBUFF_OVERLAY;
}

export function loadDebuffOverlayLocal(): boolean {
  try {
    return parseDebuffOverlay(localStorage.getItem(LOCAL_KEY));
  } catch {
    return DEFAULT_DEBUFF_OVERLAY;
  }
}

export function persistDebuffOverlayLocal(enabled: boolean) {
  try {
    localStorage.setItem(LOCAL_KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

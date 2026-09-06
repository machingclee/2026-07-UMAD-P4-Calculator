const LOCAL_KEY = "p4-original-menu";

export const DEFAULT_ORIGINAL_MENU = true;

export function parseOriginalMenu(value: unknown): boolean {
  if (value === false || value === "false" || value === "off" || value === 0 || value === "0") {
    return false;
  }
  if (value === true || value === "true" || value === "on" || value === 1 || value === "1") {
    return true;
  }
  return DEFAULT_ORIGINAL_MENU;
}

export function loadOriginalMenuLocal(): boolean {
  try {
    return parseOriginalMenu(localStorage.getItem(LOCAL_KEY));
  } catch {
    return DEFAULT_ORIGINAL_MENU;
  }
}

export function persistOriginalMenuLocal(enabled: boolean) {
  try {
    localStorage.setItem(LOCAL_KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const OVERLAY_TEXT_EVENT = "overlay-text";

export function publishOverlayText(text: string) {
  window.dispatchEvent(new CustomEvent(OVERLAY_TEXT_EVENT, { detail: text }));
}

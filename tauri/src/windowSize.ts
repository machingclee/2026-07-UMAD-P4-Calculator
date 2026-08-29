import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { APP_HEIGHT, APP_WIDTH } from "./constants";
import { isTauri } from "./env";

/** Apply size knobs from constants.ts. Overlay size follows content instead. */
export function applyNativeWindowSize(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  const win = getCurrentWindow();
  if (win.label === "main") {
    return win.setSize(new LogicalSize(APP_WIDTH, APP_HEIGHT)).catch(() => {});
  }
  return Promise.resolve();
}

let lastOverlayW = 0;
let lastOverlayH = 0;

/** Size the overlay window to an element's laid-out box (1×1 when empty). */
export function fitOverlayToElement(el: HTMLElement): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  const win = getCurrentWindow();
  if (win.label !== "overlay") return Promise.resolve();
  const rect = el.getBoundingClientRect();
  // +1 covers subpixel / WebView2 inner-size rounding that otherwise shows scrollbars.
  const width = Math.max(1, Math.ceil(Math.max(el.scrollWidth, el.offsetWidth, rect.width)) + 1);
  const height = Math.max(1, Math.ceil(Math.max(el.scrollHeight, el.offsetHeight, rect.height)) + 1);
  if (width === lastOverlayW && height === lastOverlayH) return Promise.resolve();
  return win.setSize(new LogicalSize(width, height)).then(
    () => {
      lastOverlayW = width;
      lastOverlayH = height;
    },
    () => {},
  );
}

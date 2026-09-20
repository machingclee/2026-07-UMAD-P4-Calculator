import { invoke } from "@tauri-apps/api/core";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  APP_HEIGHT,
  APP_WIDTH,
  COMPACT_APP_HEIGHT,
  COMPACT_APP_WIDTH,
  SETTINGS_APP_HEIGHT,
} from "./constants";
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

/** Full calculator vs 清除+變更 bar vs 變更 settings. Bottom-anchored when shade edge is bottom. */
export async function applyMainWindowLayout(opts: {
  compact: boolean;
  settings: boolean;
  shadeFromBottom: boolean;
}): Promise<void> {
  if (!isTauri()) return;
  const win = getCurrentWindow();
  if (win.label !== "main") return;
  const width = opts.compact ? COMPACT_APP_WIDTH : APP_WIDTH;
  const height = opts.compact
    ? COMPACT_APP_HEIGHT
    : opts.settings
      ? SETTINGS_APP_HEIGHT
      : APP_HEIGHT;
  const prev = opts.shadeFromBottom
    ? await Promise.all([win.outerPosition(), win.outerSize()]).catch(() => null)
    : null;
  await win.setSize(new LogicalSize(width, height)).catch(() => {});
  if (!prev) return;
  const [pos, oldSize] = prev;
  const newSize = await win.outerSize().catch(() => null);
  if (!newSize) return;
  const dy = oldSize.height - newSize.height;
  if (dy === 0) return;
  await win.setPosition(new PhysicalPosition(pos.x, pos.y + dy)).catch(() => {});
}

let lastOverlayW = 0;
let lastOverlayH = 0;
let fitQueue: Promise<void> = Promise.resolve();

const OVERLAY_WINDOW_LABELS = new Set(["overlay", "overlay-icons"]);

/** Size the overlay window to an element's laid-out box (1×1 when empty). */
export function fitOverlayToElement(
  el: HTMLElement,
  options?: { anchor?: "top" | "bottom" },
): Promise<void> {
  const run = () => fitOverlayToElementNow(el, options?.anchor ?? "top");
  const next = fitQueue.then(run, run);
  fitQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function fitOverlayToElementNow(
  el: HTMLElement,
  anchor: "top" | "bottom",
): Promise<void> {
  if (!isTauri()) return;
  const win = getCurrentWindow();
  if (!OVERLAY_WINDOW_LABELS.has(win.label)) return;
  const rect = el.getBoundingClientRect();
  // +1 covers subpixel / WebView2 inner-size rounding that otherwise shows scrollbars.
  const width = Math.max(1, Math.ceil(Math.max(el.scrollWidth, el.offsetWidth, rect.width)) + 1);
  const height = Math.max(1, Math.ceil(Math.max(el.scrollHeight, el.offsetHeight, rect.height)) + 1);
  if (width === lastOverlayW && height === lastOverlayH) return;

  if (anchor === "bottom") {
    await invoke("resize_overlay_anchored", {
      width,
      height,
      anchorBottom: true,
    }).catch(() => {});
  } else {
    await win.setSize(new LogicalSize(width, height)).catch(() => {});
  }
  lastOverlayW = width;
  lastOverlayH = height;
}

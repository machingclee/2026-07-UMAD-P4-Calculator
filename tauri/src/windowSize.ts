import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { OVERLAY_HEIGHT, OVERLAY_WIDTH } from "./constants";
import { isTauri } from "./env";

/** Apply OVERLAY_* from constants.ts to the overlay window. */
export function applyNativeWindowSize(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  const win = getCurrentWindow();
  if (win.label !== "overlay") return Promise.resolve();
  return win.setSize(new LogicalSize(OVERLAY_WIDTH, OVERLAY_HEIGHT)).catch(() => {});
}

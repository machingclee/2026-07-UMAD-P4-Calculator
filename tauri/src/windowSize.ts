import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { APP_HEIGHT, APP_WIDTH, OVERLAY_HEIGHT, OVERLAY_WIDTH } from "./constants";
import { isTauri } from "./env";

/** Apply size knobs from constants.ts. Main size is forced in dev only. */
export function applyNativeWindowSize(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  const win = getCurrentWindow();
  if (win.label === "overlay") {
    return win.setSize(new LogicalSize(OVERLAY_WIDTH, OVERLAY_HEIGHT)).catch(() => {});
  }
  if (win.label === "main" && import.meta.env.DEV) {
    return win.setSize(new LogicalSize(APP_WIDTH, APP_HEIGHT)).catch(() => {});
  }
  return Promise.resolve();
}

// ── Config ────────────────────────────────────────────────────────────────────
// Same knobs as ../main.py. Main window size is stored in config.json
// after you resize in 變更 mode.

export const DEBUG = false; // show overlay X/Y in the main window title when dragging

export const OVERLAY_WIDTH = 400; // overlay window width
export const OVERLAY_HEIGHT = 320; // overlay window height
export const OVERLAY_X = 865; // initial screen X position
export const OVERLAY_Y = 345; // initial screen Y position
export const TEXT_X = 200; // text X anchor within overlay (center)
export const TEXT_Y = 160; // text Y anchor within overlay (center)

export const FONT_FAMILY =
  '"Microsoft JhengHei UI", "Microsoft JhengHei", "微軟正黑體", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang TC", "Noto Sans TC", sans-serif';
export const OVERLAY_FONT_FAMILY = FONT_FAMILY;
export const OVERLAY_FONT_SIZE_PT = 18;
export const OVERLAY_FONT_WEIGHT = 700;
export const STROKE_COLOR = "#0044cc"; // deep blue outline
export const STROKE_RADIUS = 2;
export const STROKE_STEP_DEG = 22;
export const FILL_COLOR = "#ffffff"; // white text
export const OVERLAY_HINT = "金身撞相反，紫身撞相同";
export const BG_COLOR = "transparent"; // Python used #000000 as a Win32 color-key
export const DRAG_BG = "rgba(0, 0, 0, 0.55)"; // text plate while dragging is enabled

export const FONT_SIZE = 14;
export const EMOJI_SIZE = 18; // 🔥 💧 ❓ and other UI emoji
export const ACTION_ICON_SIZE = 25; // webp icons on ⏩ 💧 ⚡ badge buttons
export const LABEL_WIDTH = 5; // character width for row labels in round blocks
export const LEFT_COL_WIDTH = 130; // px; right column takes the remaining space
export const ACTION_BTN_WIDTH = 52; // px; ⏩ 💧 ⚡ buttons only
export const ACTION_BTN_PAD_TOP = 10; // px; extra padding above the icon
export const ACTION_BTN_PAD_BOTTOM = 0; // px; padding below the icon
export const ACTION_BTN_GAP = 6; // px; horizontal gap between ⏩ 💧 ⚡ columns
export const ACTION_BADGE_TOP = -10; // px; 0 = top of icon, negative moves the label up
export const ACTION_BADGE_FONT_SIZE = 12; // px; 0~50 / 1m labels
export const ACTION_BADGE_FILL = "#000000"; // light mode text
export const ACTION_BADGE_FILL_DARK = "#ffffff"; // dark mode text
export const ACTION_BADGE_STROKE = "#ffffff"; // light mode outline
export const ACTION_BADGE_STROKE_DARK = "#000000"; // dark mode outline

export const APP_BG = "#f0f0f0";
export const APP_BG_DARK = "#1e1e1e";
export const BTN_BG = "#e1e1e1";
export const BTN_BG_DARK = "#3a3a3a";
export const BTN_SELECTED_BG = "#b2d1e9";
export const BTN_SELECTED_BG_DARK = "#1b3d55";
export const BTN_HOVER_BG = "#e5f1fb";
export const BTN_HOVER_BG_DARK = "#2a4a6a";

export const FIRE_COLOR = "#cc3300";
export const FIRE_COLOR_DARK = "#ffd117";
export const WATER_COLOR = "#0066cc";
export const WATER_COLOR_DARK = "#6ecbff";
export const QUESTION_COLOR = "#ff0000";
export const QUESTION_COLOR_DARK = "#ff877f";

// ── Choices ───────────────────────────────────────────────────────────────────
export const TRUE_FALSE = ["真", "？"] as const;
export const SPEED = ["1 ⏩", "2 ⏩"] as const;
export const WATER = ["1 💧", "2 💧"] as const;
export const THUNDER = ["1 ⚡", "2 ⚡"] as const;
export const ICE = ["1 冰", "2 冰"] as const;

export function applyThemeColors(theme: "light" | "dark") {
  const dark = theme === "dark";
  const root = document.documentElement;
  root.style.setProperty("--app-bg", dark ? APP_BG_DARK : APP_BG);
  root.style.setProperty("--btn-bg", dark ? BTN_BG_DARK : BTN_BG);
  root.style.setProperty("--btn-selected-bg", dark ? BTN_SELECTED_BG_DARK : BTN_SELECTED_BG);
  root.style.setProperty("--btn-hover-bg", dark ? BTN_HOVER_BG_DARK : BTN_HOVER_BG);
  root.style.setProperty("--question-color", dark ? QUESTION_COLOR_DARK : QUESTION_COLOR);
  root.style.setProperty("--badge-fill", dark ? ACTION_BADGE_FILL_DARK : ACTION_BADGE_FILL);
  root.style.setProperty(
    "--badge-stroke",
    dark ? ACTION_BADGE_STROKE_DARK : ACTION_BADGE_STROKE,
  );
}

export function applyCssVars(el: HTMLElement = document.documentElement) {
  el.style.setProperty("--font-family", FONT_FAMILY);
  el.style.setProperty("--font-size", `${FONT_SIZE}px`);
  el.style.setProperty("--emoji-size", `${EMOJI_SIZE}px`);
  el.style.fontFamily = FONT_FAMILY;
  el.style.fontSize = `${FONT_SIZE}px`;
  document.body.style.fontFamily = FONT_FAMILY;
  document.body.style.fontSize = `${FONT_SIZE}px`;
  applyThemeColors("light");
}

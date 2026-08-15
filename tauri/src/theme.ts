export type Theme = "light" | "dark";

const LOCAL_KEY = "p4-theme";

export function parseTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
}

export function loadThemeLocal(): Theme {
  try {
    return parseTheme(localStorage.getItem(LOCAL_KEY));
  } catch {
    return "light";
  }
}

export function persistThemeLocal(theme: Theme) {
  try {
    localStorage.setItem(LOCAL_KEY, theme);
  } catch {
    /* ignore */
  }
}

const LOCAL_KEY = "p4-line-gap";

export const DEFAULT_LINE_GAP = 0;
export const MAX_LINE_GAP = 15;

export function parseLineGap(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LINE_GAP;
  return Math.max(DEFAULT_LINE_GAP, Math.min(MAX_LINE_GAP, Math.round(n)));
}

export function loadLineGapLocal(): number {
  try {
    return parseLineGap(localStorage.getItem(LOCAL_KEY));
  } catch {
    return DEFAULT_LINE_GAP;
  }
}

export function persistLineGapLocal(px: number) {
  try {
    localStorage.setItem(LOCAL_KEY, String(parseLineGap(px)));
  } catch {
    /* ignore */
  }
}

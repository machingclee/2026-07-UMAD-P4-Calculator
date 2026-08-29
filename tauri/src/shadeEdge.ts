export type ShadeEdge = "top" | "bottom";

const LOCAL_KEY = "p4-shade-edge";

export function parseShadeEdge(value: unknown): ShadeEdge {
  return value === "top" ? "top" : "bottom";
}

export function loadShadeEdgeLocal(): ShadeEdge {
  try {
    return parseShadeEdge(localStorage.getItem(LOCAL_KEY));
  } catch {
    return "bottom";
  }
}

export function persistShadeEdgeLocal(edge: ShadeEdge) {
  try {
    localStorage.setItem(LOCAL_KEY, edge);
  } catch {
    /* ignore */
  }
}

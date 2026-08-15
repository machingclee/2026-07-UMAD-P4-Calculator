import type { State } from "./state";

function get(state: State, key: string): string {
  return state[key] ?? "";
}

/** Same as python/main.py `_actions`. */
function actions(selections: State, prefix: string): string[] {
  const out: string[] = [];
  for (const rnd of ["round1", "round2"] as const) {
    const tf = get(selections, `${rnd}_tf`);
    if (!tf) continue;
    const isTrue = tf === "真";
    const spd = get(selections, `${rnd}_speed`);
    const wat = get(selections, `${rnd}_water`);
    const thu = get(selections, `${rnd}_thunder`);
    if (spd.includes(prefix)) out.push(isTrue ? "不動" : "動");
    if (wat.includes(prefix)) out.push(isTrue ? "水分攤" : "水出去");
    if (thu.includes(prefix)) out.push(isTrue ? "雷出去" : "雷分攤");
  }
  return out;
}

/** Same as python/main.py `calculate`. */
export function calculate(state: State): string {
  const lines: string[] = [];
  for (const [rnd, prefix] of [
    ["round1", "1"],
    ["round2", "2"],
  ] as const) {
    const tf = get(state, `${rnd}_tf`);
    const eye = tf === "真" ? "背對眼" : tf ? "面對眼" : "";
    const acts = actions(state, prefix);
    if (!tf && acts.length === 0) continue;
    if (lines.length) lines.push("");
    const label = rnd === "round1" ? "R1" : "R2";
    const actionText = acts.join("  ");
    lines.push(`${label} ${actionText}`.trim());
    if (eye) lines.push(`  ${eye}`);
    if (rnd === "round1") {
      const fVal = get(state, "fire");
      if (fVal) lines.push(`  ${fVal === "真" ? "放鋼鐵" : "放月環"}`);
    } else {
      const wVal = get(state, "water");
      if (wVal) lines.push(`  ${wVal === "真" ? "放月環" : "放鋼鐵"}`);
    }
  }
  return lines.join("\n");
}

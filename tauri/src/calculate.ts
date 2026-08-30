import { DEFAULT_LABELS, type Labels } from "./labels";
import type { State } from "./state";

function get(state: State, key: string): string {
  return state[key] ?? "";
}

/** Empty omits the line. `\n` in the field becomes a real newline. */
function linesFromLabel(text: string): string[] | null {
  if (text === "") return null;
  const expanded = text.replace(/\\n/g, "\n");
  if (/^\n+$/.test(expanded)) return Array.from(expanded, () => "");
  return expanded.split("\n");
}

function pushLabel(lines: string[], text: string, indent = "") {
  const parts = linesFromLabel(text);
  if (!parts) return;
  for (const part of parts) lines.push(indent + part);
}

function joinParts(...parts: string[]): string {
  return parts.filter((s) => s !== "").join("  ");
}

/** 水出/雷出 may be blank; 水分攤/雷分攤 fall back to 分攤. */
function waterThunderWord(text: string, isOut: boolean): string {
  if (text !== "") return text;
  return isOut ? "" : "分攤";
}

/** Same as python/main.py `_actions`, with 分攤/水出/雷出 before 要動/不動. */
function actions(selections: State, prefix: string, labels: Labels): string[] {
  const waterThunder: string[] = [];
  const speedActs: string[] = [];
  let hasShare = false;
  const share = waterThunderWord(labels.share, false);
  for (const rnd of ["round1", "round2"] as const) {
    const tf = get(selections, `${rnd}_tf`);
    if (!tf) continue;
    const isTrue = tf === "真";
    const spd = get(selections, `${rnd}_speed`);
    const wat = get(selections, `${rnd}_water`);
    const thu = get(selections, `${rnd}_thunder`);
    if (wat.includes(prefix)) {
      if (isTrue) {
        if (!hasShare) {
          waterThunder.push(share);
          hasShare = true;
        }
      } else {
        const word = waterThunderWord(labels.waterOut, true);
        if (word) waterThunder.push(word);
      }
    }
    if (thu.includes(prefix)) {
      if (isTrue) {
        const word = waterThunderWord(labels.thunderOut, true);
        if (word) waterThunder.push(word);
      } else if (!hasShare) {
        waterThunder.push(share);
        hasShare = true;
      }
    }
    if (spd.includes(prefix)) {
      speedActs.push(isTrue ? labels.stay : labels.move);
    }
  }
  return [...waterThunder, ...speedActs].filter((s) => s !== "");
}

function withShareIfNoOut(acts: string[], labels: Labels): string[] {
  const share = waterThunderWord(labels.share, false);
  const waterOut = waterThunderWord(labels.waterOut, true);
  const thunderOut = waterThunderWord(labels.thunderOut, true);
  const hasOut = acts.some((a) => a === waterOut || a === thunderOut);
  const hasShare = share !== "" && acts.includes(share);
  if (!hasOut && !hasShare && share) return [share, ...acts];
  return acts;
}

function r2StepHint(state: State, labels: Labels): string {
  const isThunderFaked = Boolean(get(state, "thunder"));
  const isIceFaked = Boolean(get(state, "ice"));
  if (isThunderFaked && isIceFaked) return labels.stepBoth;
  if (isThunderFaked) return labels.stepThunder;
  if (isIceFaked) return labels.stepIce;
  return labels.stepNone;
}

/** Same as python/main.py `calculate`. */
export function calculate(state: State, labels: Labels = DEFAULT_LABELS): string {
  const lines: string[] = [];
  for (const [rnd, prefix] of [
    ["round1", "1"],
    ["round2", "2"],
  ] as const) {
    const tf = get(state, `${rnd}_tf`);
    const eye = tf === "真" ? labels.lookAway : tf ? labels.lookAt : "";
    let acts = actions(state, prefix, labels);
    if (!tf && acts.length === 0) continue;
    acts = withShareIfNoOut(acts, labels);
    const suffix = labels.recordTf;
    const block: string[] = [];
    pushLabel(block, rnd === "round1" ? labels.r1 : labels.r2);
    if (acts.length) {
      const actsText = acts.join("  ");
      pushLabel(
        block,
        rnd === "round2" ? joinParts(actsText, suffix) : actsText,
        "  ",
      );
    } else if (rnd === "round2") {
      pushLabel(block, suffix, "  ");
    }
    pushLabel(block, rnd === "round1" ? joinParts(eye, suffix) : eye, "  ");
    if (rnd === "round1") {
      const fVal = get(state, "fire");
      if (fVal) pushLabel(block, fVal === "真" ? labels.steel : labels.moon, "  ");
    } else {
      const wVal = get(state, "water");
      if (wVal) {
        const parts = [
          wVal === "真" ? labels.moon : labels.steel,
          r2StepHint(state, labels),
        ].filter((s) => s !== "");
        if (parts.length) pushLabel(block, parts.join(" "), "  ");
      }
    }
    if (!block.length) continue;
    lines.push(...block);
  }
  return lines.join("\n");
}

/** Overlay payload: hint once at the top after any button is set. */
export function overlayText(state: State, labels: Labels = DEFAULT_LABELS): string {
  const started = Object.values(state).some(Boolean);
  if (!started) return "";
  const body = calculate(state, labels);
  if (labels.overlayHint === "") return body;
  const hint = labels.overlayHint.replace(/\\n/g, "\n");
  if (!body) return hint;
  return `${hint}\n${body}`;
}

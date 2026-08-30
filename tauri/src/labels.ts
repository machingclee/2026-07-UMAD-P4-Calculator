const LOCAL_KEY = "p4-labels";

export const DEFAULT_LABELS = {
  overlayHint: "金反，紫同",
  r1: "R1",
  r2: "R2",
  stay: "不動",
  move: "要動",
  lookAway: "背眼",
  lookAt: "望眼",
  recordTf: "記錄真假",
  waterOut: "水出",
  thunderOut: "雷出",
  share: "分攤",
  steel: "放鋼鐵",
  moon: "放月環",
  stepBoth: "都踩",
  stepThunder: "踩雷",
  stepIce: "踩冰",
  stepNone: "都不踩",
} as const;

export type LabelKey = keyof typeof DEFAULT_LABELS;
export type Labels = { [K in LabelKey]: string };

export const LABEL_KEYS = Object.keys(DEFAULT_LABELS) as LabelKey[];

export const LABEL_GROUPS: { title: string; keys: LabelKey[] }[] = [
  {
    title: "Overlay",
    keys: [
      "overlayHint",
      "r1",
      "r2",
      "stay",
      "move",
      "lookAway",
      "lookAt",
      "recordTf",
      "waterOut",
      "thunderOut",
      "share",
      "steel",
      "moon",
      "stepBoth",
      "stepThunder",
      "stepIce",
      "stepNone",
    ],
  },
];

export function mergeLabels(
  partial: Partial<Record<string, string>> | null | undefined,
): Labels {
  const out = { ...DEFAULT_LABELS } as Labels;
  if (!partial) return out;
  for (const key of LABEL_KEYS) {
    const value = partial[key];
    if (typeof value === "string") out[key] = value;
  }
  if (typeof partial.share !== "string") {
    const legacy = partial.waterShare ?? partial.thunderShare;
    if (typeof legacy === "string") out.share = legacy;
  }
  return out;
}

/** Store only values that differ from defaults (empty string is a real override). */
export function sparseLabels(labels: Labels): Partial<Labels> {
  const out: Partial<Labels> = {};
  for (const key of LABEL_KEYS) {
    if (labels[key] !== DEFAULT_LABELS[key]) out[key] = labels[key];
  }
  return out;
}

export function loadLabelsLocal(): Labels {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { ...DEFAULT_LABELS };
    return mergeLabels(JSON.parse(raw) as Partial<Record<string, string>>);
  } catch {
    return { ...DEFAULT_LABELS };
  }
}

export function persistLabelsLocal(labels: Labels) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sparseLabels(labels)));
  } catch {
    /* ignore */
  }
}

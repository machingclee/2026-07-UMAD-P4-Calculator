export type State = Record<string, string>;

export const EMPTY_STATE: State = {
  fire: "",
  water: "",
  thunder: "",
  ice: "",
  round1_tf: "",
  round1_speed: "",
  round1_water: "",
  round1_thunder: "",
  round2_tf: "",
  round2_speed: "",
  round2_water: "",
  round2_thunder: "",
};

export const SPEED = ["1 ⏩", "2 ⏩"];
export const WATER = ["1 💧", "2 💧"];
export const THUNDER = ["1 ⚡", "2 ⚡"];

export function toggleValue(current: string, next: string): string {
  return current === next ? "" : next;
}

export function isExcluded(
  state: State,
  rnd: "round1" | "round2",
  key: "speed" | "water" | "thunder",
): boolean {
  const other = rnd === "round1" ? "round2" : "round1";
  return Boolean(state[`${other}_${key}`]);
}

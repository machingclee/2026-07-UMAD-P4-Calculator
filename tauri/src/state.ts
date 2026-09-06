export type State = Record<string, string>;

export { ICE, SPEED, THUNDER, TRUE_FALSE, WATER } from "./constants";

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

export type DebuffIconState = {
  speed: boolean;
  water: boolean;
  thunder: boolean;
  dimAll: boolean;
};

export const EMPTY_DEBUFF_ICON_STATE: DebuffIconState = {
  speed: false,
  water: false,
  thunder: false,
  dimAll: false,
};

function roundHasAction(state: State, rnd: "round1" | "round2"): boolean {
  return Boolean(
    state[`${rnd}_speed`] || state[`${rnd}_water`] || state[`${rnd}_thunder`],
  );
}

/** Which overlay icons are marked used, and whether both rounds are filled. */
export function debuffIconState(state: State): DebuffIconState {
  const speed = Boolean(state.round1_speed || state.round2_speed);
  const water = Boolean(state.round1_water || state.round2_water);
  const thunder = Boolean(state.round1_thunder || state.round2_thunder);
  return {
    speed,
    water,
    thunder,
    dimAll: roundHasAction(state, "round1") && roundHasAction(state, "round2"),
  };
}

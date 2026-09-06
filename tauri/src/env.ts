import type { State } from "./state";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const OVERLAY_TEXT_EVENT = "overlay-text";
export const OVERLAY_DRAG_EVENT = "overlay-drag";
export const OVERLAY_LINE_GAP_EVENT = "overlay-line-gap";
export const APP_EXPANDED_EVENT = "app-expanded";
export const DEBUFF_OVERLAY_EVENT = "debuff-overlay";
export const CALCULATOR_STATE_EVENT = "calculator-state";
export const CALCULATOR_SET_EVENT = "calculator-set";
export const CALCULATOR_STATE_REQUEST_EVENT = "calculator-state-request";

export type CalculatorSet = { key: string; value: string };

export function publishOverlayText(text: string) {
  window.dispatchEvent(new CustomEvent(OVERLAY_TEXT_EVENT, { detail: text }));
}

export function publishOverlayDrag(enabled: boolean) {
  window.dispatchEvent(new CustomEvent(OVERLAY_DRAG_EVENT, { detail: enabled }));
}

export function publishOverlayLineGap(px: number) {
  window.dispatchEvent(new CustomEvent(OVERLAY_LINE_GAP_EVENT, { detail: px }));
}

export function publishAppExpanded(expanded: boolean) {
  window.dispatchEvent(new CustomEvent(APP_EXPANDED_EVENT, { detail: expanded }));
}

export function publishDebuffOverlay(enabled: boolean) {
  window.dispatchEvent(new CustomEvent(DEBUFF_OVERLAY_EVENT, { detail: enabled }));
}

export function publishCalculatorState(state: State) {
  window.dispatchEvent(new CustomEvent(CALCULATOR_STATE_EVENT, { detail: state }));
}

export function publishCalculatorSet(patch: CalculatorSet) {
  window.dispatchEvent(new CustomEvent(CALCULATOR_SET_EVENT, { detail: patch }));
}

export function publishCalculatorStateRequest() {
  window.dispatchEvent(new CustomEvent(CALCULATOR_STATE_REQUEST_EVENT));
}

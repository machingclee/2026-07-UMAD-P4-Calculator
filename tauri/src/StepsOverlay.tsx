import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BG_COLOR, DEBUG } from "./constants";
import {
  APP_EXPANDED_EVENT,
  CALCULATOR_STATE_EVENT,
  DEBUFF_OVERLAY_EVENT,
  OVERLAY_DRAG_EVENT,
  isTauri,
  publishCalculatorSet,
  publishCalculatorStateRequest,
} from "./env";
import { parseDebuffOverlay } from "./debuffOverlay";
import { StepsOverlayWizard } from "./StepsOverlayWizard";
import {
  EMPTY_STATE,
  parseState,
  wizardStep,
  type State,
} from "./state";
import { fitOverlayToElement } from "./windowSize";

export default function StepsOverlay() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragEnabled, setDragEnabled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [calc, setCalc] = useState<State>(EMPTY_STATE);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const initialFit = useRef(true);
  const step = wizardStep(calc);

  useEffect(() => {
    if (isTauri()) {
      invoke<boolean>("get_expanded")
        .then((value) => setExpanded(Boolean(value)))
        .catch(() => { });
      const unlisten = listen<boolean>("app-expanded", (event) => {
        setExpanded(Boolean(event.payload));
      });
      return () => {
        unlisten.then((fn) => fn()).catch(() => { });
      };
    }
    const onExpanded = (event: Event) => {
      setExpanded(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener(APP_EXPANDED_EVENT, onExpanded);
    return () => window.removeEventListener(APP_EXPANDED_EVENT, onExpanded);
  }, []);

  useEffect(() => {
    if (isTauri()) {
      invoke<boolean>("get_debuff_overlay")
        .then((value) => setEnabled(parseDebuffOverlay(value)))
        .catch(() => { });
      const unlisten = listen<boolean>("debuff-overlay", (event) => {
        setEnabled(parseDebuffOverlay(event.payload));
      });
      return () => {
        unlisten.then((fn) => fn()).catch(() => { });
      };
    }
    const onEnabled = (event: Event) => {
      setEnabled(parseDebuffOverlay((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener(DEBUFF_OVERLAY_EVENT, onEnabled);
    return () => window.removeEventListener(DEBUFF_OVERLAY_EVENT, onEnabled);
  }, []);

  useEffect(() => {
    if (isTauri()) {
      const unlisten = listen<State>("calculator-state", (event) => {
        setCalc(parseState(event.payload));
      });
      emit("calculator-state-request").catch(() => { });
      return () => {
        unlisten.then((fn) => fn()).catch(() => { });
      };
    }
    const onState = (event: Event) => {
      setCalc(parseState((event as CustomEvent<State>).detail));
    };
    window.addEventListener(CALCULATOR_STATE_EVENT, onState);
    publishCalculatorStateRequest();
    return () => window.removeEventListener(CALCULATOR_STATE_EVENT, onState);
  }, []);

  useEffect(() => {
    if (isTauri()) {
      const unlisten = listen<boolean>("overlay-drag", (event) => {
        setDragEnabled(Boolean(event.payload));
      });
      return () => {
        unlisten.then((fn) => fn()).catch(() => { });
      };
    }
    const onDrag = (event: Event) => {
      setDragEnabled(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener(OVERLAY_DRAG_EVENT, onDrag);
    return () => window.removeEventListener(OVERLAY_DRAG_EVENT, onDrag);
  }, []);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (!expanded || !enabled) return;
    const apply = () => {
      const anchor = initialFit.current || dragEnabled ? "top" : "bottom";
      initialFit.current = false;
      void fitOverlayToElement(el, { anchor });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, enabled, dragEnabled, step, calc]);

  useEffect(() => {
    if (!isTauri()) return;
    const capture = dragEnabled || (expanded && enabled);
    getCurrentWindow()
      .setIgnoreCursorEvents(!capture)
      .catch(() => { });
  }, [dragEnabled, expanded, enabled, step]);

  useEffect(() => {
    if (!isTauri()) return;
    const block = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, []);

  useEffect(() => {
    if (!DEBUG || !isTauri()) return;
    const unlisten = listen<[number, number]>("overlay-icons-pos", (event) => {
      const [x, y] = event.payload ?? [];
      if (typeof x === "number" && typeof y === "number") {
        setPos({ x, y });
      }
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => { });
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className="m-0 w-max max-w-none overflow-hidden cursor-default select-none"
      style={{ background: BG_COLOR }}
    >
      {expanded && enabled ? (
        <>
          <StepsOverlayWizard
            state={calc}
            step={step}
            dragEnabled={dragEnabled}
            onSet={(key, value) => {
              if (isTauri()) {
                emit("calculator-set", { key, value }).catch(() => { });
                return;
              }
              publishCalculatorSet({ key, value });
            }}
          />
          {DEBUG && pos ? (
            <div className="pointer-events-none whitespace-nowrap text-[22px] text-white">
              OVL_X={pos.x} OVL_Y={pos.y}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
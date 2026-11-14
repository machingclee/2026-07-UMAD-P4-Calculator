import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  BG_COLOR,
  DEBUG,
  FILL_COLOR,
  OVERLAY_FONT_FAMILY,
  OVERLAY_FONT_SIZE_PT,
  OVERLAY_FONT_WEIGHT,
  STROKE_COLOR,
  STROKE_RADIUS,
  STROKE_STEP_DEG,
} from "./constants";
import {
  OVERLAY_DRAG_EVENT,
  OVERLAY_LINE_GAP_EVENT,
  OVERLAY_TEXT_EVENT,
  isTauri,
} from "./env";
import { overlayText } from "./calculate";
import { DEFAULT_LABELS, mergeLabels, type Labels } from "./labels";
import {
  DEFAULT_LINE_GAP,
  loadLineGapLocal,
  parseLineGap,
} from "./lineGap";
import { DRAG_PREVIEW_STATE } from "./state";
import { fitOverlayToElement } from "./windowSize";

function strokeShadow(): string {
  const parts: string[] = [];
  for (let angle = 0; angle < 360; angle += STROKE_STEP_DEG) {
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * STROKE_RADIUS;
    const dy = Math.sin(rad) * STROKE_RADIUS;
    parts.push(`${dx.toFixed(2)}px ${dy.toFixed(2)}px 0 ${STROKE_COLOR}`);
  }
  return parts.join(", ");
}

export default function Overlay() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [dragEnabled, setDragEnabled] = useState(false);
  const [labels, setLabels] = useState<Labels>(DEFAULT_LABELS);
  const [lineGap, setLineGap] = useState(DEFAULT_LINE_GAP);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const shadow = useMemo(strokeShadow, []);

  const body = dragEnabled ? overlayText(DRAG_PREVIEW_STATE, labels) : text;
  const display = DEBUG && pos
    ? body
      ? `${body}\n\nOVL_X=${pos.x} OVL_Y=${pos.y}`
      : `OVL_X=${pos.x} OVL_Y=${pos.y}`
    : body;

  useEffect(() => {
    if (isTauri()) {
      let fromEvent = false;
      const unlisten = listen<string>("overlay-text", (event) => {
        fromEvent = true;
        setText(event.payload ?? "");
      });
      // Release webview mounts after the first emit. Read the stored text
      // once the listener is active so that emit is not lost.
      void unlisten.then(() => {
        invoke<string>("get_overlay_text")
          .then((value) => {
            if (!fromEvent) setText(value ?? "");
          })
          .catch(() => {});
      });
      return () => {
        unlisten.then((fn) => fn()).catch(() => {});
      };
    }
    const onText = (event: Event) => {
      setText((event as CustomEvent<string>).detail ?? "");
    };
    window.addEventListener(OVERLAY_TEXT_EVENT, onText);
    return () => window.removeEventListener(OVERLAY_TEXT_EVENT, onText);
  }, []);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => {
      void fitOverlayToElement(el);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [display, dragEnabled, lineGap]);

  useEffect(() => {
    if (!dragEnabled || !isTauri()) return;
    invoke<Record<string, string>>("get_labels")
      .then((value) => setLabels(mergeLabels(value)))
      .catch(() => {});
  }, [dragEnabled]);

  useEffect(() => {
    if (isTauri()) {
      const unlisten = listen<boolean>("overlay-drag", (event) => {
        setDragEnabled(Boolean(event.payload));
      });
      return () => {
        unlisten.then((fn) => fn()).catch(() => {});
      };
    }
    const onDrag = (event: Event) => {
      setDragEnabled(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener(OVERLAY_DRAG_EVENT, onDrag);
    return () => window.removeEventListener(OVERLAY_DRAG_EVENT, onDrag);
  }, []);

  useEffect(() => {
    if (isTauri()) {
      invoke<number>("get_line_gap")
        .then((value) => setLineGap(parseLineGap(value)))
        .catch(() => {});
      const unlisten = listen<number>("overlay-line-gap", (event) => {
        setLineGap(parseLineGap(event.payload));
      });
      return () => {
        unlisten.then((fn) => fn()).catch(() => {});
      };
    }
    setLineGap(loadLineGapLocal());
    const onGap = (event: Event) => {
      setLineGap(parseLineGap((event as CustomEvent<number>).detail));
    };
    window.addEventListener(OVERLAY_LINE_GAP_EVENT, onGap);
    return () => window.removeEventListener(OVERLAY_LINE_GAP_EVENT, onGap);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    // Not setIgnoreCursorEvents: that sets WS_EX_LAYERED, which current
    // Windows composites at alpha 0 and hides this text.
    invoke("set_overlay_click_through", { clickThrough: !dragEnabled }).catch(
      () => {},
    );
  }, [dragEnabled]);

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
    const unlisten = listen<[number, number]>("overlay-pos", (event) => {
      const [x, y] = event.payload ?? [];
      if (typeof x === "number" && typeof y === "number") {
        setPos({ x, y });
      }
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  const strokePad = STROKE_RADIUS + 1;

  return (
    <div
      ref={boxRef}
      className="m-0 w-max max-w-none overflow-hidden cursor-default select-none"
      style={{ background: BG_COLOR }}
    >
      {display || dragEnabled ? (
        <div
          className={`box-border flex flex-col text-left leading-[1.35] ${
            dragEnabled ? "cursor-move" : ""
          }`}
          {...(dragEnabled ? { "data-tauri-drag-region": "deep" } : {})}
          style={{
            fontFamily: OVERLAY_FONT_FAMILY,
            fontSize: `${OVERLAY_FONT_SIZE_PT}pt`,
            fontWeight: OVERLAY_FONT_WEIGHT,
            WebkitFontSmoothing: "antialiased",
            color: FILL_COLOR,
            textShadow: shadow,
            WebkitTextStroke: dragEnabled ? `2px ${STROKE_COLOR}` : undefined,
            paintOrder: dragEnabled ? "stroke fill" : undefined,
            background: "transparent",
            padding: strokePad,
            gap: lineGap,
          }}
        >
          {display
            ? display.split("\n").map((line, i) => (
                <div key={i} className="whitespace-pre">
                  {line === "" ? "\u00a0" : line}
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

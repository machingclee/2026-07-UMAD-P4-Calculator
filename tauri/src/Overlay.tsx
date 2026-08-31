import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  BG_COLOR,
  DEBUG,
  DRAG_BG,
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
import {
  DEFAULT_LINE_GAP,
  loadLineGapLocal,
  parseLineGap,
} from "./lineGap";
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
  const [lineGap, setLineGap] = useState(DEFAULT_LINE_GAP);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const shadow = useMemo(strokeShadow, []);

  const display = DEBUG && pos
    ? text
      ? `${text}\n\nOVL_X=${pos.x} OVL_Y=${pos.y}`
      : `OVL_X=${pos.x} OVL_Y=${pos.y}`
    : text;

  useEffect(() => {
    if (isTauri()) {
      const unlisten = listen<string>("overlay-text", (event) => {
        setText(event.payload ?? "");
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
    getCurrentWindow()
      .setIgnoreCursorEvents(!dragEnabled)
      .catch(() => {});
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
            dragEnabled
              ? "min-h-[1.4em] min-w-[4em] cursor-move rounded px-3.5 py-2.5"
              : ""
          }`}
          {...(dragEnabled ? { "data-tauri-drag-region": true } : {})}
          style={{
            fontFamily: OVERLAY_FONT_FAMILY,
            fontSize: `${OVERLAY_FONT_SIZE_PT}pt`,
            fontWeight: OVERLAY_FONT_WEIGHT,
            color: FILL_COLOR,
            textShadow: shadow,
            background: dragEnabled ? DRAG_BG : undefined,
            padding: dragEnabled ? undefined : strokePad,
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

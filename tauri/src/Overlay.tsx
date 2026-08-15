import { useEffect, useMemo, useState } from "react";
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
  OVERLAY_HEIGHT,
  OVERLAY_WIDTH,
  STROKE_COLOR,
  STROKE_RADIUS,
  STROKE_STEP_DEG,
  TEXT_X,
  TEXT_Y,
} from "./constants";
import { OVERLAY_DRAG_EVENT, OVERLAY_TEXT_EVENT, isTauri } from "./env";
import { applyNativeWindowSize } from "./windowSize";

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
  const [text, setText] = useState("");
  const [dragEnabled, setDragEnabled] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const shadow = useMemo(strokeShadow, []);

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

  useEffect(() => {
    void applyNativeWindowSize();
  }, [OVERLAY_WIDTH, OVERLAY_HEIGHT]);

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

  const display = DEBUG && pos
    ? text
      ? `${text}\n\nOVL_X=${pos.x} OVL_Y=${pos.y}`
      : `OVL_X=${pos.x} OVL_Y=${pos.y}`
    : text;

  return (
    <div
      className="relative m-0 h-full w-full cursor-default overflow-hidden select-none"
      style={{ background: BG_COLOR }}
    >
      {display || dragEnabled ? (
        <div
          className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-pre text-left leading-[1.35] ${
            dragEnabled
              ? "box-border min-h-[1.4em] min-w-[4em] cursor-move rounded px-3.5 py-2.5"
              : ""
          }`}
          {...(dragEnabled ? { "data-tauri-drag-region": true } : {})}
          style={{
            left: TEXT_X,
            top: TEXT_Y,
            fontFamily: OVERLAY_FONT_FAMILY,
            fontSize: `${OVERLAY_FONT_SIZE_PT}pt`,
            fontWeight: OVERLAY_FONT_WEIGHT,
            color: FILL_COLOR,
            textShadow: shadow,
            background: dragEnabled ? DRAG_BG : undefined,
          }}
        >
          {display}
        </div>
      ) : null}
    </div>
  );
}

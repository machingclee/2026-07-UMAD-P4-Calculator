import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import speedIcon from "./assets/speed.webp";
import lightIcon from "./assets/light.webp";
import waterIcon from "./assets/water.webp";
import {
  BG_COLOR,
  DEBUG,
  DRAG_BG,
  ICON_OVERLAY_DIM_OPACITY,
  ICON_OVERLAY_GAP,
  ICON_OVERLAY_SIZE,
} from "./constants";
import {
  APP_EXPANDED_EVENT,
  DEBUFF_OVERLAY_EVENT,
  DEBUFF_OVERLAY_STATE_EVENT,
  OVERLAY_DRAG_EVENT,
  isTauri,
} from "./env";
import { parseDebuffOverlay } from "./debuffOverlay";
import {
  EMPTY_DEBUFF_ICON_STATE,
  type DebuffIconState,
} from "./state";
import { fitOverlayToElement } from "./windowSize";

function parseDebuffIconState(value: unknown): DebuffIconState {
  if (!value || typeof value !== "object") return EMPTY_DEBUFF_ICON_STATE;
  const v = value as Partial<DebuffIconState>;
  return {
    speed: Boolean(v.speed),
    water: Boolean(v.water),
    thunder: Boolean(v.thunder),
    dimAll: Boolean(v.dimAll),
  };
}

export default function IconOverlay() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragEnabled, setDragEnabled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [icons, setIcons] = useState<DebuffIconState>(EMPTY_DEBUFF_ICON_STATE);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

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
      const unlisten = listen<DebuffIconState>("debuff-overlay-state", (event) => {
        setIcons(parseDebuffIconState(event.payload));
      });
      return () => {
        unlisten.then((fn) => fn()).catch(() => {});
      };
    }
    const onState = (event: Event) => {
      setIcons(parseDebuffIconState((event as CustomEvent<DebuffIconState>).detail));
    };
    window.addEventListener(DEBUFF_OVERLAY_STATE_EVENT, onState);
    return () => window.removeEventListener(DEBUFF_OVERLAY_STATE_EVENT, onState);
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
    const apply = () => {
      void fitOverlayToElement(el);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, enabled, dragEnabled]);

  useEffect(() => {
    if (!isTauri()) return;
    getCurrentWindow()
      .setIgnoreCursorEvents(!dragEnabled)
      .catch(() => { });
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
        <div
          className={`box-border flex items-center ${dragEnabled
            ? "min-h-[1.4em] cursor-move rounded px-3.5 py-2.5"
            : ""
            }`}
          {...(dragEnabled ? { "data-tauri-drag-region": true } : {})}
          style={{
            background: dragEnabled ? DRAG_BG : undefined,
            padding: dragEnabled ? undefined : 2,
            gap: ICON_OVERLAY_GAP,
          }}
        >


          <IconWithText
            text="速度"
            icon={speedIcon}
            dimmed={icons.dimAll || icons.speed}
          />
          <IconWithText
            text={""}
            icon={waterIcon}
            dimmed={icons.dimAll || icons.water}
          />
          <IconWithText
            text="雷"
            icon={lightIcon}
            dimmed={icons.dimAll || icons.thunder}
          />

          {DEBUG && pos ? (
            <div className="pointer-events-none whitespace-nowrap text-[11px] text-white">
              OVL_X={pos.x} OVL_Y={pos.y}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


const IconWithText = (props: {
  text: string,
  icon: string,
  dimmed?: boolean,
}) => {
  return (
    <div
      className="relative pt-2"
      style={{ opacity: props.dimmed ? ICON_OVERLAY_DIM_OPACITY : 1 }}
    >
      <div
        className="font-bold"
        style={{
          fontSize: 18,
          position: "absolute",
          left: "50%",
          top: -6,
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          color: "#ffffff",
          WebkitTextStroke: "1px #000000",
          paintOrder: "stroke fill",
          textShadow:
            "-1px -1px 0 #000000, 1px -1px 0 #000000, -1px 1px 0 #000000, 1px 1px 0 #000000",
        }}
      >
        {props.text}
      </div>
      <img
        src={props.icon}
        alt=""
        className="pointer-events-none object-contain"
        style={{ width: ICON_OVERLAY_SIZE, height: ICON_OVERLAY_SIZE }}
        draggable={false}
      />
    </div>
  )
}
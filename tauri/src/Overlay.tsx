import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { OVERLAY_TEXT_EVENT, isTauri } from "./env";
import "./Overlay.css";

function strokeShadow(): string {
  const parts: string[] = [];
  const r = 2;
  for (let angle = 0; angle < 360; angle += 22) {
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * r;
    const dy = Math.sin(rad) * r;
    parts.push(`${dx.toFixed(2)}px ${dy.toFixed(2)}px 0 #0044cc`);
  }
  return parts.join(", ");
}

export default function Overlay() {
  const [text, setText] = useState("");
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
    if (!isTauri()) return;
    const block = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, []);

  return (
    <div className="overlay" data-tauri-drag-region>
      {text ? (
        <div
          className="overlay-text"
          data-tauri-drag-region
          style={{ textShadow: shadow }}
        >
          {text}
        </div>
      ) : null}
    </div>
  );
}

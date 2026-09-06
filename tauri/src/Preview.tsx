import { useState } from "react";
import App from "./App";
import Overlay from "./Overlay";
import StepsOverlay from "./StepsOverlay";
import { APP_HEIGHT, APP_WIDTH } from "./constants";
import { publishAppExpanded } from "./env";

export default function Preview() {
  const [expanded, setExpanded] = useState(true);
  const setPreviewExpanded = (next: boolean) => {
    setExpanded(next);
    publishAppExpanded(next);
  };

  return (
    <div className="flex flex-wrap items-start gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs leading-tight text-[#bbb]">Main</div>
        <div
          className="overflow-hidden bg-[var(--app-bg)] text-black shadow-[0_8px_24px_rgba(0,0,0,0.4)] dark:text-[#e8e8e8]"
          style={{ width: APP_WIDTH, height: APP_HEIGHT }}
        >
          <App />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs leading-tight text-[#bbb]">Overlay (hugs content)</div>
        <div
          className="w-fit min-h-[2rem] min-w-[8rem] overflow-hidden bg-[#2b2b2b] shadow-[0_8px_24px_rgba(0,0,0,0.4)] [background-image:linear-gradient(45deg,#3a3a3a_25%,transparent_25%),linear-gradient(-45deg,#3a3a3a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#3a3a3a_75%),linear-gradient(-45deg,transparent_75%,#3a3a3a_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0] [background-size:16px_16px]"
        >
          <Overlay />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs leading-tight text-[#bbb]">Steps overlay (expanded only)</div>
        <div className="flex gap-1 text-[11px]">
          <button
            type="button"
            className={`rounded-sm border px-2 py-0.5 ${
              expanded
                ? "border-[#8ec8ff] bg-[#1b3d55] text-white"
                : "border-[#555] bg-[#3a3a3a] text-[#ddd]"
            }`}
            onClick={() => setPreviewExpanded(true)}
          >
            展開
          </button>
          <button
            type="button"
            className={`rounded-sm border px-2 py-0.5 ${
              !expanded
                ? "border-[#8ec8ff] bg-[#1b3d55] text-white"
                : "border-[#555] bg-[#3a3a3a] text-[#ddd]"
            }`}
            onClick={() => setPreviewExpanded(false)}
          >
            收合
          </button>
        </div>
        <div
          className="w-fit min-h-[2rem] overflow-hidden bg-[#2b2b2b] shadow-[0_8px_24px_rgba(0,0,0,0.4)] [background-image:linear-gradient(45deg,#3a3a3a_25%,transparent_25%),linear-gradient(-45deg,#3a3a3a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#3a3a3a_75%),linear-gradient(-45deg,transparent_75%,#3a3a3a_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0] [background-size:16px_16px]"
        >
          <StepsOverlay />
        </div>
      </div>
      <p className="max-w-[860px] basis-full text-xs leading-normal text-[#999]">
        Browser preview via <code className="text-[#eee]">npm run dev:web</code>.
        Native always-on-top windows: <code className="text-[#eee]">npm run dev</code>{" "}
        (needs Windows for the Win32 overlay / single-instance behaviour).
      </p>
    </div>
  );
}

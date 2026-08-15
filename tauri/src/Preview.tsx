import App from "./App";
import Overlay from "./Overlay";
import { OVERLAY_HEIGHT, OVERLAY_WIDTH } from "./constants";

export default function Preview() {
  return (
    <div className="flex flex-wrap items-start gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs leading-tight text-[#bbb]">Main</div>
        <div className="h-[220px] w-[420px] overflow-hidden bg-[var(--app-bg)] text-black shadow-[0_8px_24px_rgba(0,0,0,0.4)] dark:text-[#e8e8e8]">
          <App />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xs leading-tight text-[#bbb]">
          Overlay — {OVERLAY_WIDTH}×{OVERLAY_HEIGHT}
        </div>
        <div
          className="overflow-hidden bg-[#2b2b2b] shadow-[0_8px_24px_rgba(0,0,0,0.4)] [background-image:linear-gradient(45deg,#3a3a3a_25%,transparent_25%),linear-gradient(-45deg,#3a3a3a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#3a3a3a_75%),linear-gradient(-45deg,transparent_75%,#3a3a3a_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0] [background-size:16px_16px]"
          style={{ width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT }}
        >
          <Overlay />
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

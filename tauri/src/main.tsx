import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import Overlay from "./Overlay";
import StepsOverlay from "./StepsOverlay";
import Preview from "./Preview";
import { TauriClickToComponent } from "./components/TauriClickToComponent";
import { applyCssVars } from "./constants";
import { isTauri } from "./env";
import { applyNativeWindowSize } from "./windowSize";
import "overlayscrollbars/overlayscrollbars.css";
import "./index.css";

applyCssVars();
void applyNativeWindowSize();
document.documentElement.classList.add("h-full");
document.body.classList.add("m-0", "h-full", "overflow-hidden");
document.getElementById("root")?.classList.add("h-full");

let page: React.ReactNode;
if (isTauri()) {
  const label = getCurrentWindow().label;
  const overlay = label === "overlay" || label === "overlay-icons";
  if (overlay) {
    document.documentElement.classList.add("bg-transparent");
    document.body.classList.add("bg-transparent");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }
  page =
    label === "overlay" ? (
      <Overlay />
    ) : label === "overlay-icons" ? (
      <StepsOverlay />
    ) : (
      <App />
    );
} else {
  document.body.classList.add(
    "min-h-full",
    "h-auto",
    "overflow-auto",
    "bg-[#2b2b2b]",
    "text-[#ddd]",
  );
  page = <Preview />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {page}
    {import.meta.env.DEV && <TauriClickToComponent />}
  </React.StrictMode>,
);

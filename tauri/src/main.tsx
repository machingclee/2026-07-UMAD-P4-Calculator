import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import Overlay from "./Overlay";
import Preview from "./Preview";
import { isTauri } from "./env";

document.body.classList.remove("preview", "overlay-mode");

let page: React.ReactNode;
if (isTauri()) {
  const overlay = getCurrentWindow().label === "overlay";
  if (overlay) document.body.classList.add("overlay-mode");
  page = overlay ? <Overlay /> : <App />;
} else {
  document.body.classList.add("preview");
  page = <Preview />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{page}</React.StrictMode>,
);

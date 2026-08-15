import App from "./App";
import Overlay from "./Overlay";
import "./Preview.css";

export default function Preview() {
  return (
    <div className="preview">
      <div className="preview-pane">
        <div className="preview-label">Main — 420×220</div>
        <div className="preview-main">
          <App />
        </div>
      </div>
      <div className="preview-pane">
        <div className="preview-label">Overlay — 400×320</div>
        <div className="preview-overlay">
          <Overlay />
        </div>
      </div>
      <p className="preview-note">
        Browser preview via <code>npm run dev</code> / <code>yarn dev</code>.
        Native always-on-top windows: <code>npm run tauri dev</code> (needs
        Windows for the Win32 overlay / single-instance behaviour).
      </p>
    </div>
  );
}

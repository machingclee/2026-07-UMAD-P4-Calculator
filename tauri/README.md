# FF14 P4 Calculator (Tauri)

Windows remake of `../main.py`: same calculation, same toggle / cross-exclusion UI, and the same Win32 topmost / single-instance overlay behaviour.

Adjustable knobs (overlay font/position, colors, choice labels) live at the top of `src/constants.ts`. Window size, position, and theme persist after you move or resize in 變更 mode. Overlay default position is in `src-tauri/src/constants.rs`.

## Develop on macOS (browser UI)

`npm run dev:web` / `yarn dev:web` only starts Vite. It now opens a browser preview of the main window and overlay so you can iterate without Tauri:

```bash
cd tauri
npm install
npm run dev:web
```

Then open http://localhost:1420 — you should see both panes side by side.

Native windows (always-on-top, color-key overlay, single-instance):

```bash
npm run dev
```

That path is meant for Windows. On Mac it will launch, but the Win32 pieces are no-ops.

Release build:

```bash
npm run build:exe
```

The installer / exe land under `src-tauri/target/release/`.

In a **release** build, settings are stored per user at:

`%AppData%\com.ff14.p4calculator\config.json`

(`app_x`, `app_y`, `app_width`, `app_height`, `overlay_x`, `overlay_y`, `theme`). Debug builds still write `config.json` next to the exe. If AppData has no file yet, an older next-to-exe config is copied once.

## Notes

- Built for Windows. The Win32 pieces (`CreateMutexW`, `SetWindowPos` topmost, `SetLayeredWindowAttributes` color-key, second-instance restore) compile only on Windows; other hosts get no-ops so the project can still be edited.
- Drag the overlay to reposition it. Closing the main window closes the overlay.

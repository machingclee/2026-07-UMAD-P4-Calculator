# FF14 P4 Calculator (Tauri)

Windows remake of `python/main.py`: same calculation, same toggle / cross-exclusion UI, same `config.json` next to the executable, and the same Win32 topmost / single-instance / color-key overlay behaviour.

## Develop on macOS (browser UI)

`npm run dev` / `yarn dev` only starts Vite. It now opens a browser preview of the main window and overlay so you can iterate without Tauri:

```bash
cd tauri
npm install
npm run dev
```

Then open http://localhost:1420 — you should see both panes side by side.

Native windows (always-on-top, color-key overlay, single-instance) still need:

```bash
npm run tauri dev
```

That path is meant for Windows. On Mac it will launch, but the Win32 pieces are no-ops.

Release build:

```bash
npm run tauri build
```

The installer / exe land under `src-tauri/target/release/`. `config.json` is written next to the running executable (`overlay_x`, `overlay_y`, `app_x`, `app_y`), matching the Python app.

## Notes

- Built for Windows. The Win32 pieces (`CreateMutexW`, `SetWindowPos` topmost, `SetLayeredWindowAttributes` color-key, second-instance restore) compile only on Windows; other hosts get no-ops so the project can still be edited.
- Drag the overlay to reposition it. Closing the main window closes the overlay.

import ctypes
import json
import math
import os
import sys
import tkinter as tk
from tkinter import ttk

# Windows API constants for forcing topmost
_HWND_TOPMOST  = -1
_SWP_NOSIZE    = 0x0001
_SWP_NOMOVE    = 0x0002
_SWP_NOACTIVATE = 0x0010
_SWP_SHOWWINDOW = 0x0040
_WS_EX_TOPMOST  = 0x00000008
_WS_EX_TOOLWINDOW = 0x00000080
_WS_EX_NOACTIVATE = 0x08000000
_GWL_EXSTYLE    = -20


def _win32_topmost(widget):
    """Force a tkinter widget's HWND to stay on top via Windows API."""
    hwnd = widget.winfo_id()
    if not hwnd:
        widget.after(200, lambda: _win32_topmost(widget))
        return
    ex_style = _WS_EX_TOPMOST | _WS_EX_TOOLWINDOW | _WS_EX_NOACTIVATE
    ctypes.windll.user32.SetWindowLongW(hwnd, _GWL_EXSTYLE,
        ctypes.windll.user32.GetWindowLongW(hwnd, _GWL_EXSTYLE) | ex_style)
    ctypes.windll.user32.SetWindowPos(
        hwnd, _HWND_TOPMOST, 0, 0, 0, 0,
        _SWP_NOMOVE | _SWP_NOSIZE | _SWP_NOACTIVATE | _SWP_SHOWWINDOW)

# ── Config ────────────────────────────────────────────────────────────────────
DEBUG          = False   # show overlay X/Y in main window title when dragging
APP_WIDTH      = 320
APP_HEIGHT     = 200
OVERLAY_WIDTH  = 400     # overlay window width
OVERLAY_HEIGHT = 320     # overlay window height
OVERLAY_X      = 865     # initial screen X position
OVERLAY_Y      = 345     # initial screen Y position
TEXT_X         = 200     # text X anchor within overlay (center) — default
TEXT_Y         = 160     # text Y anchor within overlay (center) — default
OVERLAY_FONT   = ("Microsoft YaHei", 18, "bold")
STROKE_COLOR   = "#0044cc"   # deep blue outline
FILL_COLOR     = "#ffffff"   # white text
BG_COLOR       = "#000000"   # transparent key color
FONT           = ("", 11)
FONT_BOLD      = ("", 11, "bold")
FONT_TITLE    = ("", 9)

if getattr(sys, "frozen", False):
    _APP_DIR = os.path.dirname(sys.executable)
else:
    _APP_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(_APP_DIR, "config.json")

def _load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def _save_config(cfg: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

# ── Choices ───────────────────────────────────────────────────────────────────
TRUE_FALSE = ["真", "假"]
SPEED     = ["1 加速", "2 加速"]
WATER     = ["1 水",   "2 水"]
THUNDER   = ["1 雷",   "2 雷"]
ICE       = ["1 冰",   "2 冰"]

# ── Toggle helper for button-style radiobuttons ──────────────────────────────
_toggle_state = {}

def _make_toggle(var: tk.StringVar):
    def toggle():
        cur = var.get()
        vid = id(var)
        if _toggle_state.get(vid) == cur:
            var.set("")
            _toggle_state[vid] = ""
        else:
            _toggle_state[vid] = cur
    return toggle


# ── Calculation ───────────────────────────────────────────────────────────────
def _actions(selections: dict, prefix: str) -> list[str]:
    out = []
    for rnd in ("round1", "round2"):
        tf = selections.get(f"{rnd}_tf", "")
        if not tf:
            continue
        is_true = tf == "真"
        spd = selections.get(f"{rnd}_speed", "")
        wat = selections.get(f"{rnd}_water", "")
        thu = selections.get(f"{rnd}_thunder", "")
        if prefix in spd: out.append("不動" if is_true else "動")
        if prefix in wat: out.append("水分攤" if is_true else "水出去")
        if prefix in thu: out.append("雷出去" if is_true else "雷分攤")
    return out


def calculate(state: dict) -> str:
    lines = []
    for rnd, prefix in (("round1", "1"), ("round2", "2")):
        tf = state.get(f"{rnd}_tf", "")
        eye = "背對眼" if tf == "真" else "面對眼" if tf else ""
        actions = _actions(state, prefix)
        if not tf and not actions:
            continue
        if lines:
            lines.append("")
        label = "R1" if rnd == "round1" else "R2"
        action_text = f"{'  '.join(actions)}" if actions else ""
        lines.append(f"{label} {action_text}".strip())
        if eye:
            lines.append(f"  {eye}")
        if rnd == "round1":
            f_val = state.get("fire", "")
            if f_val:
                lines.append(f"  {'放鋼鐵' if f_val == '真' else '放月環'}")
        else:
            w_val = state.get("water", "")
            if w_val:
                lines.append(f"  {'放月環' if w_val == '真' else '放鋼鐵'}")
    return "\n".join(lines) if lines else ""


# ── Floating overlay ─────────────────────────────────────────────────────────
class Overlay:
    def __init__(self, root: tk.Tk, ovl_x: int = OVERLAY_X, ovl_y: int = OVERLAY_Y):
        self._root = root
        self._ovl_x = ovl_x
        self._ovl_y = ovl_y
        self._on_pos_changed = None  # callback(ovl_x, ovl_y)
        self.win = tk.Toplevel()
        self.win.overrideredirect(True)
        self.win.attributes("-topmost", True)
        self.win.attributes("-transparentcolor", BG_COLOR)
        self.win.geometry(f"{OVERLAY_WIDTH}x{OVERLAY_HEIGHT}+{self._ovl_x}+{self._ovl_y}")

        self.canvas = tk.Canvas(self.win, bg=BG_COLOR, highlightthickness=0,
                                borderwidth=0, width=OVERLAY_WIDTH, height=OVERLAY_HEIGHT)
        self.canvas.pack()

        self._last_text = ""
        self._drag_x = 0
        self._drag_y = 0
        self.canvas.bind("<ButtonPress-1>", self._drag_start)
        self.canvas.bind("<B1-Motion>", self._drag_move)
        self.canvas.bind("<ButtonRelease-1>", self._drag_end)

        self.win.after(100, self._force_topmost)  # apply after window is realized

    def _force_topmost(self):
        """Use Windows API to force the overlay window to stay on top,
        even over borderless-fullscreen games."""
        _win32_topmost(self.win)

    def set_text(self, text: str):
        self._last_text = text
        self.canvas.delete("all")
        display = text
        if DEBUG:
            x = self.win.winfo_x()
            y = self.win.winfo_y()
            display = f"{text}\n\nOVL_X={x} OVL_Y={y}" if text else f"OVL_X={x} OVL_Y={y}"
        if not display:
            return
        # draw blue stroke by rendering text offset in a circle (16 samples, radius 2)
        STROKE_R = 2
        for angle in range(0, 360, 22):
            rad = math.radians(angle)
            dx = math.cos(rad) * STROKE_R
            dy = math.sin(rad) * STROKE_R
            self.canvas.create_text(TEXT_X + dx, TEXT_Y + dy, text=display,
                                     font=OVERLAY_FONT, fill=STROKE_COLOR,
                                     anchor=tk.CENTER, justify=tk.LEFT)
        # draw white fill on top
        self.canvas.create_text(TEXT_X, TEXT_Y, text=display,
                                 font=OVERLAY_FONT, fill=FILL_COLOR,
                                 anchor=tk.CENTER, justify=tk.LEFT)

    def _drag_start(self, event):
        self._drag_x = event.x
        self._drag_y = event.y

    def _drag_move(self, event):
        x = self.win.winfo_x() + event.x - self._drag_x
        y = self.win.winfo_y() + event.y - self._drag_y
        self._ovl_x = x
        self._ovl_y = y
        self.win.geometry(f"+{x}+{y}")
        if self._on_pos_changed:
            self._on_pos_changed(x, y)
        if DEBUG:
            self._root.title(f"OVERLAY_X={x}  OVERLAY_Y={y}")

    def _drag_end(self, _event):
        cfg = _load_config()
        cfg["overlay_x"] = self._ovl_x
        cfg["overlay_y"] = self._ovl_y
        _save_config(cfg)
        if self._on_pos_changed:
            self._on_pos_changed(self._ovl_x, self._ovl_y)


# ── Widget builders ───────────────────────────────────────────────────────────
def radio_group(parent, label: str, choices: list[str]) -> tk.StringVar:
    var = tk.StringVar(value="")
    group = tk.Frame(parent, padx=0, pady=0)
    group.pack(fill=tk.X, pady=(0, 4))
    tk.Label(group, text=label, font=FONT).pack(side=tk.LEFT, padx=(0, 6))
    cmd = _make_toggle(var)
    for choice in choices:
        tk.Radiobutton(group, text=choice, value=choice, variable=var,
                       indicatoron=False, padx=6, pady=2,
                       font=FONT, cursor="hand2", command=cmd).pack(side=tk.LEFT, padx=2)
    return var


def radio_group_v(parent, choices: list[str]) -> tk.StringVar:
    var = tk.StringVar(value="")
    group = tk.Frame(parent, padx=2, pady=0, borderwidth=0)
    group.pack(side=tk.LEFT, padx=1)
    cmd = _make_toggle(var)
    for choice in choices:
        tk.Radiobutton(group, text=choice, value=choice, variable=var,
                       indicatoron=False, padx=6, pady=2,
                       font=FONT, cursor="hand2", command=cmd).pack(side=tk.TOP, pady=0)
    return var


# ── UI ────────────────────────────────────────────────────────────────────────
def build_ui(root: tk.Tk, overlay: Overlay) -> dict:
    columns = ttk.Frame(root, padding=8)
    columns.pack(fill=tk.BOTH, expand=True)

    left_col = ttk.Frame(columns, padding=4)
    left_col.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    right_col = ttk.Frame(columns, padding=4)
    right_col.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    fire    = radio_group(left_col, "火", TRUE_FALSE)
    water   = radio_group(left_col, "水", TRUE_FALSE)
    ttk.Separator(left_col, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=(4, 4))
    thunder = radio_group(left_col, "雷", ["假"])
    ice     = radio_group(left_col, "冰", ["假"])

    def round_block(parent, title: str) -> dict:
        frame = tk.Frame(parent, padx=0, pady=0)
        frame.pack(fill=tk.X, pady=(0, 8))

        title_row = tk.Frame(frame)
        title_row.pack(fill=tk.X)
        tk.Label(title_row, text=title, font=FONT_TITLE).pack(side=tk.LEFT, padx=(0, 6))

        tf_var = tk.StringVar(value="")
        tf_cmd = _make_toggle(tf_var)
        for choice in TRUE_FALSE:
            ttk.Radiobutton(title_row, text=choice, value=choice, variable=tf_var,
                            cursor="hand2", command=tf_cmd).pack(side=tk.LEFT, padx=2)
        tk.Frame(frame, height=4).pack(fill=tk.X)

        row = tk.Frame(frame)
        row.pack(fill=tk.X)
        return {
            "tf":      tf_var,
            "speed":   radio_group_v(row, SPEED),
            "water":   radio_group_v(row, WATER),
            "thunder": radio_group_v(row, THUNDER),
        }

    r1 = round_block(right_col, "第一輪大十字")
    r2 = round_block(right_col, "第二輪大十字")

    all_vars = {"fire": fire, "water": water, "thunder": thunder, "ice": ice}
    for rnd, r in (("round1", r1), ("round2", r2)):
        for k, v in r.items():
            all_vars[f"{rnd}_{k}"] = v

    def on_change(*_):
        state = {n: v.get() for n, v in all_vars.items()}
        overlay.set_text(calculate(state))

    def clear_all():
        for var in all_vars.values():
            var.set("")
        _toggle_state.clear()

    clear_btn = tk.Button(left_col, text="清除", font=FONT, cursor="hand2",
                          command=clear_all)
    clear_btn.pack(side=tk.BOTTOM, anchor=tk.W, pady=(12, 0))

    for var in all_vars.values():
        var.trace_add("write", on_change)
    on_change()

    return all_vars


def main():
    cfg = _load_config()
    ovl_x = cfg.get("overlay_x", OVERLAY_X)
    ovl_y = cfg.get("overlay_y", OVERLAY_Y)

    root = tk.Tk()
    root.title("FF14 P4 Calculator")

    # center main app on screen
    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()
    app_x = (sw - APP_WIDTH) // 2
    app_y = (sh - APP_HEIGHT) // 2

    root.geometry(f"{APP_WIDTH}x{APP_HEIGHT}+{app_x}+{app_y}")
    root.resizable(True, True)
    root.attributes("-topmost", True)
    root.after(100, lambda: _win32_topmost(root))

    overlay = Overlay(root, ovl_x=ovl_x, ovl_y=ovl_y)
    build_ui(root, overlay)
    root.mainloop()


if __name__ == "__main__":
    main()

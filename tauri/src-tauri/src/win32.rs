//! Windows API helpers matching python/main.py (`ctypes.windll`).
//! Compiles to no-ops on non-Windows so the project can be edited on macOS.

#![allow(non_snake_case)]

#[cfg(windows)]
mod imp {
    use std::collections::HashMap;
    use std::ffi::c_void;
    use std::mem::size_of;
    use std::sync::atomic::{
        AtomicBool, AtomicI32, AtomicIsize, AtomicPtr, AtomicU64, Ordering,
    };
    use std::sync::Mutex;
    use std::thread;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tauri::WebviewWindow;

    type HWND = *mut c_void;
    type HANDLE = *mut c_void;
    type HDC = *mut c_void;
    type HGDIOBJ = *mut c_void;

    const HWND_TOPMOST: HWND = -1isize as HWND;
    const SWP_NOSIZE: u32 = 0x0001;
    const SWP_NOMOVE: u32 = 0x0002;
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_FRAMECHANGED: u32 = 0x0020;
    const SWP_SHOWWINDOW: u32 = 0x0040;
    const WS_SYSMENU: i32 = 0x0008_0000;
    const WS_MINIMIZEBOX: i32 = 0x0002_0000;
    const WS_MAXIMIZEBOX: i32 = 0x0001_0000;
    const WS_CAPTION_BUTTONS: i32 = WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX;
    const WS_EX_TOPMOST: i32 = 0x0000_0008;
    const WS_EX_TOOLWINDOW: i32 = 0x0000_0080;
    const WS_EX_NOACTIVATE: i32 = 0x0800_0000;
    const GWL_STYLE: i32 = -16;
    const GWL_EXSTYLE: i32 = -20;
    const GWLP_WNDPROC: i32 = -4;
    const WM_CREATE: u32 = 0x0001;
    const WM_GETMINMAXINFO: u32 = 0x0024;
    const WM_NCHITTEST: u32 = 0x0084;
    const WM_MOUSEACTIVATE: u32 = 0x0021;
    const WM_MOUSEMOVE: u32 = 0x0200;
    const WM_LBUTTONUP: u32 = 0x0202;
    const WM_CAPTURECHANGED: u32 = 0x0215;
    const WM_NCLBUTTONDOWN: u32 = 0x00A1;
    const WM_NCLBUTTONDBLCLK: u32 = 0x00A3;
    const WM_GETICON: u32 = 0x007F;
    const WM_SETICON: u32 = 0x0080;
    const WM_SYSCOMMAND: u32 = 0x0112;
    const WM_PARENTNOTIFY: u32 = 0x0210;
    const MA_NOACTIVATE: isize = 3;
    const MK_LBUTTON: usize = 0x0001;
    const ICON_SMALL: usize = 0;
    const ICON_BIG: usize = 1;
    const HTCAPTION: usize = 2;
    const HTSYSMENU: usize = 3;
    const HTMINBUTTON: usize = 8;
    const SC_CLOSE: u32 = 0xF060;
    const SC_MINIMIZE: u32 = 0xF020;
    const SC_RESTORE: u32 = 0xF120;
    const SPI_GETNONCLIENTMETRICS: u32 = 0x0029;
    const SM_CXDRAG: i32 = 68;
    const SM_CYDRAG: i32 = 69;
    const LF_FACESIZE: usize = 32;
    const SW_RESTORE: i32 = 9;
    const ERROR_ALREADY_EXISTS: u32 = 183;
    const VK_MENU: u8 = 0x12;
    const KEYEVENTF_KEYUP: u32 = 2;
    const MUTEX_NAME: &str = "FF14-P4-Calculator-single-instance";
    const MAIN_TITLE: &str = "FF14 P4 Calculator";

    static MUTEX_HANDLE: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
    /// Previous WndProcs for HWNDs subclassed to return `MA_NOACTIVATE`.
    static OLD_WNDPROCS: Mutex<Option<HashMap<isize, isize>>> = Mutex::new(None);
    static MAIN_HWND: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
    static TITLEBAR_SHADED: AtomicBool = AtomicBool::new(false);
    static SHADE_FROM_BOTTOM: AtomicBool = AtomicBool::new(true);
    static INPUT_ENABLED: AtomicBool = AtomicBool::new(false);
    static RESTORED_CX: AtomicI32 = AtomicI32::new(0);
    static RESTORED_CY: AtomicI32 = AtomicI32::new(0);
    static SAVED_STYLE: AtomicI32 = AtomicI32::new(0);
    static SAVED_ICON_BIG: AtomicIsize = AtomicIsize::new(0);
    static SAVED_ICON_SMALL: AtomicIsize = AtomicIsize::new(0);
    static LAST_SHADE_TOGGLE_MS: AtomicU64 = AtomicU64::new(0);
    static SHADE_CAPTURING: AtomicBool = AtomicBool::new(false);
    static SHADE_PRESS_X: AtomicI32 = AtomicI32::new(0);
    static SHADE_PRESS_Y: AtomicI32 = AtomicI32::new(0);

    #[repr(C)]
    struct RECT {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    struct POINT {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    struct MINMAXINFO {
        ptReserved: POINT,
        ptMaxSize: POINT,
        ptMaxPosition: POINT,
        ptMinTrackSize: POINT,
        ptMaxTrackSize: POINT,
    }

    #[repr(C)]
    struct SIZE {
        cx: i32,
        cy: i32,
    }

    #[repr(C)]
    struct LOGFONTW {
        lfHeight: i32,
        lfWidth: i32,
        lfEscapement: i32,
        lfOrientation: i32,
        lfWeight: i32,
        lfItalic: u8,
        lfUnderline: u8,
        lfStrikeOut: u8,
        lfCharSet: u8,
        lfOutPrecision: u8,
        lfClipPrecision: u8,
        lfQuality: u8,
        lfPitchAndFamily: u8,
        lfFaceName: [u16; LF_FACESIZE],
    }

    #[repr(C)]
    struct NONCLIENTMETRICSW {
        cbSize: u32,
        iBorderWidth: i32,
        iScrollWidth: i32,
        iScrollHeight: i32,
        iCaptionWidth: i32,
        iCaptionHeight: i32,
        lfCaptionFont: LOGFONTW,
        iSmCaptionWidth: i32,
        iSmCaptionHeight: i32,
        lfSmCaptionFont: LOGFONTW,
        iMenuWidth: i32,
        iMenuHeight: i32,
        lfMenuFont: LOGFONTW,
        lfStatusFont: LOGFONTW,
        lfMessageFont: LOGFONTW,
        iPaddedBorderWidth: i32,
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn FindWindowW(lpClassName: *const u16, lpWindowName: *const u16) -> HWND;
        fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> i32;
        fn GetWindowLongW(hWnd: HWND, nIndex: i32) -> i32;
        fn SetWindowLongW(hWnd: HWND, nIndex: i32, dwNewLong: i32) -> i32;
        fn GetWindowLongPtrW(hWnd: HWND, nIndex: i32) -> isize;
        fn SetWindowLongPtrW(hWnd: HWND, nIndex: i32, dwNewLong: isize) -> isize;
        fn CallWindowProcW(
            lpPrevWndFunc: *const c_void,
            hWnd: HWND,
            Msg: u32,
            wParam: usize,
            lParam: isize,
        ) -> isize;
        fn DefWindowProcW(hWnd: HWND, Msg: u32, wParam: usize, lParam: isize) -> isize;
        fn EnumChildWindows(
            hWndParent: HWND,
            lpEnumFunc: Option<unsafe extern "system" fn(HWND, isize) -> i32>,
            lParam: isize,
        ) -> i32;
        fn SetForegroundWindow(hWnd: HWND) -> i32;
        fn SetWindowPos(
            hWnd: HWND,
            hWndInsertAfter: HWND,
            X: i32,
            Y: i32,
            cx: i32,
            cy: i32,
            uFlags: u32,
        ) -> i32;
        fn GetWindowRect(hWnd: HWND, lpRect: *mut RECT) -> i32;
        fn GetClientRect(hWnd: HWND, lpRect: *mut RECT) -> i32;
        fn IsIconic(hWnd: HWND) -> i32;
        fn GetWindowTextW(hWnd: HWND, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn GetDC(hWnd: HWND) -> HDC;
        fn ReleaseDC(hWnd: HWND, hDC: HDC) -> i32;
        fn SendMessageW(hWnd: HWND, Msg: u32, wParam: usize, lParam: isize) -> isize;
        fn SetCapture(hWnd: HWND) -> HWND;
        fn ReleaseCapture() -> i32;
        fn GetCursorPos(lpPoint: *mut POINT) -> i32;
        fn ClientToScreen(hWnd: HWND, lpPoint: *mut POINT) -> i32;
        fn GetSystemMetrics(nIndex: i32) -> i32;
        fn SystemParametersInfoW(
            uiAction: u32,
            uiParam: u32,
            pvParam: *mut c_void,
            fWinIni: u32,
        ) -> i32;
        fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
    }

    #[link(name = "gdi32")]
    unsafe extern "system" {
        fn CreateFontIndirectW(lplf: *const LOGFONTW) -> HGDIOBJ;
        fn SelectObject(hdc: HDC, h: HGDIOBJ) -> HGDIOBJ;
        fn DeleteObject(h: HGDIOBJ) -> i32;
        fn GetTextExtentPoint32W(
            hdc: HDC,
            lpString: *const u16,
            c: i32,
            psizl: *mut SIZE,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn CreateMutexW(
            lpMutexAttributes: *const c_void,
            bInitialOwner: i32,
            lpName: *const u16,
        ) -> HANDLE;
        fn GetLastError() -> u32;
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn hwnd_of(window: &WebviewWindow) -> Option<HWND> {
        window.hwnd().ok().map(|h| h.0 as HWND)
    }

    fn is_main_hwnd(hwnd: HWND) -> bool {
        let stored = MAIN_HWND.load(Ordering::SeqCst);
        !hwnd.is_null() && !stored.is_null() && hwnd == stored
    }

    fn window_rect(hwnd: HWND) -> Option<RECT> {
        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if unsafe { GetWindowRect(hwnd, &mut rect) } == 0 {
            None
        } else {
            Some(rect)
        }
    }

    fn titlebar_only_height(hwnd: HWND) -> i32 {
        let Some(window) = window_rect(hwnd) else {
            return 0;
        };
        let mut client = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if unsafe { GetClientRect(hwnd, &mut client) } == 0 {
            return 0;
        }
        let h = (window.bottom - window.top) - (client.bottom - client.top);
        if h > 0 { h } else { 32 }
    }

    fn horiz_border_width(hwnd: HWND) -> i32 {
        let Some(window) = window_rect(hwnd) else {
            return 0;
        };
        let mut client = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if unsafe { GetClientRect(hwnd, &mut client) } == 0 {
            return 0;
        }
        (window.right - window.left) - (client.right - client.left)
    }

    fn looks_shaded(hwnd: HWND) -> bool {
        if TITLEBAR_SHADED.load(Ordering::SeqCst) {
            return true;
        }
        let Some(rect) = window_rect(hwnd) else {
            return false;
        };
        let height = rect.bottom - rect.top;
        let shade_h = titlebar_only_height(hwnd);
        shade_h > 0 && height <= shade_h + 8
    }

    fn lparam_point(lparam: isize) -> POINT {
        POINT {
            x: (lparam as u32 as u16 as i16) as i32,
            y: ((lparam as u32 >> 16) as u16 as i16) as i32,
        }
    }

    fn pack_lparam(x: i32, y: i32) -> isize {
        ((y as u16 as u32) << 16 | (x as u16 as u32)) as isize
    }

    fn caption_font() -> Option<LOGFONTW> {
        let mut ncm: NONCLIENTMETRICSW = unsafe { std::mem::zeroed() };
        ncm.cbSize = size_of::<NONCLIENTMETRICSW>() as u32;
        let ok = unsafe {
            SystemParametersInfoW(
                SPI_GETNONCLIENTMETRICS,
                ncm.cbSize,
                &mut ncm as *mut NONCLIENTMETRICSW as *mut c_void,
                0,
            )
        };
        if ok != 0 {
            Some(ncm.lfCaptionFont)
        } else {
            None
        }
    }

    fn measure_title_width(hwnd: HWND) -> i32 {
        let mut buf = [0u16; 256];
        let len = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        let fallback = wide(MAIN_TITLE);
        let (text, count) = if len > 0 {
            (buf.as_ptr(), len)
        } else {
            let n = fallback.len().saturating_sub(1) as i32;
            (fallback.as_ptr(), n)
        };
        if count <= 0 {
            return 120;
        }
        unsafe {
            let hdc = GetDC(hwnd);
            if hdc.is_null() {
                return (count * 8).max(80);
            }
            let font = caption_font()
                .map(|lf| CreateFontIndirectW(&lf))
                .unwrap_or(std::ptr::null_mut());
            let old = if font.is_null() {
                std::ptr::null_mut()
            } else {
                SelectObject(hdc, font)
            };
            let mut size = SIZE { cx: 0, cy: 0 };
            let _ = GetTextExtentPoint32W(hdc, text, count, &mut size);
            if !old.is_null() {
                SelectObject(hdc, old);
            }
            if !font.is_null() {
                DeleteObject(font);
            }
            ReleaseDC(hwnd, hdc);
            if size.cx > 0 { size.cx } else { (count * 8).max(80) }
        }
    }

    fn compact_window_width(hwnd: HWND) -> i32 {
        let text = measure_title_width(hwnd);
        let borders = horiz_border_width(hwnd).max(0);
        // Caption text padding once the icon and caption buttons are gone.
        (text + borders + 24).max(80)
    }

    fn frame_changed(hwnd: HWND) {
        unsafe {
            SetWindowPos(
                hwnd,
                std::ptr::null_mut(),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
        }
    }

    fn apply_compact_chrome(hwnd: HWND) {
        unsafe {
            let style = GetWindowLongW(hwnd, GWL_STYLE);
            SAVED_STYLE.store(style, Ordering::SeqCst);
            SetWindowLongW(hwnd, GWL_STYLE, style & !WS_CAPTION_BUTTONS);
            let big = SendMessageW(hwnd, WM_GETICON, ICON_BIG, 0);
            let small = SendMessageW(hwnd, WM_GETICON, ICON_SMALL, 0);
            SAVED_ICON_BIG.store(big, Ordering::SeqCst);
            SAVED_ICON_SMALL.store(small, Ordering::SeqCst);
            SendMessageW(hwnd, WM_SETICON, ICON_BIG, 0);
            SendMessageW(hwnd, WM_SETICON, ICON_SMALL, 0);
        }
        frame_changed(hwnd);
    }

    fn restore_chrome(hwnd: HWND) {
        unsafe {
            let style = SAVED_STYLE.load(Ordering::SeqCst);
            if style != 0 {
                SetWindowLongW(hwnd, GWL_STYLE, style);
            } else {
                let style = GetWindowLongW(hwnd, GWL_STYLE);
                SetWindowLongW(hwnd, GWL_STYLE, style | WS_CAPTION_BUTTONS);
            }
            SendMessageW(
                hwnd,
                WM_SETICON,
                ICON_BIG,
                SAVED_ICON_BIG.load(Ordering::SeqCst),
            );
            SendMessageW(
                hwnd,
                WM_SETICON,
                ICON_SMALL,
                SAVED_ICON_SMALL.load(Ordering::SeqCst),
            );
        }
        frame_changed(hwnd);
    }

    fn set_window_bounds(hwnd: HWND, x: i32, y: i32, width: i32, height: i32) {
        if width <= 0 || height <= 0 {
            return;
        }
        unsafe {
            SetWindowPos(
                hwnd,
                std::ptr::null_mut(),
                x,
                y,
                width,
                height,
                SWP_NOZORDER | SWP_NOACTIVATE,
            );
        }
    }

    fn start_shaded_press(hwnd: HWND, lparam: isize) {
        let pt = lparam_point(lparam);
        SHADE_PRESS_X.store(pt.x, Ordering::SeqCst);
        SHADE_PRESS_Y.store(pt.y, Ordering::SeqCst);
        SHADE_CAPTURING.store(true, Ordering::SeqCst);
        unsafe {
            SetCapture(hwnd);
        }
    }

    fn shaded_press_became_drag(hwnd: HWND, lparam: isize, client_coords: bool) -> bool {
        let mut pt = lparam_point(lparam);
        if client_coords {
            unsafe {
                ClientToScreen(hwnd, &mut pt);
            }
        }
        let dx = (pt.x - SHADE_PRESS_X.load(Ordering::SeqCst)).abs();
        let dy = (pt.y - SHADE_PRESS_Y.load(Ordering::SeqCst)).abs();
        let thresh_x = unsafe { GetSystemMetrics(SM_CXDRAG) }.max(4);
        let thresh_y = unsafe { GetSystemMetrics(SM_CYDRAG) }.max(4);
        dx > thresh_x || dy > thresh_y
    }

    fn begin_shaded_move(hwnd: HWND) {
        SHADE_CAPTURING.store(false, Ordering::SeqCst);
        unsafe {
            ReleaseCapture();
            let mut pt = POINT { x: 0, y: 0 };
            GetCursorPos(&mut pt);
            call_old_wndproc(
                hwnd,
                WM_NCLBUTTONDOWN,
                HTCAPTION,
                pack_lparam(pt.x, pt.y),
            );
        }
    }

    fn finish_shaded_click(hwnd: HWND) {
        SHADE_CAPTURING.store(false, Ordering::SeqCst);
        unsafe {
            ReleaseCapture();
        }
        toggle_titlebar_shade(hwnd);
    }

    fn toggle_titlebar_shade(hwnd: HWND) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let last = LAST_SHADE_TOGGLE_MS.load(Ordering::SeqCst);
        if now.saturating_sub(last) < 80 {
            return;
        }
        LAST_SHADE_TOGGLE_MS.store(now, Ordering::SeqCst);

        let Some(rect) = window_rect(hwnd) else {
            return;
        };
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        let from_bottom = SHADE_FROM_BOTTOM.load(Ordering::SeqCst);
        if looks_shaded(hwnd) {
            TITLEBAR_SHADED.store(false, Ordering::SeqCst);
            restore_chrome(hwnd);
            let restored_cx = RESTORED_CX.load(Ordering::SeqCst);
            let restored_cy = RESTORED_CY.load(Ordering::SeqCst);
            let new_w = if restored_cx > 0 { restored_cx } else { width };
            let new_h = if restored_cy > height { restored_cy } else { height };
            let new_y = if from_bottom {
                rect.bottom - new_h
            } else {
                rect.top
            };
            set_window_bounds(hwnd, rect.left, new_y, new_w, new_h);
        } else {
            let shade_h = titlebar_only_height(hwnd);
            if shade_h <= 0 || shade_h >= height {
                return;
            }
            RESTORED_CX.store(width, Ordering::SeqCst);
            RESTORED_CY.store(height, Ordering::SeqCst);
            TITLEBAR_SHADED.store(true, Ordering::SeqCst);
            apply_compact_chrome(hwnd);
            let compact_h = titlebar_only_height(hwnd).max(shade_h);
            let compact_w = compact_window_width(hwnd);
            let new_y = if from_bottom {
                rect.bottom - compact_h
            } else {
                rect.top
            };
            set_window_bounds(hwnd, rect.left, new_y, compact_w, compact_h);
        }
    }

    unsafe fn call_old_wndproc(
        hwnd: HWND,
        msg: u32,
        wparam: usize,
        lparam: isize,
    ) -> isize {
        let old = OLD_WNDPROCS
            .lock()
            .ok()
            .and_then(|g| g.as_ref().and_then(|m| m.get(&(hwnd as isize)).copied()))
            .unwrap_or(0);
        if old == 0 {
            DefWindowProcW(hwnd, msg, wparam, lparam)
        } else {
            CallWindowProcW(old as *const c_void, hwnd, msg, wparam, lparam)
        }
    }

    fn syscommand(wparam: usize) -> u32 {
        (wparam as u32) & 0xFFF0
    }

    fn set_noactivate_style(hwnd: HWND) {
        if hwnd.is_null() {
            return;
        }
        unsafe {
            let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
            if ex & WS_EX_NOACTIVATE == 0 {
                SetWindowLongW(hwnd, GWL_EXSTYLE, ex | WS_EX_NOACTIVATE);
            }
        }
    }

    fn clear_noactivate_style(hwnd: HWND) {
        if hwnd.is_null() {
            return;
        }
        unsafe {
            let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
            if ex & WS_EX_NOACTIVATE != 0 {
                SetWindowLongW(hwnd, GWL_EXSTYLE, ex & !WS_EX_NOACTIVATE);
            }
        }
    }

    unsafe extern "system" fn enum_activate(hwnd: HWND, _lparam: isize) -> i32 {
        clear_noactivate_style(hwnd);
        1
    }

    fn subclass_noactivate(hwnd: HWND) {
        if hwnd.is_null() {
            return;
        }
        let key = hwnd as isize;
        let mut guard = match OLD_WNDPROCS.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let map = guard.get_or_insert_with(HashMap::new);
        if map.contains_key(&key) {
            return;
        }
        let old = unsafe { GetWindowLongPtrW(hwnd, GWLP_WNDPROC) };
        map.insert(key, old);
        drop(guard);
        unsafe {
            SetWindowLongPtrW(hwnd, GWLP_WNDPROC, noactivate_wnd_proc as *const () as isize);
        }
    }

    unsafe extern "system" fn noactivate_wnd_proc(
        hwnd: HWND,
        msg: u32,
        wparam: usize,
        lparam: isize,
    ) -> isize {
        if msg == WM_MOUSEACTIVATE {
            if INPUT_ENABLED.load(Ordering::SeqCst) {
                return call_old_wndproc(hwnd, msg, wparam, lparam);
            }
            return MA_NOACTIVATE;
        }
        if msg == WM_PARENTNOTIFY && (wparam as u32 & 0xffff) == WM_CREATE {
            let child = lparam as HWND;
            set_noactivate_style(child);
            subclass_noactivate(child);
        }
        if is_main_hwnd(hwnd) {
            let shaded = TITLEBAR_SHADED.load(Ordering::SeqCst);
            if msg == WM_NCHITTEST {
                if shaded {
                    return HTCAPTION as isize;
                }
                let hit = call_old_wndproc(hwnd, msg, wparam, lparam) as usize;
                // Double-clicking the title-bar app icon is Windows' close shortcut.
                if hit == HTSYSMENU {
                    return HTCAPTION as isize;
                }
                return hit as isize;
            }
            if (msg == WM_NCLBUTTONDOWN || msg == WM_NCLBUTTONDBLCLK) && wparam == HTSYSMENU {
                if msg == WM_NCLBUTTONDBLCLK {
                    return 0;
                }
                if shaded {
                    start_shaded_press(hwnd, lparam);
                    return 0;
                }
                // Treat the app icon as part of the title bar, not the close shortcut.
                return call_old_wndproc(hwnd, msg, HTCAPTION, lparam);
            }
            if shaded && msg == WM_NCLBUTTONDOWN {
                start_shaded_press(hwnd, lparam);
                return 0;
            }
            if SHADE_CAPTURING.load(Ordering::SeqCst) {
                if msg == WM_MOUSEMOVE && (wparam & MK_LBUTTON) != 0 {
                    if shaded_press_became_drag(hwnd, lparam, true) {
                        begin_shaded_move(hwnd);
                    }
                    return 0;
                }
                if msg == WM_LBUTTONUP {
                    finish_shaded_click(hwnd);
                    return 0;
                }
                if msg == WM_CAPTURECHANGED {
                    SHADE_CAPTURING.store(false, Ordering::SeqCst);
                }
            }
            if !shaded && (msg == WM_NCLBUTTONDOWN || msg == WM_NCLBUTTONDBLCLK) && wparam == HTMINBUTTON
            {
                toggle_titlebar_shade(hwnd);
                return 0;
            }
            if msg == WM_NCLBUTTONDBLCLK && wparam == HTCAPTION {
                return 0;
            }
            if msg == WM_SYSCOMMAND {
                let cmd = syscommand(wparam);
                if cmd == SC_CLOSE && shaded {
                    return 0;
                }
                if cmd == SC_MINIMIZE {
                    toggle_titlebar_shade(hwnd);
                    return 0;
                }
                if cmd == SC_RESTORE && shaded && IsIconic(hwnd) == 0 {
                    toggle_titlebar_shade(hwnd);
                    return 0;
                }
            }
            if msg == WM_GETMINMAXINFO {
                let result = call_old_wndproc(hwnd, msg, wparam, lparam);
                let shade_h = titlebar_only_height(hwnd);
                let compact_w = compact_window_width(hwnd);
                if lparam != 0 {
                    let info = lparam as *mut MINMAXINFO;
                    if shade_h > 0 {
                        (*info).ptMinTrackSize.y = shade_h;
                    }
                    if compact_w > 0 {
                        (*info).ptMinTrackSize.x = compact_w;
                    }
                }
                return result;
            }
        }
        call_old_wndproc(hwnd, msg, wparam, lparam)
    }

    unsafe extern "system" fn enum_noactivate(hwnd: HWND, _lparam: isize) -> i32 {
        set_noactivate_style(hwnd);
        subclass_noactivate(hwnd);
        1
    }

    pub fn is_titlebar_shaded() -> bool {
        TITLEBAR_SHADED.load(Ordering::SeqCst)
    }

    pub fn set_shade_from_bottom(from_bottom: bool) {
        SHADE_FROM_BOTTOM.store(from_bottom, Ordering::SeqCst);
    }

    /// Keep minimize + close; the minus button shades to a title chip instead of minimizing.
    pub fn enable_titlebar_shade(window: &WebviewWindow) {
        let Some(hwnd) = hwnd_of(window) else {
            return;
        };
        MAIN_HWND.store(hwnd, Ordering::SeqCst);
        if !TITLEBAR_SHADED.load(Ordering::SeqCst) {
            unsafe {
                let style = GetWindowLongW(hwnd, GWL_STYLE);
                let desired = (style | WS_SYSMENU | WS_MINIMIZEBOX) & !WS_MAXIMIZEBOX;
                if style != desired {
                    SetWindowLongW(hwnd, GWL_STYLE, desired);
                    frame_changed(hwnd);
                }
            }
        }
        subclass_noactivate(hwnd);
    }

    /// Clickable but never activated: the previous foreground window (the game)
    /// keeps keyboard focus. Must run on the window thread.
    pub fn prevent_activation(window: &WebviewWindow) {
        if INPUT_ENABLED.load(Ordering::SeqCst) {
            return;
        }
        let Some(hwnd) = hwnd_of(window) else {
            return;
        };
        set_noactivate_style(hwnd);
        subclass_noactivate(hwnd);
        unsafe {
            EnumChildWindows(hwnd, Some(enum_noactivate), 0);
        }
    }

    /// Allow the main window to take keyboard focus (變更 → 自定義).
    pub fn set_input_enabled(window: &WebviewWindow, enabled: bool) {
        INPUT_ENABLED.store(enabled, Ordering::SeqCst);
        let Some(hwnd) = hwnd_of(window) else {
            return;
        };
        if enabled {
            clear_noactivate_style(hwnd);
            unsafe {
                EnumChildWindows(hwnd, Some(enum_activate), 0);
            }
            let _ = window.set_focusable(true);
            let _ = window.set_focus();
        } else {
            set_noactivate_style(hwnd);
            subclass_noactivate(hwnd);
            unsafe {
                EnumChildWindows(hwnd, Some(enum_noactivate), 0);
            }
            let _ = window.set_focusable(false);
        }
    }

    /// `CreateMutexW` + `ERROR_ALREADY_EXISTS` — same as `_already_running`.
    pub fn already_running() -> bool {
        let name = wide(MUTEX_NAME);
        unsafe {
            let handle = CreateMutexW(std::ptr::null(), 0, name.as_ptr());
            MUTEX_HANDLE.store(handle, Ordering::SeqCst);
            GetLastError() == ERROR_ALREADY_EXISTS
        }
    }

    /// Restore + focus the first instance — same as `_bring_existing_to_front`.
    pub fn bring_existing_to_front() -> bool {
        let title = wide(MAIN_TITLE);
        unsafe {
            for _ in 0..8 {
                let hwnd = FindWindowW(std::ptr::null(), title.as_ptr());
                if !hwnd.is_null() {
                    ShowWindow(hwnd, SW_RESTORE);
                    let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
                    SetWindowLongW(hwnd, GWL_EXSTYLE, ex & !WS_EX_NOACTIVATE);
                    if SetForegroundWindow(hwnd) == 0 {
                        keybd_event(VK_MENU, 0, 0, 0);
                        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
                        SetForegroundWindow(hwnd);
                    }
                    SetWindowPos(
                        hwnd,
                        HWND_TOPMOST,
                        0,
                        0,
                        0,
                        0,
                        SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW,
                    );
                    SetWindowLongW(hwnd, GWL_EXSTYLE, ex);
                    return true;
                }
                thread::sleep(Duration::from_millis(250));
            }
        }
        false
    }

    /// Keep the main window above the game. Do not set `WS_EX_TOOLWINDOW` —
    /// that caption has only a close button and stays off the taskbar, so
    /// minimize would be useless. `WS_EX_NOACTIVATE` lets clicks hit the
    /// buttons without taking foreground from the game.
    pub fn force_topmost_window(window: &WebviewWindow) {
        let Some(hwnd) = hwnd_of(window) else {
            return;
        };
        unsafe {
            let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
            let mut next = ex | WS_EX_TOPMOST;
            if INPUT_ENABLED.load(Ordering::SeqCst) {
                next &= !WS_EX_NOACTIVATE;
            } else {
                next |= WS_EX_NOACTIVATE;
            }
            SetWindowLongW(hwnd, GWL_EXSTYLE, next);
            SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }

    /// Topmost overlay. Transparency is per-pixel WebView2 alpha, not a color-key:
    /// `SetLayeredWindowAttributes(LWA_COLORKEY)` would disable that and leave a black box.
    pub fn apply_overlay_style(window: &WebviewWindow) {
        let Some(hwnd) = hwnd_of(window) else {
            return;
        };
        unsafe {
            let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
            SetWindowLongW(
                hwnd,
                GWL_EXSTYLE,
                ex | WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            );
            SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
            );
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use tauri::WebviewWindow;

    pub fn already_running() -> bool {
        false
    }

    pub fn bring_existing_to_front() -> bool {
        false
    }

    pub fn force_topmost_window(_window: &WebviewWindow) {}

    pub fn apply_overlay_style(_window: &WebviewWindow) {}

    pub fn prevent_activation(_window: &WebviewWindow) {}

    pub fn set_input_enabled(_window: &WebviewWindow, _enabled: bool) {}

    pub fn is_titlebar_shaded() -> bool {
        false
    }

    pub fn enable_titlebar_shade(_window: &WebviewWindow) {}

    pub fn set_shade_from_bottom(_from_bottom: bool) {}
}

pub use imp::*;

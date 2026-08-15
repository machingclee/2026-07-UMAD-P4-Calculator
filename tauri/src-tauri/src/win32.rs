//! Windows API helpers matching python/main.py (`ctypes.windll`).
//! Compiles to no-ops on non-Windows so the project can be edited on macOS.

#![allow(non_snake_case)]

#[cfg(windows)]
mod imp {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicPtr, Ordering};
    use std::thread;
    use std::time::Duration;
    use tauri::WebviewWindow;

    type HWND = *mut c_void;
    type HANDLE = *mut c_void;

    const HWND_TOPMOST: HWND = -1isize as HWND;
    const SWP_NOSIZE: u32 = 0x0001;
    const SWP_NOMOVE: u32 = 0x0002;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_SHOWWINDOW: u32 = 0x0040;
    const WS_EX_TOPMOST: i32 = 0x0000_0008;
    const WS_EX_TOOLWINDOW: i32 = 0x0000_0080;
    const WS_EX_NOACTIVATE: i32 = 0x0800_0000;
    const WS_EX_LAYERED: i32 = 0x0008_0000;
    const LWA_COLORKEY: u32 = 0x0000_0001;
    const GWL_EXSTYLE: i32 = -20;
    const SW_RESTORE: i32 = 9;
    const ERROR_ALREADY_EXISTS: u32 = 183;
    const VK_MENU: u8 = 0x12;
    const KEYEVENTF_KEYUP: u32 = 2;
    const MUTEX_NAME: &str = "FF14-P4-Calculator-single-instance";
    const MAIN_TITLE: &str = "FF14 P4 Calculator";

    static MUTEX_HANDLE: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

    #[link(name = "user32")]
    unsafe extern "system" {
        fn FindWindowW(lpClassName: *const u16, lpWindowName: *const u16) -> HWND;
        fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> i32;
        fn GetWindowLongW(hWnd: HWND, nIndex: i32) -> i32;
        fn SetWindowLongW(hWnd: HWND, nIndex: i32, dwNewLong: i32) -> i32;
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
        fn keybd_event(bVk: u8, bScan: u8, dwFlags: u32, dwExtraInfo: usize);
        fn SetLayeredWindowAttributes(
            hwnd: HWND,
            crKey: u32,
            bAlpha: u8,
            dwFlags: u32,
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

    /// Same as python `_win32_topmost`.
    pub fn force_topmost_window(window: &WebviewWindow) {
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

    /// Topmost + color-key black, matching tkinter `-transparentcolor` / `_win32_topmost`.
    pub fn apply_overlay_style(window: &WebviewWindow) {
        let Some(hwnd) = hwnd_of(window) else {
            return;
        };
        unsafe {
            let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
            SetWindowLongW(
                hwnd,
                GWL_EXSTYLE,
                ex | WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED,
            );
            SetLayeredWindowAttributes(hwnd, 0x0000_0000, 0, LWA_COLORKEY);
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
}

pub use imp::*;

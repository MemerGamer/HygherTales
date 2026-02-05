fn main() {
    // Linux: set before any GUI libs run to avoid EGL_BAD_PARAMETER / blank window.
    // Must be in main() so they're set before app_lib::run() loads Tauri/Wry/WebKit.
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        // Prefer X11; avoids broken EGL path on some Wayland/driver setups.
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
    }

    app_lib::run()
}

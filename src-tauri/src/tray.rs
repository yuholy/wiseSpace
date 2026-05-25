use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Theme,
};

const TRAY_ID: &str = "wisespace-tray";
const TRAY_ICON_PATH: &str = "icons/32x32.png";
const WINDOW_ICON_PATH: &str = "icons/icon.png";

fn tray_labels(language: &str) -> (&'static str, &'static str) {
    let lang = language.to_ascii_lowercase();
    if lang == "en" || lang.starts_with("en-") {
        ("Show", "Quit")
    } else if lang == "zh-tw" {
        ("顯示主視窗", "退出 wiseSpace")
    } else if lang == "ja" {
        ("メインウィンドウを表示", "wiseSpace を終了")
    } else if lang == "ko" {
        ("메인 창 표시", "wiseSpace 종료")
    } else if lang == "fr" {
        ("Afficher", "Quitter wiseSpace")
    } else if lang == "de" {
        ("Anzeigen", "wiseSpace beenden")
    } else if lang == "es" {
        ("Mostrar", "Salir de wiseSpace")
    } else if lang == "ru" {
        ("Показать", "Выйти из wiseSpace")
    } else if lang == "hi" {
        ("दिखाएं", "wiseSpace छोड़ें")
    } else if lang == "ar" {
        ("عرض", "إنهاء wiseSpace")
    } else {
        ("显示主窗口", "退出 wiseSpace")
    }
}

fn build_menu(
    app: &AppHandle,
    language: &str,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let (show_label, quit_label) = tray_labels(language);
    let show = MenuItem::with_id(app, "show", show_label, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    Ok(menu)
}

fn normalize_monochrome_rgba(rgba: &[u8], white: bool) -> Vec<u8> {
    let target = if white { 255 } else { 0 };
    let mut normalized = rgba.to_vec();
    for pixel in normalized.chunks_exact_mut(4) {
        if pixel[3] > 0 {
            pixel[0] = target;
            pixel[1] = target;
            pixel[2] = target;
        }
    }
    normalized
}

fn themed_icon(path: &str, theme: Theme) -> Result<Image<'static>, Box<dyn std::error::Error>> {
    let base = Image::from_path(path)?;
    let white = matches!(theme, Theme::Dark);
    let rgba = normalize_monochrome_rgba(base.rgba(), white);
    Ok(Image::new_owned(rgba, base.width(), base.height()))
}

fn current_system_theme(app: &AppHandle) -> Theme {
    app.get_webview_window("main")
        .and_then(|window| window.theme().ok())
        .unwrap_or(Theme::Light)
}

pub fn create_tray(app: &AppHandle, language: &str) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_menu(app, language)?;
    let icon = themed_icon(TRAY_ICON_PATH, current_system_theme(app)).unwrap_or_else(|_| {
        Image::from_bytes(include_bytes!("../icons/32x32.png"))
            .expect("failed to load fallback tray icon")
    });

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("wiseSpace")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn sync_theme_icons(app: &AppHandle, theme: Theme) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_icon(Some(themed_icon(TRAY_ICON_PATH, theme)?))?;
    }

    #[cfg(target_os = "windows")]
    if let Some(window) = app.get_webview_window("main") {
        window.set_icon(themed_icon(WINDOW_ICON_PATH, theme)?)?;
    }

    Ok(())
}

pub fn sync_tray_language(
    app: &AppHandle,
    language: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_menu(app, language)?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu))?;
    } else {
        create_tray(app, language)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::normalize_monochrome_rgba;

    #[test]
    fn normalizes_visible_pixels_to_white() {
        let rgba = vec![12, 34, 56, 255, 200, 180, 160, 0];
        let normalized = normalize_monochrome_rgba(&rgba, true);
        assert_eq!(normalized, vec![255, 255, 255, 255, 200, 180, 160, 0]);
    }

    #[test]
    fn normalizes_visible_pixels_to_black() {
        let rgba = vec![12, 34, 56, 128, 200, 180, 160, 0];
        let normalized = normalize_monochrome_rgba(&rgba, false);
        assert_eq!(normalized, vec![0, 0, 0, 128, 200, 180, 160, 0]);
    }
}

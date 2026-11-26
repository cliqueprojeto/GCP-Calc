mod system;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Evita tela em branco em algumas GPUs/sessões Wayland no Linux.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .manage(system::OAuthState::default())
        .setup(|app| {
            // Linux (WebKitGTK): permite o microfone para gravar e transcrever áudio nas notas.
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.with_webview(|wv| {
                        use webkit2gtk::{PermissionRequestExt, SettingsExt, UserMediaPermissionRequest, WebViewExt};
                        use webkit2gtk::glib::object::Cast;
                        let view = wv.inner();
                        if let Some(settings) = WebViewExt::settings(&view) {
                            settings.set_enable_media_stream(true);
                        }
                        view.connect_permission_request(|_, req| {
                            if req.downcast_ref::<UserMediaPermissionRequest>().is_some() {
                                req.allow();
                                return true;
                            }
                            false
                        });
                    });
                }
            }
            #[cfg(not(target_os = "linux"))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            system::data_load,
            system::data_save,
            system::read_text_file,
            system::write_text_file,
            system::write_binary_file,
            system::platform_info,
            system::oauth_start,
            system::oauth_result,
            system::update_download,
            system::update_install,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o GCP-Calc");
}

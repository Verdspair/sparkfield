use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostPlatformInfo {
    pub platform: &'static str,
    pub architecture: &'static str,
    pub host_mode: &'static str,
    pub app_version: &'static str,
    pub debug_build: bool,
}

#[tauri::command]
fn host_platform_info() -> HostPlatformInfo {
    HostPlatformInfo {
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        host_mode: if cfg!(mobile) { "mobile" } else { "desktop" },
        app_version: env!("CARGO_PKG_VERSION"),
        debug_build: cfg!(debug_assertions),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![host_platform_info])
        .run(tauri::generate_context!())
        .expect("failed to run SparkField native host");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_the_compiled_target_without_device_identifiers() {
        let info = host_platform_info();
        assert_eq!(info.platform, std::env::consts::OS);
        assert_eq!(info.architecture, std::env::consts::ARCH);
        assert_eq!(info.app_version, env!("CARGO_PKG_VERSION"));
        assert_eq!(info.debug_build, cfg!(debug_assertions));
        assert_eq!(
            info.host_mode,
            if cfg!(mobile) { "mobile" } else { "desktop" }
        );
    }

    #[test]
    fn serializes_the_frontend_command_contract_in_camel_case() {
        let info = host_platform_info();
        let value = serde_json::to_value(&info).expect("host info is JSON serializable");
        assert_eq!(
            value,
            serde_json::json!({
                "platform": info.platform,
                "architecture": info.architecture,
                "hostMode": info.host_mode,
                "appVersion": info.app_version,
                "debugBuild": info.debug_build,
            })
        );
        assert_eq!(value.as_object().unwrap().len(), 5);
    }

    #[test]
    fn command_is_side_effect_free_and_repeatable() {
        assert_eq!(host_platform_info(), host_platform_info());
    }

    #[test]
    fn config_preserves_landscape_window_and_shared_web_build() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let window = &config["app"]["windows"][0];
        assert_eq!(window["label"], "main");
        assert_eq!(window["width"], 1440);
        assert_eq!(window["height"], 900);
        assert_eq!(window["minWidth"], 960);
        assert_eq!(window["minHeight"], 540);
        assert_eq!(window["resizable"], true);
        assert_eq!(window["fullscreen"], false);
        assert_eq!(config["build"]["frontendDist"], "../dist");
        assert_eq!(config["build"]["devUrl"], "http://127.0.0.1:5173");
        assert_eq!(config["build"]["beforeDevCommand"], "pnpm dev");
        assert_eq!(config["build"]["beforeBuildCommand"], "pnpm build");
    }

    #[test]
    fn capability_grants_only_local_main_window_and_fullscreen_controls() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
        assert_eq!(capability["windows"], serde_json::json!(["main"]));
        assert!(capability.get("remote").is_none());
        assert_eq!(
            capability["permissions"],
            serde_json::json!([
                "core:default",
                "core:window:allow-set-fullscreen",
                "core:window:allow-is-fullscreen"
            ])
        );
    }
}

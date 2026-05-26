use std::path::PathBuf;

use wisespace_core::{crypto, db, path_vars, repo};
use wisespace_gateway::server::{GatewayServer, GatewaySslConfig, GatewayStartConfig, GatewayTlsConfig};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

fn wisespace_home() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            return PathBuf::from(user_profile).join(".wisespace");
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home_dir) = std::env::var_os("HOME") {
            return PathBuf::from(home_dir).join(".wisespace");
        }
    }

    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(".wisespace")
}

fn load_master_key(app_dir: &PathBuf) -> Result<[u8; 32], String> {
    let key_path = app_dir.join("master.key");
    if !key_path.exists() {
        return Err(format!("master.key not found at {}", key_path.display()));
    }

    let mut bytes = std::fs::read(&key_path).map_err(|e| e.to_string())?;
    if bytes.len() != 32 {
        return Err(format!("master.key is invalid: expected 32 bytes, got {}", bytes.len()));
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    bytes.iter_mut().for_each(|b| *b = 0);
    Ok(key)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = wisespace_home();
    std::fs::create_dir_all(&app_dir)?;

    #[cfg(unix)]
    if let Ok(metadata) = std::fs::metadata(app_dir.join("master.key")) {
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o600);
        let _ = std::fs::set_permissions(app_dir.join("master.key"), permissions);
    }

    wisespace_core::vector_store::register_sqlite_vec_extension();

    let db_path = format!("sqlite:{}/wisespace.db", app_dir.display());
    let db_handle = db::create_pool(&db_path).await?;
    let master_key = load_master_key(&app_dir)?;
    let settings = repo::settings::get_settings(&db_handle.conn).await?;

    let ssl = if settings.gateway_ssl_enabled {
        Some(GatewaySslConfig {
            ssl_port: settings.gateway_ssl_port,
            tls: GatewayTlsConfig {
                cert_path: path_vars::decode_path_opt(&settings.gateway_ssl_cert_path).unwrap_or_default(),
                key_path: path_vars::decode_path_opt(&settings.gateway_ssl_key_path).unwrap_or_default(),
            },
        })
    } else {
        None
    };

    let start_config = GatewayStartConfig {
        listen_address: settings.gateway_listen_address.clone(),
        http_port: settings.gateway_port,
        ssl,
        force_ssl: settings.gateway_force_ssl,
    };

    println!(
        "[gateway-launcher] starting gateway on {}:{} (ssl_enabled={}, force_ssl={})",
        settings.gateway_listen_address,
        settings.gateway_port,
        settings.gateway_ssl_enabled,
        settings.gateway_force_ssl
    );

    let mut server = GatewayServer::start(db_handle.conn.clone(), master_key, start_config).await?;

    println!("[gateway-launcher] gateway is running");
    tokio::signal::ctrl_c().await?;
    println!("[gateway-launcher] stopping gateway");
    server.stop().await?;
    Ok(())
}

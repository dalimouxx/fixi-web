//! Mise à jour automatique : lit la dernière version publiée sur GitHub, télécharge l'installateur,
//! vérifie son empreinte SHA-256 puis le lance et ferme la caisse.
use sha2::{Digest, Sha256};
use tauri::AppHandle;

const LATEST: &str = "https://github.com/dalimouxx/fixi-web/releases/download/windows-latest/latest.json";
const ASSET_PREFIX: &str = "https://github.com/dalimouxx/fixi-web/releases/download/windows-latest/";

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().user_agent("FIXI-Caisse-Windows")
        .connect_timeout(std::time::Duration::from_secs(15)).timeout(std::time::Duration::from_secs(300))
        .build().map_err(|_| "Mise à jour indisponible".to_string())
}

fn newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| v.trim_start_matches('v').split('.').map(|x| x.parse::<u64>().unwrap_or(0)).collect::<Vec<_>>();
    let (a, b) = (parse(latest), parse(current));
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (*a.get(i).unwrap_or(&0), *b.get(i).unwrap_or(&0));
        if x != y { return x > y; }
    }
    false
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<serde_json::Value, String> {
    let current = app.package_info().version.to_string();
    let response = client()?.get(LATEST).send().await.map_err(|_| "Pas de connexion pour vérifier les mises à jour".to_string())?;
    if !response.status().is_success() { return Ok(serde_json::json!({"available":false,"current":current})); }
    let info: serde_json::Value = response.json().await.map_err(|_| "Fichier de version invalide".to_string())?;
    let version = info.get("version").and_then(|v| v.as_str()).unwrap_or("0").to_string();
    Ok(serde_json::json!({"available":newer(&version,&current),"current":current,"version":version,
        "url":info.get("url"),"sha256":info.get("sha256"),"notes":info.get("notes")}))
}

#[tauri::command]
pub async fn install_update(app: AppHandle, url: String, sha256: String) -> Result<(), String> {
    if !url.starts_with(ASSET_PREFIX) || !url.ends_with(".exe") || url.contains("..") { return Err("Adresse de mise à jour refusée".into()); }
    let expected = sha256.trim().to_lowercase();
    if expected.len() != 64 || !expected.chars().all(|c| c.is_ascii_hexdigit()) { return Err("Empreinte de mise à jour manquante".into()); }
    let bytes = client()?.get(&url).send().await.map_err(|_| "Téléchargement interrompu".to_string())?
        .error_for_status().map_err(|_| "Installateur introuvable".to_string())?
        .bytes().await.map_err(|_| "Téléchargement interrompu".to_string())?;
    let digest = Sha256::digest(&bytes);
    let actual: String = digest.iter().map(|b| format!("{:02x}", b)).collect();
    if actual != expected { return Err("Installateur corrompu (empreinte différente) : mise à jour annulée".into()); }
    let path = std::env::temp_dir().join(format!("FIXI-Caisse-Setup-{}.exe", &actual[..12]));
    std::fs::write(&path, &bytes).map_err(|_| "Impossible d'enregistrer l'installateur".to_string())?;
    // /P = installation sans questions avec barre de progression, /R = relancer FIXI Caisse ensuite.
    std::process::Command::new(&path).args(["/P", "/R"]).spawn().map_err(|_| "Impossible de lancer l'installateur".to_string())?;
    app.exit(0);
    Ok(())
}

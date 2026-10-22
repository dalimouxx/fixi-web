use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

struct Connection {
    origin: String,
    client: reqwest::Client,
}
struct DesktopState {
    connection: Mutex<Option<Connection>>,
}

fn validate_origin(raw: &str) -> Result<String, String> {
    let u = url::Url::parse(raw.trim()).map_err(|_| "Adresse du serveur invalide".to_string())?;
    if u.scheme() != "https" || u.host_str().is_none()
        || !u.username().is_empty() || u.password().is_some()
        || u.query().is_some() || u.fragment().is_some()
        || u.path() != "/" {
        return Err("Utilisez l'adresse HTTPS principale du serveur, sans chemin ni paramètres".into());
    }
    Ok(u.origin().ascii_serialization())
}

#[tauri::command]
async fn supplier_login(
    state: State<'_, Arc<DesktopState>>,
    server: String,
    login: String,
    password: String,
) -> Result<serde_json::Value, String> {
    let origin = validate_origin(&server)?;
    if login.trim().is_empty() || password.is_empty() {
        return Err("Identifiant et mot de passe requis".into());
    }
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|_| "Impossible de préparer la connexion".to_string())?;
    let response = client.post(format!("{origin}/api/supplier/auth/login"))
        .json(&serde_json::json!({"login":login,"password":password}))
        .send().await.map_err(|_| "Serveur inaccessible".to_string())?;
    if !response.status().is_success() {
        return Err("Connexion refusée : vérifiez l'adresse et les identifiants fournisseur".into());
    }
    // Check permissions against desktop endpoint before committing the session.
    let response = client.get(format!("{origin}/api/supplier/desktop/bootstrap"))
        .send().await.map_err(|_| "Impossible de récupérer le catalogue".to_string())?;
    if !response.status().is_success() {
        return Err("Ce compte ne dispose pas de l'accès à la caisse Windows".into());
    }
    let data: serde_json::Value = response.json().await.map_err(|_| "Réponse serveur invalide".to_string())?;
    *state.connection.lock().await = Some(Connection{origin,client});
    Ok(data)
}

#[tauri::command]
async fn supplier_refresh(state: State<'_, Arc<DesktopState>>) -> Result<serde_json::Value, String> {
    let guard = state.connection.lock().await;
    let session = guard.as_ref().ok_or("Veuillez vous connecter")?;
    let response = session.client.get(format!("{}/api/supplier/desktop/bootstrap",session.origin))
        .send().await.map_err(|_| "Serveur inaccessible".to_string())?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("Session expirée : reconnectez-vous".into());
    }
    if !response.status().is_success(){return Err("Synchronisation impossible".into());}
    response.json().await.map_err(|_| "Réponse serveur invalide".to_string())
}

#[tauri::command]
async fn supplier_history(state: State<'_, Arc<DesktopState>>) -> Result<serde_json::Value, String> {
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Veuillez vous connecter")?;
    let response=session.client.get(format!("{}/api/supplier/desktop/history",session.origin))
        .send().await.map_err(|_| "Historique indisponible".to_string())?;
    if !response.status().is_success(){return Err("Impossible de charger l'historique du serveur".into())}
    response.json().await.map_err(|_| "Réponse historique invalide".to_string())
}

#[tauri::command]
async fn supplier_checkout(
    state: State<'_, Arc<DesktopState>>,
    sale: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Connectez-vous à FIXI Supplier")?;
    let response=session.client.post(format!("{}/api/supplier/desktop/sales",session.origin))
        .json(&sale).send().await
        .map_err(|_| "Connexion interrompue : vérifiez la vente dans l'historique avant de réessayer".to_string())?;
    let status=response.status();
    let result:serde_json::Value=response.json().await.map_err(|_| "Réponse invalide : vérifiez l'historique avant de réessayer".to_string())?;
    if !status.is_success(){
        let message=result.get("error").and_then(|v|v.as_str()).unwrap_or("Vente refusée par le serveur");
        return Err(message.to_string());
    }
    Ok(result)
}

#[tauri::command]
async fn supplier_cash_action(
    state: State<'_, Arc<DesktopState>>,
    operation: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Connectez-vous à FIXI Supplier")?;
    let response=session.client.post(format!("{}/api/supplier/desktop/cash",session.origin))
        .json(&operation).send().await
        .map_err(|_| "Réseau interrompu : vérifiez la session sur FIXI Web avant de retenter".to_string())?;
    let code=response.status();
    let result:serde_json::Value=response.json().await.map_err(|_| "Réponse caisse invalide".to_string())?;
    if !code.is_success() {
        return Err(result.get("error").and_then(|v|v.as_str()).unwrap_or("Opération de caisse refusée").to_string());
    }
    Ok(result)
}

#[tauri::command]
async fn supplier_logout(state: State<'_, Arc<DesktopState>>) -> Result<(), String> {
    let connection = state.connection.lock().await.take();
    if let Some(s) = connection {
        let _ = s.client.post(format!("{}/api/supplier/auth/logout",s.origin)).send().await;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(DesktopState{connection:Mutex::new(None)}))
        .invoke_handler(tauri::generate_handler![supplier_login,supplier_refresh,supplier_logout,supplier_checkout,supplier_history,supplier_cash_action])
        .run(tauri::generate_context!())
        .expect("error while running FIXI Caisse Windows");
}

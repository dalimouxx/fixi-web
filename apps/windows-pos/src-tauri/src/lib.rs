use std::sync::Arc;
use std::time::{Duration, Instant};
use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{SaltString, PasswordHash, rand_core::OsRng};
use tauri::State;
use tokio::sync::Mutex;

struct Connection {
    origin: String,
    client: reqwest::Client,
}
struct DesktopState {
    connection: Mutex<Option<Connection>>,
    pin: Mutex<Option<PinLock>>,
}
struct PinLock {hash: String, locked: bool, failed: u32, blocked_until: Option<Instant>}
async fn unlocked(state: &State<'_, Arc<DesktopState>>) -> Result<(),String> {
 let guard=state.pin.lock().await;
 if guard.as_ref().map(|x| x.locked).unwrap_or(false){return Err("Caisse verrouillée : saisissez votre PIN".into());}
 Ok(())
}
#[tauri::command]
async fn pin_setup(state: State<'_, Arc<DesktopState>>, pin: String) -> Result<(),String> {
 if state.connection.lock().await.is_none(){return Err("Connectez-vous d’abord avec votre compte fournisseur".into());}
 if pin.len()!=4 || !pin.bytes().all(|b|b.is_ascii_digit()){return Err("Le PIN doit contenir exactement 4 chiffres".into());}
 let salt=SaltString::generate(&mut OsRng);
 let hash=Argon2::default().hash_password(pin.as_bytes(), &salt).map_err(|_|"PIN indisponible")?.to_string();
 let mut g=state.pin.lock().await;
 if g.is_some(){return Err("PIN déjà défini pour cette session".into());}
 *g=Some(PinLock{hash,locked:false,failed:0,blocked_until:None});Ok(())
}
#[tauri::command]
async fn pin_lock(state: State<'_, Arc<DesktopState>>) -> Result<(),String> {
 let mut g=state.pin.lock().await;
 let guard=g.as_mut().ok_or("Configurez un PIN avant de verrouiller")?;
 guard.locked=true;Ok(())
}
#[tauri::command]
async fn pin_unlock(state: State<'_, Arc<DesktopState>>, pin: String) -> Result<(),String> {
 let mut g=state.pin.lock().await;
 let guard=g.as_mut().ok_or("Aucun code PIN actif")?;
 if let Some(until)=guard.blocked_until{if Instant::now()<until{return Err("Trop de tentatives : réessayez après une minute".into());}}
 let parsed=PasswordHash::new(&guard.hash).map_err(|_|"PIN invalide")?;
 if Argon2::default().verify_password(pin.as_bytes(),&parsed).is_err(){guard.failed+=1;if guard.failed>=5{guard.blocked_until=Some(Instant::now()+Duration::from_secs(60));guard.failed=0;}return Err("PIN incorrect".into());}
 guard.locked=false;guard.failed=0;guard.blocked_until=None;Ok(())
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

fn connection_error(e: reqwest::Error) -> String {
    if e.is_timeout() {
        return "Délai dépassé : le serveur Render peut être en cours de réveil. Réessayez après avoir ouvert FIXI dans un navigateur.".into();
    }
    if e.is_connect() {
        return "Connexion HTTPS impossible : vérifiez Internet, le proxy ou le pare-feu Windows, et ouvrez l'adresse FIXI dans votre navigateur.".into();
    }
    format!("Erreur réseau FIXI : {e}")
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
        .connect_timeout(std::time::Duration::from_secs(20))
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|_| "Impossible de préparer la connexion".to_string())?;
    let response = client.post(format!("{origin}/api/supplier/auth/login"))
        .json(&serde_json::json!({"login":login,"password":password}))
        .send().await.map_err(connection_error)?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 | 403 => "Identifiants fournisseur refusés ou compte sans autorisation.".into(),
            502 | 503 | 504 => "Serveur FIXI temporairement indisponible : attendez son redémarrage.".into(),
            n => format!("Connexion refusée par FIXI (HTTP {n})."),
        });
    }
    // Check permissions against desktop endpoint before committing the session.
    let response = client.get(format!("{origin}/api/supplier/desktop/bootstrap"))
        .send().await.map_err(|_| "Impossible de récupérer le catalogue".to_string())?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 => "Session fournisseur expirée ou cookie refusé.".into(),
            403 => "Ce compte ne dispose pas de l'accès à la caisse Windows.".into(),
            404 => "API Windows absente sur FIXI Cloud : une mise à jour du serveur est nécessaire.".into(),
            n => format!("Catalogue indisponible sur FIXI Cloud (HTTP {n})."),
        });
    }
    let data: serde_json::Value = response.json().await.map_err(|_| "Réponse serveur invalide".to_string())?;
    *state.connection.lock().await = Some(Connection{origin,client});
    *state.pin.lock().await=None;
    Ok(data)
}

#[tauri::command]
async fn supplier_refresh(state: State<'_, Arc<DesktopState>>) -> Result<serde_json::Value, String> {
    unlocked(&state).await?;
    let guard = state.connection.lock().await;
    let session = guard.as_ref().ok_or("Veuillez vous connecter")?;
    let response = session.client.get(format!("{}/api/supplier/desktop/bootstrap",session.origin))
        .send().await.map_err(|_| "Serveur inaccessible".to_string())?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("Session expirée : reconnectez-vous".into());
    }
    if !response.status().is_success(){return Err(format!("Synchronisation impossible (HTTP {})",response.status().as_u16()));}
    response.json().await.map_err(|_| "Réponse serveur invalide".to_string())
}

#[tauri::command]
async fn supplier_history(state: State<'_, Arc<DesktopState>>) -> Result<serde_json::Value, String> {
    unlocked(&state).await?;
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Veuillez vous connecter")?;
    let response=session.client.get(format!("{}/api/supplier/desktop/history",session.origin))
        .send().await.map_err(|_| "Historique indisponible".to_string())?;
    if !response.status().is_success(){return Err(format!("Historique FIXI indisponible (HTTP {}). Si 404 : API non déployée sur le serveur.",response.status().as_u16()))}
    response.json().await.map_err(|_| "Réponse historique invalide".to_string())
}

#[tauri::command]
async fn supplier_orders(state: State<'_, Arc<DesktopState>>) -> Result<serde_json::Value, String> {
    unlocked(&state).await?;
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Veuillez vous connecter")?;
    let response=session.client.get(format!("{}/api/supplier/desktop/orders",session.origin))
        .send().await.map_err(connection_error)?;
    if !response.status().is_success(){return Err(format!("Commandes indisponibles (HTTP {})",response.status().as_u16()))}
    response.json().await.map_err(|_| "Réponse commandes invalide".to_string())
}

#[tauri::command]
async fn supplier_order_transition(
    state: State<'_, Arc<DesktopState>>,
    order_id: String,
    status: String,
) -> Result<serde_json::Value, String> {
    unlocked(&state).await?;
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Veuillez vous connecter")?;
    let response=session.client.post(format!("{}/api/supplier/desktop/orders/transition",session.origin))
        .json(&serde_json::json!({"orderId":order_id,"status":status}))
        .send().await.map_err(connection_error)?;
    let code=response.status();
    let value:serde_json::Value=response.json().await.map_err(|_| "Réponse commande invalide".to_string())?;
    if !code.is_success(){
        return Err(value.get("error").and_then(|v|v.as_str()).unwrap_or("Transition refusée").to_string());
    }
    Ok(value)
}

#[tauri::command]
async fn supplier_debts(state: State<'_, Arc<DesktopState>>) -> Result<serde_json::Value, String> {
    unlocked(&state).await?;
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Veuillez vous connecter")?;
    let response=session.client.get(format!("{}/api/supplier/desktop/debts",session.origin))
        .send().await.map_err(connection_error)?;
    if !response.status().is_success(){return Err(format!("Créances indisponibles (HTTP {})",response.status().as_u16()))}
    response.json().await.map_err(|_| "Réponse créances invalide".to_string())
}

#[tauri::command]
async fn supplier_debt_payment(state: State<'_, Arc<DesktopState>>, payment: serde_json::Value) -> Result<serde_json::Value,String> {
    unlocked(&state).await?;
 let guard=state.connection.lock().await;
 let session=guard.as_ref().ok_or("Veuillez vous connecter")?;
 let response=session.client.post(format!("{}/api/supplier/desktop/debts/payment",session.origin)).json(&payment).send().await.map_err(connection_error)?;
 let code=response.status();
 let value:serde_json::Value=response.json().await.map_err(|_| "Réponse paiement invalide".to_string())?;
 if !code.is_success(){return Err(value.get("error").and_then(|v|v.as_str()).unwrap_or("Paiement refusé").to_string());}
 Ok(value)
}

#[tauri::command]
async fn supplier_returns(state: State<'_, Arc<DesktopState>>) -> Result<serde_json::Value,String> {
    unlocked(&state).await?;
 let guard=state.connection.lock().await;
 let connection=guard.as_ref().ok_or("Veuillez vous connecter")?;
 let response=connection.client.get(format!("{}/api/supplier/desktop/returns",connection.origin))
    .send().await.map_err(connection_error)?;
 if !response.status().is_success(){return Err(format!("Retours indisponibles (HTTP {})",response.status().as_u16()));}
 response.json().await.map_err(|_| "Réponse retours invalide".to_string())
}

#[tauri::command]
async fn supplier_return_create(
    state: State<'_, Arc<DesktopState>>,
    request: serde_json::Value,
) -> Result<serde_json::Value,String> {
    unlocked(&state).await?;
    let guard=state.connection.lock().await;
    let connection=guard.as_ref().ok_or("Veuillez vous connecter")?;
    let response=connection.client.post(format!("{}/api/supplier/desktop/returns/create",connection.origin))
        .json(&request).send().await.map_err(|_| "Réseau interrompu : vérifiez les avoirs avant de recommencer".to_string())?;
    let status=response.status();
    let value:serde_json::Value=response.json().await.map_err(|_| "Réponse invalide : vérifiez les avoirs".to_string())?;
    if !status.is_success(){return Err(value.get("error").and_then(|x|x.as_str()).unwrap_or("Retour refusé").to_string())}
    Ok(value)
}

#[tauri::command]
async fn supplier_checkout(
    state: State<'_, Arc<DesktopState>>,
    sale: serde_json::Value,
) -> Result<serde_json::Value, String> {
    unlocked(&state).await?;
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Connectez-vous à FIXI Supplier")?;
    let response=session.client.post(format!("{}/api/supplier/desktop/sales",session.origin))
        .json(&sale).send().await
        .map_err(|_| "Connexion interrompue : vérifiez la vente dans l'historique avant de réessayer".to_string())?;
    let status=response.status();
    if status==reqwest::StatusCode::NOT_FOUND {
        return Err("API Windows ventes absente sur FIXI Cloud (HTTP 404). Aucune confirmation de vente reçue. Mise à jour du serveur requise.".into());
    }
    if status==reqwest::StatusCode::FORBIDDEN {
        return Err("Ventes Windows désactivées ou accès refusé sur FIXI Cloud (HTTP 403).".into());
    }
    if status==reqwest::StatusCode::UNAUTHORIZED {
        return Err("Session fournisseur expirée (HTTP 401) : reconnectez-vous.".into());
    }
    if status.is_server_error(){
        return Err(format!("Serveur FIXI en erreur (HTTP {}). Vérifiez l’historique avant de retenter.",status.as_u16()));
    }
    let result:serde_json::Value=response.json().await.map_err(|_| {
      if status.is_success(){"Vente potentiellement enregistrée, mais réponse invalide : vérifiez l'historique.".to_string()}
      else{format!("Vente refusée : réponse non JSON (HTTP {}).",status.as_u16())}
    })?;
    if !status.is_success(){
        return Err(format!("Vente refusée (HTTP {}) : {}",status.as_u16(),result.get("error").and_then(|v|v.as_str()).unwrap_or("Erreur inconnue")));
    }
    Ok(result)
}

#[tauri::command]
async fn supplier_cash_action(
    state: State<'_, Arc<DesktopState>>,
    operation: serde_json::Value,
) -> Result<serde_json::Value, String> {
    unlocked(&state).await?;
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
    *state.pin.lock().await=None;
    let connection = state.connection.lock().await.take();
    if let Some(s) = connection {
        let _ = s.client.post(format!("{}/api/supplier/auth/logout",s.origin)).send().await;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(DesktopState{connection:Mutex::new(None),pin:Mutex::new(None)}))
        .invoke_handler(tauri::generate_handler![supplier_login,supplier_refresh,supplier_logout,supplier_checkout,supplier_history,supplier_cash_action,supplier_orders,supplier_order_transition,supplier_debts,supplier_debt_payment,supplier_returns,supplier_return_create,pin_setup,pin_lock,pin_unlock])
        .run(tauri::generate_context!())
        .expect("error while running FIXI Caisse Windows");
}

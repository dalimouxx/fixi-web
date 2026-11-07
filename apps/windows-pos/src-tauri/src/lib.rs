use std::sync::Arc;
use std::time::{Duration, Instant};
use argon2::{Argon2, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{SaltString, PasswordHash, rand_core::OsRng};
use tauri::State;
use tokio::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
mod device_auth;
use device_auth::{SavedDevice, list_profiles, find_profile, read_profile, write_profile, save_attempts, remove_profile, read_trust, write_trust, forget_trust};
mod hardware;
mod updater;
mod atelier;

struct Connection {
    origin: String,
    client: reqwest::Client,
    login: String,
    password: String,
    authenticated_with_password: bool,
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
async fn pin_setup(state: State<'_, Arc<DesktopState>>, pin: String, name: Option<String>) -> Result<(),String> {
 unlocked(&state).await?;
 let credentials={let guard=state.connection.lock().await;let connection=guard.as_ref().ok_or("Connectez-vous d’abord avec votre compte fournisseur")?;if !connection.authenticated_with_password{return Err("Reconnectez-vous avec votre mot de passe pour modifier le PIN".into());}(connection.origin.clone(),connection.login.clone(),connection.password.clone())};
 if pin.len()!=4 || !pin.bytes().all(|b|b.is_ascii_digit()){return Err("Le PIN doit contenir exactement 4 chiffres".into());}
 let salt=SaltString::generate(&mut OsRng);
 let hash=Argon2::default().hash_password(pin.as_bytes(), &salt).map_err(|_|"PIN indisponible")?.to_string();
 let display=name.unwrap_or_default().chars().take(60).collect::<String>();
 let mut g=state.pin.lock().await;
 write_profile(&SavedDevice{origin:credentials.0,login:credentials.1,password:credentials.2,pin_hash:hash.clone(),failed:0,blocked_until:0,name:display})?;
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


fn now_epoch() -> u64 {
 SystemTime::now().duration_since(UNIX_EPOCH).map(|duration|duration.as_secs()).unwrap_or(0)
}

#[tauri::command]
async fn supplier_saved_profile() -> Result<serde_json::Value,String> {
 let list=list_profiles()?;
 let profiles:Vec<serde_json::Value>=list.iter().map(|p|serde_json::json!({"login":p.login,"name":if p.name.is_empty(){p.login.clone()}else{p.name.clone()},"server":p.origin})).collect();
 match list.first() {
  Some(first)=>Ok(serde_json::json!({"configured":true,"server":first.origin,"login":first.login,"profiles":profiles})),
  None=>Ok(serde_json::json!({"configured":false,"profiles":[]})),
 }
}

/// Ouvre la caisse avec le code PIN d'un caissier enregistré (le dernier utilisé si aucun n'est choisi).
#[tauri::command]
async fn supplier_pin_login(state: State<'_, Arc<DesktopState>>, pin: String, login: Option<String>, totp: Option<String>) -> Result<serde_json::Value,String> {
 if pin.len()!=4 || !pin.bytes().all(|c|c.is_ascii_digit()){return Err("Saisissez les 4 chiffres du PIN".into());}
 let mut device=find_profile(login.as_deref())?.ok_or("Aucun caissier enregistré sur ce PC")?;
 if device.blocked_until>now_epoch(){return Err("PIN temporairement bloqué. Réessayez après une minute.".into());}
 let hash=PasswordHash::new(&device.pin_hash).map_err(|_|"PIN du profil illisible")?;
 if Argon2::default().verify_password(pin.as_bytes(),&hash).is_err(){
   device.failed+=1;
   if device.failed>=5{device.failed=0;device.blocked_until=now_epoch()+60;}
   save_attempts(&device)?;
   return Err("Code PIN incorrect".into())
 }
 device.failed=0;device.blocked_until=0;write_profile(&device)?;
 let shared=state.inner().clone();
 let pin_hash=device.pin_hash.clone();
 let data=supplier_login(state,device.origin,device.login,device.password,totp).await?;
 *shared.pin.lock().await=Some(PinLock{hash:pin_hash,locked:false,failed:0,blocked_until:None});
 if let Some(connection)=shared.connection.lock().await.as_mut(){connection.authenticated_with_password=false;}
 Ok(data)
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
    totp: Option<String>,
) -> Result<serde_json::Value, String> {
    let origin = validate_origin(&server)?;
    let login_key = login.trim().to_lowercase();
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
    let mut body = serde_json::json!({"login":login,"password":password});
    if let Some(t) = totp.as_ref().map(|t| t.trim().to_string()).filter(|t| t.len()==6 && t.bytes().all(|c|c.is_ascii_digit())) { body["totp"] = serde_json::json!(t); }
    if let Some(trust) = read_trust(&origin, &login_key) { body["trust"] = serde_json::json!(trust); }
    let response = client.post(format!("{origin}/api/supplier/auth/login"))
        .json(&body)
        .send().await.map_err(connection_error)?;
    let status = response.status();
    let reply: serde_json::Value = response.json().await.unwrap_or(serde_json::Value::Null);
    // Double vérification : le préfixe CODE_2FA_REQUIS permet à l'écran d'afficher la case du code.
    if reply.get("needsTotp").and_then(|v| v.as_bool()) == Some(true) {
        forget_trust(&origin, &login_key);
        let reason = reply.get("error").and_then(|v| v.as_str()).unwrap_or("Code de vérification requis");
        return Err(format!("CODE_2FA_REQUIS: {reason}"));
    }
    if let Some(token) = reply.get("trustToken").and_then(|v| v.as_str()) { write_trust(&origin, &login_key, token); }
    if !status.is_success() {
        return Err(match status.as_u16() {
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
    let mut data: serde_json::Value = response.json().await.map_err(|_| "Réponse serveur invalide".to_string())?;
    let saved=read_profile(&origin,&login.trim().to_lowercase()).ok().flatten();
    let pin_configured=saved.is_some();
    *state.connection.lock().await = Some(Connection{origin,client,login:login.trim().to_lowercase(),password,authenticated_with_password:true});
    *state.pin.lock().await=saved.map(|p|PinLock{hash:p.pin_hash,locked:false,failed:0,blocked_until:None});
    if let Some(map)=data.as_object_mut(){map.insert("pinConfigured".to_string(),serde_json::Value::Bool(pin_configured));}
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
    let response=session.client.patch(format!("{}/api/supplier/orders/{}",session.origin,order_id))
        .json(&serde_json::json!({"status":status}))
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
 let response=session.client.post(format!("{}/api/supplier/desktop/v4/debt-payment",session.origin)).json(&payment).send().await.map_err(connection_error)?;
 let code=response.status();
 if code==reqwest::StatusCode::NOT_FOUND{return Err("API des règlements Windows absente du serveur (HTTP 404). Aucun paiement confirmé.".into())}
 if !code.is_success(){
   let detail:serde_json::Value=response.json().await.unwrap_or(serde_json::Value::Null);
   return Err(format!("Règlement refusé (HTTP {}) : {}",code.as_u16(),detail.get("error").and_then(|x|x.as_str()).unwrap_or("Accès refusé ou erreur métier")));
 }
 let value:serde_json::Value=response.json().await.map_err(|_| "Réponse paiement invalide après succès HTTP : vérifiez le journal".to_string())?;
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
    let response=connection.client.post(format!("{}/api/supplier/desktop/v4/returns",connection.origin))
        .json(&request).send().await.map_err(|_| "Réseau interrompu : vérifiez les avoirs avant de recommencer".to_string())?;
    let status=response.status();
    if status==reqwest::StatusCode::NOT_FOUND{return Err("API de retour Windows absente du serveur (HTTP 404). Aucun retour confirmé.".into())}
    if !status.is_success(){
       let detail:serde_json::Value=response.json().await.unwrap_or(serde_json::Value::Null);
       return Err(format!("Retour refusé (HTTP {}) : {}",status.as_u16(),detail.get("error").and_then(|x|x.as_str()).unwrap_or("Accès refusé ou erreur métier")));
    }
    let value:serde_json::Value=response.json().await.map_err(|_| "Réponse invalide après succès HTTP : vérifiez les avoirs".to_string())?;
    Ok(value)
}

#[tauri::command]
async fn supplier_operation_status(state: State<'_, Arc<DesktopState>>, kind: String, reference: String) -> Result<serde_json::Value,String> {
    unlocked(&state).await?;
    if !["sale","debt","return"].contains(&kind.as_str()) || reference.len()>70 || !reference.chars().all(|c|c.is_ascii_alphanumeric()||c=='-') {
      return Err("Référence d’opération invalide".into())
    }
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Veuillez vous connecter")?;
    let address=format!("{}/api/supplier/desktop/operations?kind={}&reference={}",session.origin,kind,reference);
    let response=session.client.get(address).send().await.map_err(connection_error)?;
    if !response.status().is_success(){return Err(format!("Vérification des opérations indisponible (HTTP {})",response.status().as_u16()))}
    response.json().await.map_err(|_|"Réponse de vérification invalide".to_string())
}


async fn v4_request(
 state: &State<'_,Arc<DesktopState>>,
 path: &str,
 body: Option<serde_json::Value>,
) -> Result<serde_json::Value,String>{
 unlocked(state).await?;
 let guard=state.connection.lock().await;
 let session=guard.as_ref().ok_or("Connectez-vous à FIXI Supplier")?;
 let url=format!("{}{}",session.origin,path);
 let request=if let Some(payload)=body{session.client.post(url).json(&payload)}else{session.client.get(url)};
 let response=request.send().await.map_err(connection_error)?;
 let code=response.status();
 let result:serde_json::Value=response.json().await.map_err(|_|format!("Réponse non JSON du serveur (HTTP {}).",code.as_u16()))?;
 if !code.is_success(){
  let reason=result.get("error").and_then(|v|v.as_str()).unwrap_or("Opération refusée");
  return Err(format!("{} (HTTP {})",reason,code.as_u16()))
 }
 Ok(result)
}

#[tauri::command]
async fn supplier_find_tickets(state: State<'_,Arc<DesktopState>>, query:String, from:String, to:String) -> Result<serde_json::Value,String>{
 if query.len()>100||from.len()>10||to.len()>10{return Err("Critères de recherche trop longs".into())}
 // Keep the non-Send URL serializer entirely outside the awaited future.
 let encoded_query={
  let mut params=url::form_urlencoded::Serializer::new(String::new());
  if !query.is_empty(){params.append_pair("q",&query);}
  if !from.is_empty(){params.append_pair("from",&from);}
  if !to.is_empty(){params.append_pair("to",&to);}
  params.finish()
 };
 let path=format!("/api/supplier/desktop/v4/tickets?{}",encoded_query);
 v4_request(&state,&path,None).await
}

#[tauri::command]
async fn supplier_return_source(state: State<'_,Arc<DesktopState>>, reference:String) -> Result<serde_json::Value,String>{
 if reference.len()>100||reference.is_empty(){return Err("Référence invalide".into())}
 // The form serializer is !Send, so finish and drop it before .await.
 let encoded_reference={
  let mut params=url::form_urlencoded::Serializer::new(String::new());
  params.append_pair("reference",&reference);
  params.finish()
 };
 let path=format!("/api/supplier/desktop/v4/returns-source?{}",encoded_reference);
 v4_request(&state,&path,None).await
}

#[tauri::command]
async fn supplier_customer_debts(state: State<'_,Arc<DesktopState>>) -> Result<serde_json::Value,String>{
 v4_request(&state,"/api/supplier/desktop/v4/customer-debts",None).await
}

#[tauri::command]
async fn supplier_customer_payment(state: State<'_,Arc<DesktopState>>, payment:serde_json::Value) -> Result<serde_json::Value,String>{
 v4_request(&state,"/api/supplier/desktop/v4/customer-debts",Some(payment)).await
}

#[tauri::command]
async fn supplier_create_customer(state: State<'_,Arc<DesktopState>>, customer:serde_json::Value) -> Result<serde_json::Value,String>{
 let mut customer=customer;
 let record=customer.as_object_mut().ok_or("Client invalide")?;
 record.insert("action".into(),serde_json::json!("CUSTOMER"));
 v4_request(&state,"/api/supplier/erp",Some(customer)).await
}

#[tauri::command]
async fn supplier_delivery_shifts(state: State<'_,Arc<DesktopState>>) -> Result<serde_json::Value,String>{
 v4_request(&state,"/api/supplier/delivery/settlements",None).await
}

#[tauri::command]
async fn supplier_delivery_close(state: State<'_,Arc<DesktopState>>, closure:serde_json::Value) -> Result<serde_json::Value,String>{
 v4_request(&state,"/api/supplier/delivery/settlements",Some(closure)).await
}


#[tauri::command]
async fn supplier_invoice(state: State<'_,Arc<DesktopState>>, request:serde_json::Value) -> Result<serde_json::Value,String>{
 v4_request(&state,"/api/supplier/desktop/v4/invoice",Some(request)).await
}

#[tauri::command]
async fn supplier_update_customer(state: State<'_,Arc<DesktopState>>, customer:serde_json::Value) -> Result<serde_json::Value,String>{
 let mut customer=customer;
 let record=customer.as_object_mut().ok_or("Client invalide")?;
 record.insert("action".into(),serde_json::json!("CUSTOMER_UPDATE"));
 v4_request(&state,"/api/supplier/erp",Some(customer)).await
}

/// Création d'un produit depuis la caisse (gérant / stock) : le serveur vérifie le rôle et complète SKU, catégorie, marque.
#[tauri::command]
async fn supplier_create_product(state: State<'_,Arc<DesktopState>>, product:serde_json::Value) -> Result<serde_json::Value,String>{
 let o=product.as_object().ok_or("Produit invalide")?;
 let name=o.get("name").and_then(|v|v.as_str()).unwrap_or("").trim();
 if name.chars().count()<2||name.chars().count()>160{return Err("Nom du produit requis".into())}
 let mut clean=serde_json::Map::new();
 for k in ["name","barcode","price","stock","purchasePrice","category","brand","qualityGrade","wholesalePrice","minStock","location"]{
  if let Some(v)=o.get(k){clean.insert(k.into(),v.clone());}
 }
 v4_request(&state,"/api/supplier/products",Some(serde_json::Value::Object(clean))).await
}

/// Code-barres inconnu : suggestion du réseau Fixi (nom, catégorie, marque) avant création.
#[tauri::command]
async fn supplier_lookup_barcode(state: State<'_,Arc<DesktopState>>, barcode:String) -> Result<serde_json::Value,String>{
 let b=barcode.trim();
 if b.len()<3||b.len()>64||!b.chars().all(|c|c.is_ascii_alphanumeric()||c=='-'||c=='.'||c=='_'){return Err("Code-barres invalide".into())}
 v4_request(&state,&format!("/api/supplier/products/lookup?barcode={}",b),None).await
}

/// Inventaire au scanner : seules les actions de comptage sont relayées.
#[tauri::command]
async fn supplier_stock_count(state: State<'_,Arc<DesktopState>>, request:serde_json::Value) -> Result<serde_json::Value,String>{
 let action=request.get("action").and_then(|v|v.as_str()).unwrap_or("");
 if !["STOCK_COUNT_START","STOCK_COUNT_ITEM","STOCK_COUNT_CLOSE"].contains(&action){return Err("Action d’inventaire refusée".into())}
 v4_request(&state,"/api/supplier/advanced",Some(request)).await
}

/// Entrée de stock au scanner : coûts d'achat (gérant) puis validation. Seuls ces champs sont relayés.
#[tauri::command]
async fn supplier_stock_in_costs(state: State<'_,Arc<DesktopState>>) -> Result<serde_json::Value,String>{
 v4_request(&state,"/api/supplier/stock-in",None).await
}

#[tauri::command]
async fn supplier_stock_in(state: State<'_,Arc<DesktopState>>, request:serde_json::Value) -> Result<serde_json::Value,String>{
 let items=request.get("items").and_then(|v|v.as_array()).ok_or("Aucun article")?;
 if items.is_empty()||items.len()>300{return Err("Entrée de stock invalide".into())}
 let mut clean=Vec::new();
 for it in items{
  let id=it.get("productId").and_then(|v|v.as_str()).unwrap_or("");
  let q=it.get("quantity").and_then(|v|v.as_i64()).unwrap_or(0);
  if id.is_empty()||id.len()>40||q<=0||q>100000{return Err("Ligne d’entrée invalide".into())}
  clean.push(serde_json::json!({"productId":id,"quantity":q,"unitCost":it.get("unitCost").cloned().unwrap_or(serde_json::Value::Null)}));
 }
 let text=|k:&str,max:usize|request.get(k).and_then(|v|v.as_str()).map(|v|v.chars().take(max).collect::<String>()).unwrap_or_default();
 v4_request(&state,"/api/supplier/stock-in",Some(serde_json::json!({"items":clean,"source":text("source",120),"reference":text("reference",60)}))).await
}

#[tauri::command]
async fn supplier_open_stock_counts(state: State<'_,Arc<DesktopState>>) -> Result<serde_json::Value,String>{
 let data=v4_request(&state,"/api/supplier/advanced",None).await?;
 let open:Vec<serde_json::Value>=data.get("counts").and_then(|c|c.as_array()).map(|a|a.iter().filter(|c|c.get("status").and_then(|s|s.as_str())==Some("OPEN")).cloned().collect()).unwrap_or_default();
 Ok(serde_json::json!({"counts":open}))
}

/// « Signaler un problème » depuis la caisse : arrive dans l'admin Fixi avec la version de l'application.
#[tauri::command]
async fn supplier_report_problem(app: tauri::AppHandle, state: State<'_,Arc<DesktopState>>, report:serde_json::Value) -> Result<serde_json::Value,String>{
 let mut report=report;
 let record=report.as_object_mut().ok_or("Signalement invalide")?;
 record.insert("appVersion".into(),serde_json::json!(app.package_info().version.to_string()));
 record.insert("space".into(),serde_json::json!("supplier"));
 let guard=state.connection.lock().await;
 let session=guard.as_ref().ok_or("Connectez-vous à FIXI Supplier")?;
 let response=session.client.post(format!("{}/api/problem-report",session.origin)).header("x-fixi-client","windows").json(&report).send().await.map_err(connection_error)?;
 let code=response.status();
 let value:serde_json::Value=response.json().await.unwrap_or(serde_json::Value::Null);
 if !code.is_success(){return Err(value.get("error").and_then(|v|v.as_str()).unwrap_or("Envoi impossible").to_string())}
 Ok(value)
}

#[tauri::command]
async fn supplier_checkout(
    state: State<'_, Arc<DesktopState>>,
    mut sale: serde_json::Value,
) -> Result<serde_json::Value, String> {
    unlocked(&state).await?;
    let obj=sale.as_object_mut().ok_or("Panier de caisse invalide")?;
    obj.insert("action".into(),serde_json::json!("SALE"));
    let guard=state.connection.lock().await;
    let session=guard.as_ref().ok_or("Connectez-vous à FIXI Supplier")?;
    let response=session.client.post(format!("{}/api/supplier/erp",session.origin))
        .json(&sale).send().await
        .map_err(|_| "Connexion interrompue : vérifiez la vente dans l'historique avant de réessayer".to_string())?;
    let status=response.status();
    if status==reqwest::StatusCode::NOT_FOUND {
        return Err("API FIXI Supplier ERP indisponible (HTTP 404). Vérifiez l'adresse du serveur.".into());
    }
    if status==reqwest::StatusCode::FORBIDDEN {
        let detail:serde_json::Value=response.json().await.unwrap_or(serde_json::Value::Null);
        return Err(format!("Vente refusée (HTTP 403) : {}",detail.get("error").and_then(|x|x.as_str()).unwrap_or("Accès refusé ou fonctionnalité non activée")));
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
    let response=session.client.post(format!("{}/api/supplier/erp",session.origin))
        .json(&operation).send().await
        .map_err(|_| "Réseau interrompu : vérifiez la session sur FIXI Web avant de retenter".to_string())?;
    let code=response.status();
    let result:serde_json::Value=response.json().await.map_err(|_| "Réponse caisse invalide".to_string())?;
    if !code.is_success() {
        return Err(result.get("error").and_then(|v|v.as_str()).unwrap_or("Opération de caisse refusée").to_string());
    }
    Ok(result)
}

/// Retire le caissier connecté de ce PC (les autres caissiers restent enregistrés).
#[tauri::command]
async fn supplier_logout(state: State<'_, Arc<DesktopState>>) -> Result<(), String> {
    let connection = state.connection.lock().await.take();
    if let Some(s) = &connection { remove_profile(&s.origin,&s.login)?; }
    *state.pin.lock().await=None;
    if let Some(s) = connection {
        let _ = s.client.post(format!("{}/api/supplier/auth/logout",s.origin)).send().await;
    }
    Ok(())
}

/// Change de caissier sans effacer son profil (retour à l'écran des caissiers).
#[tauri::command]
async fn supplier_switch_user(state: State<'_, Arc<DesktopState>>) -> Result<(), String> {
    *state.pin.lock().await=None;
    let connection = state.connection.lock().await.take();
    if let Some(s) = connection {
        let _ = s.client.post(format!("{}/api/supplier/auth/logout",s.origin)).send().await;
    }
    Ok(())
}

#[tauri::command]
async fn supplier_cash_summary(state: State<'_,Arc<DesktopState>>, session: Option<String>) -> Result<serde_json::Value,String>{
 let id=session.unwrap_or_default();
 if id.len()>40 || !id.chars().all(|c|c.is_ascii_alphanumeric()){return Err("Session invalide".into())}
 let path=if id.is_empty(){"/api/supplier/desktop/v4/cash-summary".to_string()}else{format!("/api/supplier/desktop/v4/cash-summary?session={}",id)};
 v4_request(&state,&path,None).await
}

#[tauri::command]
fn app_version(app: tauri::AppHandle) -> String { app.package_info().version.to_string() }

/// Ouvre WhatsApp (ou la page de téléchargement) dans le navigateur par défaut — uniquement des adresses sûres.
#[tauri::command]
fn open_external(url: String) -> Result<(),String> {
 let allowed=["https://wa.me/","https://api.whatsapp.com/","https://github.com/dalimouxx/fixi-web/releases/"];
 if url.len()>4000 || !allowed.iter().any(|p|url.starts_with(p)) || url.chars().any(|c|c=='"'||c.is_control()) {return Err("Lien non autorisé".into())}
 hardware::open_url(&url)
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(DesktopState{connection:Mutex::new(None),pin:Mutex::new(None)}))
        .manage(Arc::new(atelier::AtelierState::new()))
        .invoke_handler(tauri::generate_handler![supplier_stock_in_costs,supplier_stock_in,supplier_login,supplier_refresh,supplier_logout,supplier_checkout,supplier_history,supplier_cash_action,supplier_orders,supplier_order_transition,supplier_debts,supplier_debt_payment,supplier_returns,supplier_return_create,pin_setup,pin_lock,pin_unlock,supplier_saved_profile,supplier_pin_login,supplier_operation_status,supplier_find_tickets,supplier_return_source,supplier_customer_debts,supplier_customer_payment,supplier_create_customer,supplier_delivery_shifts,supplier_delivery_close,supplier_switch_user,supplier_cash_summary,app_version,open_external,hardware::list_printers,hardware::cash_drawer_open,hardware::open_customer_display,hardware::close_customer_display,updater::check_update,updater::install_update,supplier_invoice,supplier_update_customer,supplier_stock_count,supplier_open_stock_counts,supplier_report_problem,supplier_create_product,supplier_lookup_barcode,atelier::atelier_options,atelier::atelier_login,atelier::atelier_request,atelier::atelier_logout])
        .run(tauri::generate_context!())
        .expect("error while running FIXI Caisse Windows");
}

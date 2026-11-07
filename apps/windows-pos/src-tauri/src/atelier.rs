//! Mode atelier (Fixi Pro) : connexion boutique + profil + PIN 6 chiffres, puis appels limités aux écrans
//! de comptoir (réception, à rendre, encaissement, vente comptoir et retours, fin de journée). Session séparée de la caisse fournisseur.
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct AtelierConn { pub origin: String, pub client: reqwest::Client }
pub struct AtelierState { pub conn: Mutex<Option<AtelierConn>> }
impl AtelierState { pub fn new() -> Self { Self { conn: Mutex::new(None) } } }

fn origin_ok(raw: &str) -> Result<String, String> {
    let u = url::Url::parse(raw.trim()).map_err(|_| "Adresse du serveur invalide".to_string())?;
    if u.scheme() != "https" || u.host_str().is_none() || !u.username().is_empty() || u.password().is_some() || u.query().is_some() || u.fragment().is_some() {
        return Err("Adresse du serveur invalide (https requis)".into());
    }
    Ok(u.origin().ascii_serialization())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().cookie_store(true).redirect(reqwest::redirect::Policy::none())
        .connect_timeout(std::time::Duration::from_secs(20)).timeout(std::time::Duration::from_secs(60))
        .build().map_err(|_| "Impossible de préparer la connexion".to_string())
}

/// Chemins autorisés depuis la caisse atelier (rien d'autre ne peut être appelé).
fn allowed(method: &str, path: &str) -> bool {
    let p = path.split('?').next().unwrap_or("");
    let seg: Vec<&str> = p.trim_start_matches('/').split('/').collect();
    let id_ok = |s: &str| !s.is_empty() && s.len() <= 40 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    let q_ok = path.len() <= 300 && !path.contains("..") && !path.contains('#');
    q_ok && match (method, seg.as_slice()) {
        ("GET", ["api", "repairs"]) | ("POST", ["api", "repairs"]) => true,
        ("PATCH", ["api", "repairs", code, "status"]) => id_ok(code),
        ("GET", ["api", "cashier", "overview"]) | ("POST", ["api", "cashier", "checkout"]) => true,
        ("GET", ["api", "connect", "access"]) | ("GET", ["api", "dashboard"]) => true,
        // Vente comptoir (accessoires) et retours client.
        ("GET", ["api", "counter-sales"]) | ("POST", ["api", "counter-sales"]) => true,
        ("GET", ["api", "counter-sales", id]) => id_ok(id),
        ("POST", ["api", "counter-sales", id, "refund"]) => id_ok(id),
        // Entrée de stock (gérant) : liste des articles, création d'un article, réception.
        ("GET", ["api", "stock"]) | ("POST", ["api", "stock"]) | ("POST", ["api", "purchases"]) => true,
        _ => false,
    }
}

fn reason(v: &serde_json::Value, code: u16) -> String {
    let r = v.get("error").and_then(|x| x.as_str()).unwrap_or("Opération refusée");
    if r == "MODULE_PREMIUM_REQUIS" { return "PRO_REQUIS: la caisse atelier fait partie de Fixi Pro".into(); }
    format!("{} (HTTP {})", r, code)
}

/// Régions, boutiques d'une région ou profils d'une boutique (écran de connexion).
#[tauri::command]
pub async fn atelier_options(server: String, region: Option<String>, shop: Option<String>) -> Result<serde_json::Value, String> {
    let origin = origin_ok(&server)?;
    let mut url = url::Url::parse(&format!("{origin}/api/public/login-options")).map_err(|_| "URL invalide")?;
    if let Some(s) = shop.filter(|s| !s.is_empty()) { url.query_pairs_mut().append_pair("shop", &s); }
    else if let Some(r) = region.filter(|r| !r.is_empty()) { url.query_pairs_mut().append_pair("region", &r); }
    let r = client()?.get(url).send().await.map_err(|e| format!("Connexion impossible : {e}"))?;
    let code = r.status().as_u16();
    let v: serde_json::Value = r.json().await.map_err(|_| "Réponse serveur invalide".to_string())?;
    if code >= 400 { return Err(reason(&v, code)); }
    Ok(v)
}

#[tauri::command]
pub async fn atelier_login(state: State<'_, Arc<AtelierState>>, server: String, shop_slug: String, user_id: String, pin: String) -> Result<serde_json::Value, String> {
    if pin.len() != 6 || !pin.bytes().all(|c| c.is_ascii_digit()) { return Err("Le code PIN contient 6 chiffres".into()); }
    let origin = origin_ok(&server)?;
    let c = client()?;
    let r = c.post(format!("{origin}/api/auth/login")).json(&serde_json::json!({"shopSlug": shop_slug, "userId": user_id, "pin": pin})).send().await.map_err(|e| format!("Connexion impossible : {e}"))?;
    let code = r.status().as_u16();
    let v: serde_json::Value = r.json().await.map_err(|_| "Réponse serveur invalide".to_string())?;
    if code >= 400 { return Err(reason(&v, code)); }
    *state.conn.lock().await = Some(AtelierConn { origin, client: c });
    Ok(v)
}

#[tauri::command]
pub async fn atelier_request(state: State<'_, Arc<AtelierState>>, method: String, path: String, body: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    let m = method.to_uppercase();
    if !allowed(&m, &path) { return Err("Action non autorisée depuis la caisse atelier".into()); }
    let guard = state.conn.lock().await;
    let conn = guard.as_ref().ok_or("Connectez-vous à votre atelier")?;
    let url = format!("{}{}", conn.origin, path);
    let req = match m.as_str() { "POST" => conn.client.post(url), "PATCH" => conn.client.patch(url), _ => conn.client.get(url) };
    let req = if let Some(b) = body { req.json(&b) } else { req };
    let r = req.send().await.map_err(|e| format!("Erreur réseau : {e}"))?;
    let code = r.status().as_u16();
    let v: serde_json::Value = r.json().await.unwrap_or(serde_json::Value::Null);
    if code == 401 { return Err("SESSION_EXPIREE: reconnectez-vous".into()); }
    if code >= 400 { return Err(reason(&v, code)); }
    Ok(v)
}

#[tauri::command]
pub async fn atelier_logout(state: State<'_, Arc<AtelierState>>) -> Result<(), String> {
    if let Some(c) = state.conn.lock().await.take() { let _ = c.client.post(format!("{}/api/auth/logout", c.origin)).send().await; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::allowed;
    #[test]
    fn allowlist() {
        assert!(allowed("GET", "/api/repairs?q=F-12"));
        assert!(allowed("PATCH", "/api/repairs/F-2614532/status"));
        assert!(allowed("POST", "/api/cashier/checkout"));
        assert!(!allowed("DELETE", "/api/repairs"));
        assert!(!allowed("GET", "/api/users"));
        assert!(!allowed("PATCH", "/api/repairs/../users/status"));
        assert!(allowed("GET", "/api/counter-sales?q=coque"));
        assert!(allowed("POST", "/api/counter-sales"));
        assert!(allowed("GET", "/api/counter-sales/V-000042"));
        assert!(allowed("POST", "/api/counter-sales/V-000042/refund"));
        assert!(!allowed("DELETE", "/api/counter-sales/V-000042"));
        assert!(!allowed("POST", "/api/counter-sales/V-000042/delete"));
        assert!(!allowed("GET", "/api/counter-sales/../users"));
        assert!(allowed("GET", "/api/stock?q=0000A04"));
        assert!(allowed("POST", "/api/purchases"));
        assert!(allowed("POST", "/api/stock"));
        assert!(!allowed("DELETE", "/api/stock"));
        assert!(!allowed("PATCH", "/api/stock/x"));
        assert!(!allowed("GET", "/api/purchases"));
    }
}

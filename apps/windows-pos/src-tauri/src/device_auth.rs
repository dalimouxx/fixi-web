use serde::{Deserialize, Serialize};

const SERVICE: &str = "FIXI Caisse Windows";
const LEGACY_ACCOUNT: &str = "supplier-session-v1";
const INDEX_ACCOUNT: &str = "supplier-profiles-index-v2";
pub const MAX_PROFILES: usize = 8;

/// Un caissier enregistré sur ce PC : ses identifiants FIXI restent dans le coffre-fort Windows,
/// seul le hachage Argon2 de son code PIN sert à l'ouvrir.
#[derive(Clone, Serialize, Deserialize)]
pub struct SavedDevice {
    pub origin: String,
    pub login: String,
    pub password: String,
    pub pin_hash: String,
    #[serde(default)]
    pub failed: u32,
    #[serde(default)]
    pub blocked_until: u64,
    #[serde(default)]
    pub name: String,
}

/// Index léger (sans secret) : une entrée du coffre-fort par caissier, car un seul secret Windows est limité à 2,5 Ko.
#[derive(Clone, Serialize, Deserialize)]
pub struct ProfileRef {
    pub origin: String,
    pub login: String,
    #[serde(default)]
    pub name: String,
}

fn entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, account).map_err(|_| "Windows Credential Manager indisponible".to_string())
}
fn profile_account(origin: &str, login: &str) -> String {
    format!("supplier-profile-v2:{}|{}", origin, login)
}
fn read_json<T: for<'a> Deserialize<'a>>(account: &str) -> Result<Option<T>, String> {
    match entry(account)?.get_password() {
        Ok(content) => serde_json::from_str::<T>(&content).map(Some)
            .map_err(|_| "Identifiants Windows illisibles : reconnectez-vous avec le compte fournisseur".to_string()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Impossible de lire la connexion protégée Windows".into()),
    }
}
fn write_json<T: Serialize>(account: &str, value: &T) -> Result<(), String> {
    let payload = serde_json::to_string(value).map_err(|_| "Erreur de sauvegarde du profil".to_string())?;
    entry(account)?.set_password(&payload).map_err(|_| "Impossible d'enregistrer les identifiants dans le coffre-fort Windows".to_string())
}
fn delete(account: &str) -> Result<(), String> {
    match entry(account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Impossible d'effacer la connexion enregistrée".into()),
    }
}

fn write_index(list: &[ProfileRef]) -> Result<(), String> {
    if list.is_empty() { return delete(INDEX_ACCOUNT); }
    write_json(INDEX_ACCOUNT, &list.to_vec())
}

/// Liste des caissiers, le dernier utilisé en premier. Migre automatiquement l'ancien profil unique (V4).
pub fn list_profiles() -> Result<Vec<ProfileRef>, String> {
    if let Some(list) = read_json::<Vec<ProfileRef>>(INDEX_ACCOUNT)? { return Ok(list); }
    if let Some(old) = read_json::<SavedDevice>(LEGACY_ACCOUNT)? {
        write_json(&profile_account(&old.origin, &old.login), &old)?;
        let list = vec![ProfileRef { origin: old.origin.clone(), login: old.login.clone(), name: old.name.clone() }];
        write_index(&list)?;
        let _ = delete(LEGACY_ACCOUNT);
        return Ok(list);
    }
    Ok(vec![])
}

pub fn read_profile(origin: &str, login: &str) -> Result<Option<SavedDevice>, String> {
    read_json::<SavedDevice>(&profile_account(origin, login))
}

/// Premier caissier (le dernier utilisé) ou celui demandé par son identifiant.
pub fn find_profile(login: Option<&str>) -> Result<Option<SavedDevice>, String> {
    let list = list_profiles()?;
    let target = match login {
        Some(l) => list.iter().find(|p| p.login == l.trim().to_lowercase()),
        None => list.first(),
    };
    match target { Some(p) => read_profile(&p.origin, &p.login), None => Ok(None) }
}

pub fn write_profile(profile: &SavedDevice) -> Result<(), String> {
    let mut list = list_profiles()?;
    let exists = list.iter().any(|p| p.origin == profile.origin && p.login == profile.login);
    if !exists && list.len() >= MAX_PROFILES {
        return Err(format!("Maximum {} caissiers sur ce PC : retirez-en un d'abord", MAX_PROFILES));
    }
    write_json(&profile_account(&profile.origin, &profile.login), profile)?;
    list.retain(|p| !(p.origin == profile.origin && p.login == profile.login));
    list.insert(0, ProfileRef { origin: profile.origin.clone(), login: profile.login.clone(), name: profile.name.clone() });
    write_index(&list)
}

/// Met à jour les compteurs d'essais sans changer l'ordre des caissiers.
pub fn save_attempts(profile: &SavedDevice) -> Result<(), String> {
    write_json(&profile_account(&profile.origin, &profile.login), profile)
}

pub fn remove_profile(origin: &str, login: &str) -> Result<(), String> {
    delete(&profile_account(origin, login))?;
    let mut list = list_profiles()?;
    list.retain(|p| !(p.origin == origin && p.login == login));
    write_index(&list)
}

/// 17.5 — jeton « appareil de confiance » de la double vérification (30 jours), un par compte.
fn trust_account(origin: &str, login: &str) -> String { format!("supplier-trust-v1:{}|{}", origin, login) }
pub fn read_trust(origin: &str, login: &str) -> Option<String> {
    read_json::<String>(&trust_account(origin, login)).ok().flatten()
}
pub fn write_trust(origin: &str, login: &str, token: &str) {
    let _ = write_json(&trust_account(origin, login), &token.to_string());
}
pub fn forget_trust(origin: &str, login: &str) { let _ = delete(&trust_account(origin, login)); }

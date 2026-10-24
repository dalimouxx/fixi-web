use serde::{Deserialize, Serialize};

const SERVICE: &str = "FIXI Caisse Windows";
const ACCOUNT: &str = "supplier-session-v1";

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
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT)
        .map_err(|_| "Windows Credential Manager indisponible".to_string())
}

pub fn read_saved() -> Result<Option<SavedDevice>, String> {
    match entry()?.get_password() {
        Ok(content) => serde_json::from_str::<SavedDevice>(&content)
            .map(Some).map_err(|_| "Identifiants Windows illisibles : reconnectez-vous avec le compte fournisseur".to_string()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Impossible de lire la connexion protégée Windows".into()),
    }
}

pub fn write_saved(profile: &SavedDevice) -> Result<(), String> {
    let payload=serde_json::to_string(profile).map_err(|_| "Erreur de sauvegarde du profil".to_string())?;
    entry()?.set_password(&payload).map_err(|_| "Impossible d'enregistrer les identifiants dans le coffre-fort Windows".to_string())
}

pub fn clear_saved() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Impossible d'effacer la connexion enregistrée".into())
    }
}

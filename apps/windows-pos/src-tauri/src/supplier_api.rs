//! Caisse fournisseur : accès générique aux écrans de gestion (produits, achats, factures…),
//! limité à une liste fermée de chemins, méthodes et actions. Le serveur revérifie le rôle à chaque appel.

/// Actions ERP / stock avancé autorisées depuis la caisse (POST avec { action }).
const ERP_ACTIONS: &[&str] = &["PURCHASE", "PURCHASE_PAYMENT", "EXPENSE", "STOCK_ADJUST"];
const ADVANCED_ACTIONS: &[&str] = &["VENDOR", "WAREHOUSE", "PRICE_TIER", "WAREHOUSE_STOCK_SET", "WAREHOUSE_TRANSFER"];
const MASTER_ACTIONS: &[&str] = &["CATEGORY", "BRAND", "UNIT", "TOGGLE"];

fn id_ok(s: &str) -> bool {
    !s.is_empty() && s.len() <= 40 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Vrai si (méthode, chemin, action) fait partie des écrans de gestion de la caisse.
pub fn allowed(method: &str, path: &str, action: Option<&str>) -> bool {
    if path.len() > 400 || path.contains("..") || path.contains('#') || path.contains('\\') || !path.starts_with("/api/supplier/") { return false; }
    let p = path.split('?').next().unwrap_or("");
    let seg: Vec<&str> = p.trim_start_matches('/').split('/').collect();
    let act = action.unwrap_or("");
    match (method, seg.as_slice()) {
        ("GET" | "PATCH", ["api", "supplier", "permissions"]) => true,
        ("POST", ["api", "supplier", "approval"]) => true,
        ("GET", ["api", "supplier", "walk-in-suggestions"]) => true,
        ("GET" | "POST" | "PATCH", ["api", "supplier", "products"]) => true,
        ("PATCH" | "DELETE", ["api", "supplier", "products", id]) => id_ok(id),
        ("POST", ["api", "supplier", "products", "barcodes"]) => true,
        ("GET" | "POST" | "PATCH", ["api", "supplier", "promos"]) => true,
        ("GET", ["api", "supplier", "master-data"]) => true,
        ("POST", ["api", "supplier", "master-data"]) => MASTER_ACTIONS.contains(&act),
        ("GET", ["api", "supplier", "erp"]) => true,
        ("POST", ["api", "supplier", "erp"]) => ERP_ACTIONS.contains(&act),
        ("GET", ["api", "supplier", "advanced"]) => true,
        ("POST", ["api", "supplier", "advanced"]) => ADVANCED_ACTIONS.contains(&act),
        ("GET" | "POST" | "PATCH", ["api", "supplier", "documents"]) => true,
        ("POST", ["api", "supplier", "documents", id, "convert"]) => id_ok(id),
        ("GET", ["api", "supplier", "orders"]) => true,
        ("GET", ["api", "supplier", "drivers"]) => true,
        ("POST", ["api", "supplier", "delivery", "assign"]) => true,
        ("GET", ["api", "supplier", "reports"]) | ("GET", ["api", "supplier", "finance-overview"]) => true,
        ("GET" | "POST" | "PATCH", ["api", "supplier", "accounts"]) => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::allowed;
    #[test]
    fn allowlist() {
        assert!(allowed("GET", "/api/supplier/permissions", None));
        assert!(allowed("PATCH", "/api/supplier/products", None));
        assert!(allowed("DELETE", "/api/supplier/products/cmw69x04g00017dem3f8ar2zo", None));
        assert!(!allowed("DELETE", "/api/supplier/products/../accounts", None));
        assert!(allowed("POST", "/api/supplier/erp", Some("PURCHASE")));
        assert!(allowed("POST", "/api/supplier/erp", Some("EXPENSE")));
        assert!(!allowed("POST", "/api/supplier/erp", Some("SALE")), "les ventes passent par la commande de caisse dédiée");
        assert!(!allowed("POST", "/api/supplier/erp", None));
        assert!(allowed("POST", "/api/supplier/advanced", Some("WAREHOUSE_TRANSFER")));
        assert!(!allowed("POST", "/api/supplier/advanced", Some("STOCK_COUNT_CLOSE")));
        assert!(allowed("POST", "/api/supplier/documents/abc123/convert", None));
        assert!(!allowed("DELETE", "/api/supplier/accounts", None));
        assert!(!allowed("GET", "/api/platform/shops", None));
        assert!(!allowed("GET", "/api/supplier/security", None));
        assert!(!allowed("POST", "/api/supplier/subscription", None));
        assert!(allowed("GET", "/api/supplier/walk-in-suggestions", None));
        assert!(!allowed("POST", "/api/supplier/walk-in-suggestions", None));
        assert!(!allowed("GET", "https://evil.example/api/supplier/products", None));
    }
}

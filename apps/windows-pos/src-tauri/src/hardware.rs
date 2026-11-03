//! Matériel de comptoir : tiroir-caisse (ESC/POS), imprimantes Windows, écran client, liens externes.
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Impulsion ESC/POS standard « ouvrir le tiroir » (broche 2, 50 ms / 500 ms).
const DRAWER_PULSE: [u8; 5] = [0x1B, 0x70, 0x00, 0x19, 0xFA];

#[cfg(windows)]
fn wide(s: &str) -> Vec<u16> { s.encode_utf16().chain(std::iter::once(0)).collect() }

#[cfg(windows)]
#[tauri::command]
pub fn list_printers() -> Result<Vec<String>, String> {
    use windows_sys::Win32::Graphics::Printing::{EnumPrintersW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_INFO_4W};
    let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
    let mut needed: u32 = 0;
    let mut count: u32 = 0;
    unsafe {
        EnumPrintersW(flags, std::ptr::null(), 4, std::ptr::null_mut(), 0, &mut needed, &mut count);
        if needed == 0 { return Ok(vec![]); }
        let mut buf = vec![0u8; needed as usize];
        if EnumPrintersW(flags, std::ptr::null(), 4, buf.as_mut_ptr(), needed, &mut needed, &mut count) == 0 {
            return Err("Liste des imprimantes Windows indisponible".into());
        }
        let items = std::slice::from_raw_parts(buf.as_ptr() as *const PRINTER_INFO_4W, count as usize);
        let mut names = Vec::new();
        for info in items {
            if info.pPrinterName.is_null() { continue; }
            let mut len = 0usize;
            while *info.pPrinterName.add(len) != 0 { len += 1; }
            names.push(String::from_utf16_lossy(std::slice::from_raw_parts(info.pPrinterName, len)));
        }
        Ok(names)
    }
}

#[cfg(not(windows))]
#[tauri::command]
pub fn list_printers() -> Result<Vec<String>, String> { Ok(vec![]) }

/// Envoie l'impulsion d'ouverture à l'imprimante de tickets (le tiroir est branché sur son port RJ11).
#[cfg(windows)]
#[tauri::command]
pub fn cash_drawer_open(printer: String) -> Result<(), String> {
    use windows_sys::Win32::Graphics::Printing::{ClosePrinter, EndDocPrinter, EndPagePrinter, OpenPrinterW, StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_HANDLE};
    if printer.trim().is_empty() || printer.len() > 260 { return Err("Choisissez l'imprimante du tiroir-caisse dans les réglages".into()); }
    let name = wide(printer.trim());
    let mut doc_name = wide("FIXI tiroir-caisse");
    let mut data_type = wide("RAW");
    unsafe {
        let mut handle = PRINTER_HANDLE::default();
        if OpenPrinterW(name.as_ptr(), &mut handle, std::ptr::null()) == 0 {
            return Err(format!("Imprimante introuvable : {}", printer));
        }
        let info = DOC_INFO_1W { pDocName: doc_name.as_mut_ptr(), pOutputFile: std::ptr::null_mut(), pDatatype: data_type.as_mut_ptr() };
        let mut ok = StartDocPrinterW(handle, 1, &info) != 0;
        if ok { ok = StartPagePrinter(handle) != 0; }
        let mut written: u32 = 0;
        if ok { ok = WritePrinter(handle, DRAWER_PULSE.as_ptr() as *const core::ffi::c_void, DRAWER_PULSE.len() as u32, &mut written) != 0; }
        EndPagePrinter(handle);
        EndDocPrinter(handle);
        ClosePrinter(handle);
        if !ok || written as usize != DRAWER_PULSE.len() { return Err("Le tiroir n'a pas répondu : vérifiez le câble et l'imprimante choisie".into()); }
    }
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn cash_drawer_open(_printer: String) -> Result<(), String> { Err("Tiroir-caisse disponible seulement sous Windows".into()) }

pub fn open_url(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("rundll32.exe").args(["url.dll,FileProtocolHandler", url])
            .creation_flags(CREATE_NO_WINDOW).spawn().map(|_| ()).map_err(|_| "Navigateur introuvable".to_string())
    }
    #[cfg(not(windows))]
    { let _ = url; Err("Ouverture de lien disponible seulement sous Windows".into()) }
}

/// Ouvre l'écran client en plein écran sur le 2ᵉ moniteur (ou en fenêtre s'il n'y en a qu'un).
#[tauri::command]
pub async fn open_customer_display(app: AppHandle) -> Result<bool, String> {
    if let Some(w) = app.get_webview_window("client") { let _ = w.set_focus(); return Ok(true); }
    let main = app.get_webview_window("main").ok_or("Fenêtre principale absente")?;
    let current = main.current_monitor().ok().flatten();
    let monitors = main.available_monitors().map_err(|_| "Écrans indisponibles".to_string())?;
    let other = monitors.into_iter().find(|m| current.as_ref().map(|c| c.position() != m.position()).unwrap_or(true));
    let window = WebviewWindowBuilder::new(&app, "client", WebviewUrl::App("index.html".into()))
        .title("FIXI — Écran client").inner_size(1024.0, 640.0).visible(false).decorations(other.is_none())
        .build().map_err(|e| format!("Écran client impossible : {e}"))?;
    let second = other.is_some();
    if let Some(m) = other {
        let _ = window.set_position(tauri::Position::Physical(*m.position()));
        let _ = window.set_fullscreen(true);
    }
    let _ = window.show();
    let _ = main.set_focus();
    Ok(second)
}

#[tauri::command]
pub fn close_customer_display(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("client") { w.close().map_err(|_| "Fermeture impossible".to_string())?; }
    Ok(())
}

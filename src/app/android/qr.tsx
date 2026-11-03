'use client';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

// QR à montrer depuis un ordinateur : le technicien le scanne avec son téléphone.
export function AndroidQr() {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (c.current) QRCode.toCanvas(c.current, location.origin + '/android', { width: 180, margin: 1 }).catch(() => {}); }, []);
  return <div className="fx-android-qr"><canvas ref={c} aria-label="QR code de la page de téléchargement" /><small>Sur un ordinateur ? Scannez ce code avec le téléphone.</small></div>;
}

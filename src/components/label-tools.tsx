'use client';
import { useEffect } from 'react';
import QRCode from 'qrcode';
import { Printer, Minus, Plus } from 'lucide-react';

// Dessine le QR de chaque étiquette et propose l'impression.
export function LabelTools({ code, url, copies }: { code: string; url: string; copies: number }) {
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.fx-label-qr').forEach(el => {
      if (el.querySelector('canvas')) return;
      const c = document.createElement('canvas');
      el.appendChild(c);
      QRCode.toCanvas(c, url, { width: 96, margin: 0, errorCorrectionLevel: 'M' }).catch(() => {});
    });
  }, [url, copies]);
  const go = (n: number) => { const u = new URL(location.href); u.searchParams.set('n', String(n)); location.href = u.toString(); };
  return <div className="fx-label-tools no-print">
    <p>Étiquette <b>{code}</b> à coller sur l’appareil. Format rouleau 50 × 30 mm.</p>
    <div className="fx-label-copies" role="group" aria-label="Nombre d’étiquettes">
      <button type="button" className="btn btn-ghost btn-sm" disabled={copies <= 1} onClick={() => go(copies - 1)} aria-label="Une étiquette de moins"><Minus size={16} /></button>
      <span>{copies} étiquette{copies > 1 ? 's' : ''}</span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={copies >= 4} onClick={() => go(copies + 1)} aria-label="Une étiquette de plus"><Plus size={16} /></button>
    </div>
    <button type="button" className="btn btn-primary btn-block" onClick={() => window.print()}><Printer size={18} /> Imprimer l’étiquette</button>
  </div>;
}

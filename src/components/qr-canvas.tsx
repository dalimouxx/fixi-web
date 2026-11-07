'use client';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';

export function QrCanvas({ value, size = 120 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) void QRCode.toCanvas(ref.current, value, { width: size, margin: 0 }); }, [value, size]);
  return <canvas ref={ref} aria-label="QR code" />;
}
export function PrintNow({ label = 'Imprimer' }: { label?: string }) {
  return <button type="button" className="ci-print no-print" onClick={() => window.print()}><Printer size={16} /> {label}</button>;
}

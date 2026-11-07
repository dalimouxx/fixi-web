'use client';
import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';

/** Code-barres du numéro OCC (pour retrouver le téléphone d'un scan) + choix du format + impression. */
export function UsedLabelBarcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => { if (ref.current) try { JsBarcode(ref.current, value, { format: 'CODE128', height: 26, width: 1.3, margin: 0, displayValue: false }); } catch {} }, [value]);
  return <svg ref={ref} className="occ-lbl-bar" aria-label={`Code-barres ${value}`} />;
}

export function UsedLabelToolbar() {
  const [size, setSize] = useState('58x40');
  useEffect(() => { document.documentElement.dataset.label = size; }, [size]);
  return <div className="occ-lbl-tools no-print">
    <div role="group" aria-label="Format d’étiquette">{[['58x40', 'Étiquette 58 × 40 mm'], ['50x30', 'Étiquette 50 × 30 mm'], ['a4', 'Feuille A4 (vitrine)']].map(([v, l]) => <button key={v} type="button" aria-pressed={size === v} onClick={() => setSize(v)}>{l}</button>)}</div>
    <button type="button" className="occ-lbl-print" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
  </div>;
}

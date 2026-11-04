'use client';
import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';

/** Signature au doigt : PNG compact (fond transparent), renvoyé à chaque trait. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = ref.current!; const ratio = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * ratio; c.height = c.clientHeight * ratio;
    const ctx = c.getContext('2d')!; ctx.scale(ratio, ratio); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1c1917';
  }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return <div className="sig">
    <div className="sig-head"><span><PenLine size={14} /> Signature du réceptionnaire</span>{!empty && <button type="button" onClick={() => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(''); }}><Eraser size={14} /> Effacer</button>}</div>
    <canvas ref={ref} className="sig-pad" aria-label="Zone de signature"
      onPointerDown={e => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x, y); }}
      onPointerMove={e => { if (!drawing.current) return; const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.lineTo(x, y); ctx.stroke(); if (empty) setEmpty(false); }}
      onPointerUp={() => { drawing.current = false; if (!empty) onChange(ref.current!.toDataURL('image/png')); }} />
    {empty && <small className="sig-hint">Faites signer ici avec le doigt (facultatif)</small>}
  </div>;
}

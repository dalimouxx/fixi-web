'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck, Smartphone, PenLine, RotateCcw } from 'lucide-react';
import { shopBrandVars } from '@/lib/brand-color';
import { money } from '@/lib/format';

// Écran tourné vers le client (tablette ou vieux téléphone au comptoir).
// L'atelier touche « Montrer au client » sur une réparation : elle s'affiche ici, le client vérifie et signe.
export default function Comptoir() {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);

  async function load() {
    try { const r = await fetch('/api/counter', { cache: 'no-store' }); if (r.status === 401) { location.href = '/login?next=/comptoir'; return; } const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); setError(''); }
    catch (e: any) { setError(e.message || 'Connexion perdue'); }
  }
  useEffect(() => {
    load();
    const es = new EventSource('/api/events'); es.onmessage = () => load();
    const t = setInterval(load, 6000);
    const wake = (navigator as any).wakeLock?.request?.('screen').catch(() => null);
    return () => { es.close(); clearInterval(t); Promise.resolve(wake).then((w: any) => w?.release?.()).catch(() => {}); };
  }, []);
  const code = d?.repair?.code;
  useEffect(() => { setDone(''); setSigning(false); }, [code]);
  useEffect(() => {
    if (!signing) return;
    const c = canvas.current; if (!c) return;
    const ratio = window.devicePixelRatio || 1; const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio; c.height = rect.height * ratio;
    const ctx = c.getContext('2d')!; ctx.scale(ratio, ratio); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = '#101828'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let on = false; drawn.current = false;
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.onpointerdown = e => { on = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); c.setPointerCapture(e.pointerId); };
    c.onpointermove = e => { if (!on) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); drawn.current = true; };
    c.onpointerup = () => { on = false; };
  }, [signing]);

  async function saveSignature() {
    const c = canvas.current; if (!c || !code) return;
    if (!drawn.current) return alert('Signez dans le cadre blanc.');
    c.toBlob(async b => {
      if (!b) return;
      const f = new FormData(); f.append('file', new File([b], `signature-${code}.png`, { type: 'image/png' })); f.append('type', 'SIGNATURE_RECEPTION');
      const r = await fetch(`/api/repairs/${encodeURIComponent(code)}/attachments`, { method: 'POST', body: f });
      if (r.ok) { setSigning(false); setDone('Merci, votre signature est enregistrée.'); load(); } else alert('Signature non enregistrée, réessayez.');
    }, 'image/png');
  }

  const s = d?.shop; const r = d?.repair;
  return <main className="fx-counter" style={shopBrandVars(s?.brandColor) as any}>
    <header className="fx-counter-head">{s?.logoDataUrl ? <img src={s.logoDataUrl} alt="" /> : <i>{String(s?.name || 'F').charAt(0)}</i>}<b>{s?.name || 'Fixi'}</b>{error && <span className="fx-counter-off">{error}</span>}</header>
    {!r ? <section className="fx-counter-idle"><Smartphone /><h1>Bienvenue</h1><p>Votre réparation s’affichera ici.</p></section> :
      <section className="fx-counter-card">
        <small className="fx-counter-code">Réparation {r.code}</small>
        <h1>{r.device}</h1>
        <p className="fx-counter-issue">{r.issue}</p>
        <div className="fx-counter-price"><span>{r.estimated ? 'Prix estimé' : 'Prix de la réparation'}</span><strong>{r.price == null ? 'À définir après diagnostic' : money(r.price, s?.currency)}</strong>
          {r.paid > 0 && r.balance != null && <small>Déjà payé {money(r.paid, s?.currency)} · reste {money(r.balance, s?.currency)}</small>}</div>
        {r.warrantyDays > 0 && <p className="fx-counter-warranty"><ShieldCheck size={20} /> Garantie {r.warrantyDays} jours après la remise</p>}
        {r.signed || done ? <p className="fx-counter-done"><CheckCircle2 size={22} /> {done || 'Prise en charge signée.'}</p> : !signing ?
          <button className="btn fx-counter-btn" onClick={() => setSigning(true)}><PenLine size={22} /> Je suis d’accord, je signe</button> :
          <div className="fx-counter-sign"><p>Signez avec le doigt dans le cadre :</p><canvas ref={canvas} aria-label="Zone de signature" />
            <div><button className="btn btn-ghost" onClick={() => { setSigning(false); setTimeout(() => setSigning(true), 0); }}><RotateCcw size={18} /> Effacer</button><button className="btn fx-counter-btn" onClick={saveSignature}><CheckCircle2 size={20} /> Valider</button></div></div>}
        <p className="fx-counter-legal">En signant, vous confirmez déposer cet appareil pour la réparation décrite. {r.client ? `Merci ${r.client} !` : ''}</p>
      </section>}
  </main>;
}

// FIXI Caisse — mode ATELIER (Fixi Pro) : réception rapide + ticket de dépôt, appareils à rendre, encaissement
// (tiroir-caisse, ticket), fin de journée. Même installateur et même matériel que la caisse fournisseur.
import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeftRight, Banknote, CheckCircle2, ClipboardList, CreditCard, LogOut, MapPin, Moon, Printer, Search, ShoppingBag, Smartphone, Sparkles, Store, UserRound, Wrench } from 'lucide-react';
import { CounterSaleTab, METHOD_LABEL, type SalePrint } from './atelier-comptoir';
import { FixiLogo, Clock } from './brand';
import { dt } from './dialogs';
import { defaultSettings, readJson, SETTINGS_KEY, type Settings } from './storage';

type Opt = { regions?: string[]; shops?: { slug: string; name: string }[]; users?: { id: string; fullName: string; roleLabel: string }[] };
type Session = { fullName: string; role?: string; roleLabel: string; accessTier: string; shopName: string };
const SERVER = 'https://fixi-web.onrender.com';
const KEY = 'fixi-atelier-last';
const req = <T,>(method: string, path: string, body?: unknown) => invoke<T>('atelier_request', { method, path, body: body ?? null });
const clean = (e: unknown) => String(e).replace(/^(PRO_REQUIS|SESSION_EXPIREE):\s*/, '');

export function switchSpace(space: 'supplier' | 'atelier') { try { localStorage.setItem('fixi-space', space); } catch {} location.reload(); }

export function AtelierApp() {
  const last = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })();
  const [server, setServer] = useState<string>(last.server || SERVER);
  const [opt, setOpt] = useState<Opt>({}); const [region, setRegion] = useState<string>(last.region || ''); const [shop, setShop] = useState<string>(last.shop || ''); const [user, setUser] = useState<string>(last.user || '');
  const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [session, setSession] = useState<Session | null>(null); const [pro, setPro] = useState(true);
  useEffect(() => { void invoke<Opt>('atelier_options', { server, region: null, shop: null }).then(o => setOpt(x => ({ ...x, regions: o.regions }))).catch(e => setErr(clean(e))); }, [server]);
  useEffect(() => { if (region) void invoke<Opt>('atelier_options', { server, region, shop: null }).then(o => setOpt(x => ({ ...x, shops: o.shops }))).catch(() => {}); }, [region, server]);
  useEffect(() => { if (shop) void invoke<Opt>('atelier_options', { server, region: null, shop }).then(o => setOpt(x => ({ ...x, users: o.users }))).catch(() => {}); }, [shop, server]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await invoke<any>('atelier_login', { server, shopSlug: shop, userId: user, pin });
      localStorage.setItem(KEY, JSON.stringify({ server, region, shop, user }));
      const shopName = opt.shops?.find(s => s.slug === shop)?.name || '';
      setSession({ fullName: r.fullName, role: r.role, roleLabel: r.roleLabel, accessTier: r.accessTier, shopName }); setPro(r.accessTier === 'PRO'); setPin('');
    } catch (x) { setErr(clean(x)); setPin(''); } finally { setBusy(false); }
  }

  if (!session) return <div className="v5-login">
    <div className="v5-login-identity"><FixiLogo size={72} className="v7-logo--hero" /><h1>FIXI Caisse · Atelier</h1><p>Le comptoir de votre atelier de réparation.</p>
      <ul><li><ClipboardList size={18} /> Réception en 30 secondes, ticket de dépôt imprimé</li><li><Banknote size={18} /> Encaissement, tiroir-caisse et ticket</li><li><ShoppingBag size={18} /> Vente d’accessoires et retours client</li><li><Moon size={18} /> Fin de journée en un coup d’œil</li></ul></div>
    <div className="v5-login-panel"><form className="v5-card v5-login-form" onSubmit={login}>
      <h2>Connexion atelier</h2><p>Avec votre profil Fixi et votre code à 6 chiffres.</p>
      <label className="v5-field"><span><MapPin size={14} /> Région</span><select value={region} onChange={e => { setRegion(e.target.value); setShop(''); setUser(''); }} required><option value="">Choisir…</option>{(opt.regions || []).map(r => <option key={r}>{r}</option>)}</select></label>
      <label className="v5-field"><span><Store size={14} /> Boutique</span><select value={shop} onChange={e => { setShop(e.target.value); setUser(''); }} required disabled={!region}><option value="">Choisir…</option>{(opt.shops || []).map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
      <label className="v5-field"><span><UserRound size={14} /> Profil</span><select value={user} onChange={e => setUser(e.target.value)} required disabled={!shop}><option value="">Choisir…</option>{(opt.users || []).map(u => <option key={u.id} value={u.id}>{u.fullName} · {u.roleLabel}</option>)}</select></label>
      <label className="v5-field"><span>Code PIN</span><input className="v6-totp" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" required /></label>
      <details className="v5-advanced"><summary>Serveur</summary><label className="v5-field"><span>Adresse du serveur FIXI</span><input type="url" value={server} onChange={e => setServer(e.target.value)} /></label></details>
      <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy || pin.length !== 6 || !user}>{busy ? 'Connexion…' : 'Ouvrir le comptoir'}</button>
      <button type="button" className="v5-link" onClick={() => switchSpace('supplier')}><ArrowLeftRight size={15} /> Je suis fournisseur</button>
    </form>{err && <p role="alert" className="v5-alert v5-alert--danger">{err}</p>}</div>
  </div>;

  if (!pro) return <div className="v5-login"><div className="v5-login-panel"><div className="v5-card v5-login-form at-pro">
    <Sparkles size={34} /><h2>La caisse atelier fait partie de Fixi Pro</h2><p>{session.shopName} est en offre gratuite. Activez l’essai Fixi Pro depuis Fixi (un clic, sans paiement), puis reconnectez-vous ici.</p>
    <button className="v5-btn v5-btn--primary v5-btn--lg" onClick={() => void invoke('open_external', { url: server + '/app/upgrade?from=%2Fapp%2Fcashier' })}>Essayer Fixi Pro</button>
    <button className="v5-link" onClick={async () => { await invoke('atelier_logout'); setSession(null); }}>Changer de profil</button></div></div></div>;

  return <Counter session={session} server={server} onLogout={async () => { await invoke('atelier_logout').catch(() => {}); setSession(null); }} />;
}

type Tab = 'reception' | 'rendre' | 'comptoir' | 'jour';

function Counter({ session, server, onLogout }: { session: Session; server: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('reception'); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const [printing, setPrinting] = useState<any>(null);
  useEffect(() => { if (!printing) return; document.body.dataset.printMode = 'atelier'; const done = () => { delete document.body.dataset.printMode; setPrinting(null); }; window.addEventListener('afterprint', done, { once: true }); setTimeout(() => window.print(), 60); }, [printing]);
  const fail = (e: unknown) => { const t = String(e); if (t.startsWith('SESSION_EXPIREE')) { onLogout(); return; } setErr(clean(e)); };
  return <div className="v5-app at-app">
    <aside className="v5-side">
      <div className="v5-brand"><FixiLogo size={40} /><div className="v5-brand-text"><strong>FIXI</strong><small>Atelier</small></div></div>
      <nav className="v5-nav" aria-label="Menu"><div className="v5-nav-group"><span className="v5-nav-heading">Comptoir</span>
        {([['reception', ClipboardList, 'Réception'], ['rendre', Wrench, 'À rendre · Encaisser'], ['comptoir', ShoppingBag, 'Vente comptoir'], ['jour', Moon, 'Fin de journée']] as const).map(([k, I, l]) => <button key={k} className="v5-nav-item" aria-current={tab === k ? 'page' : undefined} onClick={() => { setTab(k); setErr(''); setMsg(''); }}><I size={19} /><span>{l}</span></button>)}
      </div></nav>
      <div className="v5-account"><span className="v5-led" aria-hidden /><div><strong>{session.fullName}</strong><small>{session.roleLabel} · {session.shopName}</small></div>
        <div className="v5-account-actions"><button className="v5-icon-btn" title="Mode fournisseur" aria-label="Mode fournisseur" onClick={() => switchSpace('supplier')}><ArrowLeftRight size={17} /></button><button className="v5-icon-btn" title="Déconnexion" aria-label="Déconnexion" onClick={onLogout}><LogOut size={17} /></button></div></div>
    </aside>
    <main className="v5-main at-main"><header className="at-head"><Clock /><h1>{tab === 'reception' ? 'Réception' : tab === 'rendre' ? 'À rendre · Encaisser' : tab === 'comptoir' ? 'Vente comptoir' : 'Fin de journée'}</h1></header>
      {msg && <p className="v5-alert v5-alert--info" role="status"><CheckCircle2 size={16} /> <span>{msg}</span></p>}
      {err && <p className="v5-alert v5-alert--danger" role="alert"><span>{err}</span></p>}
      {tab === 'reception' && <Reception onDone={r => { setMsg(`Dossier ${r.code} créé.`); setPrinting({ kind: 'depot', r }); }} onError={fail} />}
      {tab === 'rendre' && <ToReturn onPaid={(r, amount, method) => { setMsg(`${r.code} encaissé : ${dt(amount)}.`); setPrinting({ kind: 'recu', r, amount, method }); }} onError={fail} />}
      {tab === 'comptoir' && <CounterSaleTab manager={session.role === 'ADMIN'} onSold={(p, m) => { setErr(''); setMsg(m); setPrinting({ kind: p.kind, sale: p }); }} onError={fail} />}
      {tab === 'jour' && <Day onError={fail} />}
    </main>
    {printing && <AtelierTicket p={printing} shopName={session.shopName} server={server} />}
  </div>;
}

function Reception({ onDone, onError }: { onDone: (r: any) => void; onError: (e: unknown) => void }) {
  const blank = { clientPhone: '', clientName: '', brand: '', model: '', reportedIssue: '', estimatedPrice: '', priority: 'NORMAL', lockCode: '' };
  const [f, setF] = useState(blank); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const ok = f.clientPhone.replace(/\D/g, '').length >= 8 && f.clientName.trim().length >= 2 && f.model.trim() && f.reportedIssue.trim().length >= 2;
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!ok) return; setBusy(true);
    try { const r = await req<any>('POST', '/api/repairs', { ...f, category: 'PHONE', estimatedPrice: f.estimatedPrice ? Number(f.estimatedPrice.replace(',', '.')) : null, lockCode: f.lockCode || undefined }); onDone(r); setF(blank); }
    catch (x) { onError(x); } finally { setBusy(false); }
  }
  return <form className="v5-card at-form" onSubmit={save}>
    <div className="v6-form-2"><label className="v5-field"><span>Téléphone client</span><input autoFocus inputMode="tel" value={f.clientPhone} onChange={set('clientPhone')} placeholder="20 123 456" /></label><label className="v5-field"><span>Nom du client</span><input value={f.clientName} onChange={set('clientName')} placeholder="Prénom et nom" /></label></div>
    <div className="v6-form-2"><label className="v5-field"><span>Marque</span><input value={f.brand} onChange={set('brand')} placeholder="Samsung, Apple…" list="at-brands" /></label><label className="v5-field"><span>Modèle</span><input value={f.model} onChange={set('model')} placeholder="Galaxy A54" /></label></div>
    <datalist id="at-brands">{['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Realme', 'Huawei', 'Honor', 'Infinix', 'Tecno', 'Itel', 'Nokia', 'Vivo'].map(b => <option key={b} value={b} />)}</datalist>
    <label className="v5-field"><span>Panne</span><input value={f.reportedIssue} onChange={set('reportedIssue')} placeholder="Écran cassé, ne charge plus…" /></label>
    <div className="at-chips">{['Écran cassé', 'Batterie', 'Ne charge plus', 'Vitre arrière', 'Caméra', 'Logiciel', 'Tombé dans l’eau'].map(x => <button type="button" key={x} aria-pressed={f.reportedIssue === x} onClick={() => setF({ ...f, reportedIssue: x })}>{x}</button>)}</div>
    <div className="v6-form-2"><label className="v5-field"><span>Prix estimé (DT)</span><input inputMode="decimal" value={f.estimatedPrice} onChange={set('estimatedPrice')} placeholder="Facultatif" /></label><label className="v5-field"><span>Code de déverrouillage</span><input value={f.lockCode} onChange={set('lockCode')} placeholder="Facultatif" /></label></div>
    <label className="v6-check"><input type="checkbox" checked={f.priority === 'URGENT'} onChange={e => setF({ ...f, priority: e.target.checked ? 'URGENT' : 'NORMAL' })} /> Urgent</label>
    <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={!ok || busy}><Printer size={18} /> {busy ? 'Enregistrement…' : 'Enregistrer et imprimer le ticket'}</button>
  </form>;
}

function ToReturn({ onPaid, onError }: { onPaid: (r: any, amount: number, method: string) => void; onError: (e: unknown) => void }) {
  const [q, setQ] = useState(''); const [rows, setRows] = useState<any[]>([]); const [sel, setSel] = useState<any>(null); const [method, setMethod] = useState('CASH'); const [busy, setBusy] = useState(false); const [n, setN] = useState(0);
  useEffect(() => { const t = setTimeout(() => { req<any>('GET', '/api/cashier/overview?q=' + encodeURIComponent(q)).then(d => setRows((d.repairs || []).filter((r: any) => r.status === 'READY' || r.balance > 0))).catch(onError); }, 250); return () => clearTimeout(t); }, [q, n]);
  const settings = useMemo(() => ({ ...defaultSettings, ...readJson<Partial<Settings>>(SETTINGS_KEY, {}) }), []);
  async function pay() {
    if (!sel) return; setBusy(true);
    try {
      const amount = Number(sel.balance);
      if (amount > 0) await req('POST', '/api/cashier/checkout', { repairId: sel.id, splits: [{ method, amount }] });
      if (sel.status === 'READY') await req('PATCH', `/api/repairs/${sel.code}/status`, { status: 'DELIVERED' });
      if (method === 'CASH' && amount > 0 && settings.drawerPrinter) void invoke('cash_drawer_open', { printer: settings.drawerPrinter }).catch(() => {});
      onPaid(sel, amount, method); setSel(null); setN(x => x + 1);
    } catch (x) { onError(x); } finally { setBusy(false); }
  }
  return <div className="at-split">
    <section className="v5-card at-list"><div className="v5-search"><Search size={17} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Code, téléphone, nom…" /></div>
      {rows.length ? rows.map(r => <button key={r.id} className={'at-row' + (sel?.id === r.id ? ' on' : '')} onClick={() => setSel(r)}><Smartphone size={18} /><span><b>{[r.brand, r.model].filter(Boolean).join(' ')}</b><small>{r.code} · {r.client?.fullName} · {r.status === 'READY' ? 'Prêt' : 'Livré'}</small></span><strong>{dt(Number(r.balance))}</strong></button>)
        : <div className="v5-empty"><Wrench size={34} /><h3>Rien à rendre</h3><p>Les réparations « Prêt » apparaissent ici.</p></div>}</section>
    <section className="v5-card at-pay">{sel ? <>
      <h2>{[sel.brand, sel.model].filter(Boolean).join(' ')}</h2><p>{sel.code} · {sel.client?.fullName} · {sel.client?.phone}</p>
      <div className="at-total"><span>À encaisser</span><b>{dt(Number(sel.balance))}</b><small>Prix {dt(Number(sel.payable))} · déjà payé {dt(Number(sel.paid))}</small></div>
      <div className="at-methods" role="radiogroup" aria-label="Moyen de paiement">{([['CASH', Banknote, 'Espèces'], ['CARD', CreditCard, 'Carte'], ['D17', Smartphone, 'D17'], ['BANK_TRANSFER', ArrowLeftRight, 'Virement']] as const).map(([k, I, l]) => <button key={k} type="button" aria-pressed={method === k} onClick={() => setMethod(k)}><I size={16} /> {l}</button>)}</div>
      <button className="v5-btn v5-btn--primary v5-btn--lg" disabled={busy || (Number(sel.balance) <= 0 && sel.status !== 'READY')} onClick={pay}><CheckCircle2 size={18} /> {busy ? '…' : Number(sel.balance) > 0 ? `Encaisser ${dt(Number(sel.balance))} et rendre` : 'Rendre l’appareil'}</button>
    </> : <div className="v5-empty"><Banknote size={40} /><h3>Choisissez un appareil</h3><p>Scannez l’étiquette ou cherchez par téléphone.</p></div>}</section>
  </div>;
}

function Day({ onError }: { onError: (e: unknown) => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { req<any>('GET', '/api/cashier/overview').then(setD).catch(onError); }, []);
  if (!d) return <div className="v5-card">Chargement…</div>;
  const k = d.kpis || {}; const by = k.byMethod || {};
  return <div className="at-day">
    <div className="v5-card at-kpi"><span>Encaissé aujourd’hui</span><b>{dt(Number(k.net || 0))}</b><small>{k.count || 0} paiement(s) · {k.delivered || 0} appareil(s) rendu(s)</small></div>
    <div className="v5-card"><h3>Par moyen de paiement</h3>{Object.entries(by).map(([m, v]) => <p className="at-line" key={m}><span>{({ CASH: 'Espèces', CARD: 'Carte', D17: 'D17', FLOUCI: 'Flouci', BANK_TRANSFER: 'Virement', OTHER: 'Autre' } as Record<string, string>)[m] || m}</span><b>{dt(Number(v))}</b></p>)}{!Object.keys(by).length && <p>Aucun paiement aujourd’hui.</p>}</div>
    <div className="v5-card"><h3>Derniers encaissements</h3>{(d.payments || []).slice(0, 12).map((p: any) => <p className="at-line" key={p.id}><span>{new Date(p.createdAt).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })} · {p.repair?.code || p.counterSale?.number} · {p.repair?.client?.fullName || p.counterSale?.client?.fullName || (p.counterSale ? 'Vente comptoir' : '')}</span><b>{p.kind === 'REFUND' ? '−' : ''}{dt(Number(p.amount))}</b></p>)}</div>
    <button className="v5-btn v5-btn--ghost" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
  </div>;
}

function AtelierTicket({ p, shopName, server }: { p: any; shopName: string; server: string }) {
  if (p.kind === 'vente' || p.kind === 'retour') return <SaleTicket s={p.sale} shopName={shopName} />;
  const r = p.r;
  return <div className="at-ticket" aria-hidden="true">
    <header><b>{shopName}</b><small>{new Date().toLocaleString('fr-TN')}</small></header>
    <h3>{p.kind === 'depot' ? 'TICKET DE DÉPÔT' : 'REÇU DE PAIEMENT'}</h3>
    <div className="at-code">{r.code}</div>
    <p><span>Client</span><b>{r.client?.fullName || ''}</b></p><p><span>Appareil</span><b>{[r.brand, r.model].filter(Boolean).join(' ')}</b></p>
    {p.kind === 'depot' ? <><p><span>Panne</span><b>{r.reportedIssue}</b></p>{r.estimatedPrice != null && <p><span>Prix estimé</span><b>{dt(Number(r.estimatedPrice))}</b></p>}<small className="at-track">Suivi : {server.replace(/^https:\/\//, '')}/track/{r.code}</small></>
      : <><p><span>Payé</span><b>{dt(Number(p.amount))}</b></p><p><span>Moyen</span><b>{p.method}</b></p></>}
    <footer>Merci de votre confiance · Fixi</footer>
  </div>;
}

/** Ticket 80 mm d'une vente comptoir ou d'un retour client. */
function SaleTicket({ s, shopName }: { s: SalePrint; shopName: string }) {
  const refund = s.kind === 'retour';
  return <div className="at-ticket" aria-hidden="true">
    <header><b>{shopName}</b><small>{new Date().toLocaleString('fr-TN')}</small></header>
    <h3>{refund ? 'REMBOURSEMENT' : 'TICKET DE CAISSE'}</h3>
    <div className="at-code">{s.number}</div>
    {s.lines.map((l, i) => <p key={i}><span>{l.quantity} × {l.name}</span><b>{refund ? '− ' : ''}{dt(l.total)}</b></p>)}
    {!!s.discount && <p><span>Remise</span><b>− {dt(s.discount)}</b></p>}
    <p><span>{refund ? 'Rendu au client' : 'Total'}</span><b>{refund ? '− ' : ''}{dt(s.total)}</b></p>
    <p><span>Moyen</span><b>{METHOD_LABEL[s.method] || s.method}</b></p>
    {!refund && s.received != null && s.method === 'CASH' && <><p><span>Reçu</span><b>{dt(s.received)}</b></p><p><span>Monnaie</span><b>{dt(s.change || 0)}</b></p></>}
    {s.offline && <p><span>Vente enregistrée hors ligne</span><b>envoi automatique</b></p>}
    <footer>{refund ? 'Remboursement enregistré' : 'Merci pour votre achat'} · Fixi</footer>
  </div>;
}

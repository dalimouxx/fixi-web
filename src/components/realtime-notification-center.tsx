'use client';

import Link from 'next/link';
import { Bell, BellRing, CheckCheck, Volume2, Smartphone, X, Truck, PackageCheck, ShoppingBag, MapPinned, CheckCircle2, Info, Settings2, ChevronLeft, Play, Vibrate, Mic, LockKeyhole, Send, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playFixiSound, primeNotificationAudio, notificationAudioStatus, soundDuration, speakAlert } from '@/lib/notification-audio';
import { alertCategories, categoriesForSpace, categoryFor, fixiSounds, parseAlertSettings, vibrationFor, type AlertCategory, type AlertSettings, type FixiSoundId } from '@/lib/notification-sounds';
import { PushToggle } from '@/components/push-toggle';
import { FxSheet } from '@/components/fx-sheet';
import { SupplierWhatsAppAlerts } from '@/components/supplier-whatsapp-alerts';
import { TextSizeToggle } from '@/components/text-size-toggle';
import { VideoHelpButton } from '@/components/video-help';

type Props = {
  apiUrl: string; eventsUrl: string; storageKey: string; allHref?: string; compact?: boolean;
  onNavigate?: (href: string) => void; onEvent?: (notification: any) => void;
};
type Incoming = {
  id: string; title: string; message: string; href?: string | null;
  experienceKey?: string; soundKey?: string; priority?: string; kind?: string; type?: string;
  readAt?: string | null; createdAt?: string; [key: string]: any;
};

const categoryIcon: Record<AlertCategory, any> = { orders: ShoppingBag, missions: Truck, progress: MapPinned, done: CheckCircle2, general: Info };
function iconFor(n: Incoming) {
  if (n.experienceKey?.startsWith('SUPPLIER_') && n.experienceKey !== 'SUPPLIER_NEW_ORDER') return PackageCheck;
  return categoryIcon[categoryFor(n.experienceKey, n.priority)];
}
function ago(iso?: string) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

export function RealtimeNotificationCenter({ apiUrl, eventsUrl, storageKey, allHref, onNavigate, onEvent }: Props) {
  const space: 'atelier' | 'supplier' | 'delivery' = apiUrl.includes('/supplier/') ? 'supplier' : apiUrl.includes('/delivery/') ? 'delivery' : 'atelier';
  const spaceTitle = space === 'supplier' ? 'Fixi Fournisseur' : space === 'delivery' ? 'Fixi Livreur' : 'Fixi Atelier';
  const spaceHref = space === 'supplier' ? '/supplier' : space === 'delivery' ? '/delivery' : '/app/dashboard';
  const subscribeUrl = space === 'supplier' ? '/api/supplier/push/subscribe' : space === 'delivery' ? '/api/delivery/push/subscribe' : '/api/push/subscribe';
  const testUrl = space === 'supplier' ? '/api/supplier/push/test' : space === 'delivery' ? '/api/delivery/push/test' : '/api/push/test';

  const [rows, setRows] = useState<Incoming[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'settings'>('list');
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [settings, setSettings] = useState<AlertSettings>(() => parseAlertSettings(null));
  const [audioReady, setAudioReady] = useState(false);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [testStatus, setTestStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<Incoming | null>(null);

  const settingsRef = useRef(settings); settingsRef.current = settings;
  const lastId = useRef(''), initial = useRef(true);
  const announced = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // --- Alerte : son (répété si urgent), vibration, voix, notification système si l'onglet est caché
  const alert = useCallback((n: Incoming) => {
    const s = settingsRef.current;
    const cat = categoryFor(n.experienceKey, n.priority);
    const sound: FixiSoundId = s.sounds[cat];
    const repeat = alertCategories[cat].repeat;
    clearTimers();
    const gap = (soundDuration(sound) + 1.6) * 1000;
    for (let i = 0; i < repeat; i++) timers.current.push(setTimeout(() => {
      if (sound !== 'silence' && s.volume > 0 && !playFixiSound(sound, s.volume)) setAudioReady(false);
      if (s.vibrate && 'vibrate' in navigator) try { navigator.vibrate(vibrationFor[cat]); } catch {}
      if (i === 0 && s.voice) timers.current.push(setTimeout(() => speakAlert(n.title), soundDuration(sound) * 1000 + 250));
    }, i * gap));
  }, []);

  const announce = useCallback((n: Incoming) => {
    if (!n.id || announced.current.has(n.id)) return;
    announced.current.add(n.id);
    if (announced.current.size > 120) announced.current = new Set([...announced.current].slice(-75));
    setToast(n);
    alert(n);
    const cat = categoryFor(n.experienceKey, n.priority);
    const sticky = alertCategories[cat].repeat > 1;
    if (!sticky) timers.current.push(setTimeout(() => setToast(t => (t?.id === n.id ? null : t)), 7000));
    // Onglet caché sans Push : notification système directe.
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      navigator.serviceWorker?.ready.then(r => r.pushManager.getSubscription()).then(sub => {
        if (!sub) navigator.serviceWorker.ready.then(r => r.showNotification(n.title, { body: n.message, tag: n.id, icon: `/icons/${space}-192.png`, badge: '/icons/badge-96.png', data: { href: n.href || spaceHref } }));
      }).catch(() => {});
    }
  }, [alert, space, spaceHref]);

  async function load(fromRealtime = false) {
    try {
      const r = await fetch(apiUrl, { cache: 'no-store' }); if (!r.ok) return;
      const j = await r.json(), next: Incoming[] = Array.isArray(j.rows) ? j.rows : [];
      const newest = next[0];
      if (!initial.current && fromRealtime && newest && newest.id !== lastId.current) announce(newest);
      setRows(next); setUnread(Number(j.unread || 0));
      if (newest) lastId.current = newest.id;
      initial.current = false;
    } catch { /* la reconnexion ou le prochain passage réessaiera */ }
  }

  useEffect(() => {
    // Réglages : nouveau format, avec reprise de l'ancien volume / son coupé.
    let raw: string | null = null;
    try { raw = localStorage.getItem(storageKey + ':alerts'); } catch {}
    const parsed = parseAlertSettings(raw);
    if (!raw) {
      try {
        if (localStorage.getItem(storageKey + ':sound') === '0') parsed.volume = 0;
        const v = Number(localStorage.getItem(storageKey + ':volume'));
        if (localStorage.getItem(storageKey + ':volume') !== null && Number.isFinite(v)) parsed.volume = Math.max(parsed.volume ? .5 : 0, v);
      } catch {}
    }
    setSettings(parsed);
    setAudioReady(notificationAudioStatus() === 'READY');
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    const prime = () => { void primeNotificationAudio().then(setAudioReady); };
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    void load();
    const es = new EventSource(eventsUrl);
    es.onmessage = ev => {
      try {
        const e = JSON.parse(ev.data);
        if (e.type === 'notification.created') {
          const n = e.payload;
          if (n?.id && n?.message) { announce(n); void load(false); } else void load(true);
          onEvent?.(n);
        }
      } catch { void load(true); }
    };
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 25000);
    const vis = () => { if (document.visibilityState === 'visible') { clearTimers(); void load(true); } };
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pointerdown', prime); window.removeEventListener('keydown', prime); document.removeEventListener('visibilitychange', vis); es.close(); clearInterval(t); clearTimers(); };
  }, []);

  // Pastille sur l'icône de l'appli + résumé permanent sur l'écran verrouillé.
  useEffect(() => {
    try { const nav = navigator as any; if (nav.setAppBadge) unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge?.(); } catch {}
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    const latest = rows.find(r => !r.readAt);
    navigator.serviceWorker.ready.then(reg => reg.active?.postMessage(
      settings.summary && unread > 0
        ? { type: 'FIXI_SUMMARY', space: space === 'atelier' ? 'atelier' : space, href: spaceHref, badge: unread, title: `${spaceTitle} · ${unread} alerte${unread > 1 ? 's' : ''} à voir`, body: latest ? `Dernière : ${latest.title}` : '' }
        : { type: 'FIXI_SUMMARY', space, clear: true },
    )).catch(() => {});
  }, [unread, rows, settings.summary]);

  function save(next: AlertSettings) {
    setSettings(next);
    try { localStorage.setItem(storageKey + ':alerts', JSON.stringify(next)); } catch {}
  }
  async function test(sound: FixiSoundId, cat?: AlertCategory) {
    const ok = await primeNotificationAudio(); setAudioReady(ok);
    if (ok) playFixiSound(sound, settings.volume || .6);
    if (cat && settings.vibrate && 'vibrate' in navigator) try { navigator.vibrate(vibrationFor[cat]); } catch {}
  }
  async function sendTestPush() {
    if (testing) return;
    setTesting(true); setTestStatus('');
    try {
      const r = await fetch(testUrl, { method: 'POST', credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setTestStatus(j.error || 'Le test a été refusé.');
      else if (Number(j.pushAcceptedByGateway || 0) > 0) setTestStatus('Envoyé. Verrouillez le téléphone : la notification doit apparaître dans quelques secondes.');
      else setTestStatus('Ce téléphone n’est pas encore inscrit aux alertes. Touchez « Activer » ci-dessus puis réessayez.');
    } catch { setTestStatus('Pas de connexion internet. Réessayez.'); }
    finally { setTesting(false); }
  }
  async function mark(id: string) {
    try {
      const r = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'READ', id }) });
      if (!r.ok) return;
      setRows(x => x.map(n => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread(x => Math.max(0, x - 1));
    } catch {}
  }
  async function markAll() {
    try {
      const r = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'READ_ALL' }) });
      if (!r.ok) return;
      setRows(x => x.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() }))); setUnread(0);
    } catch {}
  }
  function go(n: Incoming) {
    clearTimers(); setToast(null);
    if (!n.readAt) void mark(n.id);
    setOpen(false);
    if (n.href) { if (onNavigate) onNavigate(n.href); else window.location.assign(n.href); }
  }
  function dismiss() { clearTimers(); setToast(null); }
  const close = useCallback(() => { setOpen(false); setView('list'); }, []);

  const list = rows.filter(n => filter === 'ALL' || !n.readAt).slice(0, 30);
  const cats = categoriesForSpace[space];
  const lockedOk = pushOn === true && permission === 'granted';

  return <div className="rt-notifications">
    <button type="button" className={'rt-bell ' + (unread ? 'active' : '')} onClick={() => { setOpen(true); setView('list'); }}
      aria-label={'Notifications' + (unread ? ` — ${unread} non lues` : '')} title="Notifications">
      {unread ? <BellRing /> : <Bell />}{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
    </button>

    <FxSheet open={open} onClose={close} label="Notifications"
      title={view === 'list' ? 'Notifications' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><button type="button" className="fx-icon-btn" style={{ width: 36, height: 36 }} onClick={() => setView('list')} aria-label="Retour"><ChevronLeft size={18} /></button>Réglages des alertes</span>}
      subtitle={view === 'list' ? (unread ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu') : spaceTitle}>
      {view === 'list' ? <div className="fx-notif">
        {!lockedOk && <div className="fx-notif-callout">
          <LockKeyhole size={22} />
          <div><b>Recevez les alertes même téléphone verrouillé</b><small>Nouvelle commande, livraison, appareil prêt… sans ouvrir l’application.</small></div>
          <PushToggle subscribeUrl={subscribeUrl} label onStateChange={on => { setPushOn(on); setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission); }} />
          <VideoHelpButton id="alertes" />
        </div>}
        <div className="fx-notif-bar">
          <div className="fx-seg" role="group" aria-label="Filtrer">
            <button type="button" aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')}>Toutes</button>
            <button type="button" aria-pressed={filter === 'UNREAD'} onClick={() => setFilter('UNREAD')}>Non lues{unread ? ` (${unread})` : ''}</button>
          </div>
          {unread > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void markAll()}><CheckCheck size={16} /> Tout lire</button>}
        </div>
        <div className="fx-notif-list">
          {list.map(n => { const Icon = iconFor(n); const cat = categoryFor(n.experienceKey, n.priority);
            return <button type="button" key={n.id} className={'fx-notif-item fx-cat-' + cat + (n.readAt ? '' : ' is-unread')} onClick={() => go(n)}>
              <i><Icon /></i><span><b>{n.title}</b><small>{n.message}</small><time>{ago(n.createdAt)}</time></span>{!n.readAt && <em aria-label="non lue" />}
            </button>; })}
          {!list.length && <div className="fx-notif-empty"><Bell /><b>{filter === 'UNREAD' ? 'Tout est lu' : 'Aucune notification'}</b><span>Les événements importants apparaîtront ici.</span></div>}
        </div>
        <div className="fx-notif-foot">
          <button type="button" className="btn btn-ghost" onClick={() => setView('settings')}><Settings2 size={18} /> Sons et alertes</button>
          {allHref && <Link className="btn btn-ghost" href={allHref} onClick={close}>Historique complet</Link>}
        </div>
      </div> : <div className="fx-notif fx-notif-settings">
        <section>
          <h3><LockKeyhole size={16} /> Téléphone verrouillé</h3>
          <div className="fx-set-row">
            <span><b>{lockedOk ? 'Alertes activées sur ce téléphone' : 'Alertes désactivées sur ce téléphone'}</b><small>{permission === 'denied' ? 'Bloquées dans les réglages du navigateur : autorisez « Notifications » pour ce site.' : 'Fonctionne même application fermée.'}</small></span>
            <PushToggle subscribeUrl={subscribeUrl} label onStateChange={on => { setPushOn(on); setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission); }} />
          </div>
          <div className="fx-set-row">
            <span><b>Résumé permanent</b><small>Une ligne discrète sur l’écran verrouillé : nombre d’alertes à voir et la dernière.</small></span>
            <Switch on={settings.summary} onChange={v => save({ ...settings, summary: v })} label="Résumé permanent" />
          </div>
          <button type="button" className="btn btn-ghost btn-block" disabled={testing} onClick={() => void sendTestPush()}><Send size={17} /> {testing ? 'Envoi…' : 'M’envoyer une notification d’essai'}</button>
          {testStatus && <p className="fx-set-status" role="status">{testStatus}</p>}
        </section>

        {space === 'supplier' && <SupplierWhatsAppAlerts />}

        <section>
          <h3><Volume2 size={16} /> Sons (application ouverte)</h3>
          {!audioReady && <p className="fx-set-status">Touchez un bouton ▶ pour autoriser le son sur ce téléphone.</p>}
          {cats.map(cat => <div className="fx-set-sound" key={cat}>
            <span><b>{alertCategories[cat].label}</b><small>{alertCategories[cat].hint}{alertCategories[cat].repeat > 1 ? ' · répété jusqu’à ouverture' : ''}</small></span>
            <select className="select" value={settings.sounds[cat]} aria-label={`Son : ${alertCategories[cat].label}`}
              onChange={e => { const id = e.target.value as FixiSoundId; save({ ...settings, sounds: { ...settings.sounds, [cat]: id } }); void test(id, cat); }}>
              {(Object.keys(fixiSounds) as FixiSoundId[]).map(id => <option key={id} value={id}>{fixiSounds[id].label}</option>)}
            </select>
            <button type="button" className="fx-icon-btn" onClick={() => void test(settings.sounds[cat], cat)} aria-label={`Écouter : ${alertCategories[cat].label}`}><Play size={18} /></button>
          </div>)}
          <label className="fx-set-volume"><span><b>Volume</b><small>{Math.round(settings.volume * 100)} %</small></span>
            <input type="range" min={0} max={100} step={5} value={Math.round(settings.volume * 100)} onChange={e => save({ ...settings, volume: Number(e.target.value) / 100 })} onPointerUp={() => void test(settings.sounds[cats[0]])} />
          </label>
          <div className="fx-set-row"><span><b><Vibrate size={15} /> Vibration</b><small>Motif différent pour chaque type d’alerte.</small></span><Switch on={settings.vibrate} onChange={v => save({ ...settings, vibrate: v })} label="Vibration" /></div>
          <div className="fx-set-row"><span><b><Mic size={15} /> Annonce vocale</b><small>Le téléphone lit le titre : « Nouvelle commande… ».</small></span><Switch on={settings.voice} onChange={v => { save({ ...settings, voice: v }); if (v) speakAlert('Annonce vocale activée'); }} label="Annonce vocale" /></div>
        </section>

        <section>
          <h3>Affichage</h3>
          <TextSizeToggle variant="row" />
        </section>

        <section>
          <VideoHelpButton id="alertes" />
          <button type="button" className="fx-set-help-toggle" aria-expanded={help} onClick={() => setHelp(h => !h)}><Smartphone size={16} /> Je ne reçois rien ou pas de son <ChevronDown size={16} /></button>
          {help && <ul className="fx-set-help">
            <li><b>Android :</b> Réglages › Applications › Chrome (ou Fixi) › Notifications : tout autoriser. Désactivez l’économie de batterie pour Chrome.</li>
            <li><b>iPhone :</b> installez d’abord Fixi sur l’écran d’accueil (Partager › Sur l’écran d’accueil), ouvrez-le depuis l’icône, puis activez les alertes. iOS 16.4 minimum.</li>
            <li><b>Son quand le téléphone est verrouillé :</b> c’est le son de notification du téléphone qui est utilisé. Les sons Fixi ci-dessus jouent quand l’application est ouverte.</li>
            <li><b>Mode silencieux / Ne pas déranger :</b> aucun son ne passe, seule la vibration reste possible.</li>
          </ul>}
        </section>
      </div>}
    </FxSheet>

    {toast && typeof document !== 'undefined' && createPortal(<div role={alertCategories[categoryFor(toast.experienceKey, toast.priority)].repeat > 1 ? 'alert' : 'status'}
      className={'fx-toast fx-cat-' + categoryFor(toast.experienceKey, toast.priority)}>
      <i>{(() => { const I = iconFor(toast); return <I />; })()}</i>
      <button type="button" className="fx-toast-body" onClick={() => go(toast)}>
        <b>{toast.title}</b><span>{toast.message}</span>{toast.href && <em>Voir →</em>}
      </button>
      <button type="button" className="fx-toast-close" aria-label="Masquer" onClick={dismiss}><X size={18} /></button>
    </div>, document.body)}
  </div>;
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="fx-switch" onClick={() => onChange(!on)}><span /></button>;
}

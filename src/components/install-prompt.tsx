'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, Share, SquarePlus, Zap, BellRing, Maximize, Download } from 'lucide-react';
import { canPromptInstall, isIosSafari, isStandalone, onInstallChange, promptInstall, INSTALL_OPEN_EVENT } from '@/lib/install-prompt';
import { icon, spaceForPath, spaces } from '@/lib/pwa';
import { VideoHelpButton } from './video-help';

const SNOOZE_DAYS = 5;

// Carte « Installer l'application » : sur Android elle déclenche l'installation native,
// sur iPhone elle montre les 2 gestes à faire dans Safari. Une fois refusée, elle se tait 5 jours.
export function InstallPrompt() {
  const pathname = usePathname() || '/';
  const space = spaceForPath(pathname);
  const info = spaces[space];
  const key = `fixi-install-snooze-${space}`;
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [native, setNative] = useState(false);
  const [android, setAndroid] = useState(false);
  // Uniquement dans les espaces de travail : jamais sur les pages vues par les clients finaux.
  const enabled = /^\/(app|login|onboarding|change-pin|supplier|delivery|saas)(\/|$)/.test(pathname);
  // Ouverture automatique seulement sur les pages d'accueil : jamais au milieu d'une réception, d'une caisse ou d'un formulaire.
  const autoOk = /^\/(app\/dashboard|app|login|supplier\/login|delivery\/login|supplier|delivery)\/?$/.test(pathname);

  useEffect(() => {
    if (!enabled || isStandalone()) return;
    const iosDevice = isIosSafari();
    const androidDevice = /Android/i.test(navigator.userAgent);
    setAndroid(androidDevice);
    setIos(iosDevice);
    setNative(canPromptInstall());
    let snoozedUntil = 0;
    try { snoozedUntil = Number(localStorage.getItem(key) || 0); } catch {}
    const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 900;
    const typing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
    const show = () => { if (autoOk && !typing() && !isStandalone() && Date.now() > snoozedUntil && mobile && (iosDevice || androidDevice || canPromptInstall())) setOpen(true); };
    const t = setTimeout(show, 2500);
    const off = onInstallChange(() => { setNative(canPromptInstall()); if (isStandalone()) setOpen(false); else show(); });
    const force = () => { if (!isStandalone()) setOpen(true); };
    window.addEventListener(INSTALL_OPEN_EVENT, force);
    return () => { clearTimeout(t); off(); window.removeEventListener(INSTALL_OPEN_EVENT, force); };
  }, [key, enabled, autoOk]);

  useEffect(() => { if (!autoOk) setOpen(false); }, [autoOk]);

  function later() {
    try { localStorage.setItem(key, String(Date.now() + SNOOZE_DAYS * 86400000)); } catch {}
    setOpen(false);
  }
  async function install() {
    const r = await promptInstall();
    if (r !== 'dismissed') setOpen(false); else later();
  }

  if (!enabled) return null;
  return <aside className="fx-install" data-open={open} inert={!open} aria-label={`Installer ${info.name}`} role="dialog">
    <button type="button" className="fx-install-close" onClick={later} aria-label="Plus tard"><X size={18} /></button>
    <div className="fx-install-head">
      <img src={icon(space, '192')} alt="" width={56} height={56} />
      <div><b>Installer {info.name}</b><small>{info.description}</small></div>
    </div>
    <ul className="fx-install-perks">
      <li><Zap size={16} /> Ouverture en un toucher</li>
      <li><Maximize size={16} /> Plein écran, sans barre du navigateur</li>
      <li><BellRing size={16} /> Alertes même téléphone verrouillé</li>
    </ul>
    {ios && !native ? <ol className="fx-install-ios">
      <li><span>1</span> Touchez <Share size={18} aria-label="Partager" /> en bas de Safari</li>
      <li><span>2</span> Choisissez <SquarePlus size={18} aria-hidden="true" /> « Sur l’écran d’accueil »</li>
    </ol> : native ? <div className="fx-install-actions">
      <button type="button" className="btn btn-ghost" onClick={later}>Plus tard</button>
      <button type="button" className="btn btn-primary" onClick={install}>Installer</button>
    </div> : <p className="fx-install-hint">Ouvrez le menu du navigateur (⋮) puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».</p>}
    {android && <a className="fx-install-apk" href="/android"><Download size={16} /> Ou télécharger l’application Android (avec widget)</a>}
    <VideoHelpButton id="installer" />
  </aside>;
}

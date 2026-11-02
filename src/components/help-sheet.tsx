'use client';
import Link from 'next/link';
import { LifeBuoy, Sparkles, SlidersHorizontal, Compass } from 'lucide-react';
import { replayTour } from './guided-tour';
import { FxSheet } from './fx-sheet';
import { useI18n } from './language-provider';
import { helpFor } from '@/lib/help-content';
import { VideoHelpButton } from './video-help';

// Centre d'aide contextuel : explique l'écran ouvert, en FR ou AR,
// avec une vidéo courte si elle existe, puis les accès au support.
export function HelpSheet({ open, onClose, pathname, onAdvanced, advanced }: {
  open: boolean; onClose: () => void; pathname: string; onAdvanced?: () => void; advanced?: boolean;
}) {
  const { lang } = useI18n();
  const help = helpFor(pathname);
  const t = (x: { fr: string; ar: string }) => (lang === 'ar' ? x.ar : x.fr);
  return <FxSheet open={open} onClose={onClose} title={<span data-no-i18n>{t(help.title)}</span>} subtitle={<span data-no-i18n>{lang === 'ar' ? 'كيف تستعمل هذه الشاشة' : 'Comment utiliser cet écran'}</span>} label="Aide">
    <div data-no-i18n>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>{t(help.intro)}</p>
      <ol className="fx-help-steps">{help.steps.map((s, i) => <li key={i}>{t(s)}</li>)}</ol>
      {help.tip && <div className="fx-help-tip">{t(help.tip)}</div>}
      {help.video && <div className="fx-help-video">
        {/\.mp4($|\?)/.test(help.video)
          ? <video src={help.video} controls playsInline preload="none" />
          : <iframe src={help.video} title={t(help.title)} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />}
      </div>}
      <div className="fx-help-links">
        <VideoHelpButton id="installer" />
        <VideoHelpButton id="alertes" />
        <button type="button" onClick={() => { onClose(); setTimeout(replayTour, 250); }}><Compass size={20} />{lang === 'ar' ? 'إعادة الجولة التعريفية' : 'Revoir la visite guidée'}</button>
        <Link href="/app/support" onClick={onClose}><LifeBuoy size={20} />{lang === 'ar' ? 'راسل فريق الدعم' : 'Écrire au support Fixi'}</Link>
        <Link href="/app/updates" onClick={onClose}><Sparkles size={20} />{lang === 'ar' ? 'الجديد في Fixi' : 'Voir les nouveautés'}</Link>
        {onAdvanced && !advanced && <button type="button" onClick={() => { onAdvanced(); onClose(); }}><SlidersHorizontal size={20} />{lang === 'ar' ? 'إظهار كل الوحدات (الوضع المتقدم)' : 'Afficher tous les modules (Mode Avancé)'}</button>}
      </div>
    </div>
  </FxSheet>;
}

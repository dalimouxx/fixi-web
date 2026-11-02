'use client';
import { useCallback, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { FxSheet } from './fx-sheet';

// Vidéos d'aide de 30 s (sous-titres darija + français), servies depuis /videos.
export const helpVideos = {
  installer: { src: '/videos/fixi-installer.mp4', poster: '/videos/fixi-installer.jpg', title: 'Installer Fixi sur le téléphone', ar: 'ركّب Fixi على تليفونك' },
  alertes: { src: '/videos/fixi-alertes.mp4', poster: '/videos/fixi-alertes.jpg', title: 'Activer les alertes et le son', ar: 'فعّل التنبيهات والصوت' },
} as const;
export type HelpVideoId = keyof typeof helpVideos;

export function VideoHelpButton({ id, className = 'fx-video-link' }: { id: HelpVideoId; className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const v = helpVideos[id];
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}><PlayCircle size={18} /> Vidéo 30 s : {v.title.toLowerCase()}</button>
    <FxSheet open={open} onClose={close} title={v.title} subtitle={<span dir="rtl" data-no-i18n>{v.ar}</span>} label={v.title}>
      {open && <video className="fx-video" src={v.src} poster={v.poster} controls autoPlay muted playsInline preload="metadata" />}
    </FxSheet>
  </>;
}

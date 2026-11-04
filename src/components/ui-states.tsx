'use client';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/** États communs à toutes les applications Fixi : chargement, vide (avec une action), erreur (avec « Réessayer »). */
export function Skeleton({ lines = 3, card = false }: { lines?: number; card?: boolean }) {
  return <div className={'fx-skel' + (card ? ' fx-skel--card' : '')} aria-busy="true" aria-label="Chargement…">{Array.from({ length: lines }).map((_, i) => <i key={i} style={{ width: `${92 - (i % 3) * 18}%` }} />)}</div>;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }: { icon?: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return <div className="fx-state fx-state--empty"><span className="fx-state-ico"><Icon size={26} /></span><b>{title}</b>{text && <p>{text}</p>}{action}</div>;
}

export function ErrorState({ message = 'Une erreur est survenue', onRetry }: { message?: string; onRetry?: () => void }) {
  return <div className="fx-state fx-state--error" role="alert"><span className="fx-state-ico"><AlertTriangle size={24} /></span><b>{message}</b><p>Vérifiez la connexion Internet puis réessayez.</p>{onRetry && <button className="btn btn-soft btn-sm" onClick={onRetry}><RefreshCw size={15} /> Réessayer</button>}</div>;
}

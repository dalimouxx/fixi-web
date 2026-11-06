'use client';
import { useEffect } from 'react';
import { reportClientError } from './error-reporter';

/** Écran affiché quand une page plante : message clair, bouton pour réessayer, erreur signalée à l'équipe Fixi. */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error?.message || 'Page en erreur', `${error?.digest || ''}\n${error?.stack || ''}`); }, [error]);
  return <div className="fxm-error" role="alert">
    <div className="fxm-error-card">
      <div className="fxm-error-ico" aria-hidden="true">!</div>
      <h1>Oups, cette page a rencontré un problème</h1>
      <p>L’équipe Fixi est prévenue automatiquement. Vos données sont en sécurité : réessayez, ou revenez à l’accueil.</p>
      <div className="fxm-error-actions">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>Réessayer</button>
        <a className="btn btn-ghost" href="/app/dashboard">Accueil</a>
      </div>
      {error?.digest && <small>Référence : {error.digest}</small>}
    </div>
  </div>;
}

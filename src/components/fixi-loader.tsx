import { FixiAnimatedLogo } from './fixi-animated-logo';

/** Chargement d'une page : barre en haut + logo qui pulse avec un point en orbite. */
export function FixiLoader({ label = 'Chargement…' }: { label?: string }) {
  return (
    <>
      <div className="fxm-topbar" aria-hidden="true"><i /></div>
      <div className="fxm-loader" role="status" aria-live="polite">
        <div className="fxm-loader-mark">
          <span className="fxm-orbit" aria-hidden="true" />
          <FixiAnimatedLogo size={76} />
        </div>
        <div className="fxm-loader-label">{label}</div>
      </div>
    </>
  );
}

/** Petit indicateur pour les boutons en cours d'action (ex. « Encaissement… »). */
export function FixiSpinner() {
  return <span className="fxm-spinner" aria-hidden="true" />;
}

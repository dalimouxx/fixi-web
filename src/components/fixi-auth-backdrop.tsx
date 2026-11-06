import { ThemeToggle } from './theme-toggle';
/** Fond animé Fixi Max des écrans de connexion (aurore + bascule clair/sombre). */
export function FixiAuthBackdrop(){
  return <>
    <div className="fxm-aurora" aria-hidden="true"><span className="fxm-blob b1"/><span className="fxm-blob b2"/><span className="fxm-blob b3"/></div>
    <span className="fxm-auth-theme"><ThemeToggle/></span>
  </>;
}

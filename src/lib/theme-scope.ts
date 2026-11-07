/** Écrans dessinés uniquement en clair (pas de version sombre) : Fixi Control, pages légales, inscription, documents imprimables. */
export const LIGHT_ONLY_PREFIXES = ['/saas', '/conditions', '/confidentialite', '/mentions-legales', '/inscription', '/stores', '/supplier/daily-report', '/supplier/returns-report', '/supplier/delivery', '/receipt', '/label', '/etiquette', '/warranty'];

export function isLightOnly(path: string) {
  return LIGHT_ONLY_PREFIXES.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'));
}

/** Script du <head> : applique le thème avant l'affichage (évite le flash). */
export const THEME_HEAD_SCRIPT = `try{var t=localStorage.getItem('fixi-text-size');if(t==='large')document.documentElement.dataset.text='large';var p=location.pathname,L=${JSON.stringify(LIGHT_ONLY_PREFIXES)};var lo=L.some(function(x){return p===x||p.indexOf(x+'/')===0});if(!lo&&localStorage.getItem('fixi-theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;

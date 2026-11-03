// Lecture/écriture locale protégée : la caisse continue même si le stockage Windows est indisponible.
export function readJson<T>(key:string,fallback:T):T{try{const v=localStorage.getItem(key);return v?JSON.parse(v) as T:fallback}catch{return fallback}}
export function writeJson(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
export type Settings={lang:'fr'|'ar';theme:'auto'|'light'|'dark';drawerPrinter:string;drawerAuto:boolean;customerDisplay:boolean};
export const defaultSettings:Settings={lang:'fr',theme:'auto',drawerPrinter:'',drawerAuto:true,customerDisplay:false};
export const SETTINGS_KEY='fixi:v6:settings';

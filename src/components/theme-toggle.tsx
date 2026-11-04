'use client';
import { useEffect,useState } from 'react';import { Moon,Sun } from 'lucide-react';
/** Mode clair / sombre (choix enregistré sur l'appareil ; clair par défaut). */
export function ThemeToggle(){
 const[dark,setDark]=useState(false);
 useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('fixi-theme')}catch{}const d=saved==='dark';setDark(d);document.documentElement.dataset.theme=d?'dark':'light'},[]);
 function toggle(){const d=!dark;const apply=()=>{setDark(d);document.documentElement.dataset.theme=d?'dark':'light'};try{localStorage.setItem('fixi-theme',d?'dark':'light')}catch{}
  const doc=document as any;const calm=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(doc.startViewTransition&&!calm)doc.startViewTransition(apply);else apply()}
 return <button type="button" className="fx-icon-btn theme-toggle" aria-pressed={dark} onClick={toggle} title={dark?'Mode clair':'Mode sombre'} aria-label={dark?'Passer en mode clair':'Passer en mode sombre'}>{dark?<Sun size={16}/>:<Moon size={16}/>}</button>;
}

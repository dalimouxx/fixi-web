'use client';
import { useEffect,useState } from 'react';import { Moon,Sun } from 'lucide-react';
/** Mode clair / sombre. Sans choix enregistré, suit le réglage du téléphone ou de l'ordinateur. */
export function ThemeToggle(){
 const[dark,setDark]=useState(false);
 useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('fixi-theme')}catch{}const d=saved?saved==='dark':!!window.matchMedia?.('(prefers-color-scheme: dark)').matches;setDark(d);document.documentElement.dataset.theme=d?'dark':'light'},[]);
 function toggle(){const d=!dark;setDark(d);document.documentElement.dataset.theme=d?'dark':'light';try{localStorage.setItem('fixi-theme',d?'dark':'light')}catch{}}
 return <button type="button" className="fx-icon-btn theme-toggle" aria-pressed={dark} onClick={toggle} title={dark?'Mode clair':'Mode sombre'} aria-label={dark?'Passer en mode clair':'Passer en mode sombre'}>{dark?<Sun size={16}/>:<Moon size={16}/>}</button>;
}

import React,{useEffect,useState} from 'react';
import {BatteryFull,Cable,Camera,Cpu,Headphones,Package,Plug,Shield,Smartphone,Wrench,type LucideIcon} from 'lucide-react';

/** Logo FIXI (même dessin que l'icône de l'application). */
export function FixiLogo({size=40,className=''}:{size?:number;className?:string}){
 return <svg className={'v7-logo '+className} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
  <defs><linearGradient id="fxg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F0782B"/><stop offset="1" stopColor="#B9470A"/></linearGradient></defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#fxg)"/>
  <g transform="translate(256 256) scale(.86) translate(-262 -250)" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
   <path d="M167 374V151a25 25 0 0 1 25-25h156" strokeWidth="65"/><path d="M167 244h140" strokeWidth="65"/><path d="m296 375 76-76m0 76-76-76" strokeWidth="43"/></g>
 </svg>;
}

const RULES:[RegExp,LucideIcon,string][]=[
 [/ecran|afficheur|lcd|oled|display|tactile/,Smartphone,'#f0782b'],
 [/batter/,BatteryFull,'#16a34a'],
 [/connect|charge|port|nappe|flex/,Plug,'#2563eb'],
 [/camera|objectif/,Camera,'#7c3aed'],
 [/haut.?parleur|audio|ecouteur|micro|speaker/,Headphones,'#db2777'],
 [/coque|vitre|protection|verre|back/,Shield,'#0d9488'],
 [/cable|chargeur|adaptateur/,Cable,'#ca8a04'],
 [/puce|ic\b|carte|cpu|chip/,Cpu,'#475569'],
 [/outil|tournevis|kit/,Wrench,'#57534e'],
];
const n=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/** Icône et couleur d'un article selon sa catégorie (ou son nom). */
export function categoryLook(category?:string|null,name=''):{Icon:LucideIcon;color:string}{
 const hay=n((category||'')+' '+name);
 for(const [re,Icon,color] of RULES)if(re.test(hay))return {Icon,color};
 return {Icon:Package,color:'#78716c'};
}

/** Heure et date du comptoir, mises à jour toutes les 20 secondes. */
export function Clock(){
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const t=window.setInterval(()=>setNow(new Date()),20000);return()=>window.clearInterval(t)},[]);
 return <div className="v7-clock" aria-label="Heure"><b>{now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</b><small>{now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</small></div>;
}

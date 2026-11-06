import React,{useEffect,useId,useState} from 'react';
import {BatteryFull,Cable,Camera,Cpu,Headphones,Package,Plug,Shield,Smartphone,Wrench,type LucideIcon} from 'lucide-react';

/** Logo FIXI animé (Fixi Max) : anneau dégradé qui tourne et « F » qui se dessine, comme sur le web. */
export function FixiLogo({size=40,className=''}:{size?:number;className?:string}){
 const id='fxm-g'+useId().replace(/:/g,'');
 return <span className={'fxm-logo v7-logo '+className} style={{['--fxm-logo-size' as any]:size+'px'}} aria-hidden="true"><span className="fxm-logo-core">
  <svg viewBox="0 0 38 38" fill="none" strokeLinecap="round" strokeLinejoin="round" focusable="false">
   <defs><linearGradient id={id} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#FF9A4D"/><stop offset="1" stopColor="#FF3D77"/></linearGradient></defs>
   <path className="fxm-logo-f" d="M11 30V9.5a2 2 0 0 1 2-2h15" stroke={`url(#${id})`} strokeWidth="5.2"/>
   <path className="fxm-logo-f" d="M11 18.5h13.2" stroke={`url(#${id})`} strokeWidth="5.2"/>
   <path className="fxm-logo-f" d="m23 29.5 6.5-6.5m0 6.5L23 23" stroke="#FFFFFF" strokeWidth="3.8"/>
  </svg></span></span>;
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

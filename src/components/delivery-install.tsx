'use client';
import {useEffect,useState} from 'react';
import {Download,CheckCircle2,Smartphone} from 'lucide-react';

export function DeliveryInstall(){
 const[installed,setInstalled]=useState(false);const[prompt,setPrompt]=useState<any>(null);const[ios,setIos]=useState(false);
 useEffect(()=>{
  const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone===true;setInstalled(standalone);
  setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
  const fn=(e:any)=>{e.preventDefault();setPrompt(e)};window.addEventListener('beforeinstallprompt',fn);
  const done=()=>{setInstalled(true);setPrompt(null)};window.addEventListener('appinstalled',done);
  return()=>{window.removeEventListener('beforeinstallprompt',fn);window.removeEventListener('appinstalled',done)}
 },[]);
 async function install(){if(!prompt)return;await prompt.prompt();await prompt.userChoice.catch(()=>null);setPrompt(null)}
 if(installed)return <div className="delivery-install installed"><CheckCircle2/><span><b>Application installée</b><small>Fixi Delivery fonctionne en mode application.</small></span></div>;
 return <div className="delivery-install"><Smartphone/><span><b>Installer Fixi Delivery sur ce téléphone</b><small>{ios?'Safari → Partager → Ajouter à l’écran d’accueil':'Installation recommandée pour les notifications et la tournée.'}</small></span>{prompt&&<button className="btn btn-primary btn-sm" onClick={install}><Download/> Installer</button>}</div>
}

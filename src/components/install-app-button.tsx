'use client';
import {useEffect,useState} from 'react';
import {Download,CheckCircle2} from 'lucide-react';

export function InstallAppButton({label='Installer'}:{label?:string}){
 const[prompt,setPrompt]=useState<any>(null);const[installed,setInstalled]=useState(false);
 useEffect(()=>{
  const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone===true;setInstalled(standalone);
  const h=(e:any)=>{e.preventDefault();setPrompt(e)};const done=()=>{setInstalled(true);setPrompt(null)};
  window.addEventListener('beforeinstallprompt',h as any);window.addEventListener('appinstalled',done);
  return()=>{window.removeEventListener('beforeinstallprompt',h as any);window.removeEventListener('appinstalled',done)}
 },[]);
 async function install(){if(!prompt)return;await prompt.prompt();await prompt.userChoice;setPrompt(null)}
 if(installed)return <span className="install-app installed"><CheckCircle2/> Installée</span>;
 return <button className="install-app" onClick={install} disabled={!prompt} title={prompt?'Installer sur ce téléphone':'Utilisez le menu du navigateur > Ajouter à l’écran d’accueil'}><Download/>{label}</button>
}

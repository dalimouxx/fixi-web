// Dictée vocale (Web Speech API) : démarrage commun, langue de l'interface, messages d'erreur clairs.
export function speechSupported(){return typeof window!=='undefined'&&!!((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition)}
export function speechError(code:string){
 const m:Record<string,string>={
  'not-allowed':'Micro refusé : autorisez le micro pour Fixi (icône 🔒 à côté de l’adresse, ou Paramètres Android → Applications → Fixi → Autorisations).',
  'service-not-allowed':'La dictée est désactivée sur ce téléphone. Activez « Saisie vocale Google » dans les paramètres.',
  'audio-capture':'Aucun micro détecté.',
  'network':'La dictée a besoin d’Internet. Vérifiez la connexion.',
  'no-speech':'Je n’ai rien entendu. Parlez juste après le bip.',
  'language-not-supported':'Cette langue n’est pas disponible pour la dictée sur ce téléphone.',
 };
 return m[code]||'La dictée n’a pas fonctionné. Réessayez.';
}
export function startDictation({onText,onInterim,onEnd,onError,continuous=false}:{onText:(t:string)=>void;onInterim?:(t:string)=>void;onEnd:()=>void;onError:(msg:string)=>void;continuous?:boolean}){
 const C=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
 const r=new C();
 const lang=document.documentElement.lang;
 r.lang=lang==='ar'?'ar-TN':'fr-FR';r.interimResults=!!onInterim;r.continuous=continuous;r.maxAlternatives=1;
 let finalText='';
 r.onresult=(e:any)=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=String(e.results[i][0]?.transcript||'');if(e.results[i].isFinal)finalText+=t;else interim+=t}onInterim?.((finalText+' '+interim).trim())};
 r.onerror=(e:any)=>{if(e.error==='aborted')return;
  // Arabe tunisien parfois absent : on retente une fois en arabe standard.
  if(e.error==='language-not-supported'&&r.lang==='ar-TN'){try{r.lang='ar';r.start();return}catch{}}
  onError(speechError(e.error))};
 r.onend=()=>{const t=finalText.trim();if(t)onText(t.charAt(0).toUpperCase()+t.slice(1));onEnd()};
 try{r.start()}catch{onError('Le micro est déjà utilisé. Réessayez dans un instant.');onEnd()}
 return r;
}

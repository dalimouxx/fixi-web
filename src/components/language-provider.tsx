'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {Languages} from 'lucide-react';
import {translateAr} from '@/lib/i18n-dictionary';
type Lang='fr'|'ar';
const C=createContext<{lang:Lang;setLang:(x:Lang)=>void;t:(s:string)=>string}>({lang:'fr',setLang:()=>{},t:s=>s});
const textOriginal=new WeakMap<Node,string>();const attrOriginal=new WeakMap<Element,Map<string,string>>();
const attrs=['placeholder','title','aria-label'];
function process(root:Node,lang:Lang){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n:Node|null=root.nodeType===Node.TEXT_NODE?root:walker.nextNode();
  while(n){const parent=(n.parentElement);if(parent&&!parent.closest('[data-no-i18n]')&&!['SCRIPT','STYLE','CODE','PRE'].includes(parent.tagName)){if(!textOriginal.has(n))textOriginal.set(n,n.nodeValue||'');let src=textOriginal.get(n)||'';const current=n.nodeValue||'';if(lang==='ar'&&current!==src&&current!==translateAr(src)){textOriginal.set(n,current);src=current}n.nodeValue=lang==='ar'?translateAr(src):src;}n=walker.nextNode()}
  if(root instanceof Element){const els=[root,...Array.from(root.querySelectorAll('*'))];for(const el of els){if(el.closest('[data-no-i18n]'))continue;let saved=attrOriginal.get(el);if(!saved){saved=new Map();attrOriginal.set(el,saved)}for(const a of attrs){const v=el.getAttribute(a);if(v!==null&&!saved.has(a))saved.set(a,v);const src=saved.get(a);if(src!==undefined)el.setAttribute(a,lang==='ar'?translateAr(src):src)}}}
}
export function I18nProvider({children}:{children:React.ReactNode}){const[lang,setState]=useState<Lang>('fr');const[ready,setReady]=useState(false);useEffect(()=>{const saved=(localStorage.getItem('fixi_lang') as Lang|null);const initial=saved==='ar'||saved==='fr'?saved:(navigator.language?.startsWith('ar')?'ar':'fr');setState(initial);setReady(true)},[]);useEffect(()=>{if(!ready)return;localStorage.setItem('fixi_lang',lang);document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.body.dataset.lang=lang;let applying=false;const apply=(node:Node=document.body)=>{if(applying)return;applying=true;try{process(node,lang)}finally{applying=false}};apply();const obs=new MutationObserver(ms=>{if(applying)return;for(const m of ms){if(m.type==='childList')m.addedNodes.forEach(x=>apply(x));}});obs.observe(document.body,{subtree:true,childList:true});return()=>obs.disconnect()},[lang,ready]);const setLang=(x:Lang)=>setState(x);const value=useMemo(()=>({lang,setLang,t:(s:string)=>lang==='ar'?translateAr(s):s}),[lang]);return <C.Provider value={value}>{children}<button className="global-lang-toggle no-print" onClick={()=>setLang(lang==='fr'?'ar':'fr')} title={lang==='fr'?'العربية':'Français'}><Languages size={16}/><b>{lang==='fr'?'AR':'FR'}</b></button></C.Provider>}
export function useI18n(){return useContext(C)}

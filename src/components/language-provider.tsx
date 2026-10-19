'use client';

import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {Languages} from 'lucide-react';
import {translateAr} from '@/lib/i18n-dictionary';

export type FixiLang='fr'|'ar';
type LanguageContext={lang:FixiLang;setLang:(next:FixiLang)=>void;t:(s:string)=>string};
const C=createContext<LanguageContext>({lang:'fr',setLang:()=>{},t:s=>s});
const originalText=new WeakMap<Text,string>();
const originalAttrs=new WeakMap<Element,Map<string,string>>();
const attrs=['placeholder','title','aria-label'] as const;

function ignored(element:Element|null){
  return !element||!!element.closest('[data-no-i18n],[contenteditable="true"],[translate="no"]')
    ||['SCRIPT','STYLE','CODE','PRE','TEXTAREA','NOSCRIPT'].includes(element.tagName);
}

function translateNode(node:Node,lang:FixiLang){
  const visit=(n:Text)=>{
    const parent=n.parentElement;
    if(ignored(parent))return;
    let original=originalText.get(n);
    const current=n.nodeValue||'';
    if(original===undefined){original=current;originalText.set(n,original)}
    else{
      const lastTranslation=translateAr(original);
      // React may replace existing text without replacing the node.
      if(current!==original&&current!==lastTranslation){
        original=current;originalText.set(n,current);
      }
    }
    const desired=lang==='ar'?translateAr(original):original;
    if(n.nodeValue!==desired)n.nodeValue=desired;
  };
  if(node.nodeType===Node.TEXT_NODE)visit(node as Text);
  else {
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    let n:Node|null;
    while((n=walker.nextNode()))visit(n as Text);
  }
  const elements=node instanceof Element?[node,...Array.from(node.querySelectorAll('*'))]:[];
  for(const element of elements){
    if(ignored(element))continue;
    let originals=originalAttrs.get(element);
    if(!originals){originals=new Map();originalAttrs.set(element,originals)}
    for(const attr of attrs){
      const current=element.getAttribute(attr);
      if(current===null){originals.delete(attr);continue}
      let source=originals.get(attr);
      if(source===undefined||current!==source&&current!==translateAr(source)){
        source=current;originals.set(attr,current);
      }
      const desired=lang==='ar'?translateAr(source):source;
      if(current!==desired)element.setAttribute(attr,desired);
    }
  }
}

export function I18nProvider({children}:{children:React.ReactNode}){
  const[lang,setState]=useState<FixiLang>('fr');
  const[ready,setReady]=useState(false);
  useEffect(()=>{
    const saved=localStorage.getItem('fixi_lang');
    const initial:FixiLang=saved==='ar'||saved==='fr'?saved:navigator.language?.startsWith('ar')?'ar':'fr';
    setState(initial);setReady(true);
  },[]);
  useEffect(()=>{
    if(!ready)return;
    localStorage.setItem('fixi_lang',lang);
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.body.dataset.lang=lang;

    const pending=new Set<Node>();
    let queued=false;
    let observer:MutationObserver;
    const observe=()=>observer.observe(document.body,{
      subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...attrs],
    });
    const apply=(nodes:Node[])=>{
      observer.disconnect(); // Avoid observing our own translations.
      try{
        for(const node of nodes)if(node.isConnected)translateNode(node,lang);
      }finally{observe()}
    };
    observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        if(mutation.type==='childList')mutation.addedNodes.forEach(node=>pending.add(node));
        else pending.add(mutation.target);
      }
      if(queued||!pending.size)return;
      queued=true;
      queueMicrotask(()=>{
        queued=false;
        const nodes=Array.from(pending);
        pending.clear();
        apply(nodes);
      });
    });
    apply([document.body]);
    return()=>{observer.disconnect();pending.clear()};
  },[lang,ready]);
  const value=useMemo<LanguageContext>(()=>({
    lang,setLang:setState,t:(s:string)=>lang==='ar'?translateAr(s):s,
  }),[lang]);
  return <C.Provider value={value}>{children}
    <button type="button" className="global-lang-toggle no-print"
      onClick={()=>setState(current=>current==='fr'?'ar':'fr')}
      title={lang==='fr'?'العربية':'Français'}
      aria-label={lang==='fr'?'Passer en arabe':'التحويل إلى الفرنسية'}>
      <Languages size={16}/><b>{lang==='fr'?'AR':'FR'}</b>
    </button>
  </C.Provider>;
}
export function useI18n(){return useContext(C)}

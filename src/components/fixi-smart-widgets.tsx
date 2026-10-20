'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {
  ArrowDown,ArrowRight,ArrowUp,Banknote,Boxes,CheckCircle2,Clock3,CreditCard,
  LayoutGrid,PackageCheck,RefreshCw,Settings2,ShieldAlert,ShoppingBag,Store,
  Truck,Users,Wrench,X,Eye,EyeOff, type LucideIcon,
} from 'lucide-react';
import {
  moveWidget,normalizeWidgetPreferences,toggleWidgetHidden,
  type WidgetPreference,
} from '@/lib/widget-preferences';

const icons:Record<FixiWidgetIcon,LucideIcon>={
  orders:ShoppingBag,repairs:Wrench,delivery:Truck,finance:Banknote,
  due:CreditCard,stock:Boxes,clients:Users,ready:PackageCheck,
  alert:ShieldAlert,shop:Store,time:Clock3,success:CheckCircle2,
};

export type FixiWidgetIcon='orders'|'repairs'|'delivery'|'finance'|'due'|'stock'|
  'clients'|'ready'|'alert'|'shop'|'time'|'success';

export type FixiWidgetData={
  id:string;label:string;value:string|number;description?:string;
  icon:FixiWidgetIcon;accent?:'brand'|'success'|'warning'|'info'|'neutral';
  href?:string;action?:string;urgent?:boolean;
};

export type FixiWidgetArea='atelier'|'supplier'|'delivery'|'control';

type Props={
  area:FixiWidgetArea;
  widgets:FixiWidgetData[];
  onAction?:(action:string)=>void;
  subtitle?:string;
};

export function FixiSmartWidgets({area,widgets,onAction,subtitle}:Props){
  const ids=useMemo(()=>widgets.map(w=>w.id),[widgets]);
  const storageKey='fixi-smart-widgets:v1:'+area;
  const [customizing,setCustomizing]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [prefs,setPrefs]=useState<WidgetPreference>(()=>normalizeWidgetPreferences(ids,null));

  useEffect(()=>{
    let stored:unknown=null;
    try{const value=localStorage.getItem(storageKey);stored=value?JSON.parse(value):null;}catch{}
    setPrefs(normalizeWidgetPreferences(ids,stored));
    setHydrated(true);
  },[storageKey]);
  useEffect(()=>{
    if(!hydrated)return;
    setPrefs(p=>normalizeWidgetPreferences(ids,p));
  },[ids.join('|'),hydrated]);
  useEffect(()=>{
    if(!hydrated)return;
    try{localStorage.setItem(storageKey,JSON.stringify(prefs));}catch{}
  },[prefs,storageKey,hydrated]);

  const order=hydrated?normalizeWidgetPreferences(ids,prefs):normalizeWidgetPreferences(ids,null);
  const byId=new Map(widgets.map(w=>[w.id,w]));
  const visible=order.order.filter(id=>!order.hidden.includes(id)).map(id=>byId.get(id)).filter((w):w is FixiWidgetData=>!!w);
  const hidden=order.order.filter(id=>order.hidden.includes(id)).map(id=>byId.get(id)).filter((w):w is FixiWidgetData=>!!w);

  const hide=(id:string)=>setPrefs(p=>toggleWidgetHidden(ids,p,id));
  const move=(id:string,dir:-1|1)=>setPrefs(p=>moveWidget(ids,p,id,dir));
  const reset=()=>{
    const next=normalizeWidgetPreferences(ids,null);
    setPrefs(next);
    try{localStorage.removeItem(storageKey)}catch{}
  };

  return <section className={'fixi-widget-deck fixi-widget-deck-'+area}
    aria-label={'Widgets '+area}>
    <div className="fixi-widget-deck-header">
      <div className="fixi-widget-title-group">
        <span className="fixi-widget-eyebrow"><LayoutGrid size={15}/> FIXI SMART WIDGETS</span>
        <h2>Votre activité en un coup d’œil</h2>
        <p>{subtitle||'Vos indicateurs réels et vos actions prioritaires, toujours accessibles.'}</p>
      </div>
      <button type="button" className={'fixi-widget-edit-button'+(customizing?' active':'')}
        onClick={()=>setCustomizing(v=>!v)} aria-pressed={customizing}
        aria-expanded={customizing} aria-label={customizing?'Terminer la personnalisation':'Personnaliser les widgets'}>
        {customizing?<CheckCircle2 size={16}/>:<Settings2 size={16}/>}
        {customizing?'Terminer':'Personnaliser'}
      </button>
    </div>

    <div className="fixi-widget-grid">
      {visible.map((widget,index)=>{
        const Icon=icons[widget.icon],interactive=!customizing&&(!!widget.href||!!widget.action&&!!onAction);
        const inner=<>
          <div className="fixi-widget-top">
            <span className="fixi-widget-icon"><Icon size={21} strokeWidth={2.1}/></span>
            {widget.urgent&&<span className="fixi-widget-alert">À traiter</span>}
            {interactive&&<ArrowRight size={16} className="fixi-widget-arrow" aria-hidden="true"/>}
          </div>
          <span className="fixi-widget-label">{widget.label}</span>
          <strong className="fixi-widget-value" title={String(widget.value)}>{widget.value}</strong>
          <span className="fixi-widget-description">{widget.description||'Mis à jour automatiquement'}</span>
        </>;

        const control=<div className="fixi-widget-edit-actions">
          <button type="button" onClick={()=>move(widget.id,-1)} disabled={index===0}
            aria-label={'Déplacer '+widget.label+' vers le début'} title="Déplacer avant"><ArrowUp size={16}/></button>
          <button type="button" onClick={()=>move(widget.id,1)} disabled={index===visible.length-1}
            aria-label={'Déplacer '+widget.label+' vers la fin'} title="Déplacer après"><ArrowDown size={16}/></button>
          <button type="button" onClick={()=>hide(widget.id)} disabled={visible.length<=1}
            aria-label={'Masquer '+widget.label} title="Masquer"><EyeOff size={16}/></button>
        </div>;

        const classes='fixi-smart-widget fixi-widget-tone-'+(widget.accent||'brand')+
          (widget.urgent?' fixi-widget-urgent':'')+(interactive?' interactive':'');
        const content=<>{inner}{customizing&&control}</>;
        return customizing||!interactive?
          <article className={classes} key={widget.id}>{content}</article>:
          widget.href?
            <Link className={classes} href={widget.href} key={widget.id}
              aria-label={widget.label+': '+widget.value}>{content}</Link>:
            <button type="button" className={classes} key={widget.id}
              onClick={()=>onAction?.(widget.action!)} aria-label={widget.label+': '+widget.value}>{content}</button>;
      })}
    </div>

    {customizing&&<div className="fixi-widget-personalize">
      <div className="fixi-widget-personalize-header"><div><strong>Personnaliser mon tableau de bord</strong>
        <span>Déplacez, masquez ou réaffichez les widgets. Le choix reste enregistré sur cet appareil.</span></div>
        <button type="button" onClick={reset}><RefreshCw size={16}/> Réinitialiser</button>
      </div>
      {hidden.length>0&&<div className="fixi-widget-hidden">
        <b>Widgets masqués</b>
        {hidden.map(w=><button key={w.id} type="button" onClick={()=>hide(w.id)}>
          <Eye size={15}/> {w.label} <span>Afficher</span>
        </button>)}
      </div>}
      {!hidden.length&&<p className="fixi-widget-personalize-hint">Tous vos widgets sont visibles.</p>}
    </div>}
  </section>;
}

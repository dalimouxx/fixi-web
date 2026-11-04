'use client';
import {ReactNode,useRef,useState} from 'react';
import {ChevronsRight} from 'lucide-react';
import {haptic} from '@/lib/haptics';

/** « Glisser pour confirmer » (style applis de livraison) : évite les confirmations par erreur dans la poche.
 * À la souris ou au clavier, un appui suffit. */
export function SlideToConfirm({label,onConfirm,disabled,tone='brand',icon}:{label:string;onConfirm:()=>void;disabled?:boolean;tone?:'brand'|'ok'|'dark';icon?:ReactNode}){
 const track=useRef<HTMLDivElement>(null);const [x,setX]=useState(0);const [drag,setDrag]=useState(false);const start=useRef(0);const max=useRef(0);
 const rtl=useRef(false);
 function down(e:React.PointerEvent){if(disabled||e.pointerType==='mouse')return;const t=track.current;if(!t)return;rtl.current=getComputedStyle(t).direction==='rtl';max.current=t.clientWidth-56;start.current=e.clientX;setDrag(true);(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}
 function move(e:React.PointerEvent){if(!drag)return;const d=rtl.current?start.current-e.clientX:e.clientX-start.current;setX(Math.max(0,Math.min(max.current,d)))}
 function up(){if(!drag)return;setDrag(false);if(x>=max.current*0.85){setX(max.current);haptic('success');onConfirm();setTimeout(()=>setX(0),600)}else setX(0)}
 const pct=max.current?x/max.current:0;
 return <div ref={track} className={'fx-slide is-'+tone+(disabled?' is-disabled':'')+(drag?' is-dragging':'')} style={{['--p' as any]:pct}}>
  <span className="fx-slide-label">{label}</span>
  <button type="button" className="fx-slide-thumb" style={{transform:`translateX(${rtl.current?-x:x}px)`}} disabled={disabled} aria-label={label}
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{setDrag(false);setX(0)}}
   onClick={e=>{if((e.nativeEvent as PointerEvent).pointerType==='mouse'||e.detail===0){haptic('success');onConfirm()}}}>{icon||<ChevronsRight size={22}/>}</button>
 </div>;
}

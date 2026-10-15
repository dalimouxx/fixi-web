'use client';
import { useEffect,useState } from 'react';
export function BrandLogo({compact=false,dark=false}:{compact?:boolean;dark?:boolean}){const[b,setB]=useState<any>(null);useEffect(()=>{fetch('/api/public/branding').then(r=>r.ok?r.json():null).then(setB).catch(()=>{})},[]);return <div className={`fixi-brand ${compact?'compact':''} ${dark?'dark':''}`}>{b?.logoDataUrl?<img src={b.logoDataUrl} alt={b.appName||'Fixi'}/>:<i>F</i>}{!compact&&<span>{b?.appName||'fixi'}</span>}</div>}

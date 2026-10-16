'use client';

import {useEffect,useRef,useState} from 'react';
import {Camera,ScanLine,X,AlertTriangle} from 'lucide-react';

export function BarcodeCamera({onDetected,onClose}:{onDetected:(code:string)=>void;onClose:()=>void}){
 const video=useRef<HTMLVideoElement|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const stopped=useRef(false);
 const[err,setErr]=useState('');
 const[manual,setManual]=useState('');

 useEffect(()=>{
  stopped.current=false;
  let timer:any;
  async function start(){
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Caméra non disponible sur ce navigateur.');
    const BarcodeDetector=(window as any).BarcodeDetector;
    if(!BarcodeDetector)throw new Error('Détection automatique non supportée ici. Utilisez la saisie manuelle ou un lecteur code-barres.');
    const detector=new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code']});
    const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
    stream.current=s;if(video.current){video.current.srcObject=s;await video.current.play()}
    const scan=async()=>{
     if(stopped.current)return;
     try{
      if(video.current&&video.current.readyState>=2){
       const results=await detector.detect(video.current);
       const code=String(results?.[0]?.rawValue||'').trim();
       if(code){stop();onDetected(code);return}
      }
     }catch{}
     timer=setTimeout(scan,180);
    };
    scan();
   }catch(e:any){setErr(e.message||'Impossible d’ouvrir la caméra.')}
  }
  function stopLocal(){stopped.current=true;if(timer)clearTimeout(timer);for(const t of stream.current?.getTracks()||[])t.stop();stream.current=null}
  start();return stopLocal;
 },[]);

 function stop(){stopped.current=true;for(const t of stream.current?.getTracks()||[])t.stop();stream.current=null}
 function close(){stop();onClose()}
 function submit(e:any){e.preventDefault();const code=manual.trim();if(code){stop();onDetected(code)}}

 return <div className="supplier-modal-backdrop"><div className="supplier-modal barcode-camera-modal">
  <button className="supplier-modal-x" onClick={close}><X/></button>
  <span className="smart-kicker"><ScanLine size={13}/> SCANNER PRODUIT</span><h2>Scanner un code-barres</h2>
  <p>Présentez le code devant la caméra. Fixi ajoute automatiquement le produit trouvé au panier.</p>
  <div className="barcode-camera-view"><video ref={video} playsInline muted/><div className="barcode-scan-frame"/><Camera/></div>
  {err&&<div className="supplier-pos-alert error"><AlertTriangle/>{err}</div>}
  <form className="barcode-manual" onSubmit={submit}><label className="label">Ou saisir / scanner avec un lecteur</label><div><input autoFocus={!!err} className="input" value={manual} onChange={e=>setManual(e.target.value)} placeholder="EAN, UPC, Code 128, SKU…"/><button className="btn btn-primary">Ajouter</button></div></form>
 </div></div>
}

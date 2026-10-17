'use client';
import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {ShieldCheck} from 'lucide-react';
export function DeliveryProofCode({code}:{code:string}){
 const[src,setSrc]=useState('');useEffect(()=>{QRCode.toDataURL('FIXI-DELIVERY:'+code,{width:180,margin:1}).then(setSrc).catch(()=>{})},[code]);
 return <div className="shop-delivery-proof"><div><ShieldCheck/><span><b>Code sécurisé de remise</b><small>Ne le donnez au livreur qu’au moment où vous recevez réellement la commande.</small></span></div><section>{src&&<img src={src} alt="QR de remise"/>}<strong>{code}</strong></section></div>
}

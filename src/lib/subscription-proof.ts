const allowedMime=new Set(['image/jpeg','image/png','image/webp','application/pdf']);
/** Small, constrained proof; a photo of a transfer is not proof of settlement. */
export function validateSubscriptionProof(value:unknown):{valid:boolean;error?:string}{
 if(value==null||value==='')return {valid:true};
 if(typeof value!=='string')return {valid:false,error:'Justificatif invalide'};
 const match=/^data:([a-z]+\/[a-z0-9+.-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
 if(!match||!allowedMime.has(match[1].toLowerCase()))
   return {valid:false,error:'Formats autorisés : JPG, PNG, WebP ou PDF'};
 const bytes=Math.floor(match[2].length*3/4)-(match[2].endsWith('==')?2:match[2].endsWith('=')?1:0);
 if(bytes>2*1024*1024)return {valid:false,error:'Justificatif limité à 2 Mo'};
 if(bytes<50)return {valid:false,error:'Fichier justificatif vide ou trop petit'};
 return {valid:true};
}

export function normalizedTransferRef(value:unknown):string|null{
 if(value==null)return null;
 const normalized=String(value).trim().replace(/\s+/g,' ').slice(0,100);
 return normalized||null;
}

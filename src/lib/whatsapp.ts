import { decryptSecret } from './crypto';

type WhatsAppShop={whatsappCloudEnabled:boolean;whatsappPhoneNumberId:string|null;whatsappAccessTokenEncrypted:string|null;countryCode:string};
export function normalizePhone(phone:string,countryCode='216'){
  let p=String(phone||'').replace(/\D/g,'');const cc=String(countryCode||'216').replace(/\D/g,'');
  if(p.startsWith('00'))p=p.slice(2);if(p.startsWith('0'))p=p.replace(/^0+/,'');if(!p.startsWith(cc))p=cc+p;return p;
}
export async function sendWhatsAppText(shop:WhatsAppShop,to:string,body:string){
  if(!shop.whatsappCloudEnabled)throw Object.assign(new Error('WhatsApp Cloud API non activée'),{status:409});
  const token=decryptSecret(shop.whatsappAccessTokenEncrypted);if(!token||!shop.whatsappPhoneNumberId)throw Object.assign(new Error('Configuration WhatsApp incomplète'),{status:409});
  const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0';
  const r=await fetch(`https://graph.facebook.com/${version}/${shop.whatsappPhoneNumberId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:normalizePhone(to,shop.countryCode),type:'text',text:{preview_url:true,body}})});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j?.error?.message||'Échec envoi WhatsApp'),{status:502,details:j});
  return {providerRef:j?.messages?.[0]?.id||null,raw:j};
}

// Liens WhatsApp « clic pour discuter » : aucun service externe, le message
// s'ouvre prêt à envoyer dans WhatsApp du téléphone ou de WhatsApp Web.
export function waPhone(raw: string | null | undefined, defaultCountry = '216') {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  // Numéro tunisien local à 8 chiffres → indicatif +216
  if (d.length === 8) d = defaultCountry + d;
  return d;
}

export function waLink(phone: string | null | undefined, text: string) {
  const p = waPhone(phone);
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export type WaTemplateId = 'received' | 'waiting' | 'quote' | 'ready' | 'thanks';
type Vars = { client: string; device: string; code: string; balance: string; shop: string; trackUrl?: string; price?: string };

const fr: Record<WaTemplateId, (v: Vars) => string> = {
  received: v => `Bonjour ${v.client}, nous avons bien reçu votre ${v.device}. Votre code de suivi : ${v.code}.${v.trackUrl ? `\nSuivre la réparation : ${v.trackUrl}` : ''}\n${v.shop}`,
  waiting: v => `Bonjour ${v.client}, la pièce pour votre ${v.device} est commandée. Nous vous prévenons dès son arrivée. Code : ${v.code}.\n${v.shop}`,
  quote: v => `Bonjour ${v.client}, le diagnostic de votre ${v.device} est fait. Prix de la réparation : ${v.price}. Merci de nous confirmer votre accord. Code : ${v.code}.\n${v.shop}`,
  ready: v => `Bonjour ${v.client}, bonne nouvelle : votre ${v.device} est prêt ! ${v.balance ? `Reste à payer : ${v.balance}. ` : ''}Code : ${v.code}.\n${v.shop}`,
  thanks: v => `Merci ${v.client} pour votre confiance ! Votre avis nous aide beaucoup.${v.trackUrl ? `\n${v.trackUrl}` : ''}\n${v.shop}`,
};
const ar: Record<WaTemplateId, (v: Vars) => string> = {
  received: v => `مرحباً ${v.client}، استلمنا جهازك ${v.device}. رمز المتابعة: ${v.code}.${v.trackUrl ? `\nتابع الإصلاح: ${v.trackUrl}` : ''}\n${v.shop}`,
  waiting: v => `مرحباً ${v.client}، تم طلب القطعة لجهازك ${v.device}. سنعلمك عند وصولها. الرمز: ${v.code}.\n${v.shop}`,
  quote: v => `مرحباً ${v.client}، تم تشخيص جهازك ${v.device}. سعر الإصلاح: ${v.price}. الرجاء تأكيد موافقتك. الرمز: ${v.code}.\n${v.shop}`,
  ready: v => `مرحباً ${v.client}، جهازك ${v.device} جاهز! ${v.balance ? `الباقي للدفع: ${v.balance}. ` : ''}الرمز: ${v.code}.\n${v.shop}`,
  thanks: v => `شكراً ${v.client} على ثقتك! رأيك يهمنا.${v.trackUrl ? `\n${v.trackUrl}` : ''}\n${v.shop}`,
};

export function waTemplate(id: WaTemplateId, vars: Vars, lang: 'fr' | 'ar' = 'fr') {
  return (lang === 'ar' ? ar : fr)[id](vars);
}

import { prisma } from './prisma';
import { normalizePhone } from './whatsapp';

// Alertes WhatsApp envoyées par le compte WhatsApp Business de la plateforme Fixi.
// WhatsApp impose un « modèle de message » approuvé par Meta pour écrire en premier
// à un fournisseur : le modèle doit avoir 3 variables {{1}} boutique, {{2}} référence, {{3}} montant.
const cfg = () => ({
  phoneNumberId: process.env.WHATSAPP_PLATFORM_PHONE_NUMBER_ID || '',
  token: process.env.WHATSAPP_PLATFORM_TOKEN || '',
  template: process.env.WHATSAPP_NEW_ORDER_TEMPLATE || 'fixi_nouvelle_commande',
  lang: process.env.WHATSAPP_TEMPLATE_LANG || 'fr',
  version: process.env.WHATSAPP_GRAPH_VERSION || 'v23.0',
});

export function platformWhatsAppReady() {
  const c = cfg();
  return !!(c.phoneNumberId && c.token);
}

/** Vérifie et normalise un numéro tunisien (8 chiffres) ou international. */
export function validAlertPhone(raw: unknown) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return normalizePhone(digits, '216');
}

export async function sendNewOrderTemplate(to: string, params: { shop: string; reference: string; total: string }) {
  const c = cfg();
  if (!platformWhatsAppReady()) throw Object.assign(new Error('Les alertes WhatsApp ne sont pas encore activées par Fixi.'), { status: 409 });
  const r = await fetch(`https://graph.facebook.com/${c.version}/${c.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: {
        name: c.template, language: { code: c.lang },
        components: [{ type: 'body', parameters: [params.shop, params.reference, params.total].map(text => ({ type: 'text', text: text.slice(0, 120) })) }],
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j?.error?.message || 'Envoi WhatsApp refusé'), { status: 502 });
  return j?.messages?.[0]?.id as string | undefined;
}

/** Appelé à chaque nouvelle commande : ne bloque jamais la commande en cas d'échec. */
export async function whatsappNewOrderAlert(companyId: string, o: { shopName: string; reference: string; total: number; currency?: string }) {
  if (!platformWhatsAppReady()) return { sent: false, reason: 'not-configured' as const };
  const company = await prisma.supplierCompany.findUnique({ where: { id: companyId }, select: { whatsappAlertsEnabled: true, whatsappAlertPhone: true, phone: true, currency: true } });
  if (!company?.whatsappAlertsEnabled) return { sent: false, reason: 'disabled' as const };
  const to = validAlertPhone(company.whatsappAlertPhone || company.phone);
  if (!to) return { sent: false, reason: 'no-phone' as const };
  const total = `${o.total.toFixed(3)} ${o.currency || company.currency || 'DT'}`;
  await sendNewOrderTemplate(to, { shop: o.shopName, reference: o.reference, total });
  return { sent: true as const };
}

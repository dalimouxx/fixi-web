import { MessageChannel, MessageDeliveryStatus, PaymentKind } from '@prisma/client';
import { prisma } from './prisma';
import { sendWhatsAppTemplate, sendWhatsAppText } from './whatsapp';

export type ClientNotice = 'RECEIVED' | 'READY';

/** Remplace {client} {device} {code} {balance} {currency} {link} dans un message de la boutique. */
export function fillMessage(tpl: string, v: Record<string, string>) {
  return String(tpl || '').replace(/\{(client|device|code|balance|currency|link)\}/g, (_, k) => v[k] ?? '');
}

/**
 * Prévient automatiquement le client (WhatsApp Cloud API de la boutique) quand son appareil est reçu ou prêt.
 * - modèle Meta approuvé s'il est configuré (fonctionne même si le client n'a jamais écrit) ;
 * - sinon message libre (accepté seulement si le client a écrit dans les 24 h) ;
 * - jamais deux fois le même avis pour la même réparation en 24 h ; tout est journalisé (MessageLog).
 * Ne lève jamais d'erreur : un message raté ne doit pas bloquer l'atelier.
 */
export async function notifyRepairClient(repairId: string, notice: ClientNotice) {
  try {
    const r = await prisma.repair.findUnique({ where: { id: repairId }, include: { client: true, shop: true, payments: { select: { amount: true, kind: true } } } });
    if (!r || !r.client?.phone) return { skipped: 'no-client' };
    const shop = r.shop as any;
    if (shop.whatsappAutoNotify === false || !shop.whatsappCloudEnabled || !shop.whatsappPhoneNumberId || !shop.whatsappAccessTokenEncrypted) return { skipped: 'not-configured' };
    const since = new Date(Date.now() - 24 * 3600_000);
    const already = await prisma.messageLog.findFirst({ where: { repairId, title: `AUTO_${notice}`, status: MessageDeliveryStatus.SENT, createdAt: { gte: since } } });
    if (already) return { skipped: 'already-sent' };
    const paid = r.payments.reduce((a, p) => a + (p.kind === PaymentKind.PAYMENT ? Number(p.amount) : -Number(p.amount)), 0);
    const balance = Math.max(0, Number(r.finalPrice ?? r.estimatedPrice ?? 0) - Number(r.discountAmount || 0) - paid);
    const base = process.env.NEXT_PUBLIC_APP_URL || '';
    const vars = { client: r.client.fullName, device: [r.brand, r.model].filter(Boolean).join(' ') || 'appareil', code: r.code, balance: balance.toFixed(3), currency: shop.currency || 'DT', link: base && r.publicToken ? `${base}/track/${encodeURIComponent(r.code)}?shop=${encodeURIComponent(shop.slug)}&t=${encodeURIComponent(r.publicToken)}` : '' };
    const textTpl = notice === 'READY' ? shop.whatsappReady : shop.whatsappReceived;
    const body = fillMessage(textTpl || (notice === 'READY' ? 'Bonjour {client}, votre {device} est prêt.' : 'Bonjour {client}, nous avons bien reçu votre {device} (dossier {code}).'), vars) + (vars.link && !String(textTpl || '').includes('{link}') ? `\nSuivi : ${vars.link}` : '');
    const template = notice === 'READY' ? shop.whatsappTemplateReady : shop.whatsappTemplateReceived;
    const log = await prisma.messageLog.create({ data: { shopId: r.shopId, clientId: r.clientId, repairId: r.id, channel: MessageChannel.WHATSAPP, recipient: r.client.phone, title: `AUTO_${notice}`, body } });
    try {
      const sent = template
        ? await sendWhatsAppTemplate(shop, r.client.phone, template, shop.whatsappTemplateLang || 'fr', [vars.client, vars.device, vars.code, `${vars.balance} ${vars.currency}`])
        : await sendWhatsAppText(shop, r.client.phone, body);
      await prisma.messageLog.update({ where: { id: log.id }, data: { status: MessageDeliveryStatus.SENT, sentAt: new Date(), providerRef: sent.providerRef } });
      return { sent: true, template: !!template };
    } catch (e: any) {
      // Erreur Meta 131047 : hors fenêtre de 24 h → il faut un modèle approuvé.
      const hint = /131047|24|re-engagement/i.test(String(e?.message)) ? ' — configurez un modèle Meta (Paramètres → WhatsApp)' : '';
      await prisma.messageLog.update({ where: { id: log.id }, data: { status: MessageDeliveryStatus.FAILED, error: String(e?.message || e).slice(0, 300) + hint } });
      return { sent: false, error: String(e?.message || e) };
    }
  } catch (e: any) { return { sent: false, error: String(e?.message || e) }; }
}

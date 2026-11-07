import { MessageChannel, MessageDeliveryStatus, NotificationType, RepairStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { notifyShop } from '@/lib/notifications';
import { daySummary, summaryText, tunisNow } from '@/lib/evening-summary';
import { fillMessage } from '@/lib/client-messages';
import { sendWhatsAppTemplate, sendWhatsAppText } from '@/lib/whatsapp';

/**
 * Tâches de la journée (appelée chaque heure par instrumentation.ts, avec x-cron-secret) :
 *  - résumé du soir au gérant (notification + téléphone) à l'heure choisie, une fois par jour ;
 *  - demande d'avis automatique 2 à 48 h après la remise de l'appareil (WhatsApp Cloud), une seule fois.
 */
export async function POST(req: Request) {
  try {
    if (!process.env.CRON_SECRET || req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) return bad('Accès refusé', 403);
    const { day, hour } = tunisNow();
    const shops = await prisma.shop.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true, currency: true, eveningSummaryEnabled: true, eveningSummaryHour: true, lastEveningSummary: true, reviewRequestEnabled: true, whatsappCloudEnabled: true, whatsappPhoneNumberId: true, whatsappAccessTokenEncrypted: true, whatsappTemplateReview: true, whatsappTemplateLang: true, countryCode: true, googleReviewUrl: true } });
    let summaries = 0, reviews = 0;
    for (const shop of shops) {
      if (shop.eveningSummaryEnabled && hour >= shop.eveningSummaryHour && shop.lastEveningSummary !== day) {
        // Marqué d'abord : jamais deux résumés le même jour, même si deux appels se croisent.
        const claimed = await prisma.shop.updateMany({ where: { id: shop.id, OR: [{ lastEveningSummary: null }, { lastEveningSummary: { not: day } }] }, data: { lastEveningSummary: day } });
        if (claimed.count === 1) {
          const s = await daySummary(shop.id, day);
          const text = summaryText(shop.name, s, shop.currency);
          await notifyShop(shop.id, `Résumé du jour : ${s.net.toFixed(3)} ${shop.currency}`, text.split('\n').slice(1, 4).join(' · '), `/app/resume?jour=${day}`, NotificationType.INFO, [UserRole.ADMIN]);
          summaries++;
        }
      }
      if (shop.reviewRequestEnabled && shop.whatsappCloudEnabled && shop.whatsappPhoneNumberId && shop.whatsappAccessTokenEncrypted) {
        const repairs = await prisma.repair.findMany({ where: { shopId: shop.id, status: RepairStatus.DELIVERED, deliveredAt: { gte: new Date(Date.now() - 48 * 3600_000), lte: new Date(Date.now() - 2 * 3600_000) }, feedback: null, messageLogs: { none: { title: 'AUTO_REVIEW' } } }, include: { client: true }, take: 20 });
        for (const r of repairs) {
          const base = process.env.NEXT_PUBLIC_APP_URL || '';
          const link = base ? `${base}/track/${encodeURIComponent(r.code)}?shop=${encodeURIComponent(shop.slug)}&t=${encodeURIComponent(r.publicToken)}` : '';
          const body = fillMessage('Bonjour {client}, merci de votre confiance ! Votre avis sur la réparation de votre {device} nous aide beaucoup (30 secondes) : {link}', { client: r.client.fullName, device: [r.brand, r.model].filter(Boolean).join(' ') || 'appareil', link });
          const log = await prisma.messageLog.create({ data: { shopId: shop.id, clientId: r.clientId, repairId: r.id, channel: MessageChannel.WHATSAPP, recipient: r.client.phone, title: 'AUTO_REVIEW', body } });
          try {
            const sent = shop.whatsappTemplateReview ? await sendWhatsAppTemplate(shop, r.client.phone, shop.whatsappTemplateReview, shop.whatsappTemplateLang || 'fr', [r.client.fullName, [r.brand, r.model].filter(Boolean).join(' '), link]) : await sendWhatsAppText(shop, r.client.phone, body);
            await prisma.messageLog.update({ where: { id: log.id }, data: { status: MessageDeliveryStatus.SENT, sentAt: new Date(), providerRef: sent.providerRef } }); reviews++;
          } catch (e: any) { await prisma.messageLog.update({ where: { id: log.id }, data: { status: MessageDeliveryStatus.FAILED, error: String(e?.message || e).slice(0, 300) } }); }
        }
      }
    }
    return ok({ day, hour, summaries, reviews });
  } catch (e: any) { return bad(e.message, 500); }
}

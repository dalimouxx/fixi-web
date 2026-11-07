import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { sendAlert } from '@/lib/alerts';
import { checkVerification } from '@/lib/shop-verification';

/** État de vérification de l'atelier (sans les photos). */
export async function GET() {
  try {
    const s = await requireSession(undefined, 'CONNECT');
    const [shop, file] = await Promise.all([
      prisma.shop.findUnique({ where: { id: s.shopId }, select: { verificationStatus: true, verifiedAt: true, verificationNote: true, name: true, address: true, city: true, taxId: true, tradeRegister: true } }),
      prisma.shopVerification.findUnique({ where: { shopId: s.shopId }, select: { legalName: true, ownerName: true, taxId: true, tradeRegister: true, address: true, city: true, submittedAt: true } }),
    ]);
    return ok({ status: shop?.verificationStatus || 'NONE', verifiedAt: shop?.verifiedAt, note: shop?.verificationNote, file, defaults: { legalName: shop?.name, address: shop?.address, city: shop?.city, taxId: shop?.taxId, tradeRegister: shop?.tradeRegister, ownerName: s.fullName } });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Le gérant envoie ses documents : la vérification passe « en cours » et Fixi est prévenu. */
export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN], 'CONNECT');
    const shop = await prisma.shop.findUnique({ where: { id: s.shopId }, select: { verificationStatus: true, name: true, phone: true, region: true } });
    if (shop?.verificationStatus === 'VERIFIED') return bad('Votre atelier est déjà vérifié', 409);
    const v = checkVerification(await req.json().catch(() => ({})));
    if (!v.ok) return bad(v.error);
    const data = { ...v.value, submittedAt: new Date(), reviewedAt: null, reviewedBy: null, decision: null, note: null };
    await prisma.$transaction([
      prisma.shopVerification.upsert({ where: { shopId: s.shopId }, create: { shopId: s.shopId, ...data }, update: data }),
      prisma.shop.update({ where: { id: s.shopId }, data: { verificationStatus: 'PENDING', verificationNote: null, taxId: v.value.taxId, tradeRegister: v.value.tradeRegister, address: v.value.address } }),
    ]);
    await sendAlert(`🪪 Nouvel atelier à vérifier : ${shop?.name} (${shop?.region || '—'} · ${shop?.phone || '—'})\nFixi Control → Vérifications`).catch(() => null);
    return ok({ status: 'PENDING' });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

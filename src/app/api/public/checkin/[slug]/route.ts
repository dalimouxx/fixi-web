import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { loginGuard, TOO_MANY } from '@/lib/login-guard';
import { notifyShop } from '@/lib/notifications';
import { publish } from '@/lib/realtime';
import { UserRole } from '@prisma/client';

/** Boutique (nom, logo) pour la page d'arrivée. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await prisma.shop.findFirst({ where: { slug, isActive: true }, select: { name: true, logoDataUrl: true, brandColor: true } });
  return shop ? ok(shop) : bad('Boutique introuvable', 404);
}

/** Le client s'enregistre lui-même en scannant le QR du comptoir ; l'atelier valide ensuite. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const guard = loginGuard('checkin', req, slug);
    if (await guard.blocked()) return bad(TOO_MANY, 429);
    await guard.fail(); // compte chaque envoi : limite les abus (5 par appareil / 5 min)
    const shop = await prisma.shop.findFirst({ where: { slug, isActive: true }, select: { id: true } });
    if (!shop) return bad('Boutique introuvable', 404);
    const b = await req.json().catch(() => ({}));
    const fullName = String(b.fullName || '').trim().slice(0, 120); const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
    const issue = String(b.issue || '').trim().slice(0, 300);
    if (fullName.length < 2 || phone.replace(/\D/g, '').length < 8 || issue.length < 2) return bad('Nom, téléphone (8 chiffres) et panne sont obligatoires');
    if (!b.consent) return bad('Merci d’accepter l’utilisation de vos coordonnées pour le suivi de la réparation');
    const pending = await prisma.selfCheckIn.count({ where: { shopId: shop.id, phone, status: 'PENDING', createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (pending) return bad('Vous êtes déjà enregistré : l’atelier va vous appeler.', 409);
    const c = await prisma.selfCheckIn.create({ data: { shopId: shop.id, fullName, phone, brand: String(b.brand || '').trim().slice(0, 40) || null, model: String(b.model || '').trim().slice(0, 80) || null, issue } });
    const waiting = await prisma.selfCheckIn.count({ where: { shopId: shop.id, status: 'PENDING' } });
    await notifyShop(shop.id, 'Nouvelle arrivée', `${fullName} · ${[c.brand, c.model].filter(Boolean).join(' ') || 'appareil'} · ${issue}`, `/app/repairs/new?checkin=${c.id}`, 'REPAIR' as any, [UserRole.ADMIN, UserRole.RECEPTION]);
    publish(shop.id, 'checkin.created', { id: c.id });
    return ok({ ok: true, position: waiting }, { status: 201 });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { normalizePhone } from '@/lib/signup';

/** Adresse et téléphone de la boutique, modifiables par le gérant même en offre gratuite (livraisons). */
export async function PATCH(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN], 'CONNECT');
    const b = await req.json().catch(() => ({}));
    const address = String(b.address || '').trim().replace(/\s+/g, ' ');
    const city = String(b.city || '').trim().slice(0, 80) || null;
    const phone = normalizePhone(String(b.phone || ''));
    if (address.length < 5 || address.length > 200) return bad('Adresse : 5 à 200 caractères');
    if (!phone) return bad('Téléphone invalide (8 chiffres)');
    const lat = Number(b.latitude), lng = Number(b.longitude);
    const gps = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { latitude: lat, longitude: lng } : {};
    const shop = await prisma.shop.update({ where: { id: s.shopId }, data: { address, city, phone, ...gps }, select: { address: true, city: true, phone: true } });
    return ok(shop);
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

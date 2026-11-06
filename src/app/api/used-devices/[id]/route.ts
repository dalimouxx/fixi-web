import { UserRole, UsedDeviceCondition, UsedDeviceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { plain } from '@/lib/serializers';
import { decryptSecret } from '@/lib/crypto';
import { maskId } from '@/lib/used-devices';

const ROLES = [UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER];

/** Détail ; ?reveal=1 (gérant, ou pour imprimer l'attestation) renvoie la pièce d'identité complète — tracé dans le journal. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession(ROLES);
    const { id } = await params;
    const d = await prisma.usedDevice.findFirst({ where: { shopId: s.shopId, OR: [{ id }, { number: id }] }, include: { buyer: true, counterSale: { select: { number: true } }, boughtBy: { select: { fullName: true } } } });
    if (!d) return bad('Appareil introuvable', 404);
    const reveal = new URL(req.url).searchParams.get('reveal') === '1';
    const { sellerIdEncrypted, ...rest } = d;
    if (reveal) await audit(s.shopId, s.id, 'REVEAL_SELLER_ID', 'USED_DEVICE', d.id, { number: d.number });
    return ok(plain({ ...rest, sellerIdMasked: maskId(d.sellerIdLast3), sellerId: reveal ? decryptSecret(sellerIdEncrypted) : undefined }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Prix demandé, état, batterie, réservation, notes. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession(ROLES);
    const { id } = await params; const b = await req.json();
    const d = await prisma.usedDevice.findFirst({ where: { id, shopId: s.shopId } });
    if (!d) return bad('Appareil introuvable', 404);
    if (d.status === UsedDeviceStatus.SOLD) return bad('Appareil déjà vendu', 409);
    const data: any = {};
    if (b.askingPrice !== undefined) data.askingPrice = Number(b.askingPrice) > 0 ? Math.round(Number(b.askingPrice) * 1000) / 1000 : null;
    if (b.condition !== undefined) { if (!Object.values(UsedDeviceCondition).includes(b.condition)) return bad('État invalide'); data.condition = b.condition; }
    if (b.batteryHealth !== undefined) data.batteryHealth = b.batteryHealth === null || b.batteryHealth === '' ? null : Math.max(0, Math.min(100, Math.trunc(Number(b.batteryHealth))));
    if (b.status === 'RESERVED' || b.status === 'IN_STOCK') data.status = b.status;
    for (const k of ['notes', 'defects', 'accessories', 'color']) if (b[k] !== undefined) data[k] = String(b[k] || '').trim().slice(0, 500) || null;
    if (b.warrantyDays !== undefined) data.warrantyDays = Math.max(0, Math.min(365, Math.trunc(Number(b.warrantyDays) || 0)));
    const u = await prisma.usedDevice.update({ where: { id }, data });
    await audit(s.shopId, s.id, 'UPDATE', 'USED_DEVICE', id, data);
    const { sellerIdEncrypted, ...rest } = u;
    return ok(plain({ ...rest, sellerIdMasked: maskId(u.sellerIdLast3) }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

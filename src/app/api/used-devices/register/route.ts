import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { plain } from '@/lib/serializers';
import { decryptSecret } from '@/lib/crypto';
import { toCsv } from '@/lib/zip';
import { conditionLabel, storageLabel } from '@/lib/used-devices';

/**
 * Registre des objets d'occasion (gérant) : à présenter en cas de contrôle.
 * Chronologique, avec l'identité complète du vendeur. ?format=csv pour Excel.
 */
export async function GET(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const u = new URL(req.url);
    const from = u.searchParams.get('from') ? new Date(String(u.searchParams.get('from'))) : new Date(new Date().getFullYear(), 0, 1);
    const to = u.searchParams.get('to') ? new Date(String(u.searchParams.get('to')) + 'T23:59:59') : new Date();
    const rows = await prisma.usedDevice.findMany({ where: { shopId: s.shopId, purchasedAt: { gte: from, lte: to } }, orderBy: { purchasedAt: 'asc' }, include: { buyer: { select: { fullName: true, phone: true } } } });
    await audit(s.shopId, s.id, 'EXPORT_REGISTER', 'USED_DEVICE', undefined, { from, to, count: rows.length });
    const lines = rows.map(d => ({
      numero: d.number, date_achat: d.purchasedAt.toISOString().slice(0, 10), appareil: `${d.brand} ${d.model}${d.storageGb ? ' ' + storageLabel(d.storageGb) : ''}`, couleur: d.color || '', imei: d.imei || '', imei2: d.imei2 || '', etat: conditionLabel(d.condition),
      prix_achat: Number(d.purchasePrice), vendeur: d.sellerName, piece: d.sellerIdType, numero_piece: decryptSecret(d.sellerIdEncrypted) || '', telephone_vendeur: d.sellerPhone || '', adresse_vendeur: d.sellerAddress || '',
      statut: d.status, date_vente: d.soldAt ? d.soldAt.toISOString().slice(0, 10) : '', prix_vente: d.soldPrice != null ? Number(d.soldPrice) : '', acheteur: d.buyer ? `${d.buyer.fullName} ${d.buyer.phone}` : '',
    }));
    if (u.searchParams.get('format') === 'csv') return new Response(toCsv(lines), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="registre-occasion-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
    return ok(plain({ from, to, rows: lines }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Recherche universelle : un numéro de téléphone, un code réparation, un IMEI,
// un nom de client, une pièce ou un numéro de facture ouvre directement la bonne fiche.
export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 80);
    if (q.length < 2) return ok({ repairs: [], clients: [], items: [], documents: [] });
    const digits = q.replace(/\D/g, '');
    const tech = s.role === UserRole.TECHNICIAN;
    const canClients = !tech;
    const canStock = s.role === UserRole.ADMIN || tech;
    const canDocs = s.role !== UserRole.TECHNICIAN;

    const [repairs, clients, items, documents] = await Promise.all([
      prisma.repair.findMany({
        where: {
          shopId: s.shopId,
          ...(tech ? { OR: [{ technicianId: s.id }, { technicianId: null }] } : {}),
          AND: [{ OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { serialNumber: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
            { client: { fullName: { contains: q, mode: 'insensitive' } } },
            ...(digits.length >= 3 ? [{ client: { phone: { contains: digits } } }] : []),
          ] }],
        },
        select: { code: true, brand: true, model: true, status: true, client: { select: { fullName: true, phone: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      canClients ? prisma.client.findMany({
        where: { shopId: s.shopId, OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        ] },
        select: { id: true, fullName: true, phone: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }) : Promise.resolve([]),
      canStock ? prisma.inventoryItem.findMany({
        where: { shopId: s.shopId, active: true, OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ] },
        select: { id: true, name: true, sku: true, quantity: true },
        orderBy: { name: 'asc' },
        take: 5,
      }) : Promise.resolve([]),
      canDocs ? prisma.salesDocument.findMany({
        where: { shopId: s.shopId, number: { contains: q, mode: 'insensitive' } },
        select: { id: true, number: true, type: true, client: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }) : Promise.resolve([]),
    ]);
    return ok({ repairs, clients, items, documents });
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}

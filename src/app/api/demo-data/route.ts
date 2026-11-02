import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { publish } from '@/lib/realtime';
import { DeviceCategory, RepairStatus, UserRole } from '@prisma/client';

// Données de démonstration : quelques clients et réparations fictifs, repérables
// (code « DEMO-… », téléphone « 0000… », note « [DEMO] ») et supprimables en un clic.
const MARK = '[DEMO]';
const samples: { name: string; brand: string; model: string; issue: string; status: RepairStatus; price: number; hoursAgo: number }[] = [
  { name: 'Sami Ben Ali (exemple)', brand: 'Samsung', model: 'Galaxy A54', issue: 'Écran cassé', status: RepairStatus.RECEIVED, price: 180, hoursAgo: 1 },
  { name: 'Amira Trabelsi (exemple)', brand: 'Apple', model: 'iPhone 12', issue: 'Batterie faible', status: RepairStatus.DIAGNOSIS, price: 120, hoursAgo: 5 },
  { name: 'Youssef Gharbi (exemple)', brand: 'Xiaomi', model: 'Redmi Note 12', issue: 'Ne charge plus', status: RepairStatus.IN_REPAIR, price: 60, hoursAgo: 20 },
  { name: 'Nour Hammami (exemple)', brand: 'Oppo', model: 'A78', issue: 'Écran tactile ne répond pas', status: RepairStatus.WAITING_PART, price: 150, hoursAgo: 30 },
  { name: 'Karim Jlassi (exemple)', brand: 'Samsung', model: 'Galaxy S21', issue: 'Vitre arrière cassée', status: RepairStatus.READY, price: 90, hoursAgo: 48 },
];

export async function GET() {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const count = await prisma.repair.count({ where: { shopId: s.shopId, code: { startsWith: 'DEMO-' } } });
    return ok({ count });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function POST() {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const existing = await prisma.repair.count({ where: { shopId: s.shopId, code: { startsWith: 'DEMO-' } } });
    if (existing) return ok({ created: 0, count: existing });
    await prisma.$transaction(async tx => {
      for (const [i, x] of samples.entries()) {
        const phone = `0000000${i + 1}`;
        const client = await tx.client.upsert({
          where: { shopId_phone: { shopId: s.shopId, phone } },
          update: {},
          create: { shopId: s.shopId, fullName: x.name, phone, notes: `${MARK} Client fictif pour découvrir Fixi` },
        });
        const createdAt = new Date(Date.now() - x.hoursAgo * 3600000);
        await tx.repair.create({
          data: {
            shopId: s.shopId, code: `DEMO-${String(i + 1).padStart(3, '0')}`, clientId: client.id,
            category: DeviceCategory.PHONE, brand: x.brand, model: x.model, reportedIssue: x.issue,
            status: x.status, estimatedPrice: x.price, finalPrice: x.status === RepairStatus.RECEIVED ? null : x.price,
            internalNotes: `${MARK} Réparation fictive`, createdAt,
            statusEvents: { create: { fromStatus: null, toStatus: x.status, userId: s.id, note: `${MARK} Exemple` } },
          },
        });
      }
    });
    await audit(s.shopId, s.id, 'DEMO_DATA_CREATED', 'SHOP', s.shopId);
    publish(s.shopId, 'repairs.changed');
    return ok({ created: samples.length, count: samples.length });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function DELETE() {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const repairs = await prisma.repair.findMany({ where: { shopId: s.shopId, code: { startsWith: 'DEMO-' } }, select: { id: true } });
    const ids = repairs.map(r => r.id);
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { shopId: s.shopId, repairId: { in: ids } } }),
      prisma.repair.deleteMany({ where: { shopId: s.shopId, id: { in: ids } } }),
      prisma.client.deleteMany({ where: { shopId: s.shopId, phone: { startsWith: '0000000' }, notes: { startsWith: MARK }, repairs: { none: {} }, salesDocuments: { none: {} } } }),
    ]);
    await audit(s.shopId, s.id, 'DEMO_DATA_DELETED', 'SHOP', s.shopId, { repairs: ids.length });
    publish(s.shopId, 'repairs.changed');
    return ok({ deleted: ids.length });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

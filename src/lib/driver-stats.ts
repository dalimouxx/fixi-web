import { prisma } from './prisma';
import { driverStats, trackKm } from './field-ops';

/** Statistiques livreurs d'une société sur N jours (calculées depuis les livraisons, incidents et points GPS). */
export async function companyDriverStats(companyId: string, days: number, onlyDriverId?: string) {
  const since = new Date(Date.now() - days * 86400_000);
  const [company, drivers, deliveries, failures, points] = await Promise.all([
    prisma.supplierCompany.findUnique({ where: { id: companyId }, select: { driverBonusPerDelivery: true } }),
    prisma.supplierAccount.findMany({ where: { companyId, role: 'DRIVER', ...(onlyDriverId ? { id: onlyDriverId } : {}) }, select: { id: true, fullName: true } }),
    prisma.supplierDelivery.findMany({ where: { order: { companyId }, deliveredAt: { gte: since }, ...(onlyDriverId ? { driverAccountId: onlyDriverId } : {}) }, select: { driverAccountId: true, pickedUpAt: true, deliveredAt: true } }),
    prisma.supplierDeliveryEvent.findMany({ where: { companyId, createdAt: { gte: since }, type: { in: ['CUSTOMER_ABSENT', 'SHOP_CLOSED', 'DELIVERY_REFUSED', 'INCIDENT'] }, ...(onlyDriverId ? { accountId: onlyDriverId } : {}) }, select: { accountId: true } }),
    prisma.supplierDriverLocation.findMany({ where: { companyId, createdAt: { gte: since }, ...(onlyDriverId ? { accountId: onlyDriverId } : {}) }, select: { accountId: true, latitude: true, longitude: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 20000 }),
  ]);
  const byDriver = new Map<string, { lat: number; lng: number; at: Date }[]>();
  for (const p of points) if (p.accountId) { const a = byDriver.get(p.accountId) || []; a.push({ lat: Number(p.latitude), lng: Number(p.longitude), at: p.createdAt }); byDriver.set(p.accountId, a); }
  const km: Record<string, number> = {};
  for (const [id, list] of byDriver) km[id] = trackKm(list);
  const bonus = Number(company?.driverBonusPerDelivery || 0);
  return { bonusPerDelivery: bonus, rows: driverStats({ drivers: drivers.map(d => ({ id: d.id, name: d.fullName })), deliveries: deliveries.map(d => ({ driverId: d.driverAccountId, pickedUpAt: d.pickedUpAt, deliveredAt: d.deliveredAt })), failures: failures.map(f => ({ driverId: f.accountId })), km, bonusPerDelivery: bonus }) };
}

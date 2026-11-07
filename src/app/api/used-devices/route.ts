import { CashSessionStatus, PaymentMethod, Prisma, UserRole, UsedDeviceCondition, UsedDeviceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { audit } from '@/lib/audit';
import { plain } from '@/lib/serializers';
import { encryptSecret } from '@/lib/crypto';
import { cleanImei, isImei } from '@/lib/imei';
import { nextShopNumber } from '@/lib/tn-invoice';
import { publicRow, purchaseIssues, validateSellerId } from '@/lib/used-devices';

const ROLES = [UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER];
const err = (m: string, status = 400) => Object.assign(new Error(m), { status });

/** Téléphones d'occasion : stock, vendus, chiffres clés. */
export async function GET(req: Request) {
  try {
    const s = await requireSession(ROLES);
    const u = new URL(req.url); const status = u.searchParams.get('status'); const q = (u.searchParams.get('q') || '').trim();
    const where: Prisma.UsedDeviceWhereInput = { shopId: s.shopId, ...(status && Object.values(UsedDeviceStatus).includes(status as any) ? { status: status as UsedDeviceStatus } : {}) };
    if (q) where.OR = [{ model: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } }, { imei: { contains: q.replace(/\s/g, '') } }, { number: { contains: q, mode: 'insensitive' } }, { sellerName: { contains: q, mode: 'insensitive' } }];
    const [rows, stock] = await Promise.all([
      prisma.usedDevice.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { buyer: { select: { fullName: true, phone: true } } } }),
      prisma.usedDevice.findMany({ where: { shopId: s.shopId, status: { in: [UsedDeviceStatus.IN_STOCK, UsedDeviceStatus.RESERVED] } }, select: { purchasePrice: true, askingPrice: true } }),
    ]);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const soldMonth = await prisma.usedDevice.findMany({ where: { shopId: s.shopId, status: UsedDeviceStatus.SOLD, soldAt: { gte: monthStart } }, select: { purchasePrice: true, soldPrice: true } });
    return ok(plain({
      rows: rows.map(publicRow),
      kpis: {
        inStock: stock.length,
        stockCost: stock.reduce((a, x) => a + Number(x.purchasePrice), 0),
        stockValue: stock.reduce((a, x) => a + Number(x.askingPrice || 0), 0),
        soldMonth: soldMonth.length,
        marginMonth: soldMonth.reduce((a, x) => a + Number(x.soldPrice || 0) - Number(x.purchasePrice), 0),
      },
    }));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Achat d'un téléphone : identité du vendeur (chiffrée), IMEI vérifié dans le réseau, sortie de caisse. */
export async function POST(req: Request) {
  try {
    const s = await requireSession(ROLES);
    const b = await req.json();
    const imei = cleanImei(b.imei || '');
    const issues = purchaseIssues({ ...b, imei, purchasePrice: Number(b.purchasePrice) }, isImei(imei));
    if (issues.length) return bad('Il manque : ' + issues.join(', ') + '.');
    const id = validateSellerId(String(b.sellerIdType || 'CIN'), String(b.sellerId || ''));
    if (!id.ok) return bad(id.error);
    if (!Object.values(UsedDeviceCondition).includes(b.condition)) return bad('État invalide');
    // Appareil signalé perdu/volé par un atelier du réseau : achat refusé.
    const flagged = await prisma.imeiReport.findFirst({ where: { imei, resolvedAt: null, shopId: { not: s.shopId } } });
    if (flagged) return bad('⚠️ Cet IMEI est signalé perdu ou volé dans le réseau Fixi. N’achetez pas cet appareil.', 409);
    const already = await prisma.usedDevice.findFirst({ where: { shopId: s.shopId, imei, status: { in: [UsedDeviceStatus.IN_STOCK, UsedDeviceStatus.RESERVED] } }, select: { number: true } });
    if (already) return bad(`Cet appareil est déjà dans votre stock (${already.number}).`, 409);
    const method = Object.values(PaymentMethod).includes(b.purchaseMethod) ? b.purchaseMethod as PaymentMethod : PaymentMethod.CASH;
    const price = Math.round(Number(b.purchasePrice) * 1000) / 1000;
    const int = (v: unknown, min: number, max: number) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
    const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max) || null;
    const device = await prisma.$transaction(async tx => {
      const number = await nextShopNumber(tx, s.shopId, 'USED', 'OCC');
      const d = await tx.usedDevice.create({ data: {
        shopId: s.shopId, number, brand: String(b.brand || '').trim().slice(0, 40) || 'Autre', model: String(b.model).trim().slice(0, 80),
        storageGb: int(b.storageGb, 1, 4096), color: str(b.color, 40), imei, imei2: str(cleanImei(b.imei2 || ''), 20), serialNumber: str(b.serialNumber, 40),
        condition: b.condition, batteryHealth: int(b.batteryHealth, 0, 100), accountUnlocked: b.accountUnlocked !== false,
        accessories: str(b.accessories, 200), defects: str(b.defects, 500), notes: str(b.notes, 500),
        purchasePrice: price, purchaseMethod: method, sellerName: String(b.sellerName).trim().slice(0, 120), sellerPhone: str(b.sellerPhone, 30), sellerAddress: str(b.sellerAddress, 200),
        sellerIdType: b.sellerIdType === 'PASSPORT' || b.sellerIdType === 'SEJOUR' ? b.sellerIdType : 'CIN', sellerIdEncrypted: encryptSecret(id.value)!, sellerIdLast3: id.last3,
        sellerIdIssuedAt: b.sellerIdIssuedAt ? new Date(b.sellerIdIssuedAt) : null, imeiCheckedAt: new Date(), imeiFlagged: false, boughtById: s.id,
        askingPrice: Number(b.askingPrice) > 0 ? Math.round(Number(b.askingPrice) * 1000) / 1000 : null, warrantyDays: int(b.warrantyDays, 0, 365) ?? 0,
      } });
      // Payé en espèces : sortie de la caisse du jour (clôture juste).
      if (method === PaymentMethod.CASH) {
        const session = await tx.cashSession.findFirst({ where: { shopId: s.shopId, status: CashSessionStatus.OPEN }, orderBy: { openedAt: 'desc' } });
        await tx.expense.create({ data: { shopId: s.shopId, cashSessionId: session?.id || null, category: 'Achat occasion', label: `${number} · ${d.model}`, amount: price, note: `Achat à ${d.sellerName}` } });
      }
      return d;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await audit(s.shopId, s.id, 'PURCHASE', 'USED_DEVICE', device.id, { number: device.number, imei, price });
    return ok(plain(publicRow(device)), { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2034' || e?.code === 'P2002') return bad('Opération concurrente détectée. Réessayez.', 409);
    return bad(e.message, e.status || 500);
  }
}

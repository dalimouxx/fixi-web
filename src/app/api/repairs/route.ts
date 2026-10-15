import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { repairCreateSchema } from '@/lib/validators';
import { encryptSecret } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { publish } from '@/lib/realtime';
import { DeviceCategory, RepairPriority, UserRole } from '@prisma/client';
import { plain } from '@/lib/serializers';
import { defaultQualityChecks } from '@/lib/smart';

function makeCode() {
  const y = String(new Date().getFullYear()).slice(-2);
  return `F-${y}${String(Date.now()).slice(-5)}`;
}

export async function GET(req: Request) {
  try {
    const s = await requireSession();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const status = searchParams.get('status') || undefined;
    const where: any = { shopId: s.shopId };
    if (s.role === UserRole.TECHNICIAN) where.OR = [{ technicianId: s.id }, { technicianId: null }];
    if (status) where.status = status;
    if (q) {
      where.AND = [{
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { client: { fullName: { contains: q, mode: 'insensitive' } } },
          { client: { phone: { contains: q } } },
          { model: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ],
      }];
    }
    const rows = await prisma.repair.findMany({
      where,
      include: { client: true, technician: { select: { id: true, fullName: true } }, parts: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    return ok(plain(rows));
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION, UserRole.CASHIER]);
    const b = repairCreateSchema.parse(await req.json());
    if (b.technicianId) {
      const technician=await prisma.user.findFirst({where:{id:b.technicianId,shopId:s.shopId,role:UserRole.TECHNICIAN,isActive:true}});
      if(!technician)return bad('Technicien invalide',400);
    }
    let code = makeCode();
    while (await prisma.repair.findUnique({ where: { shopId_code: { shopId: s.shopId, code } } })) code = makeCode();
    const repair = await prisma.$transaction(async (tx) => {
      const client = await tx.client.upsert({
        where: { shopId_phone: { shopId: s.shopId, phone: b.clientPhone } },
        update: { fullName: b.clientName, email: b.clientEmail || undefined },
        create: { shopId: s.shopId, fullName: b.clientName, phone: b.clientPhone, email: b.clientEmail || undefined },
      });
      const r = await tx.repair.create({
        data: {
          shopId: s.shopId,
          code,
          clientId: client.id,
          category: b.category as DeviceCategory,
          brand: b.brand || null,
          model: b.model,
          serialNumber: b.serialNumber || null,
          color: b.color || null,
          lockCodeEncrypted: encryptSecret(b.lockCode),
          reportedIssue: b.reportedIssue,
          priority: b.priority as RepairPriority,
          technicianId: b.technicianId || null,
          estimatedPrice: b.estimatedPrice ?? null,
          finalPrice: b.finalPrice ?? null,
          warrantyDays: b.warrantyDays,
          promisedAt: b.promisedAt ? new Date(b.promisedAt) : null,
          estimatedMinutes: b.estimatedMinutes ?? null,
        },
      });
      await tx.repairStatusEvent.create({ data: { repairId: r.id, toStatus: 'RECEIVED', userId: s.id, note: 'Réparation créée' } });
      await tx.repairQualityCheck.createMany({data:defaultQualityChecks.map(([key,label],i)=>({shopId:s.shopId,repairId:r.id,key,label,required:true,sortOrder:i}))});
      return r;
    });
    await audit(s.shopId, s.id, 'CREATE', 'REPAIR', repair.id, { code });
    publish(s.shopId, 'repair.created', { code });
    return ok(plain(repair), { status: 201 });
  } catch (e: any) {
    if (e?.issues) return bad('Formulaire invalide', 400, e.issues);
    return bad(e.message, e.status || 500);
  }
}

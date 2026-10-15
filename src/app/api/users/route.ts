import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireSession, roleLabels } from '@/lib/auth';
import { bad, ok } from '@/lib/http';
import { UserRole } from '@prisma/client';
import { audit } from '@/lib/audit';

export async function GET() {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION]);
    const rows = await prisma.user.findMany({
      where: { shopId: s.shopId },
      select: { id: true, loginCode: true, fullName: true, phone: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { fullName: 'asc' },
    });
    return ok(rows.map((x) => ({ ...x, roleLabel: roleLabels[x.role] })));
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireSession([UserRole.ADMIN]);
    const b = await req.json();
    const role = b.role as UserRole;
    if (!b.fullName || !String(b.loginCode||'').match(/^[a-zA-Z0-9._-]{2,30}$/) || !Object.values(UserRole).includes(role) || !/^\d{6}$/.test(String(b.pin || ''))) {
      return bad('Nom, rôle et PIN de exactement 6 chiffres requis');
    }
    const sub=await prisma.subscription.findFirst({where:{tenantId:s.tenantId},include:{plan:true},orderBy:{createdAt:'desc'}});
    if(sub){const count=await prisma.user.count({where:{shopId:s.shopId}});if(count>=sub.plan.maxUsersPerShop)return bad(`Limite du plan atteinte (${sub.plan.maxUsersPerShop} utilisateurs par boutique)`,409);}
    const x = await prisma.user.create({
      data: {
        shopId: s.shopId,
        fullName: String(b.fullName),
        loginCode: String(b.loginCode).toLowerCase(),
        phone: b.phone || null,
        email: b.email || null,
        role,
        pinHash: await bcrypt.hash(String(b.pin), 12),
      },
    });
    await audit(s.shopId, s.id, 'CREATE', 'USER', x.id, { role: x.role });
    return ok({ id: x.id, fullName: x.fullName, role: x.role }, { status: 201 });
  } catch (e: any) {
    return bad(e.message, e.status || 500);
  }
}

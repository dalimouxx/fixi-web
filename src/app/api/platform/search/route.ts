import { requirePlatformSession } from '@/lib/platform-auth';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { searchTerms, type SearchHit } from '@/lib/platform-search';

const ci = (v: string) => ({ contains: v, mode: 'insensitive' as const });

/** Fixi Control : retrouver en une recherche une boutique, un fournisseur, un utilisateur, un client ou une réparation. */
export async function GET(req: Request) {
  try {
    await requirePlatformSession();
    const { q, phone, ok: valid } = searchTerms(new URL(req.url).searchParams.get('q'));
    if (!valid) return ok({ q, hits: [] });
    const phoneOr = phone ? [{ phone: { contains: phone } }] : [];
    const [shops, companies, users, accounts, clients, repairs] = await Promise.all([
      prisma.shop.findMany({ where: { OR: [{ name: ci(q) }, { slug: ci(q) }, { email: ci(q) }, { region: ci(q) }, ...phoneOr] }, take: 8, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, slug: true, region: true, phone: true, isActive: true } }),
      prisma.supplierCompany.findMany({ where: { OR: [{ name: ci(q) }, { slug: ci(q) }, { email: ci(q) }, ...phoneOr] }, take: 8, select: { id: true, name: true, slug: true, region: true, phone: true, active: true } }),
      prisma.user.findMany({ where: { OR: [{ fullName: ci(q) }, { loginCode: ci(q) }, { email: ci(q) }, ...phoneOr] }, take: 8, select: { id: true, fullName: true, role: true, loginCode: true, isActive: true, shop: { select: { id: true, name: true } } } }),
      prisma.supplierAccount.findMany({ where: { OR: [{ fullName: ci(q) }, { login: ci(q) }, ...phoneOr] }, take: 6, select: { id: true, fullName: true, login: true, role: true, isActive: true, company: { select: { id: true, name: true } } } }),
      prisma.client.findMany({ where: { OR: [{ fullName: ci(q) }, ...phoneOr] }, take: 8, orderBy: { createdAt: 'desc' }, select: { id: true, fullName: true, phone: true, shop: { select: { id: true, name: true } } } }),
      prisma.repair.findMany({ where: { OR: [{ code: ci(q) }, { serialNumber: ci(q) }] }, take: 8, orderBy: { createdAt: 'desc' }, select: { id: true, code: true, brand: true, model: true, status: true, shop: { select: { id: true, name: true } }, client: { select: { fullName: true } } } }),
    ]);
    const hits: SearchHit[] = [
      ...shops.map(s => ({ kind: 'SHOP' as const, id: s.id, title: s.name, subtitle: [s.region, s.phone, s.slug].filter(Boolean).join(' · '), shopId: s.id, targetName: s.name, active: s.isActive })),
      ...companies.map(c => ({ kind: 'SUPPLIER' as const, id: c.id, title: c.name, subtitle: [c.region, c.phone, c.slug].filter(Boolean).join(' · '), companyId: c.id, targetName: c.name, active: c.active })),
      ...users.map(u => ({ kind: 'USER' as const, id: u.id, title: u.fullName, subtitle: `${u.role} · code ${u.loginCode} · ${u.shop.name}`, shopId: u.shop.id, targetName: u.shop.name, active: u.isActive })),
      ...accounts.map(a => ({ kind: 'SUPPLIER_ACCOUNT' as const, id: a.id, title: a.fullName, subtitle: `${a.role} · ${a.login} · ${a.company.name}`, companyId: a.company.id, targetName: a.company.name, active: a.isActive })),
      ...clients.map(c => ({ kind: 'CLIENT' as const, id: c.id, title: c.fullName, subtitle: `${c.phone} · client de ${c.shop.name}`, shopId: c.shop.id, targetName: c.shop.name })),
      ...repairs.map(r => ({ kind: 'REPAIR' as const, id: r.id, title: `${r.code} · ${[r.brand, r.model].filter(Boolean).join(' ')}`, subtitle: `${r.status} · ${r.client.fullName} · ${r.shop.name}`, shopId: r.shop.id, targetName: r.shop.name })),
    ];
    return ok({ q, hits });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

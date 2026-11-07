import { audit } from '@/lib/audit';
import { cleanIssues, issuesText, issuesTotal } from '@/lib/repair-issues';
import { prisma } from '@/lib/prisma'; import { requireSession } from '@/lib/auth'; import { bad,ok } from '@/lib/http'; import { decryptSecret } from '@/lib/crypto'; import { UserRole } from '@prisma/client'; import { plain } from '@/lib/serializers';
export async function GET(_:Request,{params}:{params:Promise<{code:string}>}){try{const s=await requireSession();const {code}=await params;const r=await prisma.repair.findUnique({where:{shopId_code:{shopId:s.shopId,code}},include:{client:true,technician:{select:{id:true,fullName:true}},parts:true,payments:{include:{user:{select:{fullName:true}}},orderBy:{createdAt:'desc'}},statusEvents:{include:{user:{select:{fullName:true}}},orderBy:{createdAt:'asc'}}}});if(!r)return bad('Réparation introuvable',404);if(s.role===UserRole.TECHNICIAN&&r.technicianId&&r.technicianId!==s.id)return bad('Accès refusé',403);return ok(plain({...r,lockCode:s.role===UserRole.ADMIN||s.role===UserRole.TECHNICIAN?decryptSecret(r.lockCodeEncrypted):null}))}catch(e:any){return bad(e.message,e.status||500)}}

/** Corriger une réparation après la réception : appareil, pannes, prix estimé, numéro de série, couleur. */
export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const s = await requireSession([UserRole.ADMIN, UserRole.RECEPTION]);
    const { code } = await params;
    const r = await prisma.repair.findUnique({ where: { shopId_code: { shopId: s.shopId, code } } });
    if (!r) return bad('Réparation introuvable', 404);
    const b = await req.json().catch(() => ({}));
    const data: any = {};
    const txt = (k: string, max: number) => b[k] === undefined ? undefined : (String(b[k] ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null);
    for (const [k, max] of [['brand', 60], ['model', 80], ['serialNumber', 40], ['color', 40]] as const) { const v = txt(k, max); if (v !== undefined) data[k] = v; }
    if (data.model === null) return bad('Modèle requis');
    if (b.issues !== undefined) {
      const list = cleanIssues(b.issues);
      data.issues = list.length ? list : null;
      if (list.length) data.reportedIssue = issuesText(list, b.issueNote);
      const total = issuesTotal(list);
      if (total !== null && b.estimatedPrice === undefined) data.estimatedPrice = total;
    }
    if (b.reportedIssue !== undefined && !data.reportedIssue) { const v = txt('reportedIssue', 500); if (!v || v.length < 2) return bad('Panne requise'); data.reportedIssue = v; }
    if (b.estimatedPrice !== undefined) { const n = b.estimatedPrice === null || b.estimatedPrice === '' ? null : Number(String(b.estimatedPrice).replace(',', '.')); if (n !== null && !(n >= 0)) return bad('Prix estimé invalide'); data.estimatedPrice = n; }
    if (!Object.keys(data).length) return bad('Rien à modifier');
    const x = await prisma.repair.update({ where: { id: r.id }, data });
    await audit(s.shopId, s.id, 'UPDATE', 'REPAIR', r.id, { fields: Object.keys(data), before: { brand: r.brand, model: r.model, reportedIssue: r.reportedIssue, estimatedPrice: r.estimatedPrice } });
    return ok(plain(x));
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

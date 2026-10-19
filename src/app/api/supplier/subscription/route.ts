import { prisma } from '@/lib/prisma';
import { requireSupplierSession } from '@/lib/supplier-auth';
import { bad,ok } from '@/lib/http';
import { plain } from '@/lib/serializers';
import { currentSupplierOffer, supplierOfferState } from '@/lib/supplier-saas';

export const dynamic='force-dynamic';

export async function GET() {
  try {
    const s=await requireSupplierSession();
    const [current,plans,history,counts]=await Promise.all([
      currentSupplierOffer(s.companyId),
      prisma.supplierSaasPlan.findMany({where:{active:true,publicVisible:true},orderBy:{price:'asc'}}),
      prisma.supplierSaasSubscription.findMany({
        where:{companyId:s.companyId},
        include:{plan:true,payments:{orderBy:{paidAt:'desc'}}},orderBy:{createdAt:'desc'},take:24,
      }),
      Promise.all([
        prisma.supplierProduct.count({where:{companyId:s.companyId}}),
        prisma.supplierAccount.count({where:{companyId:s.companyId,role:'DRIVER'}}),
        prisma.supplierAccount.count({where:{companyId:s.companyId,role:{not:'DRIVER'}}}),
      ]),
    ]);
    return ok(plain({
      company:{id:s.companyId,name:s.companyName},
      state:supplierOfferState(current),
      current,
      plans,
      history,
      usage:{products:counts[0],drivers:counts[1],staff:counts[2]},
      support:'Pour changer de formule, contactez l’administration Fixi. Aucun prélèvement automatique.',
    }));
  }catch(e:any){return bad(e.message,e.status||500);}
}

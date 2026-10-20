import {prisma} from '@/lib/prisma';
import {requirePlatformSession} from '@/lib/platform-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

export const dynamic='force-dynamic';
export async function GET(){
 try{
  await requirePlatformSession();
  const requests=await prisma.supplierSubscriptionRequest.findMany({
    orderBy:{createdAt:'desc'},take:100
  });
  const companyIds=[...new Set(requests.map(x=>x.companyId))];
  const planIds=[...new Set(requests.map(x=>x.planId))];
  const [companies,plans]=await Promise.all([
    prisma.supplierCompany.findMany({where:{id:{in:companyIds}},
      select:{id:true,name:true,region:true,phone:true}}),
    prisma.supplierSaasPlan.findMany({where:{id:{in:planIds}},
      select:{id:true,name:true,price:true,durationValue:true,durationUnit:true}})
  ]);
  const byCompany=new Map(companies.map(x=>[x.id,x]));
  const byPlan=new Map(plans.map(x=>[x.id,x]));
  return ok(plain(requests.map(({proofDataUrl,...x})=>({
    ...x,hasProof:!!proofDataUrl,
    company:byCompany.get(x.companyId)||null,plan:byPlan.get(x.planId)||null
  }))));
 }catch(e:any){return bad(e.message,e.status||500)}
}

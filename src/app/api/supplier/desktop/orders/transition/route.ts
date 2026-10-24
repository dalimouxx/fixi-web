import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad} from '@/lib/http';
import {PATCH as transition} from '@/app/api/supplier/orders/[id]/route';
import {prisma} from '@/lib/prisma';

export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES']);
  // Deliberate separate switch: read-only Windows features do not authorize order mutations.
  if(process.env.FIXI_WINDOWS_ORDERS_ENABLED!=='true')return bad('Confirmation Windows non activée',403);
  const b=await req.json();
  const id=String(b.orderId||'');
  const status=String(b.status||'');
  if(!['CONFIRMED','PREPARING','READY_FOR_DELIVERY'].includes(status))return bad('Transition interdite depuis Windows',400);
  const current=await prisma.supplierOrder.findFirst({where:{id,companyId:s.companyId},select:{status:true}});
  if(!current)return bad('Commande introuvable',404);
  const valid:Record<string,string>={PENDING:'CONFIRMED',CONFIRMED:'PREPARING',PREPARING:'READY_FOR_DELIVERY'};
  if(valid[current.status]!==status)return bad('Actualisez la commande avant de continuer',409);
  return transition(new Request(req.url,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status})}),{params:Promise.resolve({id})});
 }catch(e:any){return bad(e.message||'Commande non confirmée',e.status||500)}
}

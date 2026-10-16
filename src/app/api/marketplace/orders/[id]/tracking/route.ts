import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {UserRole} from '@prisma/client';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION]);
  const{id}=await params;
  const order=await prisma.supplierOrder.findFirst({
   where:{id,shopId:s.shopId},
   include:{delivery:true,company:{select:{name:true}}}
  });
  if(!order)return bad('Commande introuvable',404);
  const latest=await prisma.supplierDriverLocation.findFirst({
   where:{orderId:id,companyId:order.companyId},
   orderBy:{createdAt:'desc'}
  });
  const recent=await prisma.supplierDeliveryEvent.findMany({
   where:{orderId:id,companyId:order.companyId},
   orderBy:{createdAt:'desc'},take:12
  });
  return ok(plain({
   orderId:id,
   orderStatus:order.status,
   deliveryStatus:order.delivery?.status||null,
   driverName:order.delivery?.driverName||null,
   driverPhone:order.delivery?.driverPhone||null,
   recipientName:order.delivery?.recipientName||null,
   latest,
   events:recent.map(x=>({id:x.id,type:x.type,note:x.note,createdAt:x.createdAt}))
  }));
 }catch(e:any){return bad(e.message,e.status||500)}
}

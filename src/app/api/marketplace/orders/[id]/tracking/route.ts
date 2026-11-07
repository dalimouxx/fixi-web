import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {UserRole} from '@prisma/client';
import {etaMinutes,haversineKm} from '@/lib/field-ops';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION],'CONNECT');
  const{id}=await params;
  const order=await prisma.supplierOrder.findFirst({
   where:{id,shopId:s.shopId},
   include:{delivery:{select:{status:true,driverName:true,driverPhone:true,recipientName:true}},company:{select:{name:true}},shop:{select:{latitude:true,longitude:true}}}
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
  // 17.6 — temps d'arrivée estimé quand on connaît la position de l'atelier et celle du livreur (< 10 min).
  let eta:number|null=null;
  if(latest&&order.status==='OUT_FOR_DELIVERY'&&order.shop.latitude!=null&&order.shop.longitude!=null&&Date.now()-new Date(latest.createdAt).getTime()<600_000)
   eta=etaMinutes(haversineKm({lat:Number(latest.latitude),lng:Number(latest.longitude)},{lat:Number(order.shop.latitude),lng:Number(order.shop.longitude)}));
  return ok(plain({
   eta,
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

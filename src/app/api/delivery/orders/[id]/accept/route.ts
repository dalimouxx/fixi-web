import {prisma} from '@/lib/prisma';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {SupplierDeliveryStatus,SupplierOrderStatus} from '@prisma/client';
import {notifySupplier} from '@/lib/supplier-notifications';

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const s=await requireDeliverySession();const{id}=await params;
  const account=await prisma.supplierAccount.findFirst({where:{id:s.id,companyId:s.companyId,role:'DRIVER',isActive:true,driverAvailable:true}});
  if(!account)return bad('Livreur indisponible',409);
  const order=await prisma.supplierOrder.findFirst({where:{id,companyId:s.companyId,status:SupplierOrderStatus.READY_FOR_DELIVERY},include:{delivery:true,shop:{select:{name:true}}}});
  if(!order)return bad('Cette livraison n’est plus disponible',409);
  if(order.delivery?.driverAccountId===s.id)
    return ok({ok:true,alreadyAccepted:true,orderId:id});
  if(order.delivery?.driverAccountId)
    return bad('Cette mission est déjà attribuée à un autre livreur',409);
  const updated=await prisma.$transaction(async tx=>{
   const claimed=await tx.supplierDelivery.updateMany({
    where:{orderId:id,driverAccountId:null,status:{in:[SupplierDeliveryStatus.PENDING,SupplierDeliveryStatus.ASSIGNED]}},
    data:{driverAccountId:s.id,driverName:s.fullName,driverPhone:account.phone||null,status:SupplierDeliveryStatus.ASSIGNED,assignedAt:new Date()}
   });
   if(claimed.count!==1)throw Object.assign(new Error('Cette livraison vient d’être acceptée par un autre livreur'),{status:409});
   await tx.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:id,accountId:s.id,type:'DELIVERY_ACCEPTED',note:s.fullName+' a accepté la livraison'}});
   return tx.supplierDelivery.findUnique({where:{orderId:id}});
  });
  await notifySupplier(s.companyId,'Livraison acceptée',s.fullName+' a accepté '+order.reference+' · '+order.shop.name+'.',{href:'/supplier?tab=delivery',kind:'DELIVERY',priority:'NORMAL',roles:['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER'],metadata:{orderId:id,driverAccountId:s.id}});
  return ok({ok:true,orderId:id,acceptedAt:updated?.assignedAt});
 }catch(e:any){return bad(e.message,e.status||500)}
}

import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {notifySupplier} from '@/lib/supplier-notifications';
import {notifyShop} from '@/lib/notifications';
import {NotificationType,SupplierOrderStatus,SupplierDeliveryStatus} from '@prisma/client';

export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER']);
  const b=await req.json(),orderId=String(b.orderId||''),driverAccountId=String(b.driverAccountId||'');
  const [order,driver]=await Promise.all([
    prisma.supplierOrder.findFirst({where:{id:orderId,companyId:s.companyId},
      include:{shop:{select:{name:true}},delivery:true}}),
    prisma.supplierAccount.findFirst({where:{id:driverAccountId,companyId:s.companyId,
      role:'DRIVER',isActive:true,driverAvailable:true}}),
  ]);
  if(!order)return bad('Commande introuvable',404);
  if(order.status!==SupplierOrderStatus.READY_FOR_DELIVERY)
    return bad('Affectation possible uniquement lorsque la commande est prête pour livraison.',409);
  if(!driver)return bad('Livreur indisponible ou invalide',409);
  if(order.delivery?.driverAccountId===driver.id)
    return ok({ok:true,alreadyAssigned:true,driverName:driver.fullName});
  if(order.delivery?.driverAccountId)
    return bad('Cette commande est déjà affectée à un livreur. Utilisez une procédure de réaffectation contrôlée.',409);
  const now=new Date();
  const delivery=await prisma.$transaction(async tx=>{
    if(!order.delivery){
      return tx.supplierDelivery.create({data:{
        orderId,driverAccountId:driver.id,driverName:driver.fullName,driverPhone:driver.phone||null,
        assignedAt:now,status:SupplierDeliveryStatus.ASSIGNED,cashDue:order.total,
      }});
    }
    const updated=await tx.supplierDelivery.updateMany({
      where:{orderId,driverAccountId:null,status:{in:[SupplierDeliveryStatus.PENDING,SupplierDeliveryStatus.ASSIGNED]}},
      data:{driverAccountId:driver.id,driverName:driver.fullName,driverPhone:driver.phone||null,
        assignedAt:now,status:SupplierDeliveryStatus.ASSIGNED},
    });
    if(updated.count!==1)throw Object.assign(new Error('Mission déjà affectée ou statut modifié'),{status:409});
    return tx.supplierDelivery.findUniqueOrThrow({where:{orderId}});
  });
  await Promise.allSettled([
    notifySupplier(s.companyId,'🚚 Votre prochaine mission vous attend',
      `Commande ${order.reference} · ${order.shop.name}. Ouvrez votre tournée pour la prendre en charge.`,{
        href:'/delivery',kind:'DELIVERY',priority:'HIGH',
        experienceKey:'DRIVER_NEW_MISSION',eventId:order.id,
        accountIds:[driver.id],metadata:{orderId:order.id,reference:order.reference}
      }),
    notifyShop(order.shopId,'Livreur affecté',
      `${driver.fullName} a été affecté à votre commande ${order.reference}.`,
      '/app/suppliers',NotificationType.INFO,undefined,{
        experienceKey:'SHOP_ORDER_PROGRESS',eventId:order.id+'-ASSIGNED',
        metadata:{orderId:order.id,status:'ASSIGNED'}
      })
  ]);
  return ok(plain(delivery));
 }catch(e:any){
  if(e.code==='P2002')return bad('Commande déjà affectée',409);
  return bad(e.message,e.status||500);
 }
}

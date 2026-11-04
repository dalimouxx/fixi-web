import {prisma} from '@/lib/prisma';
import {ensureMarketplaceAccounting} from '@/lib/supplier-accounting';
import {requireDeliverySession} from '@/lib/delivery-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {NotificationType,SupplierDeliveryStatus,SupplierOrderStatus} from '@prisma/client';
import {notifySupplier} from '@/lib/supplier-notifications';
import {notifyShop} from '@/lib/notifications';
import {ETA_ALERT_MIN,etaMinutes,haversineKm} from '@/lib/field-ops';

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const s=await requireDeliverySession();const{id}=await params;const b=await req.json();
  // 18.2 — livreur partenaire : la commande peut appartenir à un autre fournisseur qui lui a confié la course.
  const o=await prisma.supplierOrder.findFirst({where:{id,delivery:{is:{driverAccountId:s.id}},OR:[{companyId:s.companyId},{delivery:{is:{partnerCompanyId:s.companyId}}}]},include:{delivery:true}});
  if(!o)return bad('Livraison introuvable',404);
  const status=String(b.status||o.status) as SupplierOrderStatus;
  const allowed:SupplierOrderStatus[]=[SupplierOrderStatus.READY_FOR_DELIVERY,SupplierOrderStatus.OUT_FOR_DELIVERY,SupplierOrderStatus.DELIVERED];
  if(!allowed.includes(status))return bad('Statut invalide');
  if(status===SupplierOrderStatus.OUT_FOR_DELIVERY){
   if(o.status!==SupplierOrderStatus.READY_FOR_DELIVERY&&o.status!==SupplierOrderStatus.OUT_FOR_DELIVERY)return bad('Transition invalide',409);
   const shift=await prisma.supplierDeliveryShift.findFirst({where:{companyId:s.companyId,driverAccountId:s.id,status:'OPEN'}});
   if(!shift)return bad('Ouvrez votre journée avant de démarrer une livraison',409);
  }
  if(status===SupplierOrderStatus.DELIVERED){
   if(o.status!==SupplierOrderStatus.OUT_FOR_DELIVERY)return bad('La livraison doit être en route',409);
   if(!String(b.recipientName||'').trim())return bad('Nom du réceptionnaire requis pour confirmer la livraison',409);
   const proofCode=String(b.proofCode||'').trim();if(!proofCode)return bad('Code de remise atelier requis',409);if(!o.deliveryCode||proofCode!==o.deliveryCode)return bad('Code de remise incorrect',409);
   if(!o.deliveryCode||String(b.proofCode||'').trim()!==String(o.deliveryCode))return bad('Code de remise atelier invalide',409);
  }
  const ds=status===SupplierOrderStatus.DELIVERED?SupplierDeliveryStatus.DELIVERED:status===SupplierOrderStatus.OUT_FOR_DELIVERY?SupplierDeliveryStatus.OUT_FOR_DELIVERY:SupplierDeliveryStatus.ASSIGNED;
  const result=await prisma.$transaction(async tx=>{
   const order=await tx.supplierOrder.update({where:{id},data:{status}});
   await tx.supplierDelivery.update({where:{orderId:id},data:{
    status:ds,
    pickedUpAt:status===SupplierOrderStatus.OUT_FOR_DELIVERY&&!o.delivery?.pickedUpAt?new Date():undefined,
    deliveredAt:status===SupplierOrderStatus.DELIVERED?new Date():undefined,
    trackingNote:b.trackingNote||undefined,
    recipientName:status===SupplierOrderStatus.DELIVERED?String(b.recipientName).trim():undefined,
    recipientPhone:status===SupplierOrderStatus.DELIVERED?(String(b.recipientPhone||'').trim()||null):undefined,
    proofCode:status===SupplierOrderStatus.DELIVERED?(String(b.proofCode||'').trim()||null):undefined,
    proofUrl:status===SupplierOrderStatus.DELIVERED?(b.proofUrl||undefined):undefined,
    // 17.8 — signature au doigt du réceptionnaire (PNG, 200 Ko max).
    signatureUrl:status===SupplierOrderStatus.DELIVERED&&typeof b.signatureUrl==='string'&&/^data:image\/png;base64,/.test(b.signatureUrl)&&b.signatureUrl.length<=270000?b.signatureUrl:undefined
   }});
   if(status===SupplierOrderStatus.DELIVERED)await tx.supplierDeliveryEvent.create({data:{companyId:o.companyId,orderId:id,accountId:s.id,type:'DELIVERY_PROOF',note:'Reçu par '+String(b.recipientName).trim()+' · Code de remise vérifié'+(b.signatureUrl?' · signé':''),proofUrl:b.proofUrl||null}});
   if(Number.isFinite(Number(b.latitude))&&Number.isFinite(Number(b.longitude)))await tx.supplierDriverLocation.create({data:{companyId:o.companyId,orderId:id,accountId:s.id,latitude:Number(b.latitude),longitude:Number(b.longitude),accuracy:Number.isFinite(Number(b.accuracy))?Number(b.accuracy):null}});
   return order;
  });
  if(status===SupplierOrderStatus.DELIVERED)await ensureMarketplaceAccounting(id,s.id);
  // 17.6 — « Votre livreur arrive dans ~N min » : une seule fois par livraison, calculé sur le GPS.
  if(status===SupplierOrderStatus.OUT_FOR_DELIVERY&&Number.isFinite(Number(b.latitude))&&Number.isFinite(Number(b.longitude))){
   try{
    const shop=await prisma.shop.findUnique({where:{id:o.shopId},select:{latitude:true,longitude:true}});
    if(shop?.latitude!=null&&shop.longitude!=null){
     const eta=etaMinutes(haversineKm({lat:Number(b.latitude),lng:Number(b.longitude)},{lat:Number(shop.latitude),lng:Number(shop.longitude)}));
     if(eta<=ETA_ALERT_MIN&&!await prisma.supplierDeliveryEvent.findFirst({where:{orderId:id,type:'ETA_SOON'},select:{id:true}})){
      await prisma.supplierDeliveryEvent.create({data:{companyId:o.companyId,orderId:id,accountId:s.id,type:'ETA_SOON',note:`Arrivée estimée dans ${eta} min`}});
      await notifyShop(o.shopId,`Votre livreur arrive dans ~${eta} min`,`${s.fullName} apporte la commande ${o.reference}. Préparez le code de remise.`,'/app/suppliers?tab=orders',NotificationType.INFO,undefined,{experienceKey:'SHOP_ORDER_PROGRESS',eventId:id+'-ETA',priority:'HIGH',metadata:{orderId:id,eta}});
     }
    }
   }catch{/* l'estimation ne bloque jamais la mise à jour */}
  }
  if(status!==o.status){
   if(status===SupplierOrderStatus.OUT_FOR_DELIVERY){
    await Promise.allSettled([
     notifySupplier(o.companyId,'🚚 Livraison en route',`La commande ${o.reference} est maintenant en route.`,{href:'/supplier?tab=delivery',kind:'DELIVERY',experienceKey:'SUPPLIER_UPDATE',eventId:o.id+'-OUT',roles:['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER'],metadata:{orderId:o.id,reference:o.reference}}),
     notifyShop(o.shopId,'Votre commande est en route',`La commande ${o.reference} est partie en livraison. Vous pouvez suivre son avancement dans Fixi Supplier.`,'/app/suppliers?tab=orders',NotificationType.INFO,undefined,{experienceKey:'SHOP_ORDER_PROGRESS',eventId:o.id+'-OUT',metadata:{orderId:o.id,reference:o.reference,status:'OUT_FOR_DELIVERY'}})
    ]);
   }
   if(status===SupplierOrderStatus.DELIVERED){
    await Promise.allSettled([
     notifySupplier(o.companyId,'✅ Livraison remise avec preuve',`Commande ${o.reference} remise à ${String(b.recipientName).trim()}.`,{href:'/supplier?tab=delivery',kind:'SUCCESS',priority:'NORMAL',experienceKey:'SUPPLIER_UPDATE',eventId:o.id+'-DELIVERED',roles:['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER','ACCOUNTANT'],metadata:{orderId:o.id,reference:o.reference,recipientName:String(b.recipientName).trim()}}),
     notifyShop(o.shopId,'🎉 Votre commande est livrée',`La commande ${o.reference} a été remise à ${String(b.recipientName).trim()}. Vérifiez votre réception et les articles.`,'/app/suppliers?tab=orders',NotificationType.SUCCESS,undefined,{
       experienceKey:'SHOP_ORDER_DELIVERED',eventId:o.id+'-DELIVERED',
       metadata:{orderId:o.id,reference:o.reference,status:'DELIVERED'}
     }),
     notifySupplier(s.companyId,'✅ Bravo, livraison terminée',`Mission ${o.reference} terminée. Votre remise à ${String(b.recipientName).trim()} est enregistrée.`,{
       href:'/delivery',kind:'SUCCESS',priority:'NORMAL',experienceKey:'DRIVER_DELIVERED',
       eventId:o.id,accountIds:[s.id],metadata:{orderId:o.id,reference:o.reference}
     })
    ]);
   }
  }
  return ok({ok:true,id:result.id,status:result.status});
 }catch(e:any){return bad(e.message,e.status||500)}
}


export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const s=await requireDeliverySession();const{id}=await params;
  const driver=await prisma.supplierAccount.findFirst({where:{id:s.id,companyId:s.companyId,role:'DRIVER',isActive:true,driverAvailable:true},select:{id:true}});
  if(!driver)return bad('Activez votre disponibilité avant de prendre une mission',409);
  const o=await prisma.supplierOrder.findFirst({where:{id,companyId:s.companyId,status:SupplierOrderStatus.READY_FOR_DELIVERY},include:{delivery:true,shop:{select:{name:true}}}});
  if(!o)return bad('Commande indisponible',404);
  if(o.delivery?.driverAccountId===s.id)return ok({ok:true,id:o.id,status:o.status,alreadyAccepted:true});
  if(o.delivery?.driverAccountId)return bad('Cette commande vient d’être acceptée par un autre livreur',409);
  const result=await prisma.$transaction(async tx=>{
   const updated=await tx.supplierDelivery.updateMany({where:{orderId:id,driverAccountId:null},data:{driverAccountId:s.id,driverName:s.fullName,assignedAt:new Date(),acceptedAt:new Date(),status:SupplierDeliveryStatus.ASSIGNED}});
   if(updated.count!==1)throw Object.assign(new Error('Commande déjà prise'),{status:409});
   await tx.supplierDeliveryEvent.create({data:{companyId:s.companyId,orderId:id,accountId:s.id,type:'DELIVERY_ACCEPTED',note:'Commande acceptée par '+s.fullName}});
   return tx.supplierOrder.findUnique({where:{id},include:{delivery:true,shop:{select:{name:true,region:true,address:true,phone:true}},items:{include:{product:true}}}});
  });
  await Promise.allSettled([
   notifySupplier(s.companyId,'Commande prise par un livreur',o.reference+' · '+s.fullName+' a accepté la livraison.',{href:'/supplier?tab=delivery',kind:'DELIVERY',soundKey:'SUCCESS',roles:['OWNER','ADMIN','MANAGER','DELIVERY_MANAGER'],metadata:{orderId:id,reference:o.reference,driverAccountId:s.id}}),
   notifyShop(o.shopId,'Votre livreur est affecté',o.reference+' · '+s.fullName+' a accepté votre livraison.','/app/suppliers?tab=orders',NotificationType.INFO,undefined,{
     experienceKey:'SHOP_ORDER_PROGRESS',eventId:o.id+'-ASSIGNED',metadata:{orderId:o.id,status:'ASSIGNED'}
   })
  ]);
  return ok({ok:true,id:result?.id,reference:result?.reference});
 }catch(e:any){return bad(e.message,e.status||500)}
}

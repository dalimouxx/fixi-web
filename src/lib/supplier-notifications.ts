import {prisma} from './prisma';
import {publishSupplierAccount} from './realtime';
import {sendPushToSupplierAccounts,type PushDispatchReport} from './push';
import {getNotificationExperience, experienceTag, type FixiExperienceKey, type FixiSoundKey} from './notification-experience';

export type SupplierNotificationKind='INFO'|'SUCCESS'|'WARNING'|'ERROR'|'ORDER'|'DELIVERY'|'PAYMENT'|'STOCK'|'SYSTEM';
export type SupplierNotificationPriority='LOW'|'NORMAL'|'HIGH'|'URGENT';

type NotifyOptions={
  href?:string;
  kind?:SupplierNotificationKind;
  priority?:SupplierNotificationPriority;
  soundKey?:FixiSoundKey;
  experienceKey?:FixiExperienceKey;
  eventId?:string;
  roles?:string[];
  accountIds?:string[];
  metadata?:Record<string,unknown>;
  availableDriversOnly?:boolean;
  onPushReport?:(report:PushDispatchReport)=>void;
};

export async function notifySupplier(companyId:string,title:string,message:string,options:NotifyOptions={}){
  const where:any={companyId,isActive:true};
  if(options.accountIds?.length) where.id={in:options.accountIds};
  if(options.roles?.length) where.role={in:options.roles};
  if(options.availableDriversOnly)where.driverAvailable=true;
  const users=await prisma.supplierAccount.findMany({where,select:{id:true}});
  if(!users.length)return [];
  const kind=options.kind||'INFO',priority=options.priority||'NORMAL';
  const experienceKey=options.experienceKey||'GENERAL';
  const soundKey=options.soundKey||(
    experienceKey==='GENERAL'?soundFor(kind,priority):getNotificationExperience(experienceKey).sound
  );
  const rows=await prisma.$transaction(users.map(u=>prisma.supplierNotification.create({data:{
    companyId,accountId:u.id,kind,priority,title,message,href:options.href||null,soundKey,experienceKey,
    metadata:options.metadata as any
  }})));
  for(const row of rows)publishSupplierAccount(row.accountId,'notification.created',{
    id:row.id,title:row.title,message:row.message,href:row.href,kind:row.kind,priority:row.priority,soundKey:row.soundKey,experienceKey,createdAt:row.createdAt
  });
  const push:any={title,body:message,href:options.href||'/supplier',
    experienceKey,tag:experienceTag(experienceKey,options.eventId||rows[0].id),
    // Never put customer financial/identity metadata in phone notifications.
    data:{experienceKey,
      ...(typeof options.metadata?.orderId==='string'?{orderId:options.metadata.orderId}:{})}};
  if(experienceKey==='DRIVER_NEW_MISSION'&&options.metadata?.orderId){
    push.tag=experienceTag('DRIVER_NEW_MISSION',String(options.metadata.orderId));
    push.requireInteraction=true;
    push.actions=[{action:'accept-delivery',title:'Accepter la mission'},{action:'open',title:'Voir la tournée'}];
  }
  // Wait for gateway responses while this request is alive. Failures are
  // best-effort and must never roll back a completed supplier transaction.
  try{
    const report=await sendPushToSupplierAccounts(rows.map(x=>x.accountId),push);
    options.onPushReport?.(report);
    if(report.failed>0)console.warn('Supplier push delivery failures',report.failed);
  }catch(err){console.warn('Supplier push transport unavailable',String(err))}

  return rows;
}

export async function notifySupplierLowStock(companyId:string,productId:string){
  const p=await prisma.supplierProduct.findFirst({where:{id:productId,companyId},select:{id:true,sku:true,name:true,stock:true,reservedStock:true,minStock:true,active:true}});
  if(!p?.active)return;
  const available=p.stock-p.reservedStock;
  if(available>p.minStock)return;
  const recent=await prisma.supplierNotification.findFirst({
    where:{companyId,kind:'STOCK',metadata:{path:['productId'],equals:p.id},createdAt:{gte:new Date(Date.now()-6*60*60*1000)}},
    select:{id:true}
  }).catch(()=>null);
  if(recent)return;
  await notifySupplier(companyId,'Stock faible',`${p.name} (${p.sku}) : ${available} disponible(s), seuil ${p.minStock}.`,{
    href:'/supplier?tab=products',kind:'STOCK',priority:available<=0?'URGENT':'HIGH',soundKey:available<=0?'URGENT':'WARNING',
    roles:['OWNER','ADMIN','MANAGER','STOCK'],metadata:{productId:p.id,sku:p.sku,available,minStock:p.minStock}
  });
}

function soundFor(kind:SupplierNotificationKind,priority:SupplierNotificationPriority){
  if(priority==='URGENT'||kind==='ERROR')return 'URGENT';
  if(priority==='HIGH'||kind==='WARNING'||kind==='STOCK')return 'WARNING';
  if(kind==='SUCCESS'||kind==='PAYMENT')return 'SUCCESS';
  return 'CHIME';
}

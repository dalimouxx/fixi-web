import {prisma} from './prisma';
import {publishSupplierAccount} from './realtime';

export type SupplierNotificationKind='INFO'|'SUCCESS'|'WARNING'|'ERROR'|'ORDER'|'DELIVERY'|'PAYMENT'|'STOCK'|'SYSTEM';
export type SupplierNotificationPriority='LOW'|'NORMAL'|'HIGH'|'URGENT';

type NotifyOptions={
  href?:string;
  kind?:SupplierNotificationKind;
  priority?:SupplierNotificationPriority;
  soundKey?:'CHIME'|'SUCCESS'|'WARNING'|'URGENT'|'SILENT';
  roles?:string[];
  accountIds?:string[];
  metadata?:Record<string,unknown>;
};

export async function notifySupplier(companyId:string,title:string,message:string,options:NotifyOptions={}){
  const where:any={companyId,isActive:true};
  if(options.accountIds?.length) where.id={in:options.accountIds};
  if(options.roles?.length) where.role={in:options.roles};
  const users=await prisma.supplierAccount.findMany({where,select:{id:true}});
  if(!users.length)return [];
  const kind=options.kind||'INFO',priority=options.priority||'NORMAL',soundKey=options.soundKey||soundFor(kind,priority);
  const rows=await prisma.$transaction(users.map(u=>prisma.supplierNotification.create({data:{
    companyId,accountId:u.id,kind,priority,title,message,href:options.href||null,soundKey,
    metadata:options.metadata as any
  }})));
  for(const row of rows)publishSupplierAccount(row.accountId,'notification.created',{
    id:row.id,title:row.title,message:row.message,href:row.href,kind:row.kind,priority:row.priority,soundKey:row.soundKey,createdAt:row.createdAt
  });
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

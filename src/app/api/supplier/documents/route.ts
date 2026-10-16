import {prisma} from '@/lib/prisma';
import {requireSupplierSession} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

const TYPES=['QUOTE','PROFORMA','DELIVERY_NOTE','PURCHASE_ORDER','RECEIPT'] as const;
const prefixes:Record<string,string>={QUOTE:'DEV',PROFORMA:'PRO',DELIVERY_NOTE:'BL',PURCHASE_ORDER:'BC',RECEIPT:'REC'};
const money=(v:any)=>Math.round(Number(v||0)*1000)/1000;

function ref(type:string){return (prefixes[type]||'DOC')+'-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Date.now().toString(36).toUpperCase()}

export async function GET(req:Request){
 try{
  const s=await requireSupplierSession();const u=new URL(req.url);const type=u.searchParams.get('type');
  const rows=await prisma.supplierCommercialDocument.findMany({where:{companyId:s.companyId,...(type?{type}: {})},orderBy:{issuedAt:'desc'},take:500});
  const items=rows.length?await prisma.supplierCommercialDocumentItem.findMany({where:{documentId:{in:rows.map(x=>x.id)}}}):[];
  return ok(plain({rows,items}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierSession();const b=await req.json();const type=String(b.type||'');
  if(!TYPES.includes(type as any))return bad('Type de document invalide');
  if(!['OWNER','ADMIN','MANAGER','SALES','CASHIER','ACCOUNTANT','STOCK'].includes(s.role))return bad('FORBIDDEN',403);

  const raw=Array.isArray(b.items)?b.items:[];
  if(!raw.length)return bad('Aucune ligne');
  const productIds=[...new Set<string>(raw.map((x:any)=>String(x.productId||'')).filter(Boolean))];
  const products=productIds.length?await prisma.supplierProduct.findMany({where:{companyId:s.companyId,id:{in:productIds}}}):[];
  let subtotal=0,tax=0;const items:any[]=[];
  for(const i of raw){
   const p=products.find(x=>x.id===String(i.productId||''));const name=String(i.name||p?.name||'').trim();if(!name)return bad('Désignation requise');
   const quantity=Math.max(1,Math.trunc(Number(i.quantity||1))),unitPrice=money(i.unitPrice??p?.retailPrice??p?.price??0),discount=Math.max(0,money(i.discount||0)),taxRate=Math.max(0,Number(i.taxRate??p?.taxRate??0));
   const base=Math.max(0,unitPrice*quantity-discount);subtotal+=base;tax+=base*taxRate/100;
   items.push({productId:p?.id||null,sku:String(i.sku||p?.sku||'').trim()||null,name,quantity,unitPrice,discount,taxRate});
  }
  subtotal=money(subtotal);tax=money(tax);const globalDiscount=Math.max(0,money(b.globalDiscount||0)),total=Math.max(0,money(subtotal-globalDiscount+tax));
  let customer:any=null;if(b.customerId){customer=await prisma.supplierErpCustomer.findFirst({where:{id:String(b.customerId),companyId:s.companyId}});if(!customer)return bad('Client invalide',404)}
  const company=await prisma.supplierCompany.findUnique({where:{id:s.companyId},select:{currency:true}});
  const doc=await prisma.$transaction(async tx=>{
   const d=await tx.supplierCommercialDocument.create({data:{
    companyId:s.companyId,type,reference:String(b.reference||ref(type)),status:String(b.status||'ISSUED'),customerId:customer?.id||null,sourceSaleId:b.sourceSaleId||null,sourceOrderId:b.sourceOrderId||null,warehouseId:b.warehouseId||null,
    partyName:String(b.partyName||customer?.name||'').trim()||null,partyPhone:String(b.partyPhone||customer?.phone||'').trim()||null,partyAddress:String(b.partyAddress||customer?.address||customer?.region||'').trim()||null,partyTaxId:String(b.partyTaxId||customer?.taxId||'').trim()||null,currency:company?.currency||'DT',
    subtotal,discount:globalDiscount,tax,total,validUntil:b.validUntil?new Date(b.validUntil):null,note:b.note||null,createdById:s.id
   }});
   await tx.supplierCommercialDocumentItem.createMany({data:items.map(x=>({...x,documentId:d.id}))});
   await tx.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'CREATE',entity:'COMMERCIAL_DOCUMENT',entityId:d.id,metadata:{type,reference:d.reference,total}}});
   return d;
  });
  return ok(plain(doc),{status:201});
 }catch(e:any){if(e.code==='P2002')return bad('Référence document déjà utilisée',409);return bad(e.message,e.status||500)}
}

export async function PATCH(req:Request){
 try{
  const s=await requireSupplierSession();if(!['OWNER','ADMIN','MANAGER','SALES','ACCOUNTANT','STOCK'].includes(s.role))return bad('FORBIDDEN',403);
  const b=await req.json(),id=String(b.id||'');const doc=await prisma.supplierCommercialDocument.findFirst({where:{id,companyId:s.companyId}});if(!doc)return bad('Document introuvable',404);
  const status=String(b.status||'');if(!['DRAFT','ISSUED','ACCEPTED','CANCELLED','EXPIRED','CONVERTED'].includes(status))return bad('Statut invalide');
  const x=await prisma.supplierCommercialDocument.update({where:{id},data:{status}});
  return ok(plain(x));
 }catch(e:any){return bad(e.message,e.status||500)}
}

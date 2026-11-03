import {prisma} from './prisma';
import {nextSupplierReference} from './supplier-sequences';
import {invoiceLines} from './invoice-lines';
export {invoiceLines};

const m=(v:unknown)=>Math.round(Number(v||0)*1000)/1000;
export const FISCAL_STAMP=1;

export type InvoiceParty={name?:string|null;taxId?:string|null;address?:string|null;phone?:string|null};

/** Crée (une seule fois) la facture numérotée d'une vente, ou rend celle déjà émise. */
export async function invoiceForSale(companyId:string,accountId:string,where:{id?:string;reference?:string},party:InvoiceParty={},withStamp=true){
 const sale=await prisma.supplierErpSale.findFirst({where:{companyId,...(where.id?{id:where.id}:{reference:String(where.reference||'')})}});
 if(!sale)throw Object.assign(new Error('Vente introuvable'),{status:404});
 if(sale.status==='CANCELLED')throw Object.assign(new Error('Vente annulée : pas de facture'),{status:409});
 const [items,company,customer]=await Promise.all([
  prisma.supplierErpSaleItem.findMany({where:{saleId:sale.id}}),
  prisma.supplierCompany.findUnique({where:{id:companyId},select:{name:true,legalName:true,address:true,region:true,phone:true,email:true,taxId:true,tradeRegister:true,logoUrl:true,documentFooter:true,invoiceTerms:true,bankName:true,bankRib:true,invoicePrefix:true}}),
  sale.customerId?prisma.supplierErpCustomer.findFirst({where:{id:sale.customerId,companyId}}):Promise.resolve(null)
 ]);
 const productIds=[...new Set(items.map(i=>i.productId).filter(Boolean) as string[])];
 const products=productIds.length?await prisma.supplierProduct.findMany({where:{companyId,id:{in:productIds}},select:{id:true,taxRate:true}}):[];
 const rates=Object.fromEntries(products.map(p=>[p.id,Number(p.taxRate||0)]));
 const calc=invoiceLines(sale,items,rates);
 let doc=await prisma.supplierCommercialDocument.findFirst({where:{companyId,type:'INVOICE',sourceSaleId:sale.id,status:{not:'CANCELLED'}}});
 if(!doc){
  const name=String(party.name||customer?.name||'').trim().slice(0,160)||null;
  const stamp=withStamp?FISCAL_STAMP:0;
  const reference=await nextSupplierReference(companyId,'INVOICE',company?.invoicePrefix||'FAC');
  doc=await prisma.$transaction(async tx=>{
   const d=await tx.supplierCommercialDocument.create({data:{companyId,type:'INVOICE',reference,status:'ISSUED',customerId:customer?.id||null,sourceSaleId:sale.id,
    partyName:name,partyTaxId:String(party.taxId||customer?.taxId||'').trim().slice(0,40)||null,partyAddress:String(party.address||customer?.address||customer?.region||'').trim().slice(0,240)||null,
    partyPhone:String(party.phone||customer?.phone||'').trim().slice(0,30)||null,subtotal:calc.ht,discount:0,tax:calc.tva,stamp,total:m(calc.ttc+stamp),createdById:accountId,note:'Facture de la vente '+sale.reference}});
   await tx.supplierCommercialDocumentItem.createMany({data:calc.lines.map(l=>({documentId:d.id,productId:null,sku:l.sku,name:l.name,quantity:l.quantity,unitPrice:l.unitHT,discount:0,taxRate:l.taxRate}))});
   await tx.supplierAuditEvent.create({data:{companyId,accountId,action:'CREATE',entity:'COMMERCIAL_DOCUMENT',entityId:d.id,metadata:{type:'INVOICE',reference,saleReference:sale.reference,total:Number(d.total)}}});
   return d;
  });
 }
 return {
  document:{id:doc.id,reference:doc.reference,issuedAt:doc.issuedAt,partyName:doc.partyName,partyTaxId:doc.partyTaxId,partyAddress:doc.partyAddress,partyPhone:doc.partyPhone,
   ht:Number(doc.subtotal),tva:Number(doc.tax),stamp:Number(doc.stamp),total:Number(doc.total)},
  lines:calc.lines,taxes:calc.taxes,
  company,sale:{reference:sale.reference,createdAt:sale.createdAt,total:Number(sale.total),paid:Number(sale.paid)}
 };
}

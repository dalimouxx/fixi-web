import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {POST as advancedPost} from '@/app/api/supplier/advanced/route';

/** Desktop returns call the already-shared Supplier ledger and inventory workflow.
 * Mutations are switched OFF unless specifically approved.
 */
export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER']);
  if(process.env.FIXI_WINDOWS_RETURNS_ENABLED!=='true')return bad('Retours Windows non activés sur FIXI Cloud',403);
  const body=await req.json();
  const sourceSaleId=String(body.sourceSaleId||'');
  const reference=String(body.reference||'');
  if(!/^WINRET-[a-f0-9-]{36}$/i.test(reference))return bad('Référence de retour Windows invalide',400);
  const items=Array.isArray(body.items)?body.items:[];
  const previous=await prisma.supplierReturn.findFirst({where:{companyId:s.companyId,reference,type:'SALE_RETURN'}});
  if(previous){
   const lines=await prisma.supplierReturnItem.findMany({where:{returnId:previous.id},select:{saleItemId:true,quantity:true,restock:true,condition:true,reason:true}});
   const norm=(x:any)=>[String(x.saleItemId||''),Number(x.quantity),Boolean(x.restock),String(x.condition||'BON'),String(x.reason||'Retour client')].join('|');
   const expected=items.map(norm).sort(),actual=lines.map(norm).sort();
   const matches=previous.sourceSaleId===sourceSaleId&&previous.status==='COMPLETED'&&
    actual.length===expected.length&&actual.every((line,i)=>line===expected[i])&&
    Math.abs(Number(previous.refund)-Number(body.refund||0))<0.0005&&
    String(previous.note||'')===String(body.note||'')&&
    (Number(previous.refund)===0||String(previous.refundMethod||'')===String(body.refundMethod||'CASH'));
   if(!matches)return bad('Cette référence appartient à un autre retour : vérifiez les avoirs avant toute nouvelle tentative',409);
   return ok({id:previous.id,reference:previous.reference,replayed:true});
  }
  if(!sourceSaleId||items.length<1||items.length>50)return bad('Vente et lignes de retour nécessaires',400);
  if(new Set(items.map((x:any)=>String(x.saleItemId))).size!==items.length)return bad('Lignes de retour en double',400);
  if(items.some((x:any)=>!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>500||typeof x.saleItemId!=='string'
       ||typeof x.restock!=='boolean'||!['BON','DAMAGED'].includes(x.condition)))
    return bad('Article, quantité ou état incorrect',400);
  const sale=await prisma.supplierErpSale.findFirst({where:{id:sourceSaleId,companyId:s.companyId,status:{not:'CANCELLED'}},select:{id:true,paid:true}});
  if(!sale)return bad('Vente introuvable',404);
  const refund=Number(body.refund||0);
  if(!Number.isFinite(refund)||refund<0||refund>100000000||Math.abs(Math.round(refund*1000)-refund*1000)>.001)return bad('Remboursement invalide',400);
  const alreadyRefunded=await prisma.supplierReturn.aggregate({
   where:{companyId:s.companyId,sourceSaleId,type:'SALE_RETURN',status:'COMPLETED'},
   _sum:{refund:true}
  });
  const refundable=Math.max(0,Number(sale.paid)-Number(alreadyRefunded._sum.refund||0));
  if(refund>refundable+0.001)return bad('Remboursement supérieur aux sommes effectivement encaissées sur cette vente',409);
  if(!['CASH','CARD','TRANSFER'].includes(String(body.refundMethod||'CASH')))return bad('Moyen de remboursement invalide',400);
  const payload={action:'RETURN',reference,type:'SALE_RETURN',sourceSaleId,items:items.map((x:any)=>({
    saleItemId:x.saleItemId,quantity:x.quantity,restock:x.restock,condition:x.condition,
    reason:String(x.reason||'Retour client').slice(0,200)
  })),refund,refundMethod:body.refundMethod||'CASH',note:String(body.note||'').slice(0,500)};
  // Advanced supplier route is authoritative for stock, returns, credits and finance.
  return advancedPost(new Request(req.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}));
 }catch(e:any){return bad(e.message||'Retour impossible',e.status||500)}
}

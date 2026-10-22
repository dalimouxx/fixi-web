import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad} from '@/lib/http';
import {POST as advancedPost} from '@/app/api/supplier/advanced/route';

/** Desktop returns call the already-shared Supplier ledger and inventory workflow.
 * Mutations are switched OFF unless specifically approved.
 */
export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  if(process.env.FIXI_WINDOWS_RETURNS_ENABLED!=='true')return bad('Retours Windows non activés sur FIXI Cloud',403);
  const body=await req.json();
  const sourceSaleId=String(body.sourceSaleId||'');
  const items=Array.isArray(body.items)?body.items:[];
  if(!sourceSaleId||items.length<1||items.length>50)return bad('Vente et lignes de retour nécessaires',400);
  if(new Set(items.map((x:any)=>String(x.saleItemId))).size!==items.length)return bad('Lignes de retour en double',400);
  if(items.some((x:any)=>!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>500||typeof x.saleItemId!=='string'
       ||typeof x.restock!=='boolean'||!['BON','DAMAGED'].includes(x.condition)))
    return bad('Article, quantité ou état incorrect',400);
  const sale=await prisma.supplierErpSale.findFirst({where:{id:sourceSaleId,companyId:s.companyId,status:{not:'CANCELLED'}},select:{id:true}});
  if(!sale)return bad('Vente introuvable',404);
  const refund=Number(body.refund||0);
  if(!Number.isFinite(refund)||refund<0||refund>100000000||Math.abs(Math.round(refund*1000)-refund*1000)>.001)return bad('Remboursement invalide',400);
  if(!['CASH','CARD','TRANSFER'].includes(String(body.refundMethod||'CASH')))return bad('Moyen de remboursement invalide',400);
  const payload={action:'RETURN',type:'SALE_RETURN',sourceSaleId,items:items.map((x:any)=>({
    saleItemId:x.saleItemId,quantity:x.quantity,restock:x.restock,condition:x.condition,
    reason:String(x.reason||'Retour client').slice(0,200)
  })),refund,refundMethod:body.refundMethod||'CASH',note:String(body.note||'').slice(0,500)};
  // Advanced supplier route is authoritative for stock, returns, credits and finance.
  return advancedPost(new Request(req.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}));
 }catch(e:any){return bad(e.message||'Retour impossible',e.status||500)}
}

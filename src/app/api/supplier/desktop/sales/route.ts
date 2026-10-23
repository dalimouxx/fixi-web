import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {prisma} from '@/lib/prisma';
import {plain} from '@/lib/serializers';
import {POST as erpPost} from '@/app/api/supplier/erp/route';

/** Desktop sale relay: uses the same authorized ERP transaction as Supplier Web.
 * Disabled by default until financial and concurrency tests have passed.
 */
export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  if(process.env.FIXI_WINDOWS_SALES_ENABLED!=='true')return bad('Ventes Windows pas encore activées sur le serveur',403);
  const b=await req.json();
  const reference=String(b.reference||'');
  if(!/^WIN-[a-f0-9-]{36}$/i.test(reference))return bad('Référence Windows invalide',400);
  const prior=await prisma.supplierErpSale.findFirst({where:{companyId:s.companyId,reference}});
  if(prior)return ok(plain(prior));
  const items=Array.isArray(b.items)?b.items:[];
  if(items.length<1||items.length>100)return bad('Panier invalide',400);
  if(items.some((x:any)=>typeof x.productId!=='string'||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>1000))return bad('Quantité invalide',400);
  if(new Set(items.map((x:any)=>x.productId)).size!==items.length)return bad('Produits en doublon',400);
  const paid=Number(b.paid);
  if(!Number.isFinite(paid)||paid<0)return bad('Montant payé invalide',400);
  const method=String(b.method||'CASH').toUpperCase();
  if(!['CASH','CARD','TRANSFER'].includes(method))return bad('Mode de paiement non autorisé',400);
  const body={action:'SALE',reference,items:items.map((x:any)=>({productId:x.productId,quantity:x.quantity})),
    customerId:b.customerId||null,discount:0,tax:0,payments:paid>0?[{method,amount:paid}]:[]};
  // The ERP route does all stock, credit and open-cash-session checks.
  const response=await erpPost(new Request(req.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
  if(response.status===500){
    // If the unique sale reference collided with a successful concurrent request, return its result.
    const recorded=await prisma.supplierErpSale.findFirst({where:{companyId:s.companyId,reference}});
    if(recorded)return ok(plain(recorded));
  }
  return response;
 }catch(e:any){return bad(e.message||'Erreur de caisse',e.status||500)}
}

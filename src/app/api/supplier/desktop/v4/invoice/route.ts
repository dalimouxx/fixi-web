import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {invoiceForSale} from '@/lib/supplier-invoice';

/** Caisse Windows : facture numérotée (HT, TVA par taux, timbre fiscal) à partir du ticket d'une vente. */
export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  const b=await req.json().catch(()=>({}));
  const reference=String(b.reference||'').trim();
  if(!reference||reference.length>80)return bad('Référence de vente invalide',400);
  return ok(await invoiceForSale(s.companyId,s.id,{reference},{name:b.partyName,taxId:b.partyTaxId,address:b.partyAddress,phone:b.partyPhone},b.stamp!==false));
 }catch(e:any){return bad(e.message||'Facture indisponible',e.status||500)}
}

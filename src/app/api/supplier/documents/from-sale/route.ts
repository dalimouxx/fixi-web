import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {invoiceForSale} from '@/lib/supplier-invoice';

/** Fixi Web fournisseur : transforme une vente de la caisse en facture numérotée. */
export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER','ACCOUNTANT']);
  const b=await req.json().catch(()=>({}));
  const saleId=String(b.saleId||'');if(!saleId)return bad('Vente requise',400);
  return ok(await invoiceForSale(s.companyId,s.id,{id:saleId},{name:b.partyName,taxId:b.partyTaxId,address:b.partyAddress,phone:b.partyPhone},b.stamp!==false));
 }catch(e:any){return bad(e.message||'Facture indisponible',e.status||500)}
}

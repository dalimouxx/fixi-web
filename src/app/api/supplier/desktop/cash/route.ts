import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad} from '@/lib/http';
import {POST as erpPost} from '@/app/api/supplier/erp/route';

/** Only the existing server-controlled ERP cash session actions are permitted. */
export async function POST(req:Request){
 try{
  await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER']);
  if(process.env.FIXI_WINDOWS_SALES_ENABLED!=='true')return bad('Opérations de caisse Windows non activées',403);
  const b=await req.json();
  if(!['CASH_OPEN','CASH_CLOSE'].includes(b.action))return bad('Action de caisse invalide',400);
  const raw=b.action==='CASH_OPEN'?b.openingAmount:b.closingAmount;
  if(!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>100000000)return bad('Montant de caisse invalide',400);
  const payload={action:b.action,openingAmount:b.action==='CASH_OPEN'?Number(raw):undefined,closingAmount:b.action==='CASH_CLOSE'?Number(raw):undefined,note:String(b.note||'').slice(0,500)};
  return erpPost(new Request(req.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}));
 }catch(e:any){return bad(e.message||'Erreur de caisse',e.status||500)}
}

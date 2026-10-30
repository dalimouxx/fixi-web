import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';

/** Supplier-scoped ticket lookup for scanner, date, customer, phone and reference.
 * Scanning a barcode is a lookup key, never an authorization token.
 */
export async function GET(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','SALES','CASHIER','ACCOUNTANT']);
  const url=new URL(req.url);
  const query=String(url.searchParams.get('q')||'').trim().slice(0,100);
  const from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
  if(from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))return bad('Date de début invalide',400);
  if(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to))return bad('Date de fin invalide',400);
  if(from&&to&&from>to)return bad('Période invalide',400);
  const dateFilter={
   ...(from?{gte:new Date(from+'T00:00:00.000Z')}:{}),
   ...(to?{lte:new Date(to+'T23:59:59.999Z')}:{}),
  };
  const customers=query?await prisma.supplierErpCustomer.findMany({where:{companyId:s.companyId,OR:[
    {name:{contains:query,mode:'insensitive'}},{phone:{contains:query}}
   ]},select:{id:true,name:true,phone:true},take:50}):[];
  const sales=await prisma.supplierErpSale.findMany({where:{
    companyId:s.companyId,
    status:{not:'CANCELLED'},
    ...((from||to)?{createdAt:dateFilter}:{}),
    ...(query?{OR:[{reference:{contains:query,mode:'insensitive'}},
      {customerId:{in:customers.map(x=>x.id)}}]}:{})
   },select:{id:true,reference:true,createdAt:true,customerId:true,subtotal:true,total:true,paid:true,status:true},
   orderBy:{createdAt:'desc'},take:60});
  const customerIds=[...new Set(sales.map(x=>x.customerId).filter((x):x is string=>!!x))];
  const allCustomers=customerIds.length?await prisma.supplierErpCustomer.findMany({
   where:{companyId:s.companyId,id:{in:customerIds}},select:{id:true,name:true,phone:true}
  }):[];
  const customerMap=new Map(allCustomers.map(x=>[x.id,x]));
  const items=sales.length?await prisma.supplierErpSaleItem.findMany({
   where:{saleId:{in:sales.map(x=>x.id)}},
   select:{saleId:true,name:true,sku:true,quantity:true,unitPrice:true}
  }):[];
  return ok({sales:sales.map(x=>({
   id:x.id,reference:x.reference,createdAt:x.createdAt,status:x.status,
   customer:customerMap.get(x.customerId||'')?.name||'Client comptoir',
   phone:customerMap.get(x.customerId||'')?.phone||'',
   subtotal:Number(x.subtotal),total:Number(x.total),paid:Number(x.paid),
   items:items.filter(i=>i.saleId===x.id).map(i=>({name:i.name,sku:i.sku,quantity:i.quantity,price:Number(i.unitPrice)}))
  }))});
 }catch(e:any){return bad(e.message||'Recherche tickets impossible',e.status||500)}
}

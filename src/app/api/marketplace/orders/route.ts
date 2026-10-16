import {prisma} from '@/lib/prisma';
import {requireSession} from '@/lib/auth';
import {bad,ok} from '@/lib/http';
import {Prisma,UserRole} from '@prisma/client';
import {plain} from '@/lib/serializers';
import {audit} from '@/lib/audit';
import {notifySupplier,notifySupplierLowStock} from '@/lib/supplier-notifications';

function ref(){
  return 'SUP-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
}

export async function GET(){
  try{
    const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION]);
    const rows=await prisma.supplierOrder.findMany({
      where:{shopId:s.shopId},
      include:{company:true,items:{include:{product:true}},delivery:true},
      orderBy:{createdAt:'desc'},take:200
    });
    return ok(plain(rows));
  }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
  try{
    const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION]);
    const b=await req.json(),rawItems=Array.isArray(b.items)?b.items:[];
    if(!rawItems.length)return bad('Panier vide');

    const grouped=new Map<string,number>();
    for(const item of rawItems){
      const productId=String(item.productId||'');
      if(!productId)continue;
      grouped.set(productId,(grouped.get(productId)||0)+Math.max(1,Math.trunc(Number(item.quantity||1))));
    }
    const ids=[...grouped.keys()];
    if(!ids.length)return bad('Panier vide');

    const result=await prisma.$transaction(async tx=>{
      const products=await tx.supplierProduct.findMany({where:{id:{in:ids},active:true,company:{active:true}}});
      if(products.length!==ids.length)throw Object.assign(new Error('Produit indisponible'),{status:409});
      const companyId=products[0].companyId;
      if(products.some(p=>p.companyId!==companyId))throw Object.assign(new Error('Une commande doit contenir les produits d’un seul fournisseur'),{status:409});

      const warehouseRows=await tx.supplierWarehouseStock.findMany({where:{companyId,productId:{in:ids}},orderBy:{updatedAt:'asc'}});
      let total=0;const rows:any[]=[],allocations:any[]=[];

      for(const p of products){
        const requested=grouped.get(p.id)||0,qty=Math.max(p.minOrderQty,requested);
        if(p.stock-p.reservedStock<qty)throw Object.assign(new Error(`Stock insuffisant pour ${p.name}`),{status:409});

        const stockRows=warehouseRows.filter(x=>x.productId===p.id);
        const allocated=stockRows.reduce((a,x)=>a+Number(x.quantity||0),0);
        const unallocated=Math.max(0,p.stock-allocated);
        const fromUnallocated=Math.min(qty,unallocated);if(fromUnallocated>0)allocations.push({productId:p.id,warehouseId:null,quantity:fromUnallocated});
        let fromWarehouses=Math.max(0,qty-unallocated);
        const warehouseAvailable=stockRows.reduce((a,x)=>a+Math.max(0,Number(x.quantity||0)-Number(x.reserved||0)),0);
        if(warehouseAvailable<fromWarehouses)throw Object.assign(new Error(`Répartition dépôt incohérente pour ${p.name}`),{status:409});

        total+=Number(p.price)*qty;
        rows.push({productId:p.id,quantity:qty,unitPrice:p.price});
        await tx.supplierProduct.update({where:{id:p.id},data:{stock:{decrement:qty}}});

        for(const stock of stockRows){
          if(fromWarehouses<=0)break;
          const available=Math.max(0,stock.quantity-stock.reserved),take=Math.min(fromWarehouses,available);
          if(take>0){
            await tx.supplierWarehouseStock.update({where:{id:stock.id},data:{quantity:{decrement:take}}});
            allocations.push({productId:p.id,warehouseId:stock.warehouseId,quantity:take});
            fromWarehouses-=take;
          }
        }
      }

      const shop=await tx.shop.findUniqueOrThrow({where:{id:s.shopId}});
      const order=await tx.supplierOrder.create({
        data:{shopId:s.shopId,companyId,reference:ref(),total,deliveryAddress:b.deliveryAddress||shop.address||null,note:b.note||null,items:{create:rows}},
        include:{company:true,shop:{select:{name:true}},items:{include:{product:true}}}
      });
      if(allocations.length)await tx.supplierOrderStockAllocation.createMany({data:allocations.map(x=>({...x,orderId:order.id}))});
      return order;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});

    await audit(s.shopId,s.id,'CREATE','SUPPLIER_ORDER',result.id,{reference:result.reference,total:Number(result.total)});
    await notifySupplier(result.companyId,'Nouvelle commande Fixi',`${result.shop.name} a passé la commande ${result.reference} · ${Number(result.total).toFixed(3)} DT`,{
      href:'/supplier?tab=orders',kind:'ORDER',priority:'HIGH',soundKey:'CHIME',
      roles:['OWNER','ADMIN','MANAGER','SALES','STOCK'],
      metadata:{orderId:result.id,reference:result.reference,shopId:s.shopId}
    });
    await Promise.allSettled(result.items.map(i=>notifySupplierLowStock(result.companyId,i.productId)));
    return ok(plain(result),{status:201});
  }catch(e:any){
    if(e.code==='P2034')return bad('Stock modifié pendant la commande. Réessayez.',409);
    return bad(e.message,e.status||500);
  }
}

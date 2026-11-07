import {LIGHT_DELIVERY,withProofFlags} from '@/lib/delivery-proof';
import {prisma} from '@/lib/prisma';
import { whatsappNewOrderAlert } from '@/lib/platform-whatsapp';
import {requireSession} from '@/lib/auth';
import {bad,ok} from '@/lib/http';
import {Prisma,UserRole} from '@prisma/client';
import {plain} from '@/lib/serializers';
import {audit} from '@/lib/audit';
import {activePromos} from '@/lib/promos';
import {aging,creditOverflow} from '@/lib/field-ops';
import {notifySupplier,notifySupplierLowStock} from '@/lib/supplier-notifications';

function ref(){
  return 'SUP-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
}
function deliveryCode(){
  return String(Math.floor(100000+Math.random()*900000));
}

export async function GET(){
  try{
    const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION],'CONNECT');
    const rows=await prisma.supplierOrder.findMany({
      where:{shopId:s.shopId},
      include:{company:{select:{id:true,name:true,region:true,phone:true,logoUrl:true,verified:true}},
        items:{include:{product:{select:{id:true,name:true,sku:true,brand:true,category:true,imageUrl:true,qualityGrade:true}}}},
        delivery:LIGHT_DELIVERY},
      orderBy:{createdAt:'desc'},take:200
    });
    return ok(plain(await withProofFlags(rows)));
  }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
  try{
    const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION],'CONNECT');
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

    // 17.6 — plafond de crédit fixé par le fournisseur : on refuse une commande qui le dépasserait.
    const pre=await prisma.supplierProduct.findMany({where:{id:{in:ids}},select:{id:true,companyId:true,price:true,minOrderQty:true,company:{select:{name:true}}}});
    if(pre.length&&pre.every(p=>p.companyId===pre[0].companyId)){
      const cust=await prisma.supplierErpCustomer.findFirst({where:{companyId:pre[0].companyId,shopId:s.shopId,active:true},select:{id:true,creditLimit:true}});
      if(cust&&Number(cust.creditLimit)>0){
        const [sales,promosPre]=await Promise.all([prisma.supplierErpSale.findMany({where:{companyId:pre[0].companyId,customerId:cust.id,status:{not:'CANCELLED'}},select:{id:true,total:true,paid:true,createdAt:true,dueAt:true}}),activePromos(ids)]);
        const current=aging(sales.map(x=>({id:x.id,total:Number(x.total),paid:Number(x.paid),createdAt:x.createdAt,dueAt:x.dueAt}))).due;
        const est=pre.reduce((a,p)=>a+(promosPre.get(p.id)?.price??Number(p.price))*Math.max(p.minOrderQty,grouped.get(p.id)||0),0);
        const over=creditOverflow(Number(cust.creditLimit),current,est);
        if(over>0)return bad(`Plafond de crédit atteint chez ${pre[0].company.name} : solde actuel ${current.toFixed(3)} DT pour un plafond de ${Number(cust.creditLimit).toFixed(3)} DT. Réglez au moins ${over.toFixed(3)} DT ou réduisez la commande.`,409);
      }
    }
    const result=await prisma.$transaction(async tx=>{
      const products=await tx.supplierProduct.findMany({where:{id:{in:ids},active:true,company:{active:true}}});
      if(products.length!==ids.length)throw Object.assign(new Error('Produit indisponible'),{status:409});
      const companyId=products[0].companyId;
      if(products.some(p=>p.companyId!==companyId))throw Object.assign(new Error('Une commande doit contenir les produits d’un seul fournisseur'),{status:409});

      const promos=await activePromos(ids); // prix promo en cours, vérifié côté serveur
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

        const promo=promos.get(p.id),unit=promo&&promo.price<Number(p.price)?promo.price:Number(p.price);
        total+=unit*qty;
        rows.push({productId:p.id,quantity:qty,unitPrice:unit});
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
      const existingCustomer=await tx.supplierErpCustomer.findFirst({where:{companyId,shopId:shop.id}});
      if(existingCustomer){
        await tx.supplierErpCustomer.update({where:{id:existingCustomer.id},data:{name:shop.name,phone:shop.phone||null,email:shop.email||null,address:shop.address||null,region:shop.region||null,taxId:shop.taxId||null,active:true}});
      }else{
        await tx.supplierErpCustomer.create({data:{companyId,shopId:shop.id,name:shop.name,phone:shop.phone||null,email:shop.email||null,address:shop.address||null,region:shop.region||null,taxId:shop.taxId||null}});
      }
      let code=deliveryCode();
      while(await tx.supplierOrder.findFirst({where:{deliveryCode:code},select:{id:true}}))code=deliveryCode();
      const order=await tx.supplierOrder.create({
        data:{shopId:s.shopId,companyId,reference:ref(),deliveryCode:code,total,deliveryAddress:b.deliveryAddress||shop.address||null,note:b.note||null,items:{create:rows}},
        include:{company:{select:{id:true,name:true,region:true}},
          shop:{select:{name:true}},items:{include:{product:{select:{id:true,name:true,sku:true}}}}}
      });
      if(allocations.length)await tx.supplierOrderStockAllocation.createMany({data:allocations.map(x=>({...x,orderId:order.id}))});
      return order;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});

    await audit(s.shopId,s.id,'CREATE','SUPPLIER_ORDER',result.id,{reference:result.reference,total:Number(result.total)});
    await notifySupplier(result.companyId,'📦 Nouvelle commande à traiter',`${result.shop.name} · ${result.reference} · ${Number(result.total).toFixed(3)} DT. Ouvrez les commandes pour la préparer.`,{
      href:'/supplier?tab=orders',kind:'ORDER',priority:'HIGH',
      experienceKey:'SUPPLIER_NEW_ORDER',eventId:result.id,
      roles:['OWNER','ADMIN','MANAGER','SALES','STOCK'],
      metadata:{orderId:result.id,reference:result.reference,shopId:s.shopId}
    }).catch(err=>console.error('Notification nouvelle commande Supplier',err));
    await whatsappNewOrderAlert(result.companyId,{shopName:result.shop.name,reference:result.reference,total:Number(result.total)})
      .catch(err=>console.warn('Alerte WhatsApp nouvelle commande',String(err?.message||err)));
    await Promise.allSettled(result.items.map(i=>notifySupplierLowStock(result.companyId,i.productId)));
    return ok(plain(result),{status:201});
  }catch(e:any){
    if(e.code==='P2034')return bad('Stock modifié pendant la commande. Réessayez.',409);
    return bad(e.message,e.status||500);
  }
}

import {prisma} from '@/lib/prisma';
import {requireSupplierRole,requireSupplierSession} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';
import {requireSupplierCreationCapacity} from '@/lib/supplier-saas';
import {autoSku,fillGuesses,PRODUCT_EDITORS} from '@/lib/supplier-product-quick';
import {parseAmount} from '@/lib/product-quick';

async function resolveMaster(companyId:string,categoryId?:string|null,brandId?:string|null,unitId?:string|null){
 const [category,brand,unit]=await Promise.all([
  categoryId?prisma.supplierCategory.findFirst({where:{id:categoryId,companyId,active:true}}):null,
  brandId?prisma.supplierBrand.findFirst({where:{id:brandId,companyId,active:true}}):null,
  unitId?prisma.supplierUnit.findFirst({where:{id:unitId,companyId,active:true}}):null,
 ]);
 if(categoryId&&!category)throw Object.assign(new Error('Catégorie invalide'),{status:400});
 if(brandId&&!brand)throw Object.assign(new Error('Marque invalide'),{status:400});
 if(unitId&&!unit)throw Object.assign(new Error('Unité invalide'),{status:400});
 return {category,brand,unit};
}

export async function GET(){
 try{
  const s=await requireSupplierSession();
  return ok(plain(await prisma.supplierProduct.findMany({where:{companyId:s.companyId},orderBy:[{active:'desc'},{updatedAt:'desc'}]})));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(PRODUCT_EDITORS);
  const b=await req.json();
  // 17.4 : seuls le nom et le prix sont obligatoires ; SKU, catégorie, marque et qualité sont déduits.
  const price=parseAmount(b.price??b.retailPrice),stock=Math.trunc(Number(b.stock||0)),purchasePrice=Math.max(0,parseAmount(b.purchasePrice)||0);
  const name=String(b.name||'').trim();
  if(name.length<2)return bad('Nom du produit requis');
  if(!Number.isFinite(price))return bad('Prix de vente requis');
  if(!(stock>=0))return bad('Stock invalide');
  await requireSupplierCreationCapacity(s.companyId,'PRODUCT');
  const {category,brand}=await resolveMaster(s.companyId,b.categoryId||null,b.brandId||null,b.unitId||null);
  const guess=fillGuesses({name,category:category?.name||b.category,brand:brand?.name||b.brand,qualityGrade:b.qualityGrade});
  const sku=String(b.sku||'').trim().toUpperCase()||await autoSku(s.companyId,name,guess.category);
  // Catégorie déduite : on la relie à la catégorie du fournisseur portant le même nom, si elle existe.
  const linkedCat=!category&&guess.category?await prisma.supplierCategory.findFirst({where:{companyId:s.companyId,active:true,name:{equals:guess.category,mode:'insensitive'}},select:{id:true}}):null;
  const barcode=String(b.barcode||'').trim()||null;
  if(barcode&&await prisma.supplierProduct.findFirst({where:{companyId:s.companyId,barcode},select:{id:true}}))return bad('Ce code-barres existe déjà dans votre catalogue',409);
  const x=await prisma.supplierProduct.create({data:{
   companyId:s.companyId,
   sku,barcode,name,
   brand:guess.brand,category:guess.category,
   brandId:b.brandId||null,categoryId:b.categoryId||linkedCat?.id||null,unitId:b.unitId||null,
   description:b.description||null,imageUrl:b.imageUrl||null,qualityGrade:guess.qualityGrade,
   price,retailPrice:price,
   wholesalePrice:Number.isFinite(parseAmount(b.wholesalePrice))?parseAmount(b.wholesalePrice):null,
   minimumPrice:Number.isFinite(parseAmount(b.minimumPrice))?parseAmount(b.minimumPrice):null,
   purchasePrice,averageCost:purchasePrice,taxRate:Math.max(0,Number(b.taxRate||0)),
   stock,reservedStock:0,minStock:Math.max(0,Math.trunc(Number(b.minStock||0))),
   maxStock:Number.isFinite(Number(b.maxStock))?Math.max(0,Math.trunc(Number(b.maxStock))):null,
   location:String(b.location||'').trim()||null,minOrderQty:Math.max(1,Math.trunc(Number(b.minOrderQty||1))),
   warrantyDays:Math.max(0,Math.trunc(Number(b.warrantyDays||0))),serialTracked:!!b.serialTracked,active:b.active!==false
  }});
  await prisma.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'CREATE',entity:'PRODUCT',entityId:x.id,metadata:{sku:x.sku,name:x.name,stock:x.stock}}});
  return ok(plain(x),{status:201});
 }catch(e:any){if(e.code==='P2002')return bad('SKU ou code-barres déjà utilisé',409);return bad(e.message,e.status||500)}
}

export async function PATCH(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','STOCK']);
  const b=await req.json();const id=String(b.id||'');if(!id)return bad('Produit requis');
  const current=await prisma.supplierProduct.findFirst({where:{id,companyId:s.companyId}});if(!current)return bad('Produit introuvable',404);
  const {category,brand}=await resolveMaster(s.companyId,b.categoryId??current.categoryId,b.brandId??current.brandId,b.unitId??current.unitId);
  const data:any={};
  const strFields=['name','description','imageUrl','qualityGrade','barcode','location'];
  for(const k of strFields)if(b[k]!==undefined)data[k]=String(b[k]||'').trim()||null;
  if(b.sku!==undefined)data.sku=String(b.sku).trim().toUpperCase();
  if(b.categoryId!==undefined){data.categoryId=b.categoryId||null;data.category=category?.name||null}
  if(b.brandId!==undefined){data.brandId=b.brandId||null;data.brand=brand?.name||null}
  if(b.unitId!==undefined)data.unitId=b.unitId||null;
  for(const k of ['price','retailPrice','wholesalePrice','minimumPrice','purchasePrice','averageCost','taxRate'])if(b[k]!==undefined)data[k]=b[k]===null?null:Math.max(0,Number(b[k]||0));
  for(const k of ['minStock','maxStock','minOrderQty','warrantyDays'])if(b[k]!==undefined)data[k]=b[k]===null?null:Math.max(k==='minOrderQty'?1:0,Math.trunc(Number(b[k]||0)));
  if(b.serialTracked!==undefined)data.serialTracked=!!b.serialTracked;
  if(b.active!==undefined)data.active=!!b.active;
  const x=await prisma.supplierProduct.update({where:{id},data});
  await prisma.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'UPDATE',entity:'PRODUCT',entityId:id,metadata:data}});
  return ok(plain(x));
 }catch(e:any){if(e.code==='P2002')return bad('SKU ou code-barres déjà utilisé',409);return bad(e.message,e.status||500)}
}

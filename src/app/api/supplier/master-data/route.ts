import {prisma} from '@/lib/prisma';
import {requireSupplierRole,requireSupplierSession} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {plain} from '@/lib/serializers';

const slugify=(v:string)=>v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export async function GET(){
 try{
  const s=await requireSupplierSession();
  const defaults=[
   {code:'CASH',name:'Espèces',cashLike:true,sortOrder:1},
   {code:'CARD',name:'Carte bancaire',cashLike:false,sortOrder:2},
   {code:'TRANSFER',name:'Virement',cashLike:false,sortOrder:3},
   {code:'CHEQUE',name:'Chèque',cashLike:false,sortOrder:4},
   {code:'CREDIT',name:'Crédit client',cashLike:false,sortOrder:5},
  ];
  await prisma.supplierPaymentMethod.createMany({data:defaults.map(x=>({...x,companyId:s.companyId})),skipDuplicates:true});
  const [categories,brands,units,paymentMethods,company]=await Promise.all([
   prisma.supplierCategory.findMany({where:{companyId:s.companyId},orderBy:[{sortOrder:'asc'},{name:'asc'}]}),
   prisma.supplierBrand.findMany({where:{companyId:s.companyId},orderBy:{name:'asc'}}),
   prisma.supplierUnit.findMany({where:{companyId:s.companyId},orderBy:{name:'asc'}}),
   prisma.supplierPaymentMethod.findMany({where:{companyId:s.companyId},orderBy:[{sortOrder:'asc'},{name:'asc'}]}),
   prisma.supplierCompany.findUnique({where:{id:s.companyId},select:{id:true,name:true,logoUrl:true,phone:true,email:true,address:true,region:true,taxId:true,currency:true,defaultTaxRate:true,invoicePrefix:true,receiptPrefix:true,purchasePrefix:true,allowNegativeStock:true,verified:true}})
  ]);
  return ok(plain({categories,brands,units,paymentMethods,company}));
 }catch(e:any){return bad(e.message,e.status||500)}
}

export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','STOCK']);
  const b=await req.json();const action=String(b.action||'');
  if(action==='CATEGORY'){
   const name=String(b.name||'').trim();if(!name)return bad('Nom de catégorie requis');
   const slug=slugify(String(b.slug||name));if(!slug)return bad('Catégorie invalide');
   if(b.parentId){const p=await prisma.supplierCategory.findFirst({where:{id:String(b.parentId),companyId:s.companyId}});if(!p)return bad('Catégorie parente invalide',404)}
   const x=await prisma.supplierCategory.create({data:{companyId:s.companyId,name,slug,parentId:b.parentId||null,description:b.description||null,sortOrder:Math.trunc(Number(b.sortOrder||0))}});
   return ok(plain(x),{status:201});
  }
  if(action==='BRAND'){
   const name=String(b.name||'').trim();if(!name)return bad('Nom de marque requis');
   const x=await prisma.supplierBrand.create({data:{companyId:s.companyId,name,slug:slugify(name)}});
   return ok(plain(x),{status:201});
  }
  if(action==='UNIT'){
   const name=String(b.name||'').trim(),symbol=String(b.symbol||'').trim();if(!name||!symbol)return bad('Nom et symbole requis');
   const x=await prisma.supplierUnit.create({data:{companyId:s.companyId,name,symbol,precision:Math.max(0,Math.min(3,Math.trunc(Number(b.precision||0))))}});
   return ok(plain(x),{status:201});
  }
  if(action==='PAYMENT_METHOD'){
   const code=String(b.code||'').trim().toUpperCase(),name=String(b.name||'').trim();if(!code||!name)return bad('Code et nom requis');
   const x=await prisma.supplierPaymentMethod.create({data:{companyId:s.companyId,code,name,cashLike:!!b.cashLike,sortOrder:Math.trunc(Number(b.sortOrder||0))}});
   return ok(plain(x),{status:201});
  }
  if(action==='TOGGLE'){
   const entity=String(b.entity||''),id=String(b.id||''),active=!!b.active;if(!id)return bad('Identifiant requis');
   const map:any={CATEGORY:prisma.supplierCategory,BRAND:prisma.supplierBrand,UNIT:prisma.supplierUnit,PAYMENT_METHOD:prisma.supplierPaymentMethod};
   const model=map[entity];if(!model)return bad('Type invalide');
   const row=await model.findFirst({where:{id,companyId:s.companyId}});if(!row)return bad('Élément introuvable',404);
   return ok(plain(await model.update({where:{id},data:{active}})));
  }
  if(action==='COMPANY_SETTINGS'){
   const a=await requireSupplierRole(['OWNER','ADMIN']);
   const data:any={};
   for(const k of ['name','phone','email','address','region','taxId','currency','invoicePrefix','receiptPrefix','purchasePrefix'])if(b[k]!==undefined)data[k]=String(b[k]||'').trim()||null;
   if(b.defaultTaxRate!==undefined)data.defaultTaxRate=Math.max(0,Number(b.defaultTaxRate||0));
   if(b.allowNegativeStock!==undefined)data.allowNegativeStock=!!b.allowNegativeStock;
   const x=await prisma.supplierCompany.update({where:{id:a.companyId},data});
   return ok(plain(x));
  }
  return bad('Action référentiel inconnue');
 }catch(e:any){
  if(e.code==='P2002')return bad('Cet élément existe déjà',409);
  return bad(e.message,e.status||500)
 }
}

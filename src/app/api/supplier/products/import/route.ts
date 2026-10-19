import {prisma} from '@/lib/prisma';
import {requireSupplierRole} from '@/lib/supplier-auth';
import {bad,ok} from '@/lib/http';
import {requireSupplierCreationCapacity} from '@/lib/supplier-saas';

function parseLine(line:string,sep:string){
 const out:string[]=[];let cur='',q=false;
 for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===sep&&!q){out.push(cur.trim());cur=''}else cur+=ch}
 out.push(cur.trim());return out;
}
function key(x:string){return x.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function num(v:any,d=0){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:d}

export async function POST(req:Request){
 try{
  const s=await requireSupplierRole(['OWNER','ADMIN','MANAGER','STOCK']);
  const fd=await req.formData(),file=fd.get('file');if(!(file instanceof File))return bad('Fichier CSV requis');
  if(file.size>5*1024*1024)return bad('CSV trop volumineux (max 5 Mo)');
  const text=(await file.text()).replace(/^\uFEFF/,'').trim();if(!text)return bad('CSV vide');
  const lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)return bad('CSV sans données');
  const sep=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?';':',';
  const headers=parseLine(lines[0],sep).map(key);
  const aliases:Record<string,string[]>={
   sku:['sku','reference','ref','code'],barcode:['barcode','code_barre','ean'],name:['name','nom','produit','designation'],brand:['brand','marque'],category:['category','categorie'],
   purchasePrice:['purchase_price','prix_achat','cout','cost'],price:['price','prix','prix_vente','sale_price'],wholesalePrice:['wholesale_price','prix_grossiste'],stock:['stock','quantite','qty','quantity'],
   minStock:['min_stock','stock_min','seuil'],location:['location','emplacement'],imageUrl:['image_url','photo','image'],qualityGrade:['quality','qualite','grade'],warrantyDays:['warranty_days','garantie_jours']
  };
  const idx=(field:string)=>{const a=aliases[field]||[field];return headers.findIndex(h=>a.includes(h))};
  if(idx('sku')<0||idx('name')<0)return bad('Colonnes obligatoires : SKU/référence et nom');
  let created=0,updated=0,skipped=0;const errors:any[]=[];
  for(let n=1;n<lines.length;n++){
   const cols=parseLine(lines[n],sep),get=(f:string)=>{const i=idx(f);return i>=0?(cols[i]??'').trim():''};
   const sku=get('sku').toUpperCase(),name=get('name');if(!sku||!name){skipped++;errors.push({line:n+1,error:'SKU ou nom manquant'});continue}
   try{
    const existing=await prisma.supplierProduct.findFirst({where:{companyId:s.companyId,sku}});
    const data:any={name,barcode:get('barcode')||null,brand:get('brand')||null,category:get('category')||null,location:get('location')||null,imageUrl:get('imageUrl')||null,qualityGrade:get('qualityGrade')||null};
    if(get('price')!=='')data.price=Math.max(0,num(get('price')));
    if(get('purchasePrice')!=='')data.purchasePrice=Math.max(0,num(get('purchasePrice')));
    if(get('wholesalePrice')!=='')data.wholesalePrice=Math.max(0,num(get('wholesalePrice')));
    if(get('stock')!=='')data.stock=Math.max(0,Math.trunc(num(get('stock'))));
    if(get('minStock')!=='')data.minStock=Math.max(0,Math.trunc(num(get('minStock'))));
    if(get('warrantyDays')!=='')data.warrantyDays=Math.max(0,Math.trunc(num(get('warrantyDays'))));
    if(existing){await prisma.supplierProduct.update({where:{id:existing.id},data});updated++}
    else{
     await requireSupplierCreationCapacity(s.companyId,'PRODUCT');
     if(data.price===undefined)data.price=0;if(data.stock===undefined)data.stock=0;
     const pp=data.purchasePrice??0;
     await prisma.supplierProduct.create({data:{companyId:s.companyId,sku,...data,retailPrice:data.price,purchasePrice:pp,averageCost:pp,minOrderQty:1,active:true}});created++;
    }
   }catch(e:any){skipped++;errors.push({line:n+1,sku,error:e.message||'Erreur import'})}
  }
  await prisma.supplierAuditEvent.create({data:{companyId:s.companyId,accountId:s.id,action:'IMPORT_CSV',entity:'PRODUCT',metadata:{file:file.name,created,updated,skipped,rows:lines.length-1}}});
  return ok({created,updated,skipped,total:lines.length-1,errors:errors.slice(0,100)});
 }catch(e:any){return bad(e.message,e.status||500)}
}

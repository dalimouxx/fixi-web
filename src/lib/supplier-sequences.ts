import {prisma} from './prisma';

const defaultPrefixes:Record<string,string>={
 QUOTE:'DEV',PROFORMA:'PRO',DELIVERY_NOTE:'BL',PURCHASE_ORDER:'BC',RECEIPT:'REC',
 SALE:'FAC',PURCHASE:'ACH',CREDIT_NOTE:'AV'
};

export async function nextSupplierReference(companyId:string,key:string,prefix?:string){
 const seq=await prisma.supplierSequence.upsert({
  where:{companyId_key:{companyId,key}},
  update:{value:{increment:1}},
  create:{companyId,key,value:1}
 });
 const year=new Date().getFullYear();
 return `${prefix||defaultPrefixes[key]||key}-${year}-${String(seq.value).padStart(6,'0')}`;
}

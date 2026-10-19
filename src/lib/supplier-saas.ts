import { DurationUnit, SubscriptionStatus } from '@prisma/client';
import { prisma } from './prisma';

/** The legacy network is grandfathered in until an admin assigns a supplier offer. */
export type SupplierOfferState = 'LEGACY' | 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';
type OfferInput = { status: SubscriptionStatus; endsAt: Date | string | null } | null;

export function supplierOfferState(sub: OfferInput, now = new Date()): SupplierOfferState {
  if (!sub) return 'LEGACY';
  if (sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') return 'SUSPENDED';
  if (sub.endsAt && new Date(sub.endsAt).getTime() <= now.getTime()) return 'EXPIRED';
  return sub.status;
}

const defaults = [
  {code:'ESSENTIAL',name:'Supplier Essential',description:'Catalogue et livraison pour démarrer dans le réseau Fixi.',
    price:59, maxProducts:500,maxDrivers:1,maxStaff:2,maxOrdersPerMonth:200,
    features:{catalogue:true,orders:true,deliveries:true,debtLedger:true,reports:false,multiWarehouse:false}},
  {code:'PRO',name:'Supplier Pro',description:'Gestion commerciale, équipe et livreurs pour les fournisseurs en croissance.',
    price:149,maxProducts:3000,maxDrivers:5,maxStaff:10,maxOrdersPerMonth:2000,
    features:{catalogue:true,orders:true,deliveries:true,debtLedger:true,reports:true,multiWarehouse:true}},
  {code:'BUSINESS',name:'Supplier Business',description:'ERP fournisseur avancé, équipes et réseau multi-dépôts.',
    price:299,maxProducts:20000,maxDrivers:30,maxStaff:30,maxOrdersPerMonth:10000,
    features:{catalogue:true,orders:true,deliveries:true,debtLedger:true,reports:true,multiWarehouse:true,prioritySupport:true}},
] as const;

/** Run from authenticated platform-administrator requests only. Existing prices remain unchanged. */
export async function ensureSupplierSaasPlans() {
  return Promise.all(defaults.map(({code,name,description,price,maxProducts,maxDrivers,maxStaff,maxOrdersPerMonth,features}) =>
    prisma.supplierSaasPlan.upsert({
      where:{code},create:{code,name,description,price,durationUnit:DurationUnit.MONTH,durationValue:1,
        trialDays:14,maxProducts,maxDrivers,maxStaff,maxOrdersPerMonth,features},
      update:{},
    })));
}

export async function currentSupplierOffer(companyId: string) {
  return prisma.supplierSaasSubscription.findFirst({
    where:{companyId},orderBy:[{createdAt:'desc'},{id:'desc'}],include:{plan:true},
  });
}

export async function requireSupplierCreationCapacity(companyId: string, kind:'PRODUCT'|'DRIVER'|'STAFF') {
  const sub=await currentSupplierOffer(companyId);
  const state=supplierOfferState(sub);
  if (state==='LEGACY') return; // Do not cut off existing supplier accounts.
  if (state!=='ACTIVE' && state!=='TRIAL')
    throw Object.assign(new Error('Abonnement Supplier à renouveler pour créer de nouvelles ressources'),{status:403});
  const plan=sub!.plan;
  const cap=kind==='PRODUCT'?plan.maxProducts:kind==='DRIVER'?plan.maxDrivers:plan.maxStaff;
  if (cap < 0) return;
  const count=kind==='PRODUCT'
    ?await prisma.supplierProduct.count({where:{companyId}})
    :await prisma.supplierAccount.count({where:{companyId,role:kind==='DRIVER'?'DRIVER':{not:'DRIVER'}}});
  if (count>=cap)
    throw Object.assign(new Error(`Limite de l’offre ${plan.name} atteinte : ${cap} ${kind==='PRODUCT'?'produits':kind==='DRIVER'?'livreurs':'utilisateurs'}. Passez à une formule supérieure.`),{status:403});
}

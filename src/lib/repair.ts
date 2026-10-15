import { RepairStatus, UserRole } from '@prisma/client';
export const statusLabel:Record<RepairStatus,string>={RECEIVED:'Reçu',DIAGNOSIS:'Diagnostic',IN_REPAIR:'En réparation',WAITING_PART:'Attente pièce',READY:'Prêt',DELIVERED:'Livré',CANCELLED:'Annulé'};
export const allowedTransitions:Record<RepairStatus,RepairStatus[]>={
  RECEIVED:[RepairStatus.DIAGNOSIS,RepairStatus.CANCELLED],
  DIAGNOSIS:[RepairStatus.IN_REPAIR,RepairStatus.WAITING_PART,RepairStatus.READY,RepairStatus.CANCELLED],
  IN_REPAIR:[RepairStatus.WAITING_PART,RepairStatus.READY,RepairStatus.CANCELLED],
  WAITING_PART:[RepairStatus.IN_REPAIR,RepairStatus.READY,RepairStatus.CANCELLED],
  READY:[RepairStatus.DELIVERED,RepairStatus.IN_REPAIR],
  DELIVERED:[], CANCELLED:[]
};
export function canTransition(from:RepairStatus,to:RepairStatus,role:UserRole){
  if(role===UserRole.ADMIN)return true;
  if(!allowedTransitions[from].includes(to))return false;
  if(role===UserRole.CASHIER)return from===RepairStatus.READY&&to===RepairStatus.DELIVERED;
  if(role===UserRole.RECEPTION)return (
    (from===RepairStatus.RECEIVED&&(to===RepairStatus.DIAGNOSIS||to===RepairStatus.CANCELLED)) ||
    (from===RepairStatus.READY&&to===RepairStatus.DELIVERED)
  );
  if(role===UserRole.TECHNICIAN)return to!==RepairStatus.DELIVERED;
  return false;
}
export function anonymizeName(name:string){const parts=name.trim().split(/\s+/); return parts.map(p=>p.length<=2?p[0]+'*':p[0]+ '*'.repeat(Math.min(4,p.length-1))).join(' ')}

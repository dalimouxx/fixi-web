import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { AppointmentStatus,UserRole } from '@prisma/client';
import { plain } from '@/lib/serializers';

export async function GET(){
  try{
    const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION]);
    const rows=await prisma.appointment.findMany({where:{shopId:s.shopId},orderBy:{scheduledAt:'asc'},take:300});
    return ok(plain(rows));
  }catch(e:any){return bad(e.message,e.status||500)}
}
export async function PATCH(req:Request){
  try{
    const s=await requireSession([UserRole.ADMIN,UserRole.RECEPTION]);
    const b=await req.json();
    if(!Object.values(AppointmentStatus).includes(b.status))return bad('Statut invalide');
    const x=await prisma.appointment.findFirst({where:{id:b.id,shopId:s.shopId}});if(!x)return bad('Rendez-vous introuvable',404);
    const updated=await prisma.appointment.update({where:{id:x.id},data:{status:b.status,scheduledAt:b.scheduledAt?new Date(b.scheduledAt):x.scheduledAt,notes:b.notes??x.notes}});
    return ok(plain(updated));
  }catch(e:any){return bad(e.message,e.status||500)}
}

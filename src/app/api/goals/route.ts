import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { GoalType,UserRole } from '@prisma/client';
import { plain } from '@/lib/serializers';
export async function GET(){try{const s=await requireSession([UserRole.ADMIN]);const rows=await prisma.shopGoal.findMany({where:{shopId:s.shopId},orderBy:{createdAt:'desc'}});return ok(plain(rows));}catch(e:any){return bad(e.message,e.status||500)}}
export async function POST(req:Request){try{const s=await requireSession([UserRole.ADMIN]);const b=await req.json();if(!Object.values(GoalType).includes(b.type))return bad('Type invalide');const target=Number(b.target);if(!Number.isFinite(target)||target<=0)return bad('Objectif invalide');const start=b.startsAt?new Date(b.startsAt):new Date();const end=b.endsAt?new Date(b.endsAt):new Date(Date.now()+30*86400000);if(end<=start)return bad('Période invalide');const x=await prisma.shopGoal.create({data:{shopId:s.shopId,type:b.type,label:String(b.label||b.type),target,startsAt:start,endsAt:end,active:b.active!==false}});return ok(plain(x),{status:201});}catch(e:any){return bad(e.message,e.status||500)}}

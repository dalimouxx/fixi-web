import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { AutomationAction,AutomationTrigger,UserRole } from '@prisma/client';
import { plain } from '@/lib/serializers';
export async function GET(){
  try{const s=await requireSession([UserRole.ADMIN]);const rows=await prisma.automationRule.findMany({where:{shopId:s.shopId},include:{runs:{orderBy:{createdAt:'desc'},take:5}},orderBy:{createdAt:'asc'}});return ok(plain(rows));}
  catch(e:any){return bad(e.message,e.status||500)}
}
export async function POST(req:Request){
  try{const s=await requireSession([UserRole.ADMIN]);const b=await req.json();if(!Object.values(AutomationTrigger).includes(b.trigger))return bad('Déclencheur invalide');if(!Object.values(AutomationAction).includes(b.action))return bad('Action invalide');const x=await prisma.automationRule.create({data:{shopId:s.shopId,name:String(b.name||'Automation Fixi'),trigger:b.trigger,action:b.action,enabled:b.enabled!==false,delayMinutes:Math.max(0,Number(b.delayMinutes||0)),conditions:b.conditions||undefined,actionConfig:b.actionConfig||undefined}});return ok(plain(x),{status:201});}
  catch(e:any){return bad(e.message,e.status||500)}
}

import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { parseReceptionWithClaude } from '@/lib/external-ai';
import { UserRole } from '@prisma/client';

export async function POST(req:Request){
  try{
    await requireSession([UserRole.ADMIN,UserRole.RECEPTION,UserRole.CASHIER]);
    const b=await req.json();
    const transcript=String(b.transcript||'').trim();
    if(!transcript)return bad('Texte de dictée requis');
    if(transcript.length>1200)return bad('Dictée trop longue');
    const brands=await prisma.deviceBrand.findMany({where:{active:true},include:{models:{where:{active:true},select:{name:true,aliases:true}}},orderBy:{sortOrder:'asc'},take:80});
    const catalog=brands.flatMap(x=>x.models.map(m=>({brand:x.name,model:m.name,aliases:m.aliases})));
    const parsed=await parseReceptionWithClaude(transcript,catalog);
    return ok({mode:parsed?'claude':'local',parsed});
  }catch(e:any){return bad(e.message,e.status||500)}
}

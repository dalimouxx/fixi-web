import { requireSession } from '@/lib/auth';
import { bad,ok } from '@/lib/http';
import { testClaudeConnection } from '@/lib/external-ai';
import { UserRole } from '@prisma/client';

export async function POST(){
  try{
    await requireSession([UserRole.ADMIN]);
    return ok(await testClaudeConnection());
  }catch(e:any){
    return bad(e.message,e.status||500);
  }
}

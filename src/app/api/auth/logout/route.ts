import { destroySession,getSession } from '@/lib/auth'; import { audit } from '@/lib/audit'; import { ok } from '@/lib/http';
export async function POST(){const s=await getSession();if(s)await audit(s.shopId,s.id,'LOGOUT','USER',s.id);await destroySession();return ok({ok:true})}

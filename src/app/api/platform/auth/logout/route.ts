import { destroyPlatformSession } from '@/lib/platform-auth';import { ok } from '@/lib/http';export async function POST(){await destroyPlatformSession();return ok({ok:true})}

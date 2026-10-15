import { ok } from '@/lib/http';export async function GET(){return ok({publicKey:process.env.VAPID_PUBLIC_KEY||null})}

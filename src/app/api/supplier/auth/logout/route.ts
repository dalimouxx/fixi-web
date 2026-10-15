import { destroySupplierSession } from '@/lib/supplier-auth';import { ok } from '@/lib/http';export async function POST(){await destroySupplierSession();return ok({ok:true})}

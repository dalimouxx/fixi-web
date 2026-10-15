import { prisma } from '@/lib/prisma';import { ok } from '@/lib/http';import { plain } from '@/lib/serializers';
export async function GET(){const rows=await prisma.plan.findMany({where:{active:true,publicVisible:true},orderBy:[{price:'asc'},{name:'asc'}]});return ok(plain(rows))}

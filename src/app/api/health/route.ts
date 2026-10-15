import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: 'ok', version: '10.1.1' });
  } catch {
    return NextResponse.json({ ok: false, database: 'unavailable', version: '10.1.1' }, { status: 503 });
  }
}

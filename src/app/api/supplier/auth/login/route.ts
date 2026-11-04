import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { bad, ok } from '@/lib/http';
import { createSupplierSession } from '@/lib/supplier-auth';
import { loginGuard, TOO_MANY } from '@/lib/login-guard';
import { verifyTotp } from '@/lib/totp';
import { checkTrust, issueTrust, TOTP_REQUIRED, TRUST_DAYS } from '@/lib/two-factor';

const TRUST_COOKIE = 'fixi_trust_supplier';

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const login = String(b.login || '').trim().toLowerCase();
    const guard = loginGuard('supplier', req, login);
    if (await guard.blocked()) return bad(TOO_MANY, 429);
    const a = login ? await prisma.supplierAccount.findUnique({ where: { login }, include: { company: true } }) : null;
    if (!a || !a.isActive || !a.company.active || a.role === 'DRIVER' || !await bcrypt.compare(String(b.password || ''), a.passwordHash)) { await guard.fail(); return bad('Identifiants invalides', 401); }
    let trustToken: string | undefined;
    if (a.totpEnabled) {
      const jar = await cookies();
      const trusted = await checkTrust(b.trust || jar.get(TRUST_COOKIE)?.value, 'supplier', a.id, a.sessionVersion);
      if (!trusted) {
        if (!b.totp) return Response.json({ error: TOTP_REQUIRED, needsTotp: true }, { status: 401 });
        if (!verifyTotp(a.totpSecret, b.totp)) { await guard.fail(); return Response.json({ error: 'Code de vérification incorrect', needsTotp: true }, { status: 401 }); }
        trustToken = await issueTrust('supplier', a.id, a.sessionVersion);
        jar.set(TRUST_COOKIE, trustToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TRUST_DAYS * 86400 });
      }
    }
    await guard.success();
    await createSupplierSession({ id: a.id, companyId: a.companyId, fullName: a.fullName, companyName: a.company.name, role: (a.role || 'ADMIN') as any, sv: a.sessionVersion });
    return ok({ ok: true, ...(trustToken ? { trustToken } : {}) });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

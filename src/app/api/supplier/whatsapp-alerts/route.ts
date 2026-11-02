import { prisma } from '@/lib/prisma';
import { requireSupplierRole, requireSupplierSession } from '@/lib/supplier-auth';
import { bad, ok } from '@/lib/http';
import { platformWhatsAppReady, sendNewOrderTemplate, validAlertPhone } from '@/lib/platform-whatsapp';

const MANAGERS = ['OWNER', 'ADMIN', 'MANAGER'] as const;

export async function GET() {
  try {
    const s = await requireSupplierSession();
    const c = await prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { whatsappAlertsEnabled: true, whatsappAlertPhone: true, phone: true } });
    return ok({
      enabled: !!c?.whatsappAlertsEnabled,
      phone: c?.whatsappAlertPhone || c?.phone || '',
      platformReady: platformWhatsAppReady(),
      canEdit: (MANAGERS as readonly string[]).includes(String(s.role || 'ADMIN')),
    });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

export async function PUT(req: Request) {
  try {
    const s = await requireSupplierRole(MANAGERS);
    const b = await req.json().catch(() => ({}));
    const enabled = b.enabled === true;
    const phone = String(b.phone || '').trim();
    if (enabled && !validAlertPhone(phone)) return bad('Numéro WhatsApp invalide. Exemple : 21 555 497', 400);
    await prisma.supplierCompany.update({ where: { id: s.companyId }, data: { whatsappAlertsEnabled: enabled, whatsappAlertPhone: phone || null } });
    return ok({ enabled, phone });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

/** Envoie un message d'essai au numéro enregistré. */
export async function POST() {
  try {
    const s = await requireSupplierRole(MANAGERS);
    const c = await prisma.supplierCompany.findUnique({ where: { id: s.companyId }, select: { whatsappAlertPhone: true, phone: true, currency: true } });
    const to = validAlertPhone(c?.whatsappAlertPhone || c?.phone);
    if (!to) return bad('Enregistrez d’abord un numéro WhatsApp.', 400);
    await sendNewOrderTemplate(to, { shop: 'Boutique test', reference: 'CMD-TEST', total: `0.000 ${c?.currency || 'DT'}` });
    return ok({ sent: true });
  } catch (e: any) { return bad(e.message, e.status || 500); }
}

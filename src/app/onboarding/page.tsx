import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { OnboardingWizard } from '@/components/onboarding-wizard';
import { prisma } from '@/lib/prisma';

export default async function OnboardingPage() {
  let s!: Awaited<ReturnType<typeof requireSession>>;
  try { s = await requireSession([UserRole.ADMIN]); } catch { redirect('/login'); }
  const shop = await prisma.shop.findUnique({ where: { id: s.shopId } });
  if (shop?.setupCompletedAt) redirect('/app/dashboard');
  return <OnboardingWizard initial={{
    name: shop?.name || 'Mon Atelier', phone: shop?.phone || '', address: shop?.address || '',
    email: shop?.email || '', currency: shop?.currency || 'DT', countryCode: shop?.countryCode || '216',
    defaultTaxRate: Number(shop?.defaultTaxRate || 0), cashRequireSession: shop?.cashRequireSession ?? true,
    lowStockNotifications: shop?.lowStockNotifications ?? true,
  }}/>;
}

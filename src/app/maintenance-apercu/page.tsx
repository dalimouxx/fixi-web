import type { Metadata } from 'next';
import { MaintenancePreview } from '@/components/maintenance-preview';

export const metadata: Metadata = { title: 'Aperçu maintenance · Fixi', robots: { index: false } };
export default function Page() { return <MaintenancePreview />; }

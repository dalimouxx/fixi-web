import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Conditions d’utilisation · Fixi' };
export default function Conditions() { return <LegalPage slug="conditions" />; }

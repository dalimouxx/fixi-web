import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Politique de confidentialité · Fixi' };
export default function Confidentialite() { return <LegalPage slug="confidentialite" />; }

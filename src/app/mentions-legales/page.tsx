import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mentions légales · Fixi' };
export default function Mentions() { return <LegalPage slug="mentions-legales" />; }

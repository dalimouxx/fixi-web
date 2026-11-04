import type { Metadata } from 'next';
import { HelpCenter } from '@/components/help-center';
import './aide.css';

export const metadata: Metadata = { title: 'Aide · Fixi', description: 'Guides pas à pas pour les ateliers, fournisseurs et livreurs Fixi, et questions fréquentes.' };
export default function Aide() { return <HelpCenter />; }

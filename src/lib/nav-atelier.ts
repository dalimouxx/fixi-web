import type { LucideIcon } from 'lucide-react';
import {
  Home, Wrench, Users, CreditCard, Boxes, MoreHorizontal, PlusCircle, ListChecks, CalendarDays, ShieldCheck,
  Smartphone, HeartHandshake, Megaphone, ReceiptText, Wallet, History, Banknote, PackageOpen, HandCoins, Link2,
  ShoppingBag, ArrowLeftRight, Store, UserCog, BarChart3, Lightbulb, Activity, BellRing, Building2, MessageCircle,
  PhoneCall, GraduationCap, CloudOff, Gift, Sparkles, LifeBuoy, ScrollText, Settings, Eye, Moon,
} from 'lucide-react';

// Rôles Atelier (identiques à l'enum Prisma UserRole)
export type AtelierRole = 'ADMIN' | 'RECEPTION' | 'TECHNICIAN' | 'CASHIER';
const ALL: AtelierRole[] = ['ADMIN', 'RECEPTION', 'TECHNICIAN', 'CASHIER'];

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: AtelierRole[];
  /** Masqué du menu en Mode Simple (reste accessible par la recherche). */
  advanced?: boolean;
  /** Libellé spécifique pour un rôle (ex. « Mes réparations » pour le technicien). */
  roleLabel?: Partial<Record<AtelierRole, string>>;
};
export type NavSectionId = 'home' | 'repairs' | 'clients' | 'cash' | 'parts' | 'more' | 'help';
export type NavSection = { id: NavSectionId; label: string; icon: LucideIcon; items: NavItem[] };

// Sept entrées au lieu de 38. Chaque ancien écran a une place unique.
export const atelierNav: NavSection[] = [
  { id: 'home', label: 'Accueil', icon: Home, items: [
    { label: 'Accueil', href: '/app/dashboard', icon: Home, roles: ALL },
    { label: 'Résumé du jour', href: '/app/resume', icon: BarChart3, roles: ['ADMIN'] },
    { label: 'Fin de journée', href: '/app/fin-de-journee', icon: Moon, roles: ['ADMIN', 'CASHIER'] },
    { label: 'Vue propriétaire', href: '/app/owner', icon: Eye, roles: ['ADMIN'], advanced: true },
  ] },
  { id: 'repairs', label: 'Réparations', icon: Wrench, items: [
    { label: 'Nouvelle réparation', href: '/app/repairs/new', icon: PlusCircle, roles: ['ADMIN', 'RECEPTION', 'CASHIER'] },
    { label: 'Toutes les réparations', href: '/app/repairs', icon: ListChecks, roles: ALL, roleLabel: { TECHNICIAN: 'Mes réparations' } },
    { label: 'Rendez-vous', href: '/app/appointments', icon: CalendarDays, roles: ['ADMIN', 'RECEPTION'] },
    { label: 'Garanties & retours', href: '/app/warranties', icon: ShieldCheck, roles: ['ADMIN', 'RECEPTION', 'TECHNICIAN'] },
    { label: 'Réceptions hors ligne', href: '/app/offline', icon: CloudOff, roles: ['ADMIN', 'RECEPTION', 'CASHIER'], advanced: true },
    { label: 'Catalogue appareils', href: '/app/device-catalog', icon: Smartphone, roles: ['ADMIN', 'RECEPTION'], advanced: true },
  ] },
  { id: 'clients', label: 'Clients', icon: Users, items: [
    { label: 'Clients', href: '/app/clients', icon: Users, roles: ['ADMIN', 'RECEPTION', 'CASHIER'] },
    { label: "Contrats d'entretien", href: '/app/care', icon: HeartHandshake, roles: ['ADMIN', 'RECEPTION', 'CASHIER'], advanced: true },
    { label: 'Messages clients', href: '/app/marketing', icon: Megaphone, roles: ['ADMIN'], advanced: true },
  ] },
  { id: 'cash', label: 'Caisse', icon: CreditCard, items: [
    { label: 'Encaisser', href: '/app/cashier', icon: Banknote, roles: ['ADMIN', 'CASHIER'] },
    { label: 'Devis & factures', href: '/app/documents', icon: ReceiptText, roles: ['ADMIN', 'RECEPTION', 'CASHIER'] },
    { label: 'Paiements reçus', href: '/app/payments', icon: Wallet, roles: ['ADMIN', 'CASHIER'] },
    { label: 'Ouverture & clôture', href: '/app/cash-sessions', icon: History, roles: ['ADMIN', 'CASHIER'] },
    { label: 'Dépenses', href: '/app/expenses', icon: HandCoins, roles: ['ADMIN'] },
    { label: 'Téléphones d’occasion', href: '/app/occasion', icon: Smartphone, roles: ['ADMIN', 'RECEPTION', 'CASHIER'] },
  ] },
  { id: 'parts', label: 'Pièces', icon: Boxes, items: [
    { label: 'Mon stock', href: '/app/stock', icon: Boxes, roles: ['ADMIN', 'TECHNICIAN'] },
    { label: 'Commander une pièce', href: '/app/suppliers', icon: PackageOpen, roles: ['ADMIN', 'RECEPTION'] },
    { label: 'Mes dettes fournisseurs', href: '/app/mes-dettes', icon: HandCoins, roles: ['ADMIN', 'RECEPTION', 'CASHIER'] },
    { label: 'Pièce compatible ?', href: '/app/compatibility', icon: Link2, roles: ['ADMIN', 'RECEPTION', 'TECHNICIAN'] },
    { label: 'Achats hors Fixi', href: '/app/purchases', icon: ShoppingBag, roles: ['ADMIN', 'RECEPTION'], advanced: true },
    { label: 'Entrées & sorties de stock', href: '/app/stock-movements', icon: ArrowLeftRight, roles: ['ADMIN', 'TECHNICIAN'], advanced: true },
    { label: 'Marché entre réparateurs', href: '/app/parts-market', icon: Store, roles: ALL, advanced: true },
  ] },
  { id: 'more', label: 'Gestion', icon: Settings, items: [
    { label: 'Rapports', href: '/app/reports', icon: BarChart3, roles: ['ADMIN'] },
    { label: 'Rapport du mois', href: '/app/rapport-mensuel', icon: ScrollText, roles: ['ADMIN'] },
    { label: 'Équipe', href: '/app/team', icon: UserCog, roles: ['ADMIN'] },
    { label: 'Commissions', href: '/app/team/commissions', icon: HandCoins, roles: ['ADMIN'], advanced: true },
    { label: 'Analyses', href: '/app/insights', icon: Activity, roles: ['ADMIN'], advanced: true },
    { label: 'Conseils', href: '/app/brain', icon: Lightbulb, roles: ['ADMIN'], advanced: true },
    { label: 'Rappels automatiques', href: '/app/automations', icon: BellRing, roles: ['ADMIN'], advanced: true },
    { label: 'Plusieurs boutiques', href: '/app/network', icon: Building2, roles: ['ADMIN'], advanced: true },
    { label: "Journal d'activité", href: '/app/audit', icon: ScrollText, roles: ['ADMIN'], advanced: true },
    { label: 'Paramètres', href: '/app/settings', icon: Settings, roles: ['ADMIN'] },
    { label: 'Abonnement', href: '/app/subscription', icon: ReceiptText, roles: ['ADMIN'] },
    { label: 'Parrainage', href: '/app/referrals', icon: Gift, roles: ['ADMIN'], advanced: true },
  ] },
  { id: 'help', label: 'Aide', icon: LifeBuoy, items: [
    { label: 'Aide & support', href: '/app/support', icon: LifeBuoy, roles: ALL },
    { label: 'Nouveautés', href: '/app/updates', icon: Sparkles, roles: ALL },
    { label: 'Formation', href: '/app/academy', icon: GraduationCap, roles: ALL, advanced: true },
    { label: 'Communauté', href: '/app/community', icon: MessageCircle, roles: ALL, advanced: true },
    { label: 'Demander à un expert', href: '/app/expert-call', icon: PhoneCall, roles: ALL, advanced: true },
  ] },
];

export function itemLabel(item: NavItem, role: string) {
  return item.roleLabel?.[role as AtelierRole] ?? item.label;
}

/** Entrées autorisées pour un rôle. `includeAdvanced` = Mode Avancé ou recherche. */
export function visibleNav(role: string, opts: { includeAdvanced: boolean; allow?: (href: string) => boolean }) {
  return atelierNav
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.roles.includes(role as AtelierRole)
        && (opts.includeAdvanced || !item.advanced)
        && (!opts.allow || opts.allow(item.href))),
    }))
    .filter(section => section.items.length > 0);
}

/** Entrée la plus spécifique correspondant à l'URL courante. */
export function matchNav(pathname: string, sections: NavSection[]) {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of sections) for (const item of section.items) {
    if (pathname === item.href || pathname.startsWith(item.href + '/')) {
      if (!best || item.href.length > best.item.href.length) best = { section, item };
    }
  }
  return best;
}

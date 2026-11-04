/** 17.5 — règles pures : premiers pas, essai Pro, indicateurs business. Testables sans base. */

export const DEFAULT_TRIAL_DAYS = 14;

type PlanLite = { id: string; code: string; name: string; active: boolean; publicVisible: boolean; trialDays: number; price: number | string; durationValue: number; durationUnit: string };

/** Prix ramené au mois (pour comparer et pour le revenu mensuel). */
export function monthlyPrice(price: number | string, value: number, unit: string) {
  const p = Number(price) || 0, v = Math.max(1, Number(value) || 1);
  const months = unit === 'YEAR' ? 12 * v : unit === 'MONTH' ? v : unit === 'WEEK' ? v / 4.345 : unit === 'DAY' ? v / 30.44 : v;
  return Math.round((p / months) * 1000) / 1000;
}

/**
 * Offre utilisée pour l'essai : celle où l'admin a mis des jours d'essai (la plus longue durée d'essai,
 * puis la moins chère) ; sinon la moins chère des offres payantes visibles, avec 14 jours.
 */
export function pickTrialPlan(plans: PlanLite[]): { plan: PlanLite; days: number } | null {
  const paid = plans.filter(p => p.active && p.publicVisible && p.code.toUpperCase() !== 'CONNECT');
  if (!paid.length) return null;
  const cheap = (a: PlanLite, b: PlanLite) => monthlyPrice(a.price, a.durationValue, a.durationUnit) - monthlyPrice(b.price, b.durationValue, b.durationUnit);
  const withTrial = paid.filter(p => p.trialDays > 0).sort((a, b) => b.trialDays - a.trialDays || cheap(a, b));
  if (withTrial.length) return { plan: withTrial[0], days: Math.min(withTrial[0].trialDays, 60) };
  return { plan: [...paid].sort(cheap)[0], days: DEFAULT_TRIAL_DAYS };
}

/** Un atelier n'a droit qu'à un seul essai : jamais d'abonnement payant ni d'essai auparavant. */
export function trialEligible(history: { status: string; plan: { code: string } | null }[]) {
  return !history.some(s => s.plan && s.plan.code.toUpperCase() !== 'CONNECT');
}

export type StartFacts = { hasAddress: boolean; ordered: boolean; delivered: boolean; invited: boolean; pro: boolean };
export type StartStep = { key: 'account' | 'address' | 'order' | 'invite' | 'delivery' | 'pro'; done: boolean };

/** Liste « Premiers pas » d'un atelier, dans l'ordre où on veut qu'il les fasse. */
export function startSteps(f: StartFacts): StartStep[] {
  return [
    { key: 'account', done: true },
    { key: 'address', done: f.hasAddress },
    { key: 'order', done: f.ordered },
    { key: 'invite', done: f.invited },
    { key: 'delivery', done: f.delivered },
    { key: 'pro', done: f.pro },
  ];
}

export function progress(steps: StartStep[]) {
  const done = steps.filter(s => s.done).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
}

/** Jour local (UTC+1, Tunisie) au format AAAA-MM-JJ. */
export function tnDay(d: Date | string) {
  return new Date(new Date(d).getTime() + 3600_000).toISOString().slice(0, 10);
}

/** Série continue de N jours (même les jours à zéro) se terminant aujourd'hui. */
export function dailySeries(dates: (Date | string)[], days: number, now = new Date()) {
  const counts = new Map<string, number>();
  for (const d of dates) counts.set(tnDay(d), (counts.get(tnDay(d)) || 0) + 1);
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) { const day = tnDay(new Date(now.getTime() - i * 86400_000)); out.push({ day, count: counts.get(day) || 0 }); }
  return out;
}

/** Message WhatsApp de relance / bienvenue envoyé à la main par l'admin. */
export function relanceText(kind: 'welcome' | 'inactive' | 'trial', shop: string, app = 'Fixi') {
  if (kind === 'welcome') return `Bonjour ${shop}, bienvenue sur ${app} ! Votre compte est prêt. Je peux vous aider à passer votre première commande fournisseur en 2 minutes. Une question ? Répondez à ce message.`;
  if (kind === 'trial') return `Bonjour ${shop}, votre essai ${app} Pro se termine bientôt. Voulez-vous que je vous aide à choisir une offre pour garder les réparations, le stock et la caisse ?`;
  return `Bonjour ${shop}, on ne vous a pas vu sur ${app} depuis quelques jours. Tout va bien ? Je peux vous montrer comment commander vos pièces plus vite.`;
}

/** Pièces habituelles : commandées dans au moins 2 commandes différentes ; quantité = médiane arrondie. */
export function usualParts(items: { productId: string; quantity: number; orderId: string; at: Date | string }[], limit = 12) {
  const by = new Map<string, { orders: Set<string>; qtys: number[]; last: number }>();
  for (const i of items) {
    const x = by.get(i.productId) || { orders: new Set<string>(), qtys: [], last: 0 };
    x.orders.add(i.orderId); x.qtys.push(i.quantity); x.last = Math.max(x.last, new Date(i.at).getTime());
    by.set(i.productId, x);
  }
  return [...by.entries()].filter(([, x]) => x.orders.size >= 2).map(([productId, x]) => {
    const q = [...x.qtys].sort((a, b) => a - b), mid = Math.floor(q.length / 2);
    const median = q.length % 2 ? q[mid] : (q[mid - 1] + q[mid]) / 2;
    return { productId, times: x.orders.size, qty: Math.max(1, Math.round(median)), lastAt: new Date(x.last) };
  }).sort((a, b) => b.times - a.times || +b.lastAt - +a.lastAt).slice(0, limit);
}

/** Matricule fiscal tunisien : 7 chiffres + clé / code TVA / catégorie / n° d'établissement (ex. 1234567A/A/M/000). */
export function normalizeMatricule(raw: string | null | undefined) {
  const s = String(raw || '').toUpperCase().replace(/[\s.\-]/g, '').replace(/\//g, '');
  const m = /^(\d{7})([A-Z])([A-Z])([A-Z])(\d{3})$/.exec(s);
  return m ? `${m[1]}${m[2]}/${m[3]}/${m[4]}/${m[5]}` : null;
}

export type EinvoiceFacts = { taxId?: string | null; legalName?: string | null; address?: string | null; b2bCustomers: number; b2bMissingTaxId: number; products: number; productsWithVat: number; sales90: number };
export type EinvoiceCheck = { key: string; label: string; ok: boolean; detail: string };

/** Ce que Fixi peut vérifier dans les données avant la facture électronique (El Fatoora / TEIF). */
export function einvoiceChecks(f: EinvoiceFacts): EinvoiceCheck[] {
  const mf = normalizeMatricule(f.taxId);
  return [
    { key: 'taxId', label: 'Matricule fiscal de la société', ok: !!mf, detail: mf ? mf : f.taxId ? 'Format non reconnu (attendu : 1234567A/A/M/000)' : 'À renseigner dans Paramètres' },
    { key: 'legal', label: 'Raison sociale et adresse', ok: !!(f.legalName && f.address), detail: f.legalName && f.address ? f.legalName : 'Raison sociale ou adresse manquante' },
    { key: 'customers', label: 'Matricule fiscal des clients professionnels', ok: f.b2bMissingTaxId === 0, detail: f.b2bCustomers ? (f.b2bMissingTaxId ? `${f.b2bMissingTaxId} client(s) sur ${f.b2bCustomers} sans matricule` : `${f.b2bCustomers} client(s) complets`) : 'Aucun client facturé sur 90 jours' },
    { key: 'vat', label: 'Taux de TVA sur les produits', ok: f.products > 0 && f.productsWithVat === f.products, detail: f.products ? `${f.productsWithVat} produit(s) sur ${f.products} avec un taux de TVA` : 'Aucun produit' },
  ];
}

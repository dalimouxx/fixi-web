// Contenu du widget Android selon l'espace : 3 cases (libellé + nombre) et une ligne de bas.
export type WidgetCell = { label: string; value: number; tone: 'ok' | 'neutral' | 'warn' };
export type WidgetData = { kind: string; title: string; cells: WidgetCell[]; foot: string; openPath: string; firstCellPath: string; updatedAt: string };

type Lang = 'fr' | 'ar';
const T = {
  fr: { ready: 'Prêts', repair: 'En cours', waiting: 'Attente pièce', remind: (n: number) => `${n} client${n > 1 ? 's' : ''} à relancer`, today: (v: string) => `${v} aujourd’hui`,
    confirm: 'À confirmer', prepare: 'À préparer', readyOrders: 'Prêtes', road: (n: number) => `${n} en livraison`, deliveredToday: (n: number) => `${n} livrée${n > 1 ? 's' : ''} aujourd’hui`,
    mine: 'Mes missions', free: 'Disponibles', done: 'Livrées', cash: (v: string) => `${v} encaissés aujourd’hui`, nothing: 'Rien d’urgent' },
  ar: { ready: 'جاهزة', repair: 'قيد الإصلاح', waiting: 'بانتظار قطعة', remind: (n: number) => `${n} حريف للتذكير`, today: (v: string) => `${v} اليوم`,
    confirm: 'للتأكيد', prepare: 'للتحضير', readyOrders: 'جاهزة', road: (n: number) => `${n} قيد التوصيل`, deliveredToday: (n: number) => `${n} مسلّمة اليوم`,
    mine: 'مهامي', free: 'متاحة', done: 'مسلّمة', cash: (v: string) => `${v} مقبوضة اليوم`, nothing: 'لا شيء عاجل' },
};
const dt = (n: number) => `${Math.round(n * 1000) / 1000} DT`;
const join = (parts: (string | false | null | undefined)[], lang: Lang) => parts.filter(Boolean).join(' · ') || T[lang].nothing;

export function atelierWidget(x: { shop: string; ready: number; inRepair: number; waitingPart: number; toRemind: number; revenueToday: number | null }, lang: Lang = 'fr'): WidgetData {
  const t = T[lang];
  return { kind: 'ATELIER', title: x.shop, openPath: '/app/dashboard', firstCellPath: '/app/cashier', updatedAt: new Date().toISOString(),
    cells: [{ label: t.ready, value: x.ready, tone: 'ok' }, { label: t.repair, value: x.inRepair, tone: 'neutral' }, { label: t.waiting, value: x.waitingPart, tone: 'warn' }],
    foot: join([x.toRemind > 0 && t.remind(x.toRemind), x.revenueToday != null && x.revenueToday !== 0 && t.today(dt(x.revenueToday))], lang) };
}

export function supplierWidget(x: { company: string; pending: number; preparing: number; ready: number; onRoad: number; deliveredToday: number }, lang: Lang = 'fr'): WidgetData {
  const t = T[lang];
  return { kind: 'SUPPLIER', title: x.company, openPath: '/supplier', firstCellPath: '/supplier?tab=orders', updatedAt: new Date().toISOString(),
    cells: [{ label: t.confirm, value: x.pending, tone: 'warn' }, { label: t.prepare, value: x.preparing, tone: 'neutral' }, { label: t.readyOrders, value: x.ready, tone: 'ok' }],
    foot: join([x.onRoad > 0 && t.road(x.onRoad), x.deliveredToday > 0 && t.deliveredToday(x.deliveredToday)], lang) };
}

export function driverWidget(x: { company: string; mine: number; available: number; deliveredToday: number; cashToday: number }, lang: Lang = 'fr'): WidgetData {
  const t = T[lang];
  return { kind: 'DRIVER', title: x.company, openPath: '/delivery', firstCellPath: '/delivery', updatedAt: new Date().toISOString(),
    cells: [{ label: t.mine, value: x.mine, tone: 'warn' }, { label: t.free, value: x.available, tone: 'neutral' }, { label: t.done, value: x.deliveredToday, tone: 'ok' }],
    foot: join([x.cashToday > 0 && t.cash(dt(x.cashToday))], lang) };
}

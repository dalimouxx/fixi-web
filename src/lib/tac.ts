import { prisma } from './prisma';
import { cleanImei, isImei } from './imei';

/** TAC = 8 premiers chiffres de l'IMEI : identifie le fabricant et le modèle. */
export function tacOf(imei: string) { const d = cleanImei(imei); return isImei(d) ? d.slice(0, 8) : null; }

/**
 * Apprentissage réseau : chaque réparation ou achat avec IMEI + modèle renforce la correspondance.
 * En cas de désaccord, le modèle le plus souvent saisi l'emporte (vote simple).
 */
export async function learnTac(imei: string | null | undefined, brand: string | null | undefined, model: string | null | undefined) {
  const tac = tacOf(String(imei || '')); const m = String(model || '').trim().slice(0, 80); const b = String(brand || '').trim().slice(0, 40);
  if (!tac || m.length < 2) return;
  try {
    const cur = await prisma.tacModel.findUnique({ where: { tac } });
    if (!cur) { await prisma.tacModel.create({ data: { tac, brand: b || 'Autre', model: m } }); return; }
    if (cur.model.toLowerCase() === m.toLowerCase()) await prisma.tacModel.update({ where: { tac }, data: { count: { increment: 1 } } });
    else if (cur.count <= 1) await prisma.tacModel.update({ where: { tac }, data: { brand: b || cur.brand, model: m, count: 1 } });
    else await prisma.tacModel.update({ where: { tac }, data: { count: { decrement: 1 } } });
  } catch { /* jamais bloquant */ }
}

export async function guessModel(imei: string) {
  const tac = tacOf(imei); if (!tac) return null;
  const row = await prisma.tacModel.findUnique({ where: { tac } });
  return row ? { brand: row.brand, model: row.model, confidence: row.count } : null;
}

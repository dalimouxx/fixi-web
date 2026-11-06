import { ok } from '@/lib/http';
import { recordEvent } from '@/lib/alerts';
import { clientIp } from '@/lib/login-guard';

// Erreurs JavaScript vues dans les navigateurs (écran blanc, bouton qui ne répond plus…).
// Public mais limité : taille bornée, 20 rapports par adresse et par heure, regroupés par empreinte.
const hits = new Map<string, { n: number; at: number }>();
export async function POST(req: Request) {
  const ip = clientIp(req); const now = Date.now();
  const h = hits.get(ip); if (h && now - h.at < 3600_000 && h.n >= 20) return ok({ ok: false });
  hits.set(ip, h && now - h.at < 3600_000 ? { n: h.n + 1, at: h.at } : { n: 1, at: now });
  if (hits.size > 5000) hits.clear();
  try {
    const raw = await req.text(); if (raw.length > 8000) return ok({ ok: false });
    const b = JSON.parse(raw || '{}');
    const message = String(b.message || '').slice(0, 500); if (!message) return ok({ ok: false });
    const path = String(b.path || '').replace(/[?#].*$/, '').replace(/\/[A-Z]-\d+|\/c[a-z0-9]{20,}/g, '/:id').slice(0, 120);
    await recordEvent('CLIENT_ERROR', message, { stack: String(b.stack || '').slice(0, 1500), ua: String(req.headers.get('user-agent') || '').slice(0, 200), path }, { where: path });
  } catch { /* ignoré */ }
  return ok({ ok: true });
}

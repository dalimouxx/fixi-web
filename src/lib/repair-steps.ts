// Étapes affichées dans la frise d'une réparation (atelier et page de suivi client).
// « Attente pièce » n'apparaît que si la réparation y est ou y est passée.
export const STEP_LABELS: Record<string, string> = {
  RECEIVED: 'Reçu', DIAGNOSIS: 'Diagnostic', IN_REPAIR: 'En réparation', WAITING_PART: 'Attente pièce', READY: 'Prêt', DELIVERED: 'Rendu', CANCELLED: 'Annulé',
};

export type Step = { key: string; label: string; state: 'done' | 'current' | 'todo'; at?: string | Date | null };

export function repairSteps(status: string, events: { toStatus: string; createdAt: string | Date }[] = []): Step[] {
  const passedWaiting = status === 'WAITING_PART' || events.some(e => e.toStatus === 'WAITING_PART');
  // La pièce arrive avant la réparation : une fois revenue « En réparation », l'attente est « faite ».
  const keys = ['RECEIVED', 'DIAGNOSIS', ...(passedWaiting ? ['WAITING_PART'] : []), 'IN_REPAIR', 'READY', 'DELIVERED'];
  let idx = keys.indexOf(status);
  if (status === 'CANCELLED') idx = -1;
  if (idx < 0 && status !== 'CANCELLED') idx = 0;
  const lastAt = (k: string) => { const e = [...events].reverse().find(x => x.toStatus === k); return e?.createdAt ?? null; };
  return keys.map((key, i) => {
    let state: Step['state'] = i < idx ? 'done' : i === idx ? 'current' : 'todo';
    if (status === 'CANCELLED') state = lastAt(key) ? 'done' : 'todo';
    return { key, label: STEP_LABELS[key], state, at: lastAt(key) };
  });
}

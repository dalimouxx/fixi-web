'use client';
import { Check } from 'lucide-react';
import { repairSteps } from '@/lib/repair-steps';
import { dateTime } from '@/lib/format';

// Frise d'étapes : Reçu → Diagnostic → En réparation → Prêt → Rendu, l'étape actuelle mise en avant.
export function StatusStepper({ status, events = [], compact = false }: { status: string; events?: any[]; compact?: boolean }) {
  const steps = repairSteps(status, events);
  return <ol className={`fx-stepper ${compact ? 'fx-stepper--compact' : ''}`} aria-label="Avancement de la réparation" data-cancelled={status === 'CANCELLED' || undefined}>
    {steps.map((s, i) => <li key={s.key} className={`fx-step is-${s.state}`} data-step={s.key} aria-current={s.state === 'current' ? 'step' : undefined}>
      <span className="fx-step-dot" aria-hidden="true">{s.state === 'done' ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
      <span className="fx-step-text"><b>{s.label}</b>{!compact && s.at && s.state !== 'todo' && <small>{dateTime(s.at)}</small>}</span>
    </li>)}
  </ol>;
}

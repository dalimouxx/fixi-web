'use client';
import { ErrorScreen } from '@/components/error-screen';
import './globals.css';
import './fixi-max.css';
import './fixi-max-system.css';
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="fr"><body><ErrorScreen error={error} reset={reset} /></body></html>;
}

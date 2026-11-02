'use client';
import { useEffect, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { canPromptInstall, isStandalone, onInstallChange, openInstallHelp, promptInstall } from '@/lib/install-prompt';

// Bouton « Installer » : installation native si le navigateur la propose, sinon
// ouvre la carte d'aide (gestes iPhone ou menu du navigateur). Jamais désactivé.
export function InstallAppButton({ label = 'Installer' }: { label?: string }) {
  const [installed, setInstalled] = useState(false);
  const [, force] = useState(0);
  useEffect(() => { setInstalled(isStandalone()); return onInstallChange(() => { setInstalled(isStandalone()); force(x => x + 1); }); }, []);
  async function install() { if (canPromptInstall()) await promptInstall(); else openInstallHelp(); }
  if (installed) return <span className="install-app installed"><CheckCircle2 /> Installée</span>;
  return <button type="button" className="install-app" onClick={install} title="Installer l’application sur ce téléphone"><Download />{label}</button>;
}

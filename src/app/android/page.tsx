import type { Metadata } from 'next';
import { Download, ShieldCheck, Smartphone, LayoutGrid, BellRing } from 'lucide-react';
import { AndroidQr } from './qr';

export const metadata: Metadata = { title: 'Fixi pour Android', description: 'Télécharger l’application Android de Fixi', openGraph: { title: 'Installer Fixi sur Android', images: ['/icons/atelier-512.png'] } };

// Page de téléchargement de l'application Android, à envoyer aux techniciens par WhatsApp.
export default function AndroidPage() {
  return <main className="fx-invite fx-android">
    <header className="fx-invite-head">
      <img src="/icons/atelier-192.png" alt="" width={72} height={72} />
      <h1>Fixi pour Android</h1>
      <p>Atelier, fournisseur et livreur dans une seule application, avec les alertes et le widget sur l’écran d’accueil.</p>
    </header>
    <a className="btn btn-primary btn-block fx-android-dl" href="/telecharger/android"><Download size={22} /> Télécharger l’application</a>
    <ol className="fx-android-steps">
      <li><span>1</span><b>Touchez « Télécharger »</b><small>Le fichier « Fixi.apk » arrive dans vos téléchargements.</small></li>
      <li><span>2</span><b>Ouvrez-le et touchez « Installer »</b><small>Si Android affiche « Installation bloquée », touchez « Paramètres » puis autorisez ce navigateur, et revenez.</small></li>
      <li><span>3</span><b>Ouvrez Fixi et connectez-vous</b><small>Avec votre profil et votre code à 6 chiffres.</small></li>
    </ol>
    <ul className="fx-invite-perks">
      <li><BellRing /><span><b>Alertes</b><small>Nouvelle commande, appareil prêt… avec un son clair.</small></span></li>
      <li><LayoutGrid /><span><b>Widget</b><small>Vos chiffres du jour directement sur l’écran d’accueil (menu Plus → « Ajouter le widget Fixi »).</small></span></li>
      <li><ShieldCheck /><span><b>Application officielle Fixi</b><small>Mise à jour : retéléchargez simplement depuis cette page.</small></span></li>
    </ul>
    <AndroidQr />
    <p className="fx-android-ios"><Smartphone size={16} /> iPhone : ouvrez Fixi dans Safari, touchez Partager puis « Sur l’écran d’accueil ».</p>
  </main>;
}

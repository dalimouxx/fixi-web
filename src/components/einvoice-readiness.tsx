'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, ExternalLink, FileCheck2 } from 'lucide-react';

/** « Préparation El Fatoora » : ce que Fixi vérifie dans vos données + les démarches qui restent à faire auprès de TTN. */
export function EinvoiceReadiness() {
  const [d, setD] = useState<any>(null); const [open, setOpen] = useState(false);
  useEffect(() => { fetch('/api/supplier/einvoice', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const all = d.ready === d.total;
  return <section className="supplier-panel ei">
    <button className="ei-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
      <span className={'ei-ico' + (all ? ' ok' : '')}><FileCheck2 size={19} /></span>
      <span><b>Préparation à la facture électronique</b><small>{all ? 'Vos données sont prêtes pour El Fatoora.' : `${d.ready} point(s) sur ${d.total} prêts · El Fatoora (TTN)`}</small></span>
      <ChevronDown size={17} className={open ? 'ei-chev on' : 'ei-chev'} />
    </button>
    {open && <div className="ei-body">
      <ul className="ei-checks">{d.checks.map((c: any) => <li key={c.key} className={c.ok ? 'ok' : ''}>{c.ok ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}<div><b>{c.label}</b><small>{c.detail}</small></div></li>)}</ul>
      <div className="ei-steps"><b>Démarches à faire de votre côté</b>
        <ol><li>Obtenir un certificat de signature électronique auprès de TunTrust (ANCE).</li><li>Déposer le dossier d’adhésion à El Fatoora auprès de Tunisie TradeNet (TTN).</li><li>Après l’adhésion, TTN fournit la documentation technique du format TEIF : Fixi pourra alors générer et transmettre vos factures.</li></ol>
        <a href="https://elfatoora.digital/" target="_blank" rel="noreferrer">Site officiel El Fatoora <ExternalLink size={13} /></a>
        <small>L’obligation et son calendrier dépendent de votre activité : vérifiez votre situation avec votre comptable.</small>
      </div>
    </div>}
  </section>;
}

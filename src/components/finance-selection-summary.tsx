import { FileText, Receipt, CheckCircle2, Wallet, Clock3 } from 'lucide-react';
import st from './finance-ledger.module.css';

type Props = {
  kind: 'Commande' | 'Facture';
  reference: string;
  customerName: string;
  total: number;
  paid: number;
  due: number;
  invoiceReference?: string | null;
  pending?: number;
  available?: number;
  creditTotal?: number;
};
const dt = (value: number) => Number(value || 0).toFixed(3) + ' DT';

export function FinanceSelectionSummary({
  kind, reference, customerName, total, paid, due,
  invoiceReference, pending = 0, available, creditTotal = 0,
}: Props) {
  const stillAvailable = available ?? due;
  return <section className={st.invoiceSummary} aria-label="Détails de la facture sélectionnée">
    <div className={st.invoiceSummaryHead}>
      <span className={st.invoiceSummaryIcon}><FileText size={19}/></span>
      <div>
        <span className={st.eyebrow}>{kind} sélectionnée</span>
        <strong>{invoiceReference || reference}</strong>
        <small>{customerName}{invoiceReference && invoiceReference !== reference ? ' · Commande ' + reference : ''}</small>
      </div>
      <span className={st.state + ' ' + (due < 0.0001 ? st.ok : st.pending)}>
        {due < 0.0001 ? 'Soldée' : 'Paiement partiel possible'}
      </span>
    </div>
    <div className={st.invoiceAmounts}>
      <div>
        <span><Receipt size={14}/> Montant facture{kind === 'Commande' && !invoiceReference ? ' / commande' : ''}</span>
        <strong>{dt(total)}</strong>
      </div>
      <div>
        <span><CheckCircle2 size={14}/> Déjà payé</span>
        <strong>{dt(paid)}</strong>
      </div>
      <div className={st.invoiceAmountDue}>
        <span><Wallet size={14}/> Reste à payer</span>
        <strong>{dt(due)}</strong>
      </div>
    </div>
    {creditTotal > 0 && <div className={st.invoiceSummaryInfo}>Avoirs / retours déduits : {dt(creditTotal)}</div>}
    {pending > 0 && <div className={st.invoiceSummaryNotice}>
      <Clock3 size={16}/> {dt(pending)} déjà déclaré(s) par livreur, en attente de validation.
      Montant encore encaissable : <strong>{dt(stillAvailable)}</strong>.
    </div>}
  </section>;
}

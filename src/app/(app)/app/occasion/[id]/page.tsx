'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, BatteryMedium, CheckCircle2, FileSignature, IdCard, Printer, Receipt, ShieldCheck, ShoppingBag, Tag } from 'lucide-react';
import { api, useApi } from '@/components/ui';
import { CashSuccess } from '@/components/cash-success';
import { money, dateOnly, dateTime } from '@/lib/format';
import { conditionLabel, deviceTitle } from '@/lib/used-devices';
import '@/app/fixi-occasion.css';

const ST: Record<string, string> = { IN_STOCK: 'En stock', RESERVED: 'Réservé', SOLD: 'Vendu', RETURNED: 'Retourné' };

export default function UsedDeviceDetail() {
  const { id } = useParams<{ id: string }>(); const fresh = useSearchParams().get('nouveau') === '1';
  const [n, setN] = useState(0); const { data: d } = useApi<any>(`/api/used-devices/${id}`, n);
  const [sell, setSell] = useState(false); const [msg, setMsg] = useState(''); const [done, setDone] = useState<any>(null);
  const [s, setS] = useState<any>({ price: '', method: 'CASH', received: '', warrantyDays: '', phone: '', name: '' });
  if (!d) return <div className="fx-page"><div className="card card-pad fx-skeleton" role="status"><i /><i /><i /></div></div>;
  const price = Number(s.price || d.askingPrice || 0);
  const change = s.method === 'CASH' ? Math.max(0, Number(s.received || price) - price) : 0;
  async function patch(body: any, m: string) { setMsg(''); try { await api(`/api/used-devices/${d.id}`, { method: 'PATCH', body: JSON.stringify(body) }); setMsg(m); setN(x => x + 1); } catch (e: any) { setMsg(e.message); } }
  async function doSell(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try { const r = await api<any>(`/api/used-devices/${d.id}/sell`, { method: 'POST', body: JSON.stringify({ price, method: s.method, receivedAmount: s.method === 'CASH' ? Number(s.received || price) : price, warrantyDays: Number(s.warrantyDays === '' ? d.warrantyDays : s.warrantyDays), buyer: s.phone ? { phone: s.phone, fullName: s.name } : undefined }) }); setDone(r); setSell(false); setN(x => x + 1); }
    catch (x: any) { setMsg(x.message); }
  }
  return <div className="fx-page fxm-occ">
    <Link className="btn btn-ghost btn-sm" href="/app/occasion"><ArrowLeft size={15} /> Téléphones d’occasion</Link>
    {fresh && !done && <div className="fxm-occ-fresh fxm-in"><CheckCircle2 size={20} /><div><b>Achat enregistré : {d.number}</b><span>Faites signer l’attestation au vendeur et collez l’étiquette sur le téléphone.</span></div><a className="btn btn-primary btn-sm" href={`/occasion/attestation/${d.id}`} target="_blank"><FileSignature size={15} /> Attestation</a><a className="btn btn-soft btn-sm" href={`/occasion/etiquette/${d.id}`} target="_blank"><Tag size={15} /> Étiquette</a></div>}
    <div className="fxm-occ-detail">
      <section className="fx-panel fxm-in">
        <div className="fxm-occ-top"><span className="fxm-occ-num">{d.number}</span><em className={'fxm-occ-st st-' + d.status}>{ST[d.status]}</em></div>
        <h1 className="fxm-occ-title">{deviceTitle(d)}</h1>
        <p className="fxm-occ-sub">{conditionLabel(d.condition)}{d.color ? ` · ${d.color}` : ''}{d.batteryHealth != null ? <> · <BatteryMedium size={14} /> batterie {d.batteryHealth} %</> : null}</p>
        <dl className="fxm-occ-dl">
          <div><dt>IMEI</dt><dd className="mono">{d.imei}{d.imei2 ? ` / ${d.imei2}` : ''}</dd></div>
          <div><dt>Compte iCloud / Google</dt><dd>{d.accountUnlocked ? <span className="ok"><ShieldCheck size={14} /> Retiré</span> : <span className="warn">Non confirmé</span>}</dd></div>
          {d.accessories && <div><dt>Accessoires</dt><dd>{d.accessories}</dd></div>}
          {d.defects && <div><dt>Défauts</dt><dd>{d.defects}</dd></div>}
          <div><dt>Acheté le</dt><dd>{dateTime(d.purchasedAt)}{d.boughtBy ? ` par ${d.boughtBy.fullName}` : ''}</dd></div>
          <div><dt>Prix d’achat</dt><dd>{money(d.purchasePrice)}</dd></div>
          <div><dt>Vendeur</dt><dd><IdCard size={14} /> {d.sellerName} · {d.sellerIdType} {d.sellerIdMasked}{d.sellerPhone ? ` · ${d.sellerPhone}` : ''}</dd></div>
          {d.status === 'SOLD' && <><div><dt>Vendu le</dt><dd>{dateOnly(d.soldAt)} · {money(d.soldPrice)}{d.buyer ? ` · ${d.buyer.fullName}` : ''}</dd></div><div><dt>Marge</dt><dd className="ok">{money(Number(d.soldPrice) - Number(d.purchasePrice))}</dd></div>{d.warrantyDays > 0 && <div><dt>Garantie</dt><dd>{d.warrantyDays} jours</dd></div>}</>}
        </dl>
      </section>
      <aside className="fx-panel fxm-in fxm-occ-side" style={{ '--d': '.06s' } as any}>
        {d.status !== 'SOLD' ? <>
          <span className="fxm-occ-kick">Prix de vente</span>
          <div className="fxm-occ-price">{d.askingPrice ? money(d.askingPrice) : '—'}</div>
          <label className="field"><span className="label">Changer le prix</span><span className="fxm-occ-pricebox"><input className="input" inputMode="decimal" defaultValue={d.askingPrice || ''} id="occ-price" /><button className="btn btn-soft btn-sm" onClick={() => patch({ askingPrice: Number((document.getElementById('occ-price') as HTMLInputElement).value.replace(',', '.')) }, 'Prix mis à jour.')}>OK</button></span></label>
          <button className="btn btn-primary btn-lg" onClick={() => { setS((x: any) => ({ ...x, price: String(d.askingPrice || ''), warrantyDays: String(d.warrantyDays) })); setSell(true); }}><ShoppingBag size={18} /> Vendre ce téléphone</button>
          {d.status === 'IN_STOCK' ? <button className="btn btn-ghost" onClick={() => patch({ status: 'RESERVED' }, 'Réservé pour un client.')}>Réserver pour un client</button> : <button className="btn btn-ghost" onClick={() => patch({ status: 'IN_STOCK' }, 'Remis en vente.')}>Remettre en vente</button>}
        </> : <div className="fxm-occ-sold"><CheckCircle2 size={28} /><b>Vendu</b>{d.counterSale && <Link className="btn btn-soft btn-sm" href={`/receipt/vente/${d.counterSale.number}`} target="_blank"><Receipt size={15} /> Ticket {d.counterSale.number}</Link>}</div>}
        <div className="fxm-occ-prints"><a className="btn btn-ghost btn-sm" href={`/occasion/etiquette/${d.id}`} target="_blank"><Printer size={15} /> Étiquette</a><a className="btn btn-ghost btn-sm" href={`/occasion/attestation/${d.id}`} target="_blank"><FileSignature size={15} /> Attestation d’achat</a></div>
        {msg && <p className="fxm-occ-msg" role="status">{msg}</p>}
      </aside>
    </div>

    {sell && <div className="fxm-occ-modal" role="dialog" aria-label="Vendre"><form className="fx-panel fxm-occ-sell" onSubmit={doSell}>
      <div className="fx-panel-head"><h2><ShoppingBag size={18} /> Vendre {deviceTitle(d)}</h2></div>
      <div className="fx-form-grid">
        <label className="field"><span className="label">Prix (DT)</span><input className="input" inputMode="decimal" value={s.price} onChange={e => setS({ ...s, price: e.target.value.replace(',', '.') })} /></label>
        <label className="field"><span className="label">Garantie (jours)</span><input className="input" inputMode="numeric" value={s.warrantyDays} onChange={e => setS({ ...s, warrantyDays: e.target.value.replace(/\D/g, '') })} /></label>
        <label className="field"><span className="label">Téléphone de l’acheteur</span><input className="input" inputMode="tel" value={s.phone} onChange={e => setS({ ...s, phone: e.target.value })} placeholder="Pour la garantie" /></label>
        <label className="field"><span className="label">Nom</span><input className="input" value={s.name} onChange={e => setS({ ...s, name: e.target.value })} /></label>
        <label className="field"><span className="label">Paiement</span><select className="select" value={s.method} onChange={e => setS({ ...s, method: e.target.value })}><option value="CASH">Espèces</option><option value="CARD">Carte</option><option value="D17">D17</option><option value="FLOUCI">Flouci</option><option value="BANK_TRANSFER">Virement</option></select></label>
        {s.method === 'CASH' && <label className="field"><span className="label">Le client donne</span><input className="input" inputMode="decimal" value={s.received} onChange={e => setS({ ...s, received: e.target.value.replace(',', '.') })} placeholder={String(price)} /></label>}
      </div>
      <div className="fxm-occ-sum"><span>Marge</span><b>{money(price - Number(d.purchasePrice))}</b>{s.method === 'CASH' && <><span>Monnaie</span><b>{money(change)}</b></>}</div>
      {msg && <div className="error">{msg}</div>}
      <div className="fxm-occ-sellbtns"><button type="button" className="btn btn-ghost" onClick={() => setSell(false)}>Annuler</button><button className="btn btn-primary" disabled={!(price > 0)}><CheckCircle2 size={17} /> Encaisser {money(price)}</button></div>
    </form></div>}

    {done && <div className="fxm-occ-modal"><div className="fx-panel fxm-occ-done"><CashSuccess amount={money(done.device.soldPrice)} title="Téléphone vendu" subtitle={<>Ticket {done.saleNumber} · marge {money(done.margin)}{done.change > 0 ? ` · monnaie ${money(done.change)}` : ''}</>}>
      <a className="btn fxm-btn-o" href={`/receipt/vente/${done.saleNumber}`} target="_blank"><Receipt size={16} /> Ticket avec garantie</a>
      <button className="btn fxm-btn-g" onClick={() => setDone(null)}>Terminer</button>
    </CashSuccess></div></div>}
  </div>;
}

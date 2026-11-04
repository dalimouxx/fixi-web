'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Package, Truck, Wrench } from 'lucide-react';
import { FAQ, GUIDES, type HelpRole } from '@/lib/help-center';

/** Centre d'aide public : un guide par rôle + FAQ. Le texte arabe est intégré (pas de traduction automatique ici). */
export function HelpCenter() {
  const [role, setRole] = useState<HelpRole>('atelier'); const [lang, setLang] = useState<'fr' | 'ar'>('fr'); const [open, setOpen] = useState(0);
  useEffect(() => { try { if (localStorage.getItem('fixi_lang') === 'ar') setLang('ar'); } catch {} const r = new URLSearchParams(location.search).get('role'); if (r === 'fournisseur' || r === 'livreur' || r === 'atelier') setRole(r); }, []);
  const g = GUIDES.find(x => x.role === role)!; const ar = lang === 'ar';
  const icons = { atelier: Wrench, fournisseur: Package, livreur: Truck };
  return <main className="hc" dir={ar ? 'rtl' : 'ltr'} lang={lang} data-no-i18n>
    <nav className="hc-nav"><Link href="/"><ArrowLeft size={16} /> {ar ? 'الرئيسية' : 'Accueil'}</Link><button onClick={() => setLang(ar ? 'fr' : 'ar')}>{ar ? 'Français' : 'العربية'}</button></nav>
    <header className="hc-hero"><h1>{ar ? 'كيف نساعدك؟' : 'Comment pouvons-nous vous aider ?'}</h1><p>{ar ? 'دليل خطوة بخطوة لكل دور، والأسئلة الأكثر تكراراً.' : 'Un guide pas à pas pour chaque rôle, et les questions les plus fréquentes.'}</p>
      <div className="hc-roles" role="tablist">{GUIDES.map(x => { const I = icons[x.role]; return <button key={x.role} role="tab" aria-selected={role === x.role} onClick={() => { setRole(x.role); setOpen(0); }}><I size={18} /> {x.title[lang]}</button>; })}</div></header>
    <section className="hc-guide"><h2>{g.title[lang]}</h2><p>{g.intro[lang]}</p>
      <ol>{g.steps.map((s, i) => <li key={i} className={open === i ? 'on' : ''}><button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><span>{i + 1}</span><b>{s.t[lang]}</b><ChevronDown size={17} /></button>{open === i && <p>{s.d[lang]}</p>}</li>)}</ol></section>
    <section className="hc-faq"><h2>{ar ? 'أسئلة متكررة' : 'Questions fréquentes'}</h2>{FAQ.map((f, i) => <details key={i}><summary>{f.q[lang]}</summary><p>{f.a[lang]}</p></details>)}</section>
    <footer className="hc-foot"><Link href="/inscription" className="hc-cta">{ar ? 'إنشاء ورشتي مجاناً' : 'Créer mon atelier gratuitement'}</Link><span><Link href="/conditions">{ar ? 'الشروط' : 'Conditions'}</Link> · <Link href="/confidentialite">{ar ? 'الخصوصية' : 'Confidentialité'}</Link></span></footer>
  </main>;
}

'use client';
import { Languages } from 'lucide-react';
import { useI18n } from './language-provider';

// Bouton de langue intégré aux menus (remplace le bouton flottant dans les espaces de travail).
export function LangToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { lang, setLang } = useI18n();
  const next = lang === 'fr' ? 'ar' : 'fr';
  return <button type="button" className={withLabel ? 'btn btn-ghost btn-sm fx-lang-btn' : 'fx-icon-btn fx-lang-btn'} data-no-i18n
    onClick={() => { setLang(next); try { localStorage.setItem('fixi_lang', next); } catch {} }}
    title={lang === 'fr' ? 'العربية' : 'Français'} aria-label={lang === 'fr' ? 'Passer en arabe' : 'التحويل إلى الفرنسية'}>
    <Languages size={18} />{withLabel ? <span>{lang === 'fr' ? 'العربية' : 'Français'}</span> : <b>{lang === 'fr' ? 'AR' : 'FR'}</b>}
  </button>;
}

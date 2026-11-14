// Taille de la page imprimée, choisie selon ce qu'on imprime.
// Avant, une seule règle « 80 mm » s'appliquait à tout : les factures, devis et rapports enregistrés en PDF sortaient
// sur une bande étroite (un mot par ligne). Maintenant : ticket = 80 mm, étiquette = son format exact, tout le reste = A4.
const TICKET = new Set(['ticket', 'z', 'atelier']);

export function pageRule(mode?: string, labelFormat?: string, portrait?: boolean) {
  if (mode === 'labels') {
    const [w, h] = (labelFormat || '50x30').split('x').map(Number);
    return `@page{size:${portrait ? h : w}mm ${portrait ? w : h}mm;margin:0}`;
  }
  if (mode && TICKET.has(mode)) return '@page{size:80mm auto;margin:0}';
  if (mode === 'doc' || mode === 'invoice') return '@page{size:A4;margin:0}'; // ces documents ont déjà leurs marges
  return '@page{size:A4;margin:10mm}';
}

export function installPrintPage() {
  const style = document.createElement('style');
  style.id = 'fixi-print-page';
  const apply = () => { const d = document.body.dataset; style.textContent = pageRule(d.printMode, d.labelFormat, !!d.labelPortrait); document.head.appendChild(style); };
  apply();
  new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['data-print-mode', 'data-label-format', 'data-label-portrait'] });
  window.addEventListener('beforeprint', apply);
}

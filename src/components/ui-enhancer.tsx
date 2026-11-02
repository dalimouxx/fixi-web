'use client';
import { useEffect } from 'react';

// Améliorations appliquées à tous les écrans, y compris les anciens :
// - chaque tableau reçoit les libellés de colonnes sur ses cellules, ce qui permet
//   de l'afficher en cartes lisibles sur téléphone (voir .fx-cards dans le CSS) ;
// - une ligne « Aucun… » sur toute la largeur devient un état vide clair ;
// - les champs de montant ouvrent le clavier numérique du téléphone.
function enhance(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>('table').forEach(table => {
    if (table.closest('[data-keep-table]')) return;
    table.classList.add('fx-cards');
    const labels = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent || '').trim());
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = Array.from(tr.children) as HTMLElement[];
      if (cells.length === 1 && Number(cells[0].getAttribute('colspan') || 1) > 1) { tr.classList.add('fx-empty-row'); return; }
      tr.classList.remove('fx-empty-row');
      cells.forEach((td, i) => { const l = labels[i] || ''; if (td.dataset.label !== l) td.dataset.label = l; });
    });
  });
  root.querySelectorAll<HTMLInputElement>('input[type="number"]:not([inputmode])').forEach(input => {
    const step = input.getAttribute('step');
    input.setAttribute('inputmode', step && step !== '1' ? 'decimal' : 'numeric');
  });
}

export function UiEnhancer() {
  useEffect(() => {
    let queued = false;
    const run = () => { queued = false; enhance(document); };
    run();
    const mo = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);
  return null;
}

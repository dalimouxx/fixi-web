import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translateAr} from '../src/lib/i18n-dictionary';

const screens:Record<string,string[]>={
  driver:['Disponible','Indisponible','Installer','Installer Fixi Delivery sur ce téléphone',
    'Encaissements & caisse livreur','JOURNÉE & TOURNÉE','Prêt à démarrer','GPS automatique',
    'Remise caisse en attente','Livrées aujourd’hui'],
  supplier:['Produits & stock','Référentiels','Achats','Créances & dettes','Finance & bénéfice',
    'Équipe & accès','Mon abonnement Supplier','GESTION DES DÉPÔTS'],
  platform:['État réseau','Présence des boutiques.','Réseau de boutiques',
    'Créer, modifier, suspendre ou supprimer un point de vente.',
    'CA · 30 jours','Réparations','Utilisateurs','Dernière activité :','Suspendre'],
};

for(const [area,texts] of Object.entries(screens)){
  test(area+' screen labels are translated to Arabic',()=>{
    for(const label of texts)
      assert.notEqual(translateAr(label),label,area+' / '+label);
  });
}

test('nontranslated references, empty texts and whitespace are preserved',()=>{
  assert.equal(translateAr('SUP-MVCM78JV-JSU6'),'SUP-MVCM78JV-JSU6');
  assert.equal(translateAr('  '),'  ');
  assert.equal(translateAr('  Disponible '),'  متاح ');
});

// Bibliothèque de sons Fixi + réglages d'alerte par type.
// Conçus pour les haut-parleurs de téléphone (900–2 400 Hz, là où ils sont le plus forts)
// et assez différents pour être reconnus sans regarder l'écran.

export type FixiSoundId = 'cloche' | 'caisse' | 'alerte' | 'livraison' | 'succes' | 'douce' | 'radar' | 'silence';
/** [fréquence Hz, début s, durée s] */
export type Note = readonly [number, number, number];

export const fixiSounds: Record<FixiSoundId, { label: string; hint: string; notes: readonly Note[] }> = {
  cloche:    { label: 'Clochette', hint: 'Trois notes claires', notes: [[1319, 0, .16], [1568, .16, .16], [2093, .32, .34]] },
  caisse:    { label: 'Tiroir-caisse', hint: 'Double « ding » vif', notes: [[1760, 0, .09], [2349, .09, .30], [1760, .5, .09], [2349, .59, .34]] },
  alerte:    { label: 'Alerte forte', hint: 'Deux tons répétés', notes: [[1175, 0, .18], [1568, .2, .18], [1175, .4, .18], [1568, .6, .18], [1175, .8, .18], [1568, 1, .26]] },
  livraison: { label: 'Klaxon doux', hint: 'Deux accords', notes: [[988, 0, .2], [1245, 0, .2], [988, .32, .3], [1245, .32, .3]] },
  succes:    { label: 'Succès', hint: 'Montée joyeuse', notes: [[1047, 0, .12], [1319, .12, .12], [1568, .24, .12], [2093, .36, .38]] },
  douce:     { label: 'Douce', hint: 'Deux notes discrètes', notes: [[1175, 0, .2], [1568, .22, .32]] },
  radar:     { label: 'Bips rapides', hint: 'Quatre bips', notes: [[1865, 0, .08], [1865, .16, .08], [1865, .32, .08], [2349, .48, .22]] },
  silence:   { label: 'Silencieux', hint: 'Aucun son', notes: [] },
};

export type AlertCategory = 'orders' | 'missions' | 'progress' | 'done' | 'general';

export const alertCategories: Record<AlertCategory, { label: string; hint: string; defaultSound: FixiSoundId; repeat: number }> = {
  orders:   { label: 'Nouvelle commande', hint: 'Une boutique passe commande', defaultSound: 'caisse', repeat: 3 },
  missions: { label: 'Nouvelle livraison', hint: 'Une mission attend un livreur', defaultSound: 'alerte', repeat: 3 },
  progress: { label: 'Suivi en cours', hint: 'Commande confirmée, en route, arrivée', defaultSound: 'cloche', repeat: 1 },
  done:     { label: 'Terminé', hint: 'Livré, payé, appareil prêt', defaultSound: 'succes', repeat: 1 },
  general:  { label: 'Autres', hint: 'Messages et rappels', defaultSound: 'douce', repeat: 1 },
};

/** Type d'événement Fixi → catégorie d'alerte. */
export function categoryFor(experienceKey?: string | null, priority?: string | null): AlertCategory {
  switch (experienceKey) {
    case 'SUPPLIER_NEW_ORDER': return 'orders';
    case 'DRIVER_NEW_MISSION': return 'missions';
    case 'SHOP_ORDER_PROGRESS': case 'SUPPLIER_UPDATE': case 'DRIVER_ARRIVED': return 'progress';
    case 'SHOP_ORDER_DELIVERED': case 'DRIVER_DELIVERED': return 'done';
  }
  return priority === 'URGENT' || priority === 'HIGH' ? 'progress' : 'general';
}

/** Catégories pertinentes pour chaque espace (les autres sont masquées dans les réglages). */
export const categoriesForSpace: Record<'atelier' | 'supplier' | 'delivery', AlertCategory[]> = {
  atelier: ['progress', 'done', 'general'],
  supplier: ['orders', 'progress', 'done', 'general'],
  delivery: ['missions', 'progress', 'done', 'general'],
};

export type AlertSettings = {
  volume: number;            // 0..1
  vibrate: boolean;
  voice: boolean;            // annonce vocale du titre
  summary: boolean;          // résumé permanent sur l'écran verrouillé
  sounds: Record<AlertCategory, FixiSoundId>;
};

export const defaultAlertSettings = (): AlertSettings => ({
  volume: 1,
  vibrate: true,
  voice: false,
  summary: true,
  sounds: Object.fromEntries(Object.entries(alertCategories).map(([k, v]) => [k, v.defaultSound])) as Record<AlertCategory, FixiSoundId>,
});

export function parseAlertSettings(raw: string | null | undefined): AlertSettings {
  const base = defaultAlertSettings();
  if (!raw) return base;
  try {
    const j = JSON.parse(raw);
    const sounds = { ...base.sounds };
    for (const k of Object.keys(sounds) as AlertCategory[]) if (j?.sounds?.[k] in fixiSounds) sounds[k] = j.sounds[k];
    const volume = Number(j?.volume);
    return {
      volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : base.volume,
      vibrate: j?.vibrate !== false,
      voice: j?.voice === true,
      summary: j?.summary !== false,
      sounds,
    };
  } catch { return base; }
}

export const vibrationFor: Record<AlertCategory, number[]> = {
  orders: [220, 90, 220, 90, 320],
  missions: [260, 100, 260, 100, 360],
  progress: [120, 70, 160],
  done: [100, 60, 220],
  general: [90, 60, 120],
};

/** Ancien code de son (avant v12) → son de la nouvelle bibliothèque. */
export const legacySoundMap: Record<string, FixiSoundId> = {
  CHIME: 'douce', SUCCESS: 'succes', WARNING: 'radar', URGENT: 'alerte', SILENT: 'silence',
  SUPPLIER_ORDER: 'caisse', SUPPLIER_UPDATE: 'cloche', SHOP_PROGRESS: 'cloche', SHOP_DELIVERED: 'succes',
  DRIVER_MISSION: 'alerte', DRIVER_ARRIVAL: 'livraison', DRIVER_SUCCESS: 'succes',
};

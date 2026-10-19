import type {FixiSoundKey} from './notification-experience';

/** [frequency in Hz, delay in seconds, duration in seconds] – unique short signatures. */
export const fixiSoundPatterns: Record<FixiSoundKey,ReadonlyArray<readonly [number,number,number]>>={
  CHIME:[[880,0,.09],[1175,.13,.10]],
  SUCCESS:[[784,0,.08],[1047,.10,.09],[1319,.21,.11]],
  WARNING:[[660,0,.11],[520,.17,.15]],
  URGENT:[[880,0,.11],[660,.17,.11],[880,.34,.14]],
  SILENT:[],
  SUPPLIER_ORDER:[[740,0,.12],[932,.17,.11],[1175,.35,.18]],
  SUPPLIER_UPDATE:[[784,0,.11],[988,.18,.13]],
  SHOP_PROGRESS:[[523,0,.10],[659,.14,.10],[784,.29,.14]],
  SHOP_DELIVERED:[[659,0,.12],[880,.18,.12],[1047,.35,.20]],
  DRIVER_MISSION:[[988,0,.13],[1318,.20,.15],[988,.43,.12],[1568,.62,.21]],
  DRIVER_ARRIVAL:[[587,0,.12],[784,.17,.11],[988,.32,.20]],
  DRIVER_SUCCESS:[[659,0,.13],[880,.19,.13],[1175,.39,.24]]
};
export function soundPattern(key:string){
  return fixiSoundPatterns[key as FixiSoundKey]||fixiSoundPatterns.CHIME;
}

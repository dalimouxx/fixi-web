/**
 * Fixi notification identities.
 * Professional, memorable sounds rather than repetitive or startling alarms.
 * Browser sound requires a prior user interaction; OS push sounds are browser-controlled.
 */
export const notificationExperiences = {
  GENERAL:{channel:'general',sound:'CHIME',duration:5200,tagPrefix:'fixi'},
  SUPPLIER_NEW_ORDER:{channel:'supplier',sound:'SUPPLIER_ORDER',duration:8200,tagPrefix:'fixi-supplier-order'},
  SUPPLIER_UPDATE:{channel:'supplier',sound:'SUPPLIER_UPDATE',duration:6200,tagPrefix:'fixi-supplier-update'},
  SHOP_ORDER_PROGRESS:{channel:'shop',sound:'SHOP_PROGRESS',duration:7000,tagPrefix:'fixi-shop-order'},
  SHOP_ORDER_DELIVERED:{channel:'shop',sound:'SHOP_DELIVERED',duration:8500,tagPrefix:'fixi-shop-delivered'},
  DRIVER_NEW_MISSION:{channel:'driver',sound:'DRIVER_MISSION',duration:10000,tagPrefix:'fixi-driver-mission'},
  DRIVER_ARRIVED:{channel:'driver',sound:'DRIVER_ARRIVAL',duration:7000,tagPrefix:'fixi-driver-arrival'},
  DRIVER_DELIVERED:{channel:'driver',sound:'DRIVER_SUCCESS',duration:8500,tagPrefix:'fixi-driver-complete'},
} as const;

export type FixiExperienceKey=keyof typeof notificationExperiences;
export type FixiSoundKey=
 'CHIME'|'SUCCESS'|'WARNING'|'URGENT'|'SILENT'|
 'SUPPLIER_ORDER'|'SUPPLIER_UPDATE'|'SHOP_PROGRESS'|'SHOP_DELIVERED'|
 'DRIVER_MISSION'|'DRIVER_ARRIVAL'|'DRIVER_SUCCESS';

export function getNotificationExperience(key:unknown){
  if(typeof key==='string' && Object.prototype.hasOwnProperty.call(notificationExperiences,key))
    return notificationExperiences[key as FixiExperienceKey];
  return notificationExperiences.GENERAL;
}
export function experienceTag(key:FixiExperienceKey,eventId?:string){
  const base=notificationExperiences[key].tagPrefix;
  return eventId?base+'-'+eventId:base;
}

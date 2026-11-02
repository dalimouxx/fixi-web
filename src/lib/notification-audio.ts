'use client';
import { fixiSounds, legacySoundMap, type FixiSoundId } from './notification-sounds';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function context() {
  if (typeof window === 'undefined') return null;
  const Constructor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Constructor) return null;
  if (!ctx) {
    ctx = new Constructor();
    // Compresseur : on monte le volume perçu au maximum sans saturer le haut-parleur.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 6; comp.ratio.value = 6; comp.attack.value = .002; comp.release.value = .12;
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(comp); comp.connect(ctx.destination);
  }
  return ctx;
}

/** Les navigateurs n'autorisent le son qu'après un geste (toucher ou touche).
 * Cela ne permet pas de contourner le système quand le téléphone est verrouillé. */
export async function primeNotificationAudio(): Promise<boolean> {
  const c = context();
  if (!c) return false;
  try {
    if (c.state !== 'running') await c.resume();
    unlocked = c.state === 'running';
    return unlocked;
  } catch { return false; }
}

export function notificationAudioStatus(): 'UNSUPPORTED' | 'NEEDS_GESTURE' | 'READY' {
  if (typeof window === 'undefined') return 'UNSUPPORTED';
  const c = context();
  if (!c) return 'UNSUPPORTED';
  return unlocked && c.state === 'running' ? 'READY' : 'NEEDS_GESTURE';
}

/** Joue un son de la bibliothèque. Chaque note = fondamentale + harmonique (timbre de cloche
 * bien audible sur un petit haut-parleur). Retourne false si le son n'a pas pu être joué. */
export function playFixiSound(id: FixiSoundId, volume = 1): boolean {
  const c = context();
  if (!c || !master || !unlocked || c.state !== 'running') return false;
  const level = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
  const notes = fixiSounds[id]?.notes || [];
  if (!level || !notes.length) return false;
  const start = c.currentTime + .01;
  for (const [frequency, delay, duration] of notes) {
    const t0 = start + delay, t1 = t0 + duration;
    const gain = c.createGain();
    gain.gain.setValueAtTime(.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level * .9), t0 + .008);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level * .35), t0 + duration * .45);
    gain.gain.exponentialRampToValueAtTime(.0001, t1);
    gain.connect(master);
    for (const [mult, type, amp] of [[1, 'sine', 1], [2, 'triangle', .28], [3, 'sine', .12]] as const) {
      const osc = c.createOscillator(), partial = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency * mult, t0);
      partial.gain.value = amp;
      osc.connect(partial); partial.connect(gain);
      osc.start(t0); osc.stop(t1 + .03);
      osc.onended = () => { osc.disconnect(); partial.disconnect(); };
    }
    setTimeout(() => gain.disconnect(), (delay + duration + .2) * 1000);
  }
  return true;
}

/** Durée d'un son, pour enchaîner une répétition ou l'annonce vocale. */
export function soundDuration(id: FixiSoundId) {
  return (fixiSounds[id]?.notes || []).reduce((m, [, d, l]) => Math.max(m, d + l), 0);
}

/** Compatibilité avec les anciens codes de son (CHIME, SUPPLIER_ORDER…). */
export function playFixiNotificationSound(key = 'CHIME', volume = 0.8): boolean {
  const id = (key in fixiSounds ? key : legacySoundMap[key] || 'douce') as FixiSoundId;
  return playFixiSound(id, volume);
}

/** Annonce vocale du titre (« Nouvelle commande de Fixi Gabès ») dans la langue de l'interface. */
export function speakAlert(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return false;
  try {
    const lang = document.documentElement.lang === 'ar' ? 'ar-TN' : 'fr-FR';
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 1; u.volume = 1;
    const voice = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
    if (voice) u.voice = voice;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

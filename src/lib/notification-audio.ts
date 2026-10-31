'use client';
import {soundPattern} from './notification-sound-patterns';

let ctx:AudioContext|null=null;
let unlocked=false;

function context(){
  if(typeof window==='undefined')return null;
  const Constructor=window.AudioContext||(window as any).webkitAudioContext;
  if(!Constructor)return null;
  if(!ctx)ctx=new Constructor();
  return ctx;
}

/** Browsers only unlock Web Audio from a real user gesture (pointer or keyboard).
 * This cannot make background / locked-phone sounds bypass OS restrictions.
 */
export async function primeNotificationAudio():Promise<boolean>{
  const c=context();
  if(!c)return false;
  try{
    if(c.state!=='running')await c.resume();
    unlocked=c.state==='running';
    return unlocked;
  }catch{return false}
}
export function notificationAudioStatus(): 'UNSUPPORTED'|'NEEDS_GESTURE'|'READY'{
  if(typeof window==='undefined')return 'UNSUPPORTED';
  const c=context();
  if(!c)return 'UNSUPPORTED';
  return unlocked&&c.state==='running'?'READY':'NEEDS_GESTURE';
}

/** Returns true only when the sound was scheduled on a running context.
 * Volume is explicit and capped to avoid startling users.
 */
export function playFixiNotificationSound(key='CHIME',volume=0.8):boolean{
  const c=context();
  if(!c||!unlocked||c.state!=='running')return false;
  const level=Math.max(0,Math.min(1,Number.isFinite(volume)?volume:0.8));
  if(level===0)return false;
  const notes=soundPattern(key);
  if(!notes.length)return false;
  const start=c.currentTime+0.005;
  for(const [frequency,delay,duration] of notes){
    const oscillator=c.createOscillator(),gain=c.createGain();
    oscillator.type='triangle';
    oscillator.frequency.setValueAtTime(frequency,start+delay);
    const beginning=start+delay,ending=beginning+duration;
    gain.gain.setValueAtTime(0.0001,beginning);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,level*.22),beginning+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,ending);
    oscillator.connect(gain);gain.connect(c.destination);
    oscillator.start(beginning);oscillator.stop(ending+.02);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  }
  return true;
}

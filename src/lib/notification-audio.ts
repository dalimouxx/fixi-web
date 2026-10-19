'use client';
import {soundPattern} from './notification-sound-patterns';

let ctx:AudioContext|null=null;
let primed=false;

function context(){
  if(typeof window==='undefined')return null;
  const C=(window.AudioContext||(window as any).webkitAudioContext);
  if(!C)return null;
  if(!ctx)ctx=new C();
  return ctx;
}

export function primeNotificationAudio(){
  const c=context();if(!c)return;
  c.resume().catch(()=>{});
  primed=true;
}

export function playFixiNotificationSound(key='CHIME'){
  const c=context();if(!c||!primed)return;
  c.resume().catch(()=>{});
  const now=c.currentTime;
  for(const[freq,delay,duration] of soundPattern(key)){
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';o.frequency.setValueAtTime(freq,now+delay);
    g.gain.setValueAtTime(.0001,now+delay);
    g.gain.exponentialRampToValueAtTime(.075,now+delay+.014);
    g.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);
    o.connect(g);g.connect(c.destination);o.start(now+delay);o.stop(now+delay+duration+.02);
  }
}

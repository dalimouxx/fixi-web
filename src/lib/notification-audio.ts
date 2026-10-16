'use client';

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
  const patterns:Record<string,Array<[number,number,number]>>={
    CHIME:[[880,0,.08],[1175,.11,.09]],
    SUCCESS:[[784,0,.07],[1047,.09,.08],[1319,.18,.1]],
    WARNING:[[660,0,.1],[520,.14,.13]],
    URGENT:[[880,0,.11],[660,.14,.11],[880,.28,.14]],
    SILENT:[]
  };
  for(const[freq,delay,duration] of patterns[key]||patterns.CHIME){
    const o=c.createOscillator(),g=c.createGain();
    o.type='sine';o.frequency.setValueAtTime(freq,now+delay);
    g.gain.setValueAtTime(.0001,now+delay);
    g.gain.exponentialRampToValueAtTime(.12,now+delay+.012);
    g.gain.exponentialRampToValueAtTime(.0001,now+delay+duration);
    o.connect(g);g.connect(c.destination);o.start(now+delay);o.stop(now+delay+duration+.02);
  }
}

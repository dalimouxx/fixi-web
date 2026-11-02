import { Smartphone, BatteryLow, PlugZap, Power, Droplets, Camera, Volume2, Cpu, Keyboard, Wrench } from 'lucide-react';

const map: Record<string, any> = { screen: Smartphone, battery: BatteryLow, plug: PlugZap, power: Power, water: Droplets, camera: Camera, speaker: Volume2, software: Cpu, keyboard: Keyboard, wrench: Wrench };

export function IssueIcon({ name, size = 22 }: { name: string; size?: number }) {
  const I = map[name] || Wrench;
  return <I size={size} aria-hidden="true" />;
}

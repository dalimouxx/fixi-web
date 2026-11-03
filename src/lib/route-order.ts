// Ordre de tournée : on part de la position du livreur et on va toujours au client le plus proche.
export type Stop = { id: string; lat?: number | null; lng?: number | null };

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function orderStops<T extends Stop>(stops: T[], start?: { lat: number; lng: number } | null): { ordered: T[]; km: number } {
  const located = stops.filter(s => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)) && s.lat !== null && s.lng !== null);
  const others = stops.filter(s => !located.includes(s));
  const rest = [...located]; const out: T[] = []; let km = 0;
  let cur = start || (rest[0] ? { lat: Number(rest[0].lat), lng: Number(rest[0].lng) } : null);
  while (rest.length && cur) {
    let bi = 0, bd = Infinity;
    rest.forEach((s, i) => { const d = distanceKm(cur!, { lat: Number(s.lat), lng: Number(s.lng) }); if (d < bd) { bd = d; bi = i; } });
    const [n] = rest.splice(bi, 1); out.push(n); km += bd; cur = { lat: Number(n.lat), lng: Number(n.lng) };
  }
  return { ordered: [...out, ...others], km: Math.round(km * 10) / 10 };
}

/** Itinéraire Google Maps avec étapes (10 au maximum). */
export function mapsRouteUrl(stops: Stop[], start?: { lat: number; lng: number } | null) {
  const pts = stops.filter(s => s.lat != null && s.lng != null).slice(0, 10).map(s => `${s.lat},${s.lng}`);
  if (!pts.length) return '';
  const dest = pts[pts.length - 1];
  const way = pts.slice(0, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1${start ? `&origin=${start.lat},${start.lng}` : ''}&destination=${dest}${way ? `&waypoints=${encodeURIComponent(way)}` : ''}&travelmode=driving`;
}

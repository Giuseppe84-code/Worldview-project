// ── Day/Night Terminator ──
// Computes the solar terminator line as an array of [lng, lat] pairs

export function computeTerminator(now = Date.now()) {
  const d = new Date(now);
  // Day of year
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = (d - start) / 86400000;

  // Solar declination (approximate)
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  const decRad = declination * Math.PI / 180;

  // Sub-solar longitude (based on UTC time)
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const subSolarLng = (12 - hours) * 15; // 15 degrees per hour

  const points = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const lngRad = (lng - subSolarLng) * Math.PI / 180;
    const lat = Math.atan(-Math.cos(lngRad) / Math.tan(decRad)) * 180 / Math.PI;
    points.push([lng, lat]);
  }

  return { points, declination, subSolarLng };
}

// ── Get sub-solar point for sun rendering ──
export function getSubSolarPoint(now = Date.now()) {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = (d - start) / 86400000;
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const lng = (12 - hours) * 15;
  return { lat: declination, lng: ((lng + 180) % 360) - 180 };
}

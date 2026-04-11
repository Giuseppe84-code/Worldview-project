// ── Satellite position computation from orbital elements ──

export function computeSatPosition(sat, now) {
  const epoch = new Date(sat.EPOCH).getTime();
  const dtMin = (now - epoch) / 60000;
  const n = sat.MEAN_MOTION;
  const nRad = n * 2 * Math.PI / 1440;
  const inc = sat.INCLINATION * Math.PI / 180;
  const raan0 = sat.RA_OF_ASC_NODE * Math.PI / 180;
  const ecc = sat.ECCENTRICITY;
  const argP = sat.ARG_OF_PERICENTER * Math.PI / 180;
  const M0 = sat.MEAN_ANOMALY * Math.PI / 180;

  const M = (M0 + nRad * dtMin) % (2 * Math.PI);

  // Solve Kepler's equation (Newton's method)
  let E = M;
  for (let i = 0; i < 10; i++) E = E - (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));

  const v = 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(E / 2), Math.sqrt(1 - ecc) * Math.cos(E / 2));
  const u = v + argP;

  // Semi-major axis (km)
  const a = Math.pow(398600.4418 / (n * 2 * Math.PI / 86400) ** 2, 1 / 3);

  // RAAN drift (J2 perturbation)
  const raanDot = -1.5 * 1.08263e-3 * nRad * Math.cos(inc) / ((1 - ecc * ecc) ** 2) * (6371 / a) ** 2;
  const raan = raan0 + raanDot * dtMin;

  const lat = Math.asin(Math.sin(inc) * Math.sin(u)) * 180 / Math.PI;

  // GMST for longitude
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const gmst = (280.46061837 + 360.98564736629 * (now - J2000) / 86400000) % 360;
  const lngAsc = raan * 180 / Math.PI - gmst;
  const lng = (lngAsc + Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u)) * 180 / Math.PI + 720) % 360 - 180;

  const alt = a * (1 - ecc * Math.cos(E));
  return { lat, lng, alt: alt - 6371 };
}

// ── Compute orbit trace (array of lat/lng for one full orbit) ──
export function computeOrbitTrace(sat, now, steps = 60) {
  const period = 1440 / sat.MEAN_MOTION; // minutes
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = now + (i / steps) * period * 60000;
    const p = computeSatPosition(sat, t);
    if (p && !isNaN(p.lat) && !isNaN(p.lng)) pts.push(p);
  }
  return pts;
}

// ── Classify satellite by name ──
export function classifySat(name) {
  const n = (name || "").toUpperCase();
  const isMil = n.includes("USA-") || n.includes("NROL") || n.includes("LACROSSE") || n.includes("MENTOR") || n.includes("ORION") || n.includes("TRUMPET");
  const isRecon = n.includes("WORLDVIEW") || n.includes("PLEIADES") || n.includes("SPOT") || n.includes("SENTINEL") || n.includes("LANDSAT") || n.includes("CSO");
  const isISS = n.includes("ISS") || n.includes("ZARYA");

  let color = "#44aaff", size = 2, type = "OTHER";
  if (isMil) { color = "#ff4444"; size = 3.5; type = "MIL"; }
  else if (isRecon) { color = "#ffaa00"; size = 3; type = "RECON"; }
  else if (isISS) { color = "#00ff88"; size = 4; type = "ISS"; }

  return { isMil, isRecon, isISS, color, size, type };
}

// ── Fetch satellite data from CelesTrak ──
export async function fetchSatellites() {
  const groups = ["military", "resource", "stations"];
  const allSats = [];
  for (const group of groups) {
    try {
      const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`);
      if (res.ok) {
        const data = await res.json();
        allSats.push(...data.slice(0, group === "military" ? 40 : 15));
      }
    } catch { /* network error — skip group */ }
  }
  return allSats;
}

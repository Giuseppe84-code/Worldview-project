// ── Simulated ship tracking for Strait of Hormuz ──
// Note: Real AIS data requires paid/authenticated APIs (MarineTraffic, AISHub).
// This module generates plausible ship positions along known shipping lanes
// to visualize maritime activity in the strategic Strait of Hormuz corridor.

// Strait of Hormuz waypoints (shipping lane)
const HORMUZ_LANE = [
  [57.5, 25.2],  // Gulf of Oman entry
  [56.8, 26.3],
  [56.4, 26.6],  // Strait choke point
  [55.8, 26.4],
  [54.5, 26.0],
  [53.0, 26.3],  // Persian Gulf waters
  [51.5, 27.0],
  [50.0, 28.5],
];

const SHIP_TYPES = [
  { type: "TANKER", flag: "LR", prefix: "MT" },
  { type: "TANKER", flag: "PA", prefix: "MT" },
  { type: "CARGO", flag: "SG", prefix: "MV" },
  { type: "CARGO", flag: "MH", prefix: "MV" },
  { type: "NAVAL", flag: "US", prefix: "USS" },
  { type: "NAVAL", flag: "IR", prefix: "IRIS" },
  { type: "TANKER", flag: "GR", prefix: "MT" },
];

const SHIP_NAMES = [
  "GULF STAR","HORMUZ PRIDE","PERSIAN SUN","ARABIAN KNIGHT","DESERT FALCON",
  "SEA VOYAGER","OCEAN EAGLE","SILVER WAVE","GOLDEN HORIZON","BLUE MARLIN",
  "NIMITZ","BATAAN","DEMAVAND","SAHAND","JAMARAN",
];

// Deterministic pseudo-random for stable ship positions across renders
function seededRand(seed) {
  const x = Math.sin(seed * 9999.1) * 43758.5453;
  return x - Math.floor(x);
}

// Generate simulated ship fleet with positions interpolated along the lane
export function generateShipFleet(count = 18) {
  const ships = [];
  for (let i = 0; i < count; i++) {
    const progress = seededRand(i + 1);
    const laneIdx = Math.floor(progress * (HORMUZ_LANE.length - 1));
    const segT = (progress * (HORMUZ_LANE.length - 1)) - laneIdx;

    const [lng1, lat1] = HORMUZ_LANE[laneIdx];
    const [lng2, lat2] = HORMUZ_LANE[laneIdx + 1];

    // Interpolate along lane with a small lateral offset
    const offset = (seededRand(i + 100) - 0.5) * 0.4;
    const perpLng = -(lat2 - lat1) * offset;
    const perpLat = (lng2 - lng1) * offset;

    const typeInfo = SHIP_TYPES[i % SHIP_TYPES.length];
    const name = SHIP_NAMES[i % SHIP_NAMES.length];

    // Heading based on lane direction
    const hdg = Math.atan2(lng2 - lng1, lat2 - lat1) * 180 / Math.PI;

    ships.push({
      mmsi: 200000000 + i * 12345,
      name,
      type: typeInfo.type,
      flag: typeInfo.flag,
      callsign: `${typeInfo.prefix}-${(i + 100).toString(16).toUpperCase()}`,
      lat: lat1 + (lat2 - lat1) * segT + perpLat,
      lng: lng1 + (lng2 - lng1) * segT + perpLng,
      hdg: (hdg + 360) % 360,
      speed: 8 + seededRand(i + 200) * 12, // knots
      length: 200 + Math.floor(seededRand(i + 300) * 150),
    });
  }
  return ships;
}

// Ship type to color
export const shipColor = (type) =>
  type === "NAVAL" ? "#ff6644" :
  type === "TANKER" ? "#ffaa44" :
  type === "CARGO" ? "#44ddaa" : "#888888";

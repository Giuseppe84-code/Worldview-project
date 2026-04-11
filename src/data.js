// ── Region definitions for OpenSky API ──
export const REGIONS = {
  middleeast: { lamin: 12, lamax: 42, lomin: 24, lomax: 75, label: "M.EAST" },
  midwest: { lamin: 10, lamax: 50, lomin: -120, lomax: -60, label: "M.OVEST" },
  europe: { lamin: 35, lamax: 60, lomin: -10, lomax: 40, label: "EUROPE" },
  world: { lamin: -60, lamax: 60, lomin: -180, lomax: 180, label: "GLOBAL" },
};

// ── Region rotation targets (globe rotation when selecting a region) ──
export const REGION_ROTATIONS = {
  middleeast: { lng: -50, lat: 25 },
  midwest: { lng: 90, lat: 35 },
  europe: { lng: -10, lat: 45 },
  world: { lng: 0, lat: 20 },
};

// ── Military callsign prefixes ──
export const MIL_PREFIXES = [
  "RCH","DUKE","EVAC","NATO","RRR","IAF","FORTE",
  "HOMER","JAKE","LAGR","VIPER","COBRA","TOPCAT"
];

// ── Conflict zone targets ──
export const TARGETS = [
  { name: "Tehran", lat: 35.69, lng: 51.39, type: "STRIKE", pct: 95 },
  { name: "Isfahan", lat: 32.65, lng: 51.67, type: "STRIKE", pct: 85 },
  { name: "Natanz", lat: 33.51, lng: 51.73, type: "NUCLEAR", pct: 90 },
  { name: "Bushehr", lat: 28.92, lng: 50.82, type: "NUCLEAR", pct: 70 },
  { name: "Bandar Abbas", lat: 27.19, lng: 56.28, type: "NAVAL", pct: 65 },
  { name: "Hormuz", lat: 26.57, lng: 56.25, type: "MARITIME", pct: 80 },
  { name: "Tel Aviv", lat: 32.09, lng: 34.78, type: "COMMAND", pct: 50 },
  { name: "Al Udeid AB", lat: 25.12, lng: 51.32, type: "AIRBASE", pct: 60 },
  { name: "Incirlik AB", lat: 37.0, lng: 35.43, type: "AIRBASE", pct: 35 },
];

// ── City labels ──
export const CITIES = [
  [45.07,7.68,"Torino"],[45.46,9.19,"Milano"],[41.9,12.5,"Roma"],[40.85,14.27,"Napoli"],
  [51.5,-0.1,"London"],[48.9,2.3,"Paris"],[52.5,13.4,"Berlin"],[40.4,-3.7,"Madrid"],
  [55.8,37.6,"Moscow"],[40.7,-74,"New York"],[38.9,-77,"DC"],
  [39.9,116.4,"Beijing"],[35.7,139.7,"Tokyo"],[28.6,77.2,"Delhi"],
  [30,31.2,"Cairo"],[-33.9,18.4,"Cape Town"],[-23.5,-46.6,"São Paulo"],
];

export const HOT_CITIES = [
  [35.69,51.39,"TEHRAN"],[32.09,34.78,"TEL AVIV"],[33.3,44.4,"BAGHDAD"],
  [25.3,55.3,"DUBAI"],[26.57,56.25,"HORMUZ"],[24.5,54.4,"ABU DHABI"],
  [29.4,48,"KUWAIT"],[25.29,51.53,"DOHA"],[21.4,39.8,"JEDDAH"],
];

// ── ISO codes for Middle East countries ──
export const ME_CODES = ["364","368","760","682","376","792","400","414","634","784","512","887","048","422"];
export const IRAN_CODE = "364";

// ── Target type to color ──
export const typeColor = (t) =>
  t === "STRIKE" ? "#ff2200" :
  t === "NUCLEAR" ? "#ffaa00" :
  t === "MARITIME" ? "#00aaff" :
  t === "COMMAND" ? "#ff44ff" :
  t === "NAVAL" ? "#00ddff" : "#00ff88";

// ── Earthquake magnitude to color ──
export const quakeColor = (mag) =>
  mag >= 6 ? "#ff0000" :
  mag >= 5 ? "#ff6600" :
  mag >= 4 ? "#ffaa00" :
  mag >= 3 ? "#ffdd00" : "#88cc00";

// ── Earthquake magnitude to size ──
export const quakeSize = (mag) =>
  mag >= 6 ? 8 :
  mag >= 5 ? 6 :
  mag >= 4 ? 4 :
  mag >= 3 ? 3 : 2;

// ── GPS Jamming / Interference Zones ──
// Known areas of GPS interference based on publicly reported data
// Sources: EUROCONTROL advisories, FAA NOTAMs, open-source intelligence

export const GPS_JAM_ZONES = [
  // Eastern Mediterranean / Syria-Turkey
  {
    name: "E. Mediterranean",
    lat: 35.5, lng: 36.0, radius: 300,
    severity: "HIGH",
    source: "RUS/SYR EW",
    desc: "Persistent GPS/GNSS jamming from Russian EW systems in Syria",
  },
  // Ukraine conflict zone
  {
    name: "Ukraine Front",
    lat: 48.5, lng: 37.5, radius: 400,
    severity: "CRITICAL",
    source: "RUS EW",
    desc: "Heavy jamming/spoofing across entire conflict zone",
  },
  // Kaliningrad
  {
    name: "Kaliningrad",
    lat: 54.7, lng: 20.5, radius: 200,
    severity: "HIGH",
    source: "RUS EW",
    desc: "Persistent GNSS interference from Russian exclave",
  },
  // Baltic states
  {
    name: "Baltic Sea",
    lat: 57.5, lng: 22.0, radius: 250,
    severity: "MODERATE",
    source: "RUS EW",
    desc: "Intermittent jamming affecting Baltic air/sea traffic",
  },
  // Iran - Strait of Hormuz
  {
    name: "Strait of Hormuz",
    lat: 26.6, lng: 56.3, radius: 150,
    severity: "HIGH",
    source: "IRN EW",
    desc: "GPS spoofing targeting tankers and naval vessels",
  },
  // Iran interior
  {
    name: "Central Iran",
    lat: 33.0, lng: 52.0, radius: 350,
    severity: "MODERATE",
    source: "IRN IADS",
    desc: "Defensive GNSS denial around nuclear and military sites",
  },
  // North Korea
  {
    name: "Korean DMZ",
    lat: 37.9, lng: 126.8, radius: 200,
    severity: "HIGH",
    source: "DPRK EW",
    desc: "Regular GPS jamming targeting South Korean aviation",
  },
  // Libya / Haftar region
  {
    name: "Eastern Libya",
    lat: 31.0, lng: 20.0, radius: 200,
    severity: "MODERATE",
    source: "UNKNOWN",
    desc: "Intermittent jamming near Benghazi/LNA areas",
  },
  // Black Sea
  {
    name: "Black Sea",
    lat: 43.5, lng: 34.0, radius: 250,
    severity: "HIGH",
    source: "RUS EW",
    desc: "Maritime GPS spoofing affecting commercial shipping",
  },
  // Israel/Gaza
  {
    name: "Israel/Gaza",
    lat: 31.5, lng: 34.5, radius: 100,
    severity: "HIGH",
    source: "IDF/MIL",
    desc: "GPS spoofing for drone defense and airspace denial",
  },
];

// Severity to color mapping
export const jamColor = (severity) =>
  severity === "CRITICAL" ? "#ff0000" :
  severity === "HIGH" ? "#ff6600" :
  severity === "MODERATE" ? "#ffaa00" : "#888888";

// Severity to opacity
export const jamOpacity = (severity) =>
  severity === "CRITICAL" ? 0.18 :
  severity === "HIGH" ? 0.12 :
  severity === "MODERATE" ? 0.08 : 0.05;

import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { REGIONS, REGION_ROTATIONS, MIL_PREFIXES, TARGETS, CITIES, HOT_CITIES, ME_CODES, IRAN_CODE, typeColor, quakeColor, quakeSize } from "./data";
import { decodeTopo } from "./topoDecoder";
import { computeSatPosition, classifySat, fetchSatellites } from "./satellites";
import { fetchEarthquakes } from "./earthquakes";
import { generateShipFleet, shipColor } from "./ships";
import { computeTerminator } from "./terminator";
import { GPS_JAM_ZONES, jamColor, jamOpacity } from "./gpsJamming";
import { FILTERS, FILTER_KEYS } from "./visualFilters";
import { connectAIS, getAISKey, setAISKey, regionToBBoxes } from "./ais";

export default function WorldView() {
  const canvasRef = useRef(null);
  const [region, setRegion] = useState("middleeast");
  const [flights, setFlights] = useState([]);
  const [status, setStatus] = useState("CONNECTING...");
  const [hud, setHud] = useState({ planes: 0, mil: 0, avg: 0 });
  const [panel, setPanel] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const geoRef = useRef(null);
  const flightsRef = useRef([]);
  const satsRef = useRef([]);
  const quakesRef = useRef([]);
  const shipsRef = useRef([]);
  const [satCount, setSatCount] = useState(0);
  const [satStatus, setSatStatus] = useState("");
  const [quakeCount, setQuakeCount] = useState(0);
  const [shipCount, setShipCount] = useState(0);
  const rotRef = useRef({ lng: -50, lat: 25 });
  const zoomRef = useRef(1);
  const dragRef = useRef({ dragging: false, lx: 0, ly: 0, moved: false });
  const [selected, setSelected] = useState(null);
  const projRef = useRef(null);
  const [layers, setLayers] = useState({ flights: true, sats: true, quakes: true, ships: true, terminator: true, gpsJam: true });
  const [utcTime, setUtcTime] = useState("");
  const [visualFilter, setVisualFilter] = useState("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const trailsRef = useRef({}); // { callsign: [{lat,lng,t}, ...] }
  const searchInputRef = useRef(null);
  const [aisKey, setAisKeyState] = useState(getAISKey());
  const [aisStatus, setAisStatus] = useState(getAISKey() ? "CONNECTING" : "SIMULATED");
  const aisInputRef = useRef(null);
  const [aisKeyInput, setAisKeyInput] = useState("");

  // UTC clock
  useEffect(() => {
    const tick = () => { setUtcTime(new Date().toISOString().slice(11, 19) + " UTC"); };
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, []);

  const toggleLayer = useCallback((key) => { setLayers(prev => ({ ...prev, [key]: !prev[key] })); }, []);
  const cycleFilter = useCallback(() => { setVisualFilter(prev => { const idx = FILTER_KEYS.indexOf(prev); return FILTER_KEYS[(idx + 1) % FILTER_KEYS.length]; }); }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      // Skip if typing in search input
      if (e.target.tagName === "INPUT") return;
      const key = e.key;
      // Zoom: + / - or = / -
      if (key === "=" || key === "+") { zoomRef.current = Math.min(3, zoomRef.current + 0.15); e.preventDefault(); }
      if (key === "-") { zoomRef.current = Math.max(0.5, zoomRef.current - 0.15); e.preventDefault(); }
      // Rotate: arrow keys
      if (key === "ArrowLeft") { rotRef.current.lng += 5; e.preventDefault(); }
      if (key === "ArrowRight") { rotRef.current.lng -= 5; e.preventDefault(); }
      if (key === "ArrowUp") { rotRef.current.lat = Math.min(70, rotRef.current.lat + 5); e.preventDefault(); }
      if (key === "ArrowDown") { rotRef.current.lat = Math.max(-70, rotRef.current.lat - 5); e.preventDefault(); }
      // Region: 1-4
      const regionKeys = Object.keys(REGIONS);
      if (key >= "1" && key <= "4") { const k = regionKeys[parseInt(key) - 1]; if (k) { setRegion(k); const rot = REGION_ROTATIONS[k]; if (rot) rotRef.current = { lng: rot.lng, lat: rot.lat }; } }
      // Filter: F key
      if (key === "f" || key === "F") { setVisualFilter(prev => { const idx = FILTER_KEYS.indexOf(prev); return FILTER_KEYS[(idx + 1) % FILTER_KEYS.length]; }); }
      // Search: / key
      if (key === "/") { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }
      // Escape: close search/panel/selected
      if (key === "Escape") { if (searchOpen) { setSearchOpen(false); setSearchQuery(""); } else if (selected) { setSelected(null); } else if (panel) { setPanel(null); } }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, selected, panel]);

  // Fetch map data
  useEffect(() => {
    const urls = ["https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json", "https://unpkg.com/world-atlas@2/countries-110m.json"];
    const tryFetch = async (idx) => { if (idx >= urls.length) return; try { const res = await fetch(urls[idx]); if (!res.ok) throw new Error(); const topo = await res.json(); geoRef.current = decodeTopo(topo); setMapLoaded(true); } catch { tryFetch(idx + 1); } };
    tryFetch(0);
  }, []);

  useEffect(() => { const load = async () => { setSatStatus("Loading..."); const sats = await fetchSatellites(); if (sats.length > 0) { satsRef.current = sats; setSatCount(sats.length); setSatStatus(`${sats.length} SATS`); } else setSatStatus("FAILED"); }; load(); const iv = setInterval(load, 300000); return () => clearInterval(iv); }, []);
  useEffect(() => { const load = async () => { const q = await fetchEarthquakes(); quakesRef.current = q; setQuakeCount(q.length); }; load(); const iv = setInterval(load, 120000); return () => clearInterval(iv); }, []);
  // Ships: live AIS if key present, otherwise simulated fleet
  const aisHandleRef = useRef(null);
  useEffect(() => {
    if (!aisKey) {
      const s = generateShipFleet(18); shipsRef.current = s; setShipCount(s.length); setAisStatus("SIMULATED");
      return;
    }
    // Subscribe to current region bbox (free tier prefers bounded subs)
    const handle = connectAIS({
      key: aisKey,
      bboxes: regionToBBoxes(REGIONS[region]),
      onUpdate: (ships) => { shipsRef.current = ships; setShipCount(ships.length); },
      onStatus: ({ state, msg }) => {
        setAisStatus(state === "connected" ? "LIVE AIS" : state === "connecting" ? "CONNECTING" : state === "error" ? `ERR${msg ? ":" + msg.slice(0, 15) : ""}` : state === "disconnected" ? `DROP ${msg || ""}`.trim() : state.toUpperCase());
      },
    });
    aisHandleRef.current = handle;
    return () => { handle.close(); aisHandleRef.current = null; };
  }, [aisKey]);

  // Update AIS subscription when region changes (no reconnect)
  useEffect(() => {
    if (aisHandleRef.current) {
      aisHandleRef.current.updateBBoxes(regionToBBoxes(REGIONS[region]));
      shipsRef.current = []; setShipCount(0);
    }
  }, [region]);

  const saveAisKey = () => { const k = aisKeyInput.trim(); setAISKey(k); setAisKeyState(k); setAisKeyInput(""); };
  const clearAisKey = () => { setAISKey(""); setAisKeyState(""); shipsRef.current = []; setShipCount(0); setAisStatus("SIMULATED"); };

  // Fetch flights + record trails
  const fetchFlights = useCallback(async () => {
    try {
      setStatus("FETCHING...");
      const r = REGIONS[region];
      const res = await fetch(`https://opensky-network.org/api/states/all?lamin=${r.lamin}&lomin=${r.lomin}&lamax=${r.lamax}&lomax=${r.lomax}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.states?.length) {
        const fl = data.states.filter(s => s[5] != null && s[6] != null && !s[8]).map(s => ({
          cs: (s[1]||"").trim(), lat: s[6], lng: s[5], alt: s[7]||s[13]||0, vel: s[9]||0, hdg: s[10]||0,
        }));
        setFlights(fl); flightsRef.current = fl; setStatus(`LIVE ${fl.length}`);
        // Record trails (keep last 20 points per callsign)
        const now = Date.now();
        const trails = trailsRef.current;
        fl.forEach(f => {
          if (!f.cs) return;
          if (!trails[f.cs]) trails[f.cs] = [];
          const arr = trails[f.cs];
          if (arr.length === 0 || now - arr[arr.length - 1].t > 10000) {
            arr.push({ lat: f.lat, lng: f.lng, t: now });
            if (arr.length > 20) arr.shift();
          }
        });
        const alts = fl.map(f => f.alt).filter(a => a > 0);
        const mil = fl.filter(f => !f.cs || MIL_PREFIXES.some(p => f.cs.startsWith(p)) || (f.alt > 0 && f.alt < 1500 && f.vel > 150)).length;
        setHud({ planes: fl.length, mil, avg: alts.length ? Math.round(alts.reduce((a,b)=>a+b)/alts.length) : 0 });
      } else setStatus("NO DATA");
    } catch (e) { setStatus(`ERR: ${e.message.slice(0,20)}`); }
  }, [region]);

  useEffect(() => { fetchFlights(); const iv = setInterval(fetchFlights, 15000); return () => clearInterval(iv); }, [fetchFlights]);

  // Search results
  const searchResults = searchQuery.length >= 2 ? [
    ...flightsRef.current.filter(f => f.cs && f.cs.toUpperCase().includes(searchQuery.toUpperCase())).slice(0, 5).map(f => ({ type: "flight", label: f.cs || "UNKNOWN", sub: `ALT ${Math.round(f.alt)}m SPD ${Math.round(f.vel)}m/s`, data: f })),
    ...satsRef.current.filter(s => (s.OBJECT_NAME || "").toUpperCase().includes(searchQuery.toUpperCase())).slice(0, 5).map(s => ({ type: "sat", label: s.OBJECT_NAME, sub: `NORAD ${s.NORAD_CAT_ID}`, data: s })),
  ] : [];

  // ── Render loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId, autoT = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      autoT += 0.012;
      const F = FILTERS[visualFilter];
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      const rot = rotRef.current;
      const rLng = rot.lng - (dragRef.current.dragging ? 0 : autoT * 0.12);
      const rLat = rot.lat;
      const Z = zoomRef.current;
      const R = Math.min(w, h) * 0.4 * Z;
      const cx = w / 2, cy = h / 2;
      const projection = d3.geoOrthographic().scale(R).translate([cx, cy]).rotate([-rLng, -rLat, 0]).clipAngle(90);
      const path = d3.geoPath(projection, ctx);
      projRef.current = { rLng, rLat, R, cx, cy, Z, projection };

      ctx.fillStyle = F.bg; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) { const sx = (Math.sin(i*127.1+33)*0.5+0.5)*w; const sy = (Math.sin(i*311.7+77)*0.5+0.5)*h; ctx.fillStyle = `rgba(${F.star[0]},${F.star[1]},${F.star[2]},${0.15+0.2*Math.sin(autoT*0.5+i)})`; ctx.fillRect(sx, sy, 1, 1); }
      const g1 = ctx.createRadialGradient(cx, cy, R*0.92, cx, cy, R*1.15); g1.addColorStop(0, "transparent"); g1.addColorStop(0.5, F.atmoColor); g1.addColorStop(1, "transparent"); ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(cx, cy, R*1.15, 0, Math.PI*2); ctx.fill();
      const gO = ctx.createRadialGradient(cx-R*0.2, cy-R*0.2, 0, cx, cy, R); gO.addColorStop(0, F.ocean[0]); gO.addColorStop(1, F.ocean[1]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fillStyle = gO; ctx.fill(); ctx.strokeStyle = F.globeEdge; ctx.lineWidth = 1.5; ctx.stroke();
      const graticule = d3.geoGraticule().step([15, 15]); ctx.beginPath(); path(graticule()); ctx.strokeStyle = F.graticule; ctx.lineWidth = 0.4; ctx.stroke();

      const geo = geoRef.current;
      if (geo) { geo.features.forEach(f => { const id = f.properties.id; ctx.beginPath(); path(f); if (id === IRAN_CODE) { ctx.fillStyle = F.iranFill; ctx.fill(); ctx.strokeStyle = F.iranStroke; ctx.lineWidth = 2; ctx.stroke(); } else if (ME_CODES.includes(id)) { ctx.fillStyle = F.meLand; ctx.fill(); ctx.strokeStyle = F.meStroke; ctx.lineWidth = 0.8; ctx.stroke(); } else { ctx.fillStyle = F.land; ctx.fill(); ctx.strokeStyle = F.landStroke; ctx.lineWidth = 0.5; ctx.stroke(); } }); }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.strokeStyle = F.globeEdge; ctx.lineWidth = 1; ctx.stroke();

      if (layers.terminator) { try { const term = computeTerminator(Date.now()); const nightGeo = { type: "Feature", geometry: { type: "Polygon", coordinates: [[ ...term.points.map(([lng, lat]) => [lng, lat]), [180, term.declination > 0 ? -90 : 90], [-180, term.declination > 0 ? -90 : 90] ]] } }; ctx.beginPath(); path(nightGeo); ctx.fillStyle = "rgba(0,0,15,0.35)"; ctx.fill(); const termLine = { type: "Feature", geometry: { type: "LineString", coordinates: term.points } }; ctx.beginPath(); path(termLine); ctx.strokeStyle = "rgba(255,180,50,0.15)"; ctx.lineWidth = 1.5; ctx.stroke(); } catch {} }

      if (layers.gpsJam) { GPS_JAM_ZONES.forEach(zone => { const p = projection([zone.lng, zone.lat]); if (!p) return; const d = d3.geoDistance([zone.lng, zone.lat], [rLng, rLat]); if (d > Math.PI / 2) return; const col = jamColor(zone.severity); const opa = jamOpacity(zone.severity); const degR = zone.radius / 111; const pxR = degR * R * Math.PI / 180; const pulseR = pxR * (0.9 + 0.1 * Math.sin(autoT * 2)); ctx.beginPath(); ctx.arc(p[0], p[1], pulseR, 0, Math.PI*2); ctx.fillStyle = col + Math.round(opa*255).toString(16).padStart(2,"0"); ctx.fill(); ctx.beginPath(); ctx.arc(p[0], p[1], pulseR, 0, Math.PI*2); ctx.strokeStyle = col+"55"; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(p[0], p[1], pulseR*1.2, 0, Math.PI*2); ctx.strokeStyle = col+"33"; ctx.lineWidth = 0.5; ctx.stroke(); ctx.setLineDash([]); if (Z > 0.7) { ctx.font = "bold 7px monospace"; ctx.fillStyle = col+"bb"; ctx.fillText("GPS JAM", p[0]-18, p[1]-pulseR-4); ctx.font = "6px monospace"; ctx.fillStyle = col+"88"; ctx.fillText(zone.name, p[0]-18, p[1]-pulseR-13); } }); }

      CITIES.forEach(([lat, lng, name]) => { const p = projection([lng, lat]); if (!p) return; if (d3.geoDistance([lng, lat], [rLng, rLat]) > Math.PI/2) return; ctx.beginPath(); ctx.arc(p[0], p[1], 2, 0, Math.PI*2); ctx.fillStyle = F.cityColor; ctx.fill(); if (Z > 0.8) { ctx.font = "8px monospace"; ctx.fillStyle = F.cityText; ctx.fillText(name, p[0]+4, p[1]+3); } });
      HOT_CITIES.forEach(([lat, lng, name]) => { const p = projection([lng, lat]); if (!p) return; if (d3.geoDistance([lng, lat], [rLng, rLat]) > Math.PI/2) return; ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI*2); ctx.fillStyle = F.hotCity; ctx.fill(); if (Z > 0.7) { ctx.font = "bold 9px monospace"; ctx.fillStyle = F.hotText; ctx.fillText(name, p[0]+5, p[1]+3); } });

      TARGETS.forEach(t => { const p = projection([t.lng, t.lat]); if (!p) return; if (d3.geoDistance([t.lng, t.lat], [rLng, rLat]) > Math.PI/2) return; const pulse = 5+3*Math.sin(autoT*2.5); const col = typeColor(t.type); ctx.beginPath(); ctx.arc(p[0], p[1], pulse, 0, Math.PI*2); ctx.strokeStyle = col+"88"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.beginPath(); ctx.arc(p[0], p[1], pulse*1.5, 0, Math.PI*2); ctx.strokeStyle = col+"33"; ctx.lineWidth = 0.8; ctx.stroke(); ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, Math.PI*2); ctx.fillStyle = col; ctx.fill(); });

      // ── Flight trails ──
      if (layers.flights) {
        const trails = trailsRef.current;
        Object.entries(trails).forEach(([cs, pts]) => {
          if (pts.length < 2) return;
          const isMil = MIL_PREFIXES.some(x => cs.startsWith(x));
          ctx.beginPath();
          let started = false;
          pts.forEach((pt, idx) => {
            const p = projection([pt.lng, pt.lat]);
            if (!p) return;
            const d = d3.geoDistance([pt.lng, pt.lat], [rLng, rLat]);
            if (d > Math.PI / 2) { started = false; return; }
            if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
            else ctx.lineTo(p[0], p[1]);
          });
          const alpha = isMil ? "44" : "22";
          ctx.strokeStyle = (isMil ? "#ff4444" : "#00ccff") + alpha;
          ctx.lineWidth = isMil ? 1.2 : 0.6;
          ctx.stroke();
        });

        // Flight dots
        flightsRef.current.forEach(f => {
          const p = projection([f.lng, f.lat]); if (!p) return;
          if (d3.geoDistance([f.lng, f.lat], [rLng, rLat]) > Math.PI/2) return;
          const isMil = !f.cs || MIL_PREFIXES.some(x => f.cs.startsWith(x)) || (f.alt>0&&f.alt<1500&&f.vel>150);
          // Highlight searched flight
          const isSearched = searchQuery.length >= 2 && f.cs && f.cs.toUpperCase().includes(searchQuery.toUpperCase());
          const sz = isSearched ? 5 : (isMil ? 3 : 1.5);
          ctx.beginPath(); ctx.arc(p[0], p[1], sz, 0, Math.PI*2);
          ctx.fillStyle = isSearched ? "#ffffff" : (isMil ? "#ff4444" : "#00ccff77"); ctx.fill();
          if (isSearched) { ctx.beginPath(); ctx.arc(p[0], p[1], sz + 4, 0, Math.PI*2); ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.font = "bold 9px monospace"; ctx.fillStyle = "#fff"; ctx.fillText(f.cs, p[0]+sz+4, p[1]+3); }
          else if (isMil && f.hdg) { const h = f.hdg*Math.PI/180; const ep = projection([f.lng+Math.sin(h)*1.5, f.lat+Math.cos(h)*1.5]); if (ep) { ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(ep[0],ep[1]); ctx.strokeStyle="#ff444466"; ctx.lineWidth=1; ctx.stroke(); } }
        });
      }

      // Satellites
      if (layers.sats) {
        const now = Date.now(); const sats = satsRef.current;
        sats.forEach((sat, si) => { if (si > 20) return; try { const trace = []; const period = 1440/sat.MEAN_MOTION; for (let i = 0; i <= 40; i++) { const t = now+(i/40)*period*60000; const pos = computeSatPosition(sat, t); if (pos&&!isNaN(pos.lat)&&!isNaN(pos.lng)) trace.push(pos); } if (trace.length > 2) { ctx.beginPath(); let started = false; trace.forEach(pt => { const p = projection([pt.lng, pt.lat]); const d = d3.geoDistance([pt.lng, pt.lat], [rLng, rLat]); if (p&&d<Math.PI/2) { if (!started) { ctx.moveTo(p[0],p[1]); started=true; } else ctx.lineTo(p[0],p[1]); } else started=false; }); ctx.strokeStyle = sat.OBJECT_TYPE==="PAYLOAD" ? "#aa44ff18" : "#44aaff12"; ctx.lineWidth = 0.6; ctx.stroke(); } } catch {} });
        sats.forEach(sat => { try { const pos = computeSatPosition(sat, now); if (!pos||isNaN(pos.lat)||isNaN(pos.lng)) return; const p = projection([pos.lng, pos.lat]); if (!p) return; if (d3.geoDistance([pos.lng, pos.lat], [rLng, rLat])>Math.PI/2) return; const cls = classifySat(sat.OBJECT_NAME); const isSearched = searchQuery.length >= 2 && (sat.OBJECT_NAME||"").toUpperCase().includes(searchQuery.toUpperCase()); const sz = isSearched ? 6 : cls.size; ctx.beginPath(); ctx.arc(p[0], p[1], sz+2, 0, Math.PI*2); ctx.fillStyle = (isSearched ? "#ffffff" : cls.color) + "22"; ctx.fill(); ctx.beginPath(); ctx.arc(p[0], p[1], sz, 0, Math.PI*2); ctx.fillStyle = isSearched ? "#ffffff" : cls.color; ctx.fill(); if (isSearched) { ctx.beginPath(); ctx.arc(p[0], p[1], sz+5, 0, Math.PI*2); ctx.strokeStyle = "#ffffff66"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.font = "bold 8px monospace"; ctx.fillStyle = "#fff"; ctx.fillText(sat.OBJECT_NAME, p[0]+sz+4, p[1]+3); } else if ((cls.isMil||cls.isRecon||cls.isISS)&&Z>0.7) { ctx.font = "bold 7px monospace"; ctx.fillStyle = cls.color+"99"; ctx.fillText(sat.OBJECT_NAME||"", p[0]+cls.size+3, p[1]+2); } } catch {} });
      }

      // Earthquakes
      if (layers.quakes) { quakesRef.current.forEach(q => { const p = projection([q.lng, q.lat]); if (!p) return; if (d3.geoDistance([q.lng, q.lat], [rLng, rLat])>Math.PI/2) return; const sz = quakeSize(q.mag); const col = quakeColor(q.mag); ctx.beginPath(); ctx.arc(p[0], p[1], sz+3*Math.sin(autoT*3), 0, Math.PI*2); ctx.strokeStyle = col+"55"; ctx.lineWidth = 1; ctx.stroke(); ctx.beginPath(); ctx.arc(p[0], p[1], sz, 0, Math.PI*2); ctx.fillStyle = col; ctx.fill(); if (q.mag >= 4 && Z > 0.7) { ctx.font = "bold 7px monospace"; ctx.fillStyle = col+"bb"; ctx.fillText(`M${q.mag.toFixed(1)}`, p[0]+sz+3, p[1]+2); } }); }

      // Ships
      if (layers.ships) { shipsRef.current.forEach(s => { const p = projection([s.lng, s.lat]); if (!p) return; if (d3.geoDistance([s.lng, s.lat], [rLng, rLat])>Math.PI/2) return; const col = shipColor(s.type); const sz = s.type==="NAVAL"?3.5:2.5; ctx.beginPath(); ctx.moveTo(p[0],p[1]-sz); ctx.lineTo(p[0]+sz*0.7,p[1]); ctx.lineTo(p[0],p[1]+sz); ctx.lineTo(p[0]-sz*0.7,p[1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); if (s.hdg) { const h=s.hdg*Math.PI/180; const ep = projection([s.lng+Math.sin(h)*0.8, s.lat+Math.cos(h)*0.8]); if (ep) { ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(ep[0],ep[1]); ctx.strokeStyle=col+"66"; ctx.lineWidth=0.8; ctx.stroke(); } } if (s.type==="NAVAL"&&Z>0.9) { ctx.font="bold 7px monospace"; ctx.fillStyle=col+"99"; ctx.fillText(s.name,p[0]+5,p[1]+2); } }); }

      const g2 = ctx.createRadialGradient(cx-R*0.3,cy-R*0.3,0,cx,cy,R); g2.addColorStop(0, F.reflection); g2.addColorStop(1, "transparent"); ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fillStyle = g2; ctx.fill();
      ctx.strokeStyle = F.crosshair; ctx.lineWidth = 0.8; [[cx,cy-22,cx,cy-8],[cx,cy+8,cx,cy+22],[cx-22,cy,cx-8,cy],[cx+8,cy,cx+22,cy]].forEach(([x1,y1,x2,y2]) => { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
    };
    render();
    return () => { cancelAnimationFrame(animId); };
  }, [mapLoaded, layers, visualFilter, searchQuery]);

  // ── Interaction handlers ──
  const lastDistRef = useRef(0);
  const handleDown = (e) => { const touch = e.touches?.[0]; dragRef.current.dragging = true; dragRef.current.moved = false; dragRef.current.lx = touch?.clientX ?? e.clientX; dragRef.current.ly = touch?.clientY ?? e.clientY; dragRef.current.startX = dragRef.current.lx; dragRef.current.startY = dragRef.current.ly; if (e.touches?.length === 2) { const dx = e.touches[0].clientX-e.touches[1].clientX; const dy = e.touches[0].clientY-e.touches[1].clientY; lastDistRef.current = Math.sqrt(dx*dx+dy*dy); } };
  const handleUp = (e) => {
    const wasDrag = dragRef.current.moved; dragRef.current.dragging = false;
    if (!wasDrag && projRef.current) {
      const touch = e.changedTouches?.[0]; const tapX = touch?.clientX ?? e.clientX ?? dragRef.current.startX; const tapY = touch?.clientY ?? e.clientY ?? dragRef.current.startY;
      const { rLng, rLat } = projRef.current; const proj2 = d3.geoOrthographic().scale(projRef.current.R).translate([projRef.current.cx, projRef.current.cy]).rotate([-rLng, -rLat, 0]).clipAngle(90);
      let bestDist = 25, bestItem = null;
      if (layers.flights) { flightsRef.current.forEach(f => { const p = proj2([f.lng,f.lat]); if (!p) return; if (d3.geoDistance([f.lng,f.lat],[rLng,rLat])>Math.PI/2) return; const dist = Math.sqrt((p[0]-tapX)**2+(p[1]-tapY)**2); if (dist<bestDist) { bestDist=dist; const isMil = !f.cs||MIL_PREFIXES.some(x=>f.cs.startsWith(x))||(f.alt>0&&f.alt<1500&&f.vel>150); bestItem={type:"flight",data:f,isMil,x:tapX,y:tapY}; } }); }
      if (layers.sats) { const now = Date.now(); satsRef.current.forEach(sat => { try { const pos = computeSatPosition(sat,now); if (!pos||isNaN(pos.lat)||isNaN(pos.lng)) return; const p = proj2([pos.lng,pos.lat]); if (!p) return; if (d3.geoDistance([pos.lng,pos.lat],[rLng,rLat])>Math.PI/2) return; const dist = Math.sqrt((p[0]-tapX)**2+(p[1]-tapY)**2); if (dist<bestDist) { bestDist=dist; bestItem={type:"sat",data:sat,pos,x:tapX,y:tapY}; } } catch {} }); }
      if (layers.quakes) { quakesRef.current.forEach(q => { const p = proj2([q.lng,q.lat]); if (!p) return; if (d3.geoDistance([q.lng,q.lat],[rLng,rLat])>Math.PI/2) return; const dist = Math.sqrt((p[0]-tapX)**2+(p[1]-tapY)**2); if (dist<bestDist) { bestDist=dist; bestItem={type:"quake",data:q,x:tapX,y:tapY}; } }); }
      if (layers.ships) { shipsRef.current.forEach(s => { const p = proj2([s.lng,s.lat]); if (!p) return; if (d3.geoDistance([s.lng,s.lat],[rLng,rLat])>Math.PI/2) return; const dist = Math.sqrt((p[0]-tapX)**2+(p[1]-tapY)**2); if (dist<bestDist) { bestDist=dist; bestItem={type:"ship",data:s,x:tapX,y:tapY}; } }); }
      if (layers.gpsJam) { GPS_JAM_ZONES.forEach(z => { const p = proj2([z.lng,z.lat]); if (!p) return; if (d3.geoDistance([z.lng,z.lat],[rLng,rLat])>Math.PI/2) return; const dist = Math.sqrt((p[0]-tapX)**2+(p[1]-tapY)**2); if (dist<bestDist) { bestDist=dist; bestItem={type:"gpsJam",data:z,x:tapX,y:tapY}; } }); }
      if (bestItem) setSelected(bestItem); else setSelected(null);
    }
  };
  const handleMove = (e) => { if (!dragRef.current.dragging) return; const touch = e.touches?.[0]; const x = touch?.clientX ?? e.clientX; const y = touch?.clientY ?? e.clientY; if (Math.abs(x-dragRef.current.startX)>5||Math.abs(y-dragRef.current.startY)>5) { dragRef.current.moved=true; setSelected(null); } rotRef.current.lng -= (x-dragRef.current.lx)*0.25; rotRef.current.lat += (y-dragRef.current.ly)*0.25; rotRef.current.lat = Math.max(-70, Math.min(70, rotRef.current.lat)); dragRef.current.lx=x; dragRef.current.ly=y; if (e.touches?.length===2) { const tdx=e.touches[0].clientX-e.touches[1].clientX; const tdy=e.touches[0].clientY-e.touches[1].clientY; const dist=Math.sqrt(tdx*tdx+tdy*tdy); if (lastDistRef.current>0) zoomRef.current=Math.max(0.5,Math.min(3,zoomRef.current*(dist/lastDistRef.current))); lastDistRef.current=dist; } };
  const handleWheel = (e) => { zoomRef.current = Math.max(0.5, Math.min(3, zoomRef.current - e.deltaY * 0.001)); };
  const changeRegion = useCallback((k) => { setRegion(k); const rot = REGION_ROTATIONS[k]; if (rot) rotRef.current = { lng: rot.lng, lat: rot.lat }; }, []);

  const selectSearchResult = (r) => {
    if (r.type === "flight") { setSelected({ type: "flight", data: r.data, isMil: MIL_PREFIXES.some(x => r.data.cs?.startsWith(x)), x: window.innerWidth / 2, y: 200 }); rotRef.current = { lng: -r.data.lng, lat: r.data.lat }; }
    else if (r.type === "sat") { const pos = computeSatPosition(r.data, Date.now()); setSelected({ type: "sat", data: r.data, pos, x: window.innerWidth / 2, y: 200 }); if (pos) rotRef.current = { lng: -pos.lng, lat: pos.lat }; }
    setSearchOpen(false); setSearchQuery("");
  };

  const isLive = status.includes("LIVE");
  const F = FILTERS[visualFilter];

  return (
    <div style={{ width: "100vw", height: "100vh", background: F.bg, position: "relative", overflow: "hidden", fontFamily: "'Courier New',monospace", userSelect: "none" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", position: "absolute", top: 0, left: 0, zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 80, zIndex: 1, touchAction: "none" }}
        onMouseDown={handleDown} onMouseUp={handleUp} onMouseMove={handleMove} onMouseLeave={handleUp}
        onTouchStart={handleDown} onTouchEnd={handleUp} onTouchMove={handleMove} onWheel={handleWheel} />
      {!mapLoaded && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 25, color: F.color, fontSize: 13 }} className="blink">Loading world map...</div>}

      {/* TOP BAR */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "8px 12px", background: `linear-gradient(180deg,${F.bg}dd,transparent)`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: F.color, fontSize: 17, fontWeight: "bold", letterSpacing: 4 }}>WORLDVIEW</div>
          <div style={{ color: "#00ffaa66", fontSize: 9, letterSpacing: 2 }}>LIVE OSINT</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: F.color, fontSize: 16, fontWeight: "bold", letterSpacing: 3 }}>{utcTime}</div>
          <div style={{ color: "#1a3a5c", fontSize: 9 }}>{new Date().toISOString().slice(0, 10)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: isLive ? "#00ffaa" : "#ffaa00", fontSize: 13, fontWeight: "bold" }}>{status}</div>
          <div style={{ color: "#ff2200", fontSize: 11 }} className="blink">CRITICAL</div>
        </div>
      </div>

      {/* SEARCH BAR */}
      {searchOpen && (
        <div className="fade-in" style={{ position: "absolute", top: 48, left: "50%", transform: "translateX(-50%)", zIndex: 100, width: 280 }}>
          <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search callsign or satellite..."
            style={{ width: "100%", padding: "8px 12px", background: F.bg + "ee", border: `1px solid ${F.color}`, borderRadius: 4, color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", backdropFilter: "blur(8px)" }} />
          {searchResults.length > 0 && (
            <div style={{ background: F.bg + "f5", border: `1px solid ${F.color}44`, borderTop: "none", borderRadius: "0 0 4px 4px", maxHeight: 200, overflowY: "auto" }}>
              {searchResults.map((r, i) => (
                <div key={i} onClick={() => selectSearchResult(r)}
                  style={{ padding: "6px 12px", borderBottom: "1px solid #1a3a5c22", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.background = F.color + "22"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <div style={{ color: r.type === "flight" ? "#00ccff" : "#aa44ff", fontSize: 12, fontWeight: "bold" }}>{r.label}</div>
                    <div style={{ color: "#1a3a5c", fontSize: 9 }}>{r.sub}</div>
                  </div>
                  <span style={{ color: "#1a3a5c", fontSize: 9 }}>{r.type === "flight" ? "FLT" : "SAT"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* LAYER TOGGLES + FILTER + SEARCH BUTTON */}
      <div style={{ position: "absolute", top: 50, right: 8, zIndex: 10, display: "flex", flexDirection: "column", gap: 3 }}>
        <div onClick={() => { setSearchOpen(o => !o); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50); }}
          style={{ background: searchOpen ? F.color+"33" : "#1a3a5c11", border: `1px solid ${searchOpen ? F.color : "#1a3a5c33"}`, color: searchOpen ? F.color : "#1a3a5c55", fontSize: 9, padding: "3px 6px", borderRadius: 3, textAlign: "center", cursor: "pointer", letterSpacing: 1 }}>/</div>
        {[["flights","FLT","#00ccff"],["sats","SAT","#aa44ff"],["quakes","QKE","#ffaa00"],["ships","SHP","#44ddaa"],["gpsJam","GPS","#ff6600"],["terminator","D/N","#ff9944"]].map(([k,l,c]) => (
          <div key={k} onClick={() => toggleLayer(k)}
            style={{ background: layers[k] ? c+"33" : "#1a3a5c11", border: `1px solid ${layers[k] ? c : "#1a3a5c33"}`, color: layers[k] ? c : "#1a3a5c55", fontSize: 9, padding: "3px 6px", borderRadius: 3, textAlign: "center", cursor: "pointer", letterSpacing: 1 }}>{l}</div>
        ))}
        <div style={{ marginTop: 2, borderTop: "1px solid #1a3a5c33", paddingTop: 3 }} />
        <div onClick={cycleFilter}
          style={{ background: F.color+"33", border: `1px solid ${F.color}`, color: F.color, fontSize: 9, padding: "4px 6px", borderRadius: 3, textAlign: "center", cursor: "pointer", letterSpacing: 1, fontWeight: "bold" }}>{F.label}</div>
      </div>

      {/* KEYBOARD HINTS - bottom left */}
      <div style={{ position: "fixed", bottom: 90, left: 8, zIndex: 5, color: "#1a3a5c44", fontSize: 8, lineHeight: 1.6 }}>
        <div>+/- zoom</div>
        <div>arrows rotate</div>
        <div>1-4 regions</div>
        <div>F filter</div>
        <div>/ search</div>
      </div>

      {/* SELECTED ITEM POPUP */}
      {selected && (
        <div className="fade-in" style={{ position: "fixed", top: selected.y < 200 ? selected.y + 20 : selected.y - 180, left: Math.max(8, Math.min(selected.x - 120, window.innerWidth - 260)), zIndex: 9998, background: F.bg + "ee", border: `1px solid ${selected.type === "flight" ? (selected.isMil ? "#ff4444" : "#00ccff") : selected.type === "sat" ? "#aa44ff" : selected.type === "quake" ? "#ffaa00" : selected.type === "gpsJam" ? "#ff6600" : "#44ddaa"}`, borderRadius: 6, padding: "12px 14px", width: 250, backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: selected.type === "flight" ? (selected.isMil ? "#ff4444" : "#00ccff") : selected.type === "sat" ? "#aa44ff" : selected.type === "quake" ? "#ffaa00" : selected.type === "gpsJam" ? "#ff6600" : "#44ddaa", fontSize: 13, fontWeight: "bold", letterSpacing: 1 }}>
              {selected.type === "flight" ? (selected.isMil ? "MIL SUSPECT" : "COMMERCIAL") : selected.type === "sat" ? "SATELLITE" : selected.type === "quake" ? "EARTHQUAKE" : selected.type === "gpsJam" ? "GPS JAMMING" : "VESSEL"}
            </span>
            <div onClick={() => setSelected(null)} style={{ color: "#556", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>x</div>
          </div>
          {selected.type === "flight" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>CALLSIGN</span><span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{selected.data.cs || "UNKNOWN"}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>ALTITUDE</span><span style={{ color: "#00ffaa", fontSize: 12 }}>{Math.round(selected.data.alt).toLocaleString()}m ({Math.round(selected.data.alt * 3.281).toLocaleString()}ft)</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>SPEED</span><span style={{ color: "#00aaff", fontSize: 12 }}>{Math.round(selected.data.vel)}m/s ({Math.round(selected.data.vel * 3.6)}km/h)</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>HEADING</span><span style={{ color: "#00aaff", fontSize: 12 }}>{Math.round(selected.data.hdg)}deg</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>POSITION</span><span style={{ color: "#778", fontSize: 11 }}>{selected.data.lat.toFixed(3)}N {selected.data.lng.toFixed(3)}E</span>
            </div>
          )}
          {selected.type === "sat" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>NAME</span><span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{selected.data.OBJECT_NAME}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>NORAD ID</span><span style={{ color: "#aa44ff", fontSize: 12 }}>{selected.data.NORAD_CAT_ID}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>ORBIT</span><span style={{ color: "#00ffaa", fontSize: 12 }}>{Math.round(1440 / selected.data.MEAN_MOTION)} min</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>INCLINATION</span><span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.INCLINATION?.toFixed(1)}deg</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>ALTITUDE</span><span style={{ color: "#ffaa00", fontSize: 12 }}>{selected.pos?.alt ? Math.round(selected.pos.alt).toLocaleString() + " km" : "N/A"}</span>
            </div>
          )}
          {selected.type === "quake" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>MAGNITUDE</span><span style={{ color: "#ff6600", fontSize: 14, fontWeight: "bold" }}>M{selected.data.mag.toFixed(1)}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>LOCATION</span><span style={{ color: "#fff", fontSize: 11 }}>{selected.data.place}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>DEPTH</span><span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.depth?.toFixed(1)} km</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>TIME</span><span style={{ color: "#778", fontSize: 11 }}>{new Date(selected.data.time).toUTCString()}</span>
            </div>
          )}
          {selected.type === "gpsJam" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>ZONE</span><span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{selected.data.name}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>SEVERITY</span><span style={{ color: jamColor(selected.data.severity), fontSize: 13, fontWeight: "bold" }}>{selected.data.severity}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>RADIUS</span><span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.radius} km</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>SOURCE</span><span style={{ color: "#ff6600", fontSize: 12 }}>{selected.data.source}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>DETAILS</span><span style={{ color: "#778", fontSize: 10 }}>{selected.data.desc}</span>
            </div>
          )}
          {selected.type === "ship" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>NAME</span><span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{selected.data.name}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>TYPE</span><span style={{ color: "#44ddaa", fontSize: 12 }}>{selected.data.type}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>FLAG</span><span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.flag}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>SPEED</span><span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.speed.toFixed(1)} kn</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>LENGTH</span><span style={{ color: "#778", fontSize: 12 }}>{selected.data.length}m</span>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM BAR */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: F.bg, borderTop: "1px solid #1a3a5c33", padding: "6px 10px" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 6 }}>
          {Object.entries(REGIONS).map(([k, v]) => (
            <div key={k} onClick={() => changeRegion(k)} style={{ background: region === k ? F.color : "#1a3a5c33", border: `1px solid ${region === k ? F.color : "#1a3a5c55"}`, color: region === k ? "#fff" : "#1a3a5c", fontSize: 12, padding: "6px 14px", borderRadius: 3, fontFamily: "inherit", fontWeight: region === k ? "bold" : "normal", textAlign: "center", cursor: "pointer" }}>{v.label}</div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", gap: 4 }}>
          {[["data","DATA","#00aaff"],["targets","TARGETS","#ff4444"],["sats","SATS","#aa44ff"],["quakes","QUAKES","#ffaa00"],["ships","SHIPS","#44ddaa"],["gpsJam","GPS JAM","#ff6600"],["legend","INFO","#00ffaa"]].map(([k,l,c]) => (
            <div key={k} onClick={() => setPanel(p => p === k ? null : k)} style={{ flex: 1, background: panel === k ? c+"33" : "#1a3a5c22", border: `1px solid ${panel === k ? c : "#1a3a5c44"}`, color: panel === k ? c : "#1a3a5c", fontSize: 9, padding: "7px 2px", borderRadius: 3, fontFamily: "inherit", textAlign: "center", cursor: "pointer" }}>{l}</div>
          ))}
        </div>
      </div>

      {/* PANEL: DATA */}
      {panel === "data" && (
        <div className="slide-up" style={{ position: "fixed", bottom: 82, left: 8, right: 8, zIndex: 9997, background: F.bg + "ee", border: "1px solid #00aaff", borderRadius: 6, padding: "10px 12px", maxHeight: "45vh", overflowY: "auto", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#00aaff", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>TACTICAL DATA</span>
            <div onClick={() => setPanel(null)} style={{ color: "#556", fontSize: 16, cursor: "pointer" }}>x</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
            <div style={{ background: "#00aaff11", padding: "8px 10px", border: "1px solid #00aaff33", borderRadius: 3 }}>
              <div style={{ color: "#1a3a5c", fontSize: 9 }}>TOTAL TRACKS</div>
              <div style={{ color: "#00ccff", fontSize: 22, fontWeight: "bold" }}>{hud.planes}</div>
            </div>
            <div style={{ background: "#ff444411", padding: "8px 10px", border: "1px solid #ff444433", borderRadius: 3 }}>
              <div style={{ color: "#1a3a5c", fontSize: 9 }}>MIL SUSPECTED</div>
              <div style={{ color: "#ff4444", fontSize: 22, fontWeight: "bold" }}>{hud.mil}</div>
            </div>
            <div style={{ background: "#00ffaa11", padding: "8px 10px", border: "1px solid #00ffaa33", borderRadius: 3 }}>
              <div style={{ color: "#1a3a5c", fontSize: 9 }}>AVG ALTITUDE</div>
              <div style={{ color: "#00ffaa", fontSize: 18, fontWeight: "bold" }}>{hud.avg.toLocaleString()} m</div>
            </div>
            <div style={{ background: "#aa44ff11", padding: "8px 10px", border: "1px solid #aa44ff33", borderRadius: 3 }}>
              <div style={{ color: "#1a3a5c", fontSize: 9 }}>SATELLITES</div>
              <div style={{ color: "#aa44ff", fontSize: 22, fontWeight: "bold" }}>{satCount}</div>
            </div>
            <div style={{ background: "#ffaa0011", padding: "8px 10px", border: "1px solid #ffaa0033", borderRadius: 3 }}>
              <div style={{ color: "#1a3a5c", fontSize: 9 }}>QUAKES (24h)</div>
              <div style={{ color: "#ffaa00", fontSize: 22, fontWeight: "bold" }}>{quakeCount}</div>
            </div>
            <div style={{ background: "#44ddaa11", padding: "8px 10px", border: "1px solid #44ddaa33", borderRadius: 3 }}>
              <div style={{ color: "#1a3a5c", fontSize: 9 }}>SHIPS TRACKED</div>
              <div style={{ color: "#44ddaa", fontSize: 22, fontWeight: "bold" }}>{shipCount}</div>
            </div>
          </div>
          <div style={{ marginTop: 8, color: "#1a3a5c", fontSize: 10, borderTop: "1px solid #1a3a5c33", paddingTop: 6 }}>
            REGION: {REGIONS[region].label} &nbsp;|&nbsp; FILTER: {F.label} &nbsp;|&nbsp; UPDATE: every 15s
          </div>
        </div>
      )}

      {/* PANEL: TARGETS */}
      {panel === "targets" && (
        <div className="slide-up" style={{ position: "fixed", bottom: 82, left: 8, right: 8, zIndex: 9997, background: F.bg + "ee", border: "1px solid #ff4444", borderRadius: 6, padding: "10px 12px", maxHeight: "45vh", overflowY: "auto", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#ff4444", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>HIGH VALUE TARGETS</span>
            <div onClick={() => setPanel(null)} style={{ color: "#556", fontSize: 16, cursor: "pointer" }}>x</div>
          </div>
          {TARGETS.map(t => (
            <div key={t.name} onClick={() => { rotRef.current = { lng: -t.lng, lat: t.lat }; }}
              style={{ padding: "6px 8px", marginBottom: 4, background: "#ff444411", border: `1px solid ${typeColor(t.type)}44`, borderRadius: 3, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{t.name}</div>
                <div style={{ color: typeColor(t.type), fontSize: 10 }}>{t.type}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: t.pct > 80 ? "#ff4444" : t.pct > 50 ? "#ffaa00" : "#00ffaa", fontSize: 14, fontWeight: "bold" }}>{t.pct}%</div>
                <div style={{ color: "#1a3a5c", fontSize: 9 }}>THREAT</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PANEL: SATS */}
      {panel === "sats" && (
        <div className="slide-up" style={{ position: "fixed", bottom: 82, left: 8, right: 8, zIndex: 9997, background: F.bg + "ee", border: "1px solid #aa44ff", borderRadius: 6, padding: "10px 12px", maxHeight: "45vh", overflowY: "auto", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#aa44ff", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>SATELLITES ({satCount})</span>
            <div onClick={() => setPanel(null)} style={{ color: "#556", fontSize: 16, cursor: "pointer" }}>x</div>
          </div>
          {satsRef.current.slice(0, 30).map((s, i) => {
            const cls = classifySat(s.OBJECT_NAME);
            return (
              <div key={i} onClick={() => { const pos = computeSatPosition(s, Date.now()); if (pos) { rotRef.current = { lng: -pos.lng, lat: pos.lat }; setSelected({ type: "sat", data: s, pos, x: window.innerWidth/2, y: 200 }); } }}
                style={{ padding: "5px 8px", marginBottom: 3, background: cls.color + "11", border: `1px solid ${cls.color}33`, borderRadius: 3, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>{s.OBJECT_NAME}</div>
                  <div style={{ color: cls.color, fontSize: 9 }}>{cls.type} &middot; NORAD {s.NORAD_CAT_ID}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#00aaff", fontSize: 11 }}>{Math.round(1440 / s.MEAN_MOTION)}min</div>
                  <div style={{ color: "#1a3a5c", fontSize: 9 }}>{s.INCLINATION?.toFixed(0)}deg</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PANEL: QUAKES */}
      {panel === "quakes" && (
        <div className="slide-up" style={{ position: "fixed", bottom: 82, left: 8, right: 8, zIndex: 9997, background: F.bg + "ee", border: "1px solid #ffaa00", borderRadius: 6, padding: "10px 12px", maxHeight: "45vh", overflowY: "auto", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#ffaa00", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>EARTHQUAKES 24h ({quakeCount})</span>
            <div onClick={() => setPanel(null)} style={{ color: "#556", fontSize: 16, cursor: "pointer" }}>x</div>
          </div>
          {quakesRef.current.slice(0, 30).map((q, i) => (
            <div key={i} onClick={() => { rotRef.current = { lng: -q.lng, lat: q.lat }; setSelected({ type: "quake", data: q, x: window.innerWidth/2, y: 200 }); }}
              style={{ padding: "5px 8px", marginBottom: 3, background: quakeColor(q.mag) + "11", border: `1px solid ${quakeColor(q.mag)}44`, borderRadius: 3, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#fff", fontSize: 11 }}>{q.place}</div>
                <div style={{ color: "#1a3a5c", fontSize: 9 }}>{new Date(q.time).toUTCString().slice(5, 22)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: quakeColor(q.mag), fontSize: 14, fontWeight: "bold" }}>M{q.mag.toFixed(1)}</div>
                <div style={{ color: "#1a3a5c", fontSize: 9 }}>{q.depth?.toFixed(0)}km</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PANEL: SHIPS */}
      {panel === "ships" && (
        <div className="slide-up" style={{ position: "fixed", bottom: 82, left: 8, right: 8, zIndex: 9997, background: F.bg + "ee", border: "1px solid #44ddaa", borderRadius: 6, padding: "10px 12px", maxHeight: "45vh", overflowY: "auto", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: "#44ddaa", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>VESSELS ({shipCount}) <span style={{ color: aisStatus === "LIVE AIS" ? "#00ffaa" : "#ffaa00", fontSize: 10, marginLeft: 8 }}>[{aisStatus}]</span></span>
            <div onClick={() => setPanel(null)} style={{ color: "#556", fontSize: 16, cursor: "pointer" }}>x</div>
          </div>
          <div style={{ background: "#44ddaa11", border: "1px solid #44ddaa33", borderRadius: 3, padding: "6px 8px", marginBottom: 8 }}>
            {aisKey ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ color: aisStatus === "LIVE AIS" ? "#00ffaa" : aisStatus.startsWith("ERR") || aisStatus.startsWith("DROP") ? "#ff6644" : "#ffaa00", fontSize: 11, fontWeight: "bold" }}>{aisStatus}</div>
                  <div style={{ color: "#1a3a5c", fontSize: 9 }}>aisstream.io &middot; bbox: {REGIONS[region].label}</div>
                </div>
                <div onClick={clearAisKey} style={{ color: "#ff6644", fontSize: 10, cursor: "pointer", border: "1px solid #ff664455", padding: "3px 8px", borderRadius: 3 }}>CLEAR</div>
              </div>
            ) : (
              <div>
                <div style={{ color: "#ffaa00", fontSize: 11, fontWeight: "bold", marginBottom: 4 }}>Showing simulated fleet</div>
                <div style={{ color: "#778", fontSize: 9, marginBottom: 6 }}>Get free API key at aisstream.io, paste below for global live AIS</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <input ref={aisInputRef} type="password" value={aisKeyInput} onChange={e => setAisKeyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveAisKey()} placeholder="aisstream.io API key"
                    style={{ flex: 1, padding: "5px 8px", background: "#04080f", border: "1px solid #44ddaa55", borderRadius: 3, color: "#fff", fontSize: 11, fontFamily: "inherit", outline: "none" }} />
                  <div onClick={saveAisKey} style={{ color: "#00ffaa", fontSize: 10, fontWeight: "bold", cursor: "pointer", border: "1px solid #00ffaa", padding: "5px 10px", borderRadius: 3 }}>SAVE</div>
                </div>
              </div>
            )}
          </div>
          {shipsRef.current.slice(0, 50).map((s, i) => (
            <div key={i} onClick={() => { rotRef.current = { lng: -s.lng, lat: s.lat }; setSelected({ type: "ship", data: s, x: window.innerWidth/2, y: 200 }); }}
              style={{ padding: "5px 8px", marginBottom: 3, background: shipColor(s.type) + "11", border: `1px solid ${shipColor(s.type)}44`, borderRadius: 3, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>{s.name}</div>
                <div style={{ color: shipColor(s.type), fontSize: 9 }}>{s.type} &middot; {s.flag} &middot; {s.length}m</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#00aaff", fontSize: 12 }}>{s.speed.toFixed(1)}kn</div>
                <div style={{ color: "#1a3a5c", fontSize: 9 }}>HDG {Math.round(s.hdg)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PANEL: GPS JAM */}
      {panel === "gpsJam" && (
        <div className="slide-up" style={{ position: "fixed", bottom: 82, left: 8, right: 8, zIndex: 9997, background: F.bg + "ee", border: "1px solid #ff6600", borderRadius: 6, padding: "10px 12px", maxHeight: "45vh", overflowY: "auto", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#ff6600", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>GPS INTERFERENCE ZONES</span>
            <div onClick={() => setPanel(null)} style={{ color: "#556", fontSize: 16, cursor: "pointer" }}>x</div>
          </div>
          {GPS_JAM_ZONES.map((z, i) => (
            <div key={i} onClick={() => { rotRef.current = { lng: -z.lng, lat: z.lat }; setSelected({ type: "gpsJam", data: z, x: window.innerWidth/2, y: 200 }); }}
              style={{ padding: "6px 8px", marginBottom: 4, background: jamColor(z.severity) + "11", border: `1px solid ${jamColor(z.severity)}44`, borderRadius: 3, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{z.name}</div>
                <div style={{ color: jamColor(z.severity), fontSize: 11, fontWeight: "bold" }}>{z.severity}</div>
              </div>
              <div style={{ color: "#1a3a5c", fontSize: 9, marginTop: 2 }}>SRC: {z.source} &middot; R{z.radius}km</div>
              <div style={{ color: "#778", fontSize: 10, marginTop: 2 }}>{z.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* PANEL: LEGEND */}
      {panel === "legend" && (
        <div className="slide-up" style={{ position: "fixed", bottom: 82, left: 8, right: 8, zIndex: 9997, background: F.bg + "ee", border: "1px solid #00ffaa", borderRadius: 6, padding: "10px 12px", maxHeight: "45vh", overflowY: "auto", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#00ffaa", fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>LEGEND & SOURCES</span>
            <div onClick={() => setPanel(null)} style={{ color: "#556", fontSize: 16, cursor: "pointer" }}>x</div>
          </div>
          <div style={{ color: "#aac", fontSize: 11, lineHeight: 1.7 }}>
            <div style={{ color: "#00ccff", fontWeight: "bold", marginTop: 4 }}>FLIGHTS</div>
            <div>&bull; <span style={{ color: "#00ccff" }}>Cyan</span> civilian &middot; <span style={{ color: "#ff4444" }}>Red</span> military/suspect</div>
            <div>&bull; Trail = last ~3 min track &middot; Data: OpenSky Network</div>

            <div style={{ color: "#aa44ff", fontWeight: "bold", marginTop: 8 }}>SATELLITES</div>
            <div>&bull; <span style={{ color: "#ff4444" }}>MIL</span> (USA-/NROL) &middot; <span style={{ color: "#ffaa00" }}>RECON</span> (WorldView, Pleiades) &middot; <span style={{ color: "#00ff88" }}>ISS</span></div>
            <div>&bull; Kepler propagation with J2 &middot; Data: CelesTrak</div>

            <div style={{ color: "#ffaa00", fontWeight: "bold", marginTop: 8 }}>EARTHQUAKES</div>
            <div>&bull; Size = magnitude &middot; Color scale M2.5 -&gt; M7+ &middot; Data: USGS</div>

            <div style={{ color: "#44ddaa", fontWeight: "bold", marginTop: 8 }}>VESSELS</div>
            <div>&bull; Simulated Hormuz/Gulf traffic (naval, tanker, cargo)</div>

            <div style={{ color: "#ff6600", fontWeight: "bold", marginTop: 8 }}>GPS JAMMING</div>
            <div>&bull; <span style={{ color: "#ff0000" }}>CRITICAL</span> &middot; <span style={{ color: "#ff6600" }}>HIGH</span> &middot; <span style={{ color: "#ffaa00" }}>MODERATE</span></div>
            <div>&bull; Based on EUROCONTROL/FAA advisories & OSINT</div>

            <div style={{ color: "#ff9944", fontWeight: "bold", marginTop: 8 }}>DAY/NIGHT</div>
            <div>&bull; Sub-solar point computed from GMST + declination</div>

            <div style={{ color: F.color, fontWeight: "bold", marginTop: 8 }}>KEYBOARD</div>
            <div>&bull; +/- zoom &middot; Arrows rotate &middot; 1-4 region</div>
            <div>&bull; F cycle filter &middot; / search &middot; Esc close</div>

            <div style={{ color: "#778", fontSize: 9, marginTop: 12, borderTop: "1px solid #1a3a5c33", paddingTop: 6 }}>
              Inspired by Bilawal Sidhu&apos;s "God&apos;s Eye" &middot; Built with React + D3 &middot; All data is public OSINT. Not for operational use.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


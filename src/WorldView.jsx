import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { REGIONS, REGION_ROTATIONS, MIL_PREFIXES, TARGETS, CITIES, HOT_CITIES, ME_CODES, IRAN_CODE, typeColor, quakeColor, quakeSize } from "./data";
import { decodeTopo } from "./topoDecoder";
import { computeSatPosition, classifySat, fetchSatellites } from "./satellites";
import { fetchEarthquakes } from "./earthquakes";
import { generateShipFleet, shipColor } from "./ships";
import { computeTerminator } from "./terminator";

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
  const [layers, setLayers] = useState({ flights: true, sats: true, quakes: true, ships: true, terminator: true });

  // Toggle layer visibility
  const toggleLayer = useCallback((key) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Fetch map data
  useEffect(() => {
    const urls = [
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
      "https://unpkg.com/world-atlas@2/countries-110m.json",
    ];
    const tryFetch = async (idx) => {
      if (idx >= urls.length) return;
      try {
        const res = await fetch(urls[idx]);
        if (!res.ok) throw new Error();
        const topo = await res.json();
        geoRef.current = decodeTopo(topo);
        setMapLoaded(true);
      } catch { tryFetch(idx + 1); }
    };
    tryFetch(0);
  }, []);

  // Fetch satellites from CelesTrak
  useEffect(() => {
    const load = async () => {
      setSatStatus("Loading sats...");
      const sats = await fetchSatellites();
      if (sats.length > 0) {
        satsRef.current = sats;
        setSatCount(sats.length);
        setSatStatus(`${sats.length} SATS`);
      } else {
        setSatStatus("SAT FETCH FAILED");
      }
    };
    load();
    const iv = setInterval(load, 300000);
    return () => clearInterval(iv);
  }, []);

  // Fetch earthquakes from USGS
  useEffect(() => {
    const load = async () => {
      const quakes = await fetchEarthquakes();
      quakesRef.current = quakes;
      setQuakeCount(quakes.length);
    };
    load();
    const iv = setInterval(load, 120000);
    return () => clearInterval(iv);
  }, []);

  // Generate ships
  useEffect(() => {
    const ships = generateShipFleet(18);
    shipsRef.current = ships;
    setShipCount(ships.length);
  }, []);

  // Fetch flights
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
        const alts = fl.map(f => f.alt).filter(a => a > 0);
        const mil = fl.filter(f => !f.cs || MIL_PREFIXES.some(p => f.cs.startsWith(p)) || (f.alt > 0 && f.alt < 1500 && f.vel > 150)).length;
        setHud({ planes: fl.length, mil, avg: alts.length ? Math.round(alts.reduce((a,b)=>a+b)/alts.length) : 0 });
      } else setStatus("NO DATA");
    } catch (e) { setStatus(`ERR: ${e.message.slice(0,20)}`); }
  }, [region]);

  useEffect(() => { fetchFlights(); const iv = setInterval(fetchFlights, 15000); return () => clearInterval(iv); }, [fetchFlights]);

  // ── Render loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId, autoT = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      autoT += 0.012;
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

      const projection = d3.geoOrthographic()
        .scale(R).translate([cx, cy]).rotate([-rLng, -rLat, 0]).clipAngle(90);
      const path = d3.geoPath(projection, ctx);
      projRef.current = { rLng, rLat, R, cx, cy, Z, projection };

      // Background
      ctx.fillStyle = "#04080f";
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (let i = 0; i < 120; i++) {
        const sx = (Math.sin(i * 127.1 + 33) * 0.5 + 0.5) * w;
        const sy = (Math.sin(i * 311.7 + 77) * 0.5 + 0.5) * h;
        ctx.fillStyle = `rgba(150,180,220,${0.15 + 0.2 * Math.sin(autoT * 0.5 + i)})`;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Atmosphere glow
      const g1 = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.15);
      g1.addColorStop(0, "transparent");
      g1.addColorStop(0.5, "rgba(0,100,255,0.05)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2); ctx.fill();

      // Globe disc (ocean)
      const gO = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, 0, cx, cy, R);
      gO.addColorStop(0, "#0d1a2e"); gO.addColorStop(1, "#060e1a");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = gO; ctx.fill();
      ctx.strokeStyle = "#1a3a6622"; ctx.lineWidth = 1.5; ctx.stroke();

      // Graticule
      const graticule = d3.geoGraticule().step([15, 15]);
      ctx.beginPath(); path(graticule()); ctx.strokeStyle = "#0e1e32"; ctx.lineWidth = 0.4; ctx.stroke();

      // Countries
      const geo = geoRef.current;
      if (geo) {
        geo.features.forEach(f => {
          const id = f.properties.id;
          ctx.beginPath(); path(f);
          if (id === IRAN_CODE) {
            ctx.fillStyle = "#2a0808"; ctx.fill();
            ctx.strokeStyle = "#ff3300"; ctx.lineWidth = 2; ctx.stroke();
          } else if (ME_CODES.includes(id)) {
            ctx.fillStyle = "#0e1f30"; ctx.fill();
            ctx.strokeStyle = "#2a6a9a"; ctx.lineWidth = 0.8; ctx.stroke();
          } else {
            ctx.fillStyle = "#0c1e33"; ctx.fill();
            ctx.strokeStyle = "#1a5080"; ctx.lineWidth = 0.5; ctx.stroke();
          }
        });
      }

      // Globe edge
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "#1a3a5c44"; ctx.lineWidth = 1; ctx.stroke();

      // ── Day/Night Terminator ──
      if (layers.terminator) {
        try {
          const term = computeTerminator(Date.now());
          const nightGeo = {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [[
                ...term.points.map(([lng, lat]) => [lng, lat]),
                [180, term.declination > 0 ? -90 : 90],
                [-180, term.declination > 0 ? -90 : 90],
              ]]
            }
          };
          ctx.beginPath(); path(nightGeo);
          ctx.fillStyle = "rgba(0,0,15,0.35)"; ctx.fill();

          // Terminator line
          const termLine = { type: "Feature", geometry: { type: "LineString", coordinates: term.points } };
          ctx.beginPath(); path(termLine);
          ctx.strokeStyle = "rgba(255,180,50,0.15)"; ctx.lineWidth = 1.5; ctx.stroke();
        } catch {}
      }

      // Cities on globe
      CITIES.forEach(([lat, lng, name]) => {
        const p = projection([lng, lat]);
        if (!p) return;
        const d = d3.geoDistance([lng, lat], [rLng, rLat]);
        if (d > Math.PI / 2) return;
        ctx.beginPath(); ctx.arc(p[0], p[1], 2, 0, Math.PI * 2);
        ctx.fillStyle = "#00aaff66"; ctx.fill();
        if (Z > 0.8) { ctx.font = "8px monospace"; ctx.fillStyle = "#00aaff44"; ctx.fillText(name, p[0] + 4, p[1] + 3); }
      });
      HOT_CITIES.forEach(([lat, lng, name]) => {
        const p = projection([lng, lat]);
        if (!p) return;
        const d = d3.geoDistance([lng, lat], [rLng, rLat]);
        if (d > Math.PI / 2) return;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ff5533cc"; ctx.fill();
        if (Z > 0.7) { ctx.font = "bold 9px monospace"; ctx.fillStyle = "#ff775599"; ctx.fillText(name, p[0] + 5, p[1] + 3); }
      });

      // Target markers
      TARGETS.forEach(t => {
        const p = projection([t.lng, t.lat]);
        if (!p) return;
        const d = d3.geoDistance([t.lng, t.lat], [rLng, rLat]);
        if (d > Math.PI / 2) return;
        const pulse = 5 + 3 * Math.sin(autoT * 2.5);
        const col = typeColor(t.type);
        ctx.beginPath(); ctx.arc(p[0], p[1], pulse, 0, Math.PI * 2);
        ctx.strokeStyle = col + "88"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], pulse * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = col + "33"; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
      });

      // ── Live flights ──
      if (layers.flights) {
        flightsRef.current.forEach(f => {
          const p = projection([f.lng, f.lat]);
          if (!p) return;
          const d = d3.geoDistance([f.lng, f.lat], [rLng, rLat]);
          if (d > Math.PI / 2) return;
          const isMil = !f.cs || MIL_PREFIXES.some(x => f.cs.startsWith(x)) || (f.alt > 0 && f.alt < 1500 && f.vel > 150);
          ctx.beginPath(); ctx.arc(p[0], p[1], isMil ? 3 : 1.5, 0, Math.PI * 2);
          ctx.fillStyle = isMil ? "#ff4444" : "#00ccff77"; ctx.fill();
          if (isMil && f.hdg) {
            const h = f.hdg * Math.PI / 180;
            const ep = projection([f.lng + Math.sin(h) * 1.5, f.lat + Math.cos(h) * 1.5]);
            if (ep) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(ep[0], ep[1]); ctx.strokeStyle = "#ff444466"; ctx.lineWidth = 1; ctx.stroke(); }
          }
        });
      }

      // ── Satellites ──
      if (layers.sats) {
        const now = Date.now();
        const sats = satsRef.current;
        // Orbit traces (limited for performance)
        sats.forEach((sat, si) => {
          if (si > 20) return;
          try {
            const trace = [];
            const period = 1440 / sat.MEAN_MOTION;
            for (let i = 0; i <= 40; i++) {
              const t = now + (i / 40) * period * 60000;
              const pos = computeSatPosition(sat, t);
              if (pos && !isNaN(pos.lat) && !isNaN(pos.lng)) trace.push(pos);
            }
            if (trace.length > 2) {
              ctx.beginPath();
              let started = false;
              trace.forEach(pt => {
                const p = projection([pt.lng, pt.lat]);
                const d = d3.geoDistance([pt.lng, pt.lat], [rLng, rLat]);
                if (p && d < Math.PI / 2) {
                  if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
                  else ctx.lineTo(p[0], p[1]);
                } else { started = false; }
              });
              ctx.strokeStyle = sat.OBJECT_TYPE === "PAYLOAD" ? "#aa44ff18" : "#44aaff12";
              ctx.lineWidth = 0.6; ctx.stroke();
            }
          } catch {}
        });
        // Satellite dots
        sats.forEach(sat => {
          try {
            const pos = computeSatPosition(sat, now);
            if (!pos || isNaN(pos.lat) || isNaN(pos.lng)) return;
            const p = projection([pos.lng, pos.lat]);
            if (!p) return;
            const d = d3.geoDistance([pos.lng, pos.lat], [rLng, rLat]);
            if (d > Math.PI / 2) return;
            const cls = classifySat(sat.OBJECT_NAME);
            // Glow
            ctx.beginPath(); ctx.arc(p[0], p[1], cls.size + 2, 0, Math.PI * 2);
            ctx.fillStyle = cls.color + "22"; ctx.fill();
            // Dot
            ctx.beginPath(); ctx.arc(p[0], p[1], cls.size, 0, Math.PI * 2);
            ctx.fillStyle = cls.color; ctx.fill();
            // Label
            if ((cls.isMil || cls.isRecon || cls.isISS) && Z > 0.7) {
              ctx.font = "bold 7px monospace";
              ctx.fillStyle = cls.color + "99";
              ctx.fillText(sat.OBJECT_NAME || "", p[0] + cls.size + 3, p[1] + 2);
            }
          } catch {}
        });
      }

      // ── Earthquakes ──
      if (layers.quakes) {
        quakesRef.current.forEach(q => {
          const p = projection([q.lng, q.lat]);
          if (!p) return;
          const d = d3.geoDistance([q.lng, q.lat], [rLng, rLat]);
          if (d > Math.PI / 2) return;
          const sz = quakeSize(q.mag);
          const col = quakeColor(q.mag);
          // Pulse ring
          const pulse = sz + 3 * Math.sin(autoT * 3);
          ctx.beginPath(); ctx.arc(p[0], p[1], pulse, 0, Math.PI * 2);
          ctx.strokeStyle = col + "55"; ctx.lineWidth = 1; ctx.stroke();
          // Core dot
          ctx.beginPath(); ctx.arc(p[0], p[1], sz, 0, Math.PI * 2);
          ctx.fillStyle = col; ctx.fill();
          // Label for significant quakes
          if (q.mag >= 4 && Z > 0.7) {
            ctx.font = "bold 7px monospace";
            ctx.fillStyle = col + "bb";
            ctx.fillText(`M${q.mag.toFixed(1)}`, p[0] + sz + 3, p[1] + 2);
          }
        });
      }

      // ── Ships (Hormuz) ──
      if (layers.ships) {
        shipsRef.current.forEach(s => {
          const p = projection([s.lng, s.lat]);
          if (!p) return;
          const d = d3.geoDistance([s.lng, s.lat], [rLng, rLat]);
          if (d > Math.PI / 2) return;
          const col = shipColor(s.type);
          const sz = s.type === "NAVAL" ? 3.5 : 2.5;
          // Ship icon (diamond shape)
          ctx.beginPath();
          ctx.moveTo(p[0], p[1] - sz);
          ctx.lineTo(p[0] + sz * 0.7, p[1]);
          ctx.lineTo(p[0], p[1] + sz);
          ctx.lineTo(p[0] - sz * 0.7, p[1]);
          ctx.closePath();
          ctx.fillStyle = col; ctx.fill();
          // Heading line
          if (s.hdg) {
            const h = s.hdg * Math.PI / 180;
            const ep = projection([s.lng + Math.sin(h) * 0.8, s.lat + Math.cos(h) * 0.8]);
            if (ep) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(ep[0], ep[1]); ctx.strokeStyle = col + "66"; ctx.lineWidth = 0.8; ctx.stroke(); }
          }
          // Label for naval
          if (s.type === "NAVAL" && Z > 0.9) {
            ctx.font = "bold 7px monospace";
            ctx.fillStyle = col + "99";
            ctx.fillText(s.name, p[0] + 5, p[1] + 2);
          }
        });
      }

      // Light reflection
      const g2 = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
      g2.addColorStop(0, "rgba(120,180,255,0.025)"); g2.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g2; ctx.fill();

      // Crosshair
      ctx.strokeStyle = "#00aaff22"; ctx.lineWidth = 0.8;
      [[cx, cy-22, cx, cy-8],[cx, cy+8, cx, cy+22],[cx-22, cy, cx-8, cy],[cx+8, cy, cx+22, cy]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
    };
    render();
    return () => { cancelAnimationFrame(animId); };
  }, [mapLoaded, layers]);

  // ── Globe interaction handlers ──
  const lastDistRef = useRef(0);
  const handleDown = (e) => {
    const touch = e.touches?.[0];
    dragRef.current.dragging = true;
    dragRef.current.moved = false;
    dragRef.current.lx = touch?.clientX ?? e.clientX;
    dragRef.current.ly = touch?.clientY ?? e.clientY;
    dragRef.current.startX = dragRef.current.lx;
    dragRef.current.startY = dragRef.current.ly;
    if (e.touches?.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };
  const handleUp = (e) => {
    const wasDrag = dragRef.current.moved;
    dragRef.current.dragging = false;
    if (!wasDrag && projRef.current) {
      const touch = e.changedTouches?.[0];
      const tapX = touch?.clientX ?? e.clientX ?? dragRef.current.startX;
      const tapY = touch?.clientY ?? e.clientY ?? dragRef.current.startY;
      const { rLng, rLat } = projRef.current;
      const proj2 = d3.geoOrthographic()
        .scale(projRef.current.R).translate([projRef.current.cx, projRef.current.cy])
        .rotate([-rLng, -rLat, 0]).clipAngle(90);

      let bestDist = 25;
      let bestItem = null;

      // Check flights
      if (layers.flights) {
        flightsRef.current.forEach(f => {
          const p = proj2([f.lng, f.lat]);
          if (!p) return;
          const dd = d3.geoDistance([f.lng, f.lat], [rLng, rLat]);
          if (dd > Math.PI / 2) return;
          const dx = p[0] - tapX, dy = p[1] - tapY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            const isMil = !f.cs || MIL_PREFIXES.some(x => f.cs.startsWith(x)) || (f.alt > 0 && f.alt < 1500 && f.vel > 150);
            bestItem = { type: "flight", data: f, isMil, x: tapX, y: tapY };
          }
        });
      }

      // Check satellites
      if (layers.sats) {
        const now = Date.now();
        satsRef.current.forEach(sat => {
          try {
            const pos = computeSatPosition(sat, now);
            if (!pos || isNaN(pos.lat) || isNaN(pos.lng)) return;
            const p = proj2([pos.lng, pos.lat]);
            if (!p) return;
            const dd = d3.geoDistance([pos.lng, pos.lat], [rLng, rLat]);
            if (dd > Math.PI / 2) return;
            const dx = p[0] - tapX, dy = p[1] - tapY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
              bestDist = dist;
              bestItem = { type: "sat", data: sat, pos, x: tapX, y: tapY };
            }
          } catch {}
        });
      }

      // Check earthquakes
      if (layers.quakes) {
        quakesRef.current.forEach(q => {
          const p = proj2([q.lng, q.lat]);
          if (!p) return;
          const dd = d3.geoDistance([q.lng, q.lat], [rLng, rLat]);
          if (dd > Math.PI / 2) return;
          const dx = p[0] - tapX, dy = p[1] - tapY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            bestItem = { type: "quake", data: q, x: tapX, y: tapY };
          }
        });
      }

      // Check ships
      if (layers.ships) {
        shipsRef.current.forEach(s => {
          const p = proj2([s.lng, s.lat]);
          if (!p) return;
          const dd = d3.geoDistance([s.lng, s.lat], [rLng, rLat]);
          if (dd > Math.PI / 2) return;
          const dx = p[0] - tapX, dy = p[1] - tapY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            bestItem = { type: "ship", data: s, x: tapX, y: tapY };
          }
        });
      }

      if (bestItem) setSelected(bestItem);
      else setSelected(null);
    }
  };
  const handleMove = (e) => {
    if (!dragRef.current.dragging) return;
    const touch = e.touches?.[0];
    const x = touch?.clientX ?? e.clientX;
    const y = touch?.clientY ?? e.clientY;
    const dx = x - dragRef.current.startX;
    const dy = y - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { dragRef.current.moved = true; setSelected(null); }
    rotRef.current.lng -= (x - dragRef.current.lx) * 0.25;
    rotRef.current.lat += (y - dragRef.current.ly) * 0.25;
    rotRef.current.lat = Math.max(-70, Math.min(70, rotRef.current.lat));
    dragRef.current.lx = x;
    dragRef.current.ly = y;
    if (e.touches?.length === 2) {
      const tdx = e.touches[0].clientX - e.touches[1].clientX;
      const tdy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(tdx * tdx + tdy * tdy);
      if (lastDistRef.current > 0) zoomRef.current = Math.max(0.5, Math.min(3, zoomRef.current * (dist / lastDistRef.current)));
      lastDistRef.current = dist;
    }
  };
  const handleWheel = (e) => { zoomRef.current = Math.max(0.5, Math.min(3, zoomRef.current - e.deltaY * 0.001)); };

  const changeRegion = useCallback((k) => {
    setRegion(k);
    const rot = REGION_ROTATIONS[k];
    if (rot) rotRef.current = { lng: rot.lng, lat: rot.lat };
  }, []);

  const isLive = status.includes("LIVE");

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#04080f", position: "relative", overflow: "hidden", fontFamily: "'Courier New',monospace", userSelect: "none" }}>
      {/* Canvas */}
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", position: "absolute", top: 0, left: 0, zIndex: 0, pointerEvents: "none" }} />

      {/* Interaction layer */}
      <div
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 80, zIndex: 1, touchAction: "none" }}
        onMouseDown={handleDown} onMouseUp={handleUp} onMouseMove={handleMove} onMouseLeave={handleUp}
        onTouchStart={handleDown} onTouchEnd={handleUp} onTouchMove={handleMove}
        onWheel={handleWheel}
      />

      {!mapLoaded && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 25, color: "#00aaff", fontSize: 13 }} className="blink">Loading world map...</div>}

      {/* TOP BAR */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "8px 12px", background: "linear-gradient(180deg,#04080fdd,transparent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#00aaff", fontSize: 17, fontWeight: "bold", letterSpacing: 4 }}>WORLDVIEW</div>
          <div style={{ color: "#00ffaa66", fontSize: 9, letterSpacing: 2 }}>LIVE OSINT</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: isLive ? "#00ffaa" : "#ffaa00", fontSize: 13, fontWeight: "bold" }}>{status}</div>
          <div style={{ color: "#ff2200", fontSize: 11 }} className="blink">CRITICAL</div>
        </div>
      </div>

      {/* LAYER TOGGLES - top right */}
      <div style={{ position: "absolute", top: 50, right: 8, zIndex: 10, display: "flex", flexDirection: "column", gap: 3 }}>
        {[["flights","FLT","#00ccff"],["sats","SAT","#aa44ff"],["quakes","QKE","#ffaa00"],["ships","SHP","#44ddaa"],["terminator","D/N","#ff9944"]].map(([k,l,c]) => (
          <div key={k} onClick={() => toggleLayer(k)}
            style={{ background: layers[k] ? c+"33" : "#1a3a5c11", border: `1px solid ${layers[k] ? c : "#1a3a5c33"}`, color: layers[k] ? c : "#1a3a5c55", fontSize: 9, padding: "3px 6px", borderRadius: 3, textAlign: "center", cursor: "pointer", letterSpacing: 1 }}>{l}</div>
        ))}
      </div>

      {/* SELECTED ITEM POPUP */}
      {selected && (
        <div className="fade-in" style={{ position: "fixed", top: selected.y < 200 ? selected.y + 20 : selected.y - 180, left: Math.max(8, Math.min(selected.x - 120, window.innerWidth - 260)), zIndex: 9998, background: "#04080fee", border: `1px solid ${selected.type === "flight" ? (selected.isMil ? "#ff4444" : "#00ccff") : selected.type === "sat" ? "#aa44ff" : selected.type === "quake" ? "#ffaa00" : "#44ddaa"}`, borderRadius: 6, padding: "12px 14px", width: 250, backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: selected.type === "flight" ? (selected.isMil ? "#ff4444" : "#00ccff") : selected.type === "sat" ? "#aa44ff" : selected.type === "quake" ? "#ffaa00" : "#44ddaa", fontSize: 13, fontWeight: "bold", letterSpacing: 1 }}>
              {selected.type === "flight" ? (selected.isMil ? "MIL SUSPECT" : "COMMERCIAL") : selected.type === "sat" ? "SATELLITE" : selected.type === "quake" ? "EARTHQUAKE" : "VESSEL"}
            </span>
            <div onClick={() => setSelected(null)} style={{ color: "#556", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>x</div>
          </div>
          {selected.type === "flight" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>CALLSIGN</span>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{selected.data.cs || "UNKNOWN"}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>ALTITUDE</span>
              <span style={{ color: "#00ffaa", fontSize: 12 }}>{Math.round(selected.data.alt).toLocaleString()}m ({Math.round(selected.data.alt * 3.281).toLocaleString()}ft)</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>SPEED</span>
              <span style={{ color: "#00aaff", fontSize: 12 }}>{Math.round(selected.data.vel)}m/s ({Math.round(selected.data.vel * 3.6)}km/h)</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>HEADING</span>
              <span style={{ color: "#00aaff", fontSize: 12 }}>{Math.round(selected.data.hdg)}deg</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>POSITION</span>
              <span style={{ color: "#778", fontSize: 11 }}>{selected.data.lat.toFixed(3)}N {selected.data.lng.toFixed(3)}E</span>
            </div>
          )}
          {selected.type === "sat" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>NAME</span>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{selected.data.OBJECT_NAME}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>NORAD ID</span>
              <span style={{ color: "#aa44ff", fontSize: 12 }}>{selected.data.NORAD_CAT_ID}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>ORBIT</span>
              <span style={{ color: "#00ffaa", fontSize: 12 }}>{Math.round(1440 / selected.data.MEAN_MOTION)} min period</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>INCLINATION</span>
              <span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.INCLINATION?.toFixed(1)}deg</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>ALTITUDE</span>
              <span style={{ color: "#ffaa00", fontSize: 12 }}>{selected.pos?.alt ? Math.round(selected.pos.alt).toLocaleString() + " km" : "N/A"}</span>
            </div>
          )}
          {selected.type === "quake" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>MAGNITUDE</span>
              <span style={{ color: "#ff6600", fontSize: 14, fontWeight: "bold" }}>M{selected.data.mag.toFixed(1)}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>LOCATION</span>
              <span style={{ color: "#fff", fontSize: 11 }}>{selected.data.place}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>DEPTH</span>
              <span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.depth?.toFixed(1)} km</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>TIME</span>
              <span style={{ color: "#778", fontSize: 11 }}>{new Date(selected.data.time).toUTCString()}</span>
            </div>
          )}
          {selected.type === "ship" && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px" }}>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>NAME</span>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>{selected.data.name}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>TYPE</span>
              <span style={{ color: "#44ddaa", fontSize: 12 }}>{selected.data.type}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>FLAG</span>
              <span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.flag}</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>SPEED</span>
              <span style={{ color: "#00aaff", fontSize: 12 }}>{selected.data.speed.toFixed(1)} kn</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>LENGTH</span>
              <span style={{ color: "#778", fontSize: 12 }}>{selected.data.length}m</span>
              <span style={{ color: "#1a3a5c", fontSize: 11 }}>CALLSIGN</span>
              <span style={{ color: "#778", fontSize: 11 }}>{selected.data.callsign}</span>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM BAR */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "#04080f", borderTop: "1px solid #1a3a5c33", padding: "6px 10px" }}>
        {/* Region row */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 6 }}>
          {Object.entries(REGIONS).map(([k, v]) => (
            <div key={k} onClick={() => changeRegion(k)} style={{ background: region === k ? "#00aaff" : "#1a3a5c33", border: `1px solid ${region === k ? "#00aaff" : "#1a3a5c55"}`, color: region === k ? "#fff" : "#1a3a5c", fontSize: 12, padding: "6px 14px", borderRadius: 3, fontFamily: "inherit", fontWeight: region === k ? "bold" : "normal", textAlign: "center", cursor: "pointer" }}>{v.label}</div>
          ))}
        </div>
        {/* Panel buttons */}
        <div style={{ display: "flex", justifyContent: "space-around", gap: 4 }}>
          {[["data","DATA","#00aaff"],["targets","TARGETS","#ff4444"],["sats","SATS","#aa44ff"],["quakes","QUAKES","#ffaa00"],["ships","SHIPS","#44ddaa"],["legend","INFO","#00ffaa"]].map(([k,l,c]) => (
            <div key={k} onClick={() => setPanel(p => p === k ? null : k)} style={{ flex: 1, background: panel === k ? c + "33" : "#1a3a5c22", border: `1px solid ${panel === k ? c : "#1a3a5c44"}`, color: panel === k ? c : "#1a3a5c", fontSize: 10, padding: "7px 2px", borderRadius: 3, fontFamily: "inherit", textAlign: "center", cursor: "pointer" }}>{l}</div>
          ))}
        </div>
      </div>

      {/* DATA PANEL */}
      {panel === "data" && (
        <div className="panel-overlay" style={{ position: "fixed", bottom: 85, left: 0, right: 0, zIndex: 25, background: "#04080fee", borderTop: "1px solid #1a3a5c", padding: "14px 16px" }}>
          <div style={{ color: "#00aaff", fontSize: 14, fontWeight: "bold", marginBottom: 10 }}>OPENSKY LIVE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
            {[["AIRBORNE",hud.planes.toLocaleString(),"#00ccff"],["MIL SUSPECT",hud.mil,"#ff4444"],["AVG ALT",hud.avg.toLocaleString()+"m","#00ffaa"],["SATELLITES",satCount || "...","#aa44ff"],["EARTHQUAKES",quakeCount || "...","#ffaa00"],["SHIPS",shipCount || "...","#44ddaa"]].map(([l,v,c],i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#1a3a5c", fontSize: 12 }}>{l}</span><span style={{ color: c, fontSize: 14, fontWeight: "bold" }}>{v}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* TARGETS PANEL */}
      {panel === "targets" && (
        <div className="panel-overlay" style={{ position: "fixed", bottom: 85, left: 0, right: 0, zIndex: 25, background: "#04080fee", borderTop: "1px solid #1a3a5c", padding: "14px 16px", maxHeight: "40vh", overflowY: "auto" }}>
          {TARGETS.map((z, i) => (
            <div key={i} style={{ padding: "5px 0", borderBottom: "1px solid #1a3a5c22", display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ color: typeColor(z.type), fontSize: 13, fontWeight: "bold" }}>{z.name}</div><div style={{ color: "#1a3a5c", fontSize: 11 }}>{z.type}</div></div>
              <div style={{ color: z.pct > 70 ? "#ff2200" : "#ffaa00", fontSize: 14, fontWeight: "bold" }}>{z.pct}%</div>
            </div>
          ))}
        </div>
      )}

      {/* SATS PANEL */}
      {panel === "sats" && (
        <div className="panel-overlay" style={{ position: "fixed", bottom: 85, left: 0, right: 0, zIndex: 25, background: "#04080fee", borderTop: "1px solid #1a3a5c", padding: "14px 16px", maxHeight: "45vh", overflowY: "auto" }}>
          <div style={{ color: "#aa44ff", fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>CELESTRAK LIVE - {satStatus}</div>
          <div style={{ color: "#1a3a5c", fontSize: 10, marginBottom: 10 }}>Real orbital data - Kepler + J2 propagation</div>
          {satsRef.current.slice(0, 30).map((s, i) => {
            const cls = classifySat(s.OBJECT_NAME);
            return (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #1a3a5c15", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: cls.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: cls.color, fontSize: 11, fontWeight: "bold" }}>{s.OBJECT_NAME}</div>
                    <div style={{ color: "#1a3a5c", fontSize: 9 }}>NORAD {s.NORAD_CAT_ID} - {Math.round(1440/s.MEAN_MOTION)}min orbit</div>
                  </div>
                </div>
                <span style={{ color: "#1a3a5c", fontSize: 10 }}>{cls.type}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* QUAKES PANEL */}
      {panel === "quakes" && (
        <div className="panel-overlay" style={{ position: "fixed", bottom: 85, left: 0, right: 0, zIndex: 25, background: "#04080fee", borderTop: "1px solid #1a3a5c", padding: "14px 16px", maxHeight: "45vh", overflowY: "auto" }}>
          <div style={{ color: "#ffaa00", fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>USGS LIVE - {quakeCount} earthquakes (24h)</div>
          <div style={{ color: "#1a3a5c", fontSize: 10, marginBottom: 10 }}>M2.5+ events - Last 24 hours</div>
          {quakesRef.current.slice(0, 25).map((q, i) => (
            <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #1a3a5c15", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: quakeColor(q.mag), fontSize: 11, fontWeight: "bold" }}>M{q.mag.toFixed(1)} - {q.place}</div>
                <div style={{ color: "#1a3a5c", fontSize: 9 }}>Depth: {q.depth?.toFixed(1)}km - {new Date(q.time).toLocaleTimeString()}</div>
              </div>
              <span style={{ color: quakeColor(q.mag), fontSize: 13, fontWeight: "bold" }}>{q.mag.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {/* SHIPS PANEL */}
      {panel === "ships" && (
        <div className="panel-overlay" style={{ position: "fixed", bottom: 85, left: 0, right: 0, zIndex: 25, background: "#04080fee", borderTop: "1px solid #1a3a5c", padding: "14px 16px", maxHeight: "45vh", overflowY: "auto" }}>
          <div style={{ color: "#44ddaa", fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>STRAIT OF HORMUZ - {shipCount} vessels</div>
          <div style={{ color: "#1a3a5c", fontSize: 10, marginBottom: 10 }}>Maritime traffic simulation - AIS data</div>
          {shipsRef.current.map((s, i) => (
            <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #1a3a5c15", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, background: shipColor(s.type), flexShrink: 0, transform: "rotate(45deg)" }} />
                <div>
                  <div style={{ color: shipColor(s.type), fontSize: 11, fontWeight: "bold" }}>{s.name}</div>
                  <div style={{ color: "#1a3a5c", fontSize: 9 }}>{s.callsign} - {s.flag} - {s.length}m</div>
                </div>
              </div>
              <span style={{ color: "#1a3a5c", fontSize: 10 }}>{s.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* LEGEND PANEL */}
      {panel === "legend" && (
        <div className="panel-overlay" style={{ position: "fixed", bottom: 85, left: 0, right: 0, zIndex: 25, background: "#04080fee", borderTop: "1px solid #1a3a5c", padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px" }}>
            {[["#00ccff","Commercial flight"],["#ff4444","Mil suspect / Mil sat"],["#ff2200","Strike zone"],["#ffaa00","Nuclear / Recon / Quake"],["#00ff88","Airbase / ISS"],["#aa44ff","Satellite orbit"],["#44ddaa","Ship / Vessel"],["#00aaff","Maritime zone"],["rgba(255,180,50,0.5)","Day/Night terminator"]].map(([c,l],i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: c, flexShrink: 0 }} /><span style={{ color: "#1a3a5c", fontSize: 12 }}>{l}</span></div>
            ))}
          </div>
          <div style={{ color: "#1a3a5c", fontSize: 11, marginTop: 10 }}>
            OpenSky + CelesTrak + USGS live | Drag rotate | Pinch zoom | Tap for details
          </div>
          <div style={{ color: "#1a3a5c", fontSize: 10, marginTop: 4 }}>
            Toggle layers with buttons (top-right)
          </div>
        </div>
      )}
    </div>
  );
}

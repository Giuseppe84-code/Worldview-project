// ── AIS live stream via aisstream.io (free tier, requires API key) ──
// Key is stored in localStorage so it's never committed.
// Docs: https://aisstream.io/documentation

const KEY_STORAGE = "wv_aisstream_key";

export const getAISKey = () => { try { return localStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; } };
export const setAISKey = (k) => { try { k ? localStorage.setItem(KEY_STORAGE, k) : localStorage.removeItem(KEY_STORAGE); } catch {} };

// Type mapping: AIS ship type code → our type buckets
function mapType(aisType) {
  const t = Number(aisType) || 0;
  if (t === 35 || (t >= 30 && t <= 39)) return "NAVAL";
  if (t >= 80 && t <= 89) return "TANKER";
  if (t >= 70 && t <= 79) return "CARGO";
  if (t >= 60 && t <= 69) return "PASSENGER";
  return "OTHER";
}

// Valid coords only (filters out the dreaded 0/0, and out-of-range sentinels)
const validCoord = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) > 0.01 && Math.abs(lng) > 0.01 &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// Opens a websocket to aisstream.io and aggregates ship state.
// bboxes:  [[[lat_sw, lon_sw], [lat_ne, lon_ne]], ...]
// onUpdate(ships[]) is called with a fleet snapshot every ~2s.
// Returns { close, updateBBoxes }.
export function connectAIS({ key, bboxes, onUpdate, onStatus }) {
  if (!key) { onStatus?.({ state: "no-key" }); return { close: () => {}, updateBBoxes: () => {} }; }

  const shipsByMmsi = new Map();
  let ws = null;
  let closed = false;
  let flushTimer = null;
  let reconnectTimer = null;
  let retries = 0;
  let currentBBoxes = bboxes;
  let msgCount = 0;

  const flush = () => {
    const now = Date.now();
    // Drop ships not seen for 15 min
    for (const [m, s] of shipsByMmsi) if (now - s.lastSeen > 900000) shipsByMmsi.delete(m);
    onUpdate?.(Array.from(shipsByMmsi.values()));
  };

  const sendSub = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({
        APIKey: key,
        BoundingBoxes: currentBBoxes,
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      }));
    } catch {}
  };

  const connect = () => {
    if (closed) return;
    onStatus?.({ state: "connecting" });
    try { ws = new WebSocket("wss://stream.aisstream.io/v0/stream"); }
    catch (e) { onStatus?.({ state: "error", msg: e.message }); scheduleReconnect(); return; }

    ws.onopen = () => {
      retries = 0; msgCount = 0;
      onStatus?.({ state: "connected" });
      sendSub();
    };

    ws.onmessage = (ev) => {
      msgCount++;
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.error) { onStatus?.({ state: "error", msg: String(msg.error).slice(0, 30) }); return; }
      const meta = msg.MetaData || {};
      const mmsi = meta.MMSI || meta.MMSI_String;
      if (!mmsi) return;
      const prev = shipsByMmsi.get(mmsi) || { mmsi, type: "OTHER", flag: "??", length: 0, name: "", speed: 0, hdg: 0 };

      const metaLat = meta.latitude ?? meta.Latitude;
      const metaLng = meta.longitude ?? meta.Longitude;

      if (msg.MessageType === "PositionReport" && msg.Message?.PositionReport) {
        const p = msg.Message.PositionReport;
        const lat = p.Latitude ?? metaLat;
        const lng = p.Longitude ?? metaLng;
        if (!validCoord(lat, lng)) return;
        prev.lat = lat;
        prev.lng = lng;
        prev.hdg = (p.TrueHeading && p.TrueHeading < 360) ? p.TrueHeading : (p.Cog ?? prev.hdg ?? 0);
        prev.speed = p.Sog ?? prev.speed ?? 0;
        prev.name = prev.name || (meta.ShipName || "").trim() || String(mmsi);
        prev.flag = prev.flag !== "??" ? prev.flag : mmsiToFlag(mmsi);
        prev.lastSeen = Date.now();
        shipsByMmsi.set(mmsi, prev);
      } else if (msg.MessageType === "ShipStaticData" && msg.Message?.ShipStaticData) {
        const s = msg.Message.ShipStaticData;
        prev.name = (s.Name || prev.name || "").trim() || String(mmsi);
        prev.type = mapType(s.Type);
        prev.length = (s.Dimension?.A || 0) + (s.Dimension?.B || 0);
        prev.callsign = (s.CallSign || "").trim();
        prev.flag = mmsiToFlag(mmsi);
        // Keep existing lat/lng from PositionReport if we have one
        if (validCoord(metaLat, metaLng) && !validCoord(prev.lat, prev.lng)) {
          prev.lat = metaLat; prev.lng = metaLng;
        }
        prev.lastSeen = Date.now();
        // Only store if we have a valid position
        if (validCoord(prev.lat, prev.lng)) shipsByMmsi.set(mmsi, prev);
      }
    };

    ws.onerror = () => { onStatus?.({ state: "error" }); };
    ws.onclose = (ev) => {
      if (!closed) {
        onStatus?.({ state: "disconnected", msg: `code ${ev.code}` });
        scheduleReconnect();
      }
    };
  };

  const scheduleReconnect = () => {
    if (closed) return;
    const delay = Math.min(30000, 1500 * Math.pow(2, retries++));
    reconnectTimer = setTimeout(connect, delay);
  };

  flushTimer = setInterval(flush, 2000);
  connect();

  return {
    close: () => {
      closed = true;
      clearInterval(flushTimer);
      clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
    },
    updateBBoxes: (newBBoxes) => {
      currentBBoxes = newBBoxes;
      sendSub();
    },
  };
}

// MMSI prefix → ISO flag (partial list for common flags)
function mmsiToFlag(mmsi) {
  const p = String(mmsi).slice(0, 3);
  const map = {
    "247": "IT", "232": "GB", "235": "GB", "236": "GB", "211": "DE", "227": "FR", "228": "FR",
    "224": "ES", "273": "RU", "366": "US", "367": "US", "368": "US", "369": "US", "338": "US",
    "431": "JP", "432": "JP", "441": "KR", "412": "CN", "413": "CN", "477": "HK",
    "353": "PA", "354": "PA", "538": "MH", "636": "LR", "256": "MT",
    "403": "SA", "470": "AE", "471": "AE", "422": "IR", "425": "IQ", "466": "QA", "447": "IL",
    "244": "NL", "205": "BE", "215": "CY", "237": "GR", "248": "MT", "271": "TR",
  };
  return map[p] || p;
}

// Helper: convert REGIONS definition (lamin/lamax/lomin/lomax) to aisstream bboxes
export function regionToBBoxes(region) {
  // aisstream wants [[lat_sw, lon_sw], [lat_ne, lon_ne]]
  return [[[region.lamin, region.lomin], [region.lamax, region.lomax]]];
}

// ── AIS live stream via aisstream.io (free tier, requires API key) ──
// Key is stored in localStorage so it's never committed.
// Docs: https://aisstream.io/documentation

const KEY_STORAGE = "wv_aisstream_key";

export const getAISKey = () => { try { return localStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; } };
export const setAISKey = (k) => { try { k ? localStorage.setItem(KEY_STORAGE, k) : localStorage.removeItem(KEY_STORAGE); } catch {} };

// Type mapping: AIS ship type code → our type buckets
function mapType(aisType) {
  const t = Number(aisType) || 0;
  if (t >= 30 && t <= 39) return "NAVAL";        // military / law enforcement (heuristic)
  if (t >= 80 && t <= 89) return "TANKER";       // tanker
  if (t >= 70 && t <= 79) return "CARGO";        // cargo
  if (t >= 60 && t <= 69) return "PASSENGER";
  if (t === 35) return "NAVAL";                   // military
  return "OTHER";
}

// Opens a websocket to aisstream.io with the given bounding boxes.
// onUpdate(ships[]) is called with an aggregated fleet snapshot every ~2s.
// Returns a close() function.
export function connectAIS({ key, bboxes, onUpdate, onStatus }) {
  if (!key) { onStatus?.({ state: "no-key" }); return () => {}; }

  const shipsByMmsi = new Map();
  let ws = null;
  let closed = false;
  let flushTimer = null;
  let reconnectTimer = null;
  let retries = 0;

  const flush = () => {
    const now = Date.now();
    // Drop stale entries (>10 min)
    for (const [m, s] of shipsByMmsi) if (now - s.lastSeen > 600000) shipsByMmsi.delete(m);
    onUpdate?.(Array.from(shipsByMmsi.values()));
  };

  const connect = () => {
    if (closed) return;
    onStatus?.({ state: "connecting" });
    try { ws = new WebSocket("wss://stream.aisstream.io/v0/stream"); }
    catch (e) { onStatus?.({ state: "error", msg: e.message }); scheduleReconnect(); return; }

    ws.onopen = () => {
      retries = 0;
      onStatus?.({ state: "connected" });
      const sub = {
        APIKey: key,
        BoundingBoxes: bboxes,
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      };
      ws.send(JSON.stringify(sub));
    };

    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      const meta = msg.MetaData || {};
      const mmsi = meta.MMSI || meta.MMSI_String;
      if (!mmsi) return;
      const prev = shipsByMmsi.get(mmsi) || { mmsi, type: "OTHER", flag: "??", length: 0, name: "" };

      if (msg.MessageType === "PositionReport" && msg.Message?.PositionReport) {
        const p = msg.Message.PositionReport;
        prev.lat = p.Latitude;
        prev.lng = p.Longitude;
        prev.hdg = p.Cog || p.TrueHeading || 0;
        prev.speed = (p.Sog || 0);
        prev.name = prev.name || meta.ShipName?.trim() || String(mmsi);
        prev.lastSeen = Date.now();
        shipsByMmsi.set(mmsi, prev);
      } else if (msg.MessageType === "ShipStaticData" && msg.Message?.ShipStaticData) {
        const s = msg.Message.ShipStaticData;
        prev.name = (s.Name || prev.name || "").trim() || String(mmsi);
        prev.type = mapType(s.Type);
        prev.length = (s.Dimension?.A || 0) + (s.Dimension?.B || 0);
        prev.callsign = (s.CallSign || "").trim();
        prev.flag = mmsiToFlag(mmsi);
        prev.lastSeen = Date.now();
        shipsByMmsi.set(mmsi, prev);
      }
    };

    ws.onerror = () => { onStatus?.({ state: "error" }); };
    ws.onclose = () => { if (!closed) { onStatus?.({ state: "disconnected" }); scheduleReconnect(); } };
  };

  const scheduleReconnect = () => {
    if (closed) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, retries++));
    reconnectTimer = setTimeout(connect, delay);
  };

  flushTimer = setInterval(flush, 2000);
  connect();

  return () => {
    closed = true;
    clearInterval(flushTimer);
    clearTimeout(reconnectTimer);
    try { ws?.close(); } catch {}
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
  };
  return map[p] || p;
}

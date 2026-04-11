// ── USGS Earthquake Live Feed ──
// Fetches significant earthquakes from the last 24h via USGS GeoJSON API

export async function fetchEarthquakes() {
  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map(f => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      mag: f.properties.mag,
      place: f.properties.place || "Unknown",
      time: f.properties.time,
      type: f.properties.type,
    }));
  } catch {
    return [];
  }
}

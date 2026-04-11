# 🌍 WorldView — Geospatial OSINT Command Center

A real-time geopolitical monitoring tool inspired by [Bilawal Sidhu's God's Eye](https://www.youtube.com/@bilawalsidhu). Built with React, D3.js orthographic projection, and live data feeds.

## Features

- **Real country borders** via world-atlas TopoJSON (d3.js orthographic projection)
- **Live flight tracking** from OpenSky Network API (auto-refresh 15s)
- **Military aircraft detection** by callsign prefix and flight behavior
- **Real satellite tracking** from CelesTrak (orbital propagation with Kepler + J2)
- **Conflict zone markers** — Iran, Hormuz, nuclear sites, airbases
- **Tap on aircraft/satellite** for detailed info popup
- **Region selector** — Middle East, Americas, Europe, Global
- **Mobile-first** — touch drag, pinch zoom, collapsible panels

## Live Data Sources

| Source | Data | Refresh |
|--------|------|---------|
| [OpenSky Network](https://opensky-network.org/) | Commercial & military flights | 15 seconds |
| [CelesTrak](https://celestrak.org/) | Satellite orbital elements | 5 minutes |
| [world-atlas](https://github.com/topojson/world-atlas) | Country borders (TopoJSON) | On load |

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

Open `http://localhost:3000` in your browser.

## Deploy

Works out of the box on **Vercel**, **Netlify**, or **GitHub Pages**:

```bash
npm run build
# Upload the `dist/` folder to any static hosting
```

## Project Structure

```
src/
├── main.jsx          # React entry point
├── App.jsx           # Root component
├── WorldView.jsx     # Main globe + HUD component
├── data.js           # Constants, targets, regions, cities
├── satellites.js     # CelesTrak fetch + orbital propagator
└── topoDecoder.js    # TopoJSON → GeoJSON decoder
```

## Tech Stack

- **React 18** + **Vite** — fast dev + build
- **D3.js** — `d3.geoOrthographic()` for cartographic projection
- **Canvas 2D** — hardware-accelerated rendering
- **OpenSky API** — live ADS-B flight data
- **CelesTrak API** — real satellite orbital elements (GP data)

## Roadmap

- [ ] Ship tracking (AIS data) for Strait of Hormuz
- [ ] USGS live earthquake feed
- [ ] GPS jamming zone overlay
- [ ] Night vision / FLIR / SIGINT visual filters
- [ ] Real day/night terminator
- [ ] Traffic anomaly alerts (airspace clearing detection)
- [ ] Timeline replay mode

## Inspired By

Bilawal Sidhu's [WorldView / God's Eye](https://www.spatialintelligence.ai/p/the-intelligence-monopoly-is-over) project, which demonstrated that a single developer with public data and AI can build intelligence-grade geospatial visualization.

## License

MIT

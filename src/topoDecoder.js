// ── Minimal TopoJSON to GeoJSON decoder ──
export function decodeTopo(topo) {
  const { arcs: rawArcs, transform } = topo;
  const { scale, translate } = transform || { scale: [1,1], translate: [0,0] };

  const arcs = rawArcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });

  const decodeArc = (idx) => {
    if (idx >= 0) return arcs[idx].slice();
    return arcs[~idx].slice().reverse();
  };

  const decodeRing = (indices) => {
    let coords = [];
    indices.forEach(idx => {
      const arc = decodeArc(idx);
      if (coords.length > 0) arc.shift();
      coords = coords.concat(arc);
    });
    return coords;
  };

  const geometries = topo.objects.countries?.geometries || topo.objects.land?.geometries || [];
  const features = geometries.map(geom => {
    let coordinates;
    if (geom.type === "Polygon") {
      coordinates = geom.arcs.map(ring => decodeRing(ring));
    } else if (geom.type === "MultiPolygon") {
      coordinates = geom.arcs.map(poly => poly.map(ring => decodeRing(ring)));
    }
    return {
      type: "Feature",
      properties: { id: geom.id || "", name: geom.properties?.name || "" },
      geometry: { type: geom.type, coordinates },
    };
  });

  return { type: "FeatureCollection", features };
}

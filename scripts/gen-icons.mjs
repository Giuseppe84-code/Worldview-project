// Minimal PNG generator for WorldView icons (no external deps)
// Writes 192x192, 512x512 and maskable 512x512 icons with a simple globe motif.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePNG(size, maskable) {
  const w = size, h = size;
  const bg = [0x04, 0x08, 0x0f]; // #04080f
  const accent = [0x00, 0xaa, 0xff];
  const grid = [0x1a, 0x3a, 0x5c];
  const cx = w / 2, cy = h / 2;
  // If maskable, globe should be smaller (safe zone ~80%)
  const R = (maskable ? w * 0.35 : w * 0.44);
  const inset = maskable ? w * 0.1 : 0;

  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter byte
    for (let x = 0; x < w; x++) {
      const idx = y * (w * 4 + 1) + 1 + x * 4;
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      let R_, G_, B_;
      if (r <= R) {
        // Ocean radial gradient
        const t = r / R;
        R_ = Math.round(0x0d * (1 - t * 0.3) + accent[0] * t * 0.05);
        G_ = Math.round(0x1a * (1 - t * 0.3) + accent[1] * t * 0.05);
        B_ = Math.round(0x2e * (1 - t * 0.3) + accent[2] * t * 0.05);
        // Graticule rings
        const ringSpacing = R / 4;
        const ringPos = r % ringSpacing;
        if (ringPos < 1.2 && r > 2) { R_ = grid[0]; G_ = grid[1]; B_ = grid[2]; }
        // Meridian
        const ang = Math.atan2(dy, dx);
        const mer = ((ang + Math.PI) / (Math.PI / 4));
        const merFrac = Math.abs(mer - Math.round(mer));
        if (merFrac < 0.012 && r > 2) { R_ = grid[0]; G_ = grid[1]; B_ = grid[2]; }
        // Iran-ish highlight blob
        const ix = x - cx - R * 0.25, iy = y - cy - R * 0.05;
        if (ix * ix + iy * iy < (R * 0.18) ** 2) {
          R_ = 0xff; G_ = 0x33; B_ = 0x00;
        }
        // Edge glow
        if (r > R - 2) { R_ = accent[0]; G_ = accent[1]; B_ = accent[2]; }
      } else {
        R_ = bg[0]; G_ = bg[1]; B_ = bg[2];
      }
      raw[idx] = R_; raw[idx + 1] = G_; raw[idx + 2] = B_; raw[idx + 3] = 0xff;
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

writeFileSync("public/icon-192.png", makePNG(192, false));
writeFileSync("public/icon-512.png", makePNG(512, false));
writeFileSync("public/icon-maskable-512.png", makePNG(512, true));
console.log("Icons written.");

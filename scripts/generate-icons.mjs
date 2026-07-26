// One-off generator for the PWA app icons. Kept dependency-free (no sharp/
// canvas native bindings) by hand-writing a minimal PNG encoder - this only
// ever needs to run when the brand mark changes, and the output PNGs are
// committed to public/icons/ rather than regenerated on every build.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CHARCOAL = [0x1c, 0x19, 0x17];
const YELLOW = [0xf5, 0xb4, 0x00];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Renders an RGB pixel buffer (row-major, no filter bytes) into a PNG file. */
function encodePng(width, height, rgbPixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor (RGB)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgbPixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Draws the Lockhart "L" wordmark on a charcoal square, scaled to fit within
 * the given content ratio (use a smaller ratio for maskable icons, which get
 * cropped to a circle/squircle by the OS and need extra safe-zone padding).
 */
function renderIcon(size, contentRatio = 0.86) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = CHARCOAL[0];
    pixels[i * 3 + 1] = CHARCOAL[1];
    pixels[i * 3 + 2] = CHARCOAL[2];
  }

  const pad = (1 - contentRatio) / 2;
  const x0 = size * pad;
  const x1 = size * (1 - pad);
  const contentW = x1 - x0;
  const y0 = size * pad;
  const y1 = size * (1 - pad);
  const contentH = y1 - y0;

  const strokeW = contentW * 0.24;
  const vBar = { x0: x0, x1: x0 + strokeW, y0: y0, y1: y1 };
  const hBar = { x0: x0, x1: x1, y0: y1 - strokeW, y1: y1 };

  const inBar = (px, py, bar) =>
    px >= bar.x0 && px < bar.x1 && py >= bar.y0 && py < bar.y1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inBar(x, y, vBar) || inBar(x, y, hBar)) {
        const i = (y * size + x) * 3;
        pixels[i] = YELLOW[0];
        pixels[i + 1] = YELLOW[1];
        pixels[i + 2] = YELLOW[2];
      }
    }
  }

  return pixels;
}

mkdirSync(new URL("../public/icons", import.meta.url), { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192, contentRatio: 0.86 },
  { name: "icon-512.png", size: 512, contentRatio: 0.86 },
  { name: "apple-touch-icon.png", size: 180, contentRatio: 0.86 },
  // Maskable icons need generous padding so the OS's circular/squircle mask
  // doesn't clip the mark - see https://web.dev/maskable-icon/.
  { name: "maskable-icon-512.png", size: 512, contentRatio: 0.6 },
];

for (const { name, size, contentRatio } of targets) {
  const pixels = renderIcon(size, contentRatio);
  const png = encodePng(size, size, pixels);
  writeFileSync(
    new URL(`../public/icons/${name}`, import.meta.url),
    png
  );
  console.log(`wrote public/icons/${name} (${size}x${size})`);
}

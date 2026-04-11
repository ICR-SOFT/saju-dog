/**
 * Pixel Art Icon Generator
 * Node.js canvas를 사용하지 않고 순수 PNG 바이트로 생성
 * 16x16 픽셀 아트 → 512x512 PNG
 */

import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

// Minimal PNG encoder (no dependencies)
function createPNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values (width * height * 4)
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    const TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
      TABLE[n] = v;
    }
    for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, crcData, crcB]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT - raw pixel data with filter byte
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      rawData.push(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
    }
  }

  const compressed = deflateSync(Buffer.from(rawData));

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend),
  ]);
}

// Scale 16x16 pixel art to target size
function scalePixels(grid16, scale) {
  const size = 16 * scale;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcY = Math.floor(y / scale);
      const srcX = Math.floor(x / scale);
      const color = grid16[srcY]?.[srcX] || [0, 0, 0, 0];
      const i = (y * size + x) * 4;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = color[3];
    }
  }
  return { pixels, size };
}

// Color definitions
const _ = [0, 0, 0, 0]; // transparent
const K = [26, 26, 26, 255]; // black
const B = [212, 118, 60, 255]; // brown
const L = [232, 168, 73, 255]; // light brown / gold
const W = [255, 255, 255, 255]; // white
const P = [255, 200, 160, 255]; // pink/skin
const R = [244, 67, 54, 255]; // red
const G = [76, 175, 80, 255]; // green
const BL = [33, 150, 243, 255]; // blue
const PR = [156, 39, 176, 255]; // purple
const T = [0, 150, 136, 255]; // teal
const O = [255, 152, 0, 255]; // orange
const PK = [255, 107, 138, 255]; // pink
const Y = [255, 215, 0, 255]; // gold/yellow
const GR = [158, 158, 158, 255]; // gray
const CR = [255, 243, 232, 255]; // cream
const DB = [160, 90, 40, 255]; // dark brown

// ===== 멍도령 마스코트 (시바견 + 갓) =====
const MASCOT = [
  [_, _, _, _, _, K, K, K, K, K, K, _, _, _, _, _],
  [_, _, _, _, K, GR, GR, GR, GR, GR, GR, K, _, _, _, _],
  [_, _, _, K, GR, K, K, K, K, K, K, GR, K, _, _, _],
  [_, _, K, B, B, K, _, _, _, _, K, B, B, K, _, _],
  [_, K, B, B, B, B, K, K, K, K, B, B, B, B, K, _],
  [_, K, B, L, L, B, B, B, B, B, B, L, L, B, K, _],
  [K, B, B, L, L, B, B, B, B, B, B, L, L, B, B, K],
  [K, B, B, B, B, B, B, B, B, B, B, B, B, B, B, K],
  [K, B, B, K, K, B, B, W, W, B, B, K, K, B, B, K],
  [K, B, B, K, K, B, B, B, B, B, B, K, K, B, B, K],
  [K, B, B, B, B, B, W, W, W, W, B, B, B, B, B, K],
  [_, K, B, B, B, B, B, K, K, B, B, B, B, B, K, _],
  [_, K, B, B, B, B, B, B, B, B, B, B, B, B, K, _],
  [_, _, K, B, B, B, B, B, B, B, B, B, B, K, _, _],
  [_, _, _, K, K, B, B, B, B, B, B, K, K, _, _, _],
  [_, _, _, _, K, K, K, K, K, K, K, K, _, _, _, _],
];

// ===== Service icons (16x16 each) =====
function solidIcon(bgColor, fgColor, pattern) {
  const grid = Array.from({ length: 16 }, () => Array(16).fill(bgColor));
  // border
  for (let i = 0; i < 16; i++) {
    grid[0][i] = K; grid[15][i] = K; grid[i][0] = K; grid[i][15] = K;
  }
  // inner pattern
  for (const [y, x] of pattern) {
    if (y >= 0 && y < 16 && x >= 0 && x < 16) grid[y][x] = fgColor;
  }
  return grid;
}

// Crystal ball pattern for 종합사주
const COMPREHENSIVE_PATTERN = [];
for (let y = 4; y <= 11; y++) for (let x = 5; x <= 10; x++) {
  const dx = x - 7.5, dy = y - 7.5;
  if (dx * dx + dy * dy <= 12) COMPREHENSIVE_PATTERN.push([y, x]);
}

const SERVICE_ICONS = {
  comprehensive: solidIcon([224, 208, 255, 255], PR, COMPREHENSIVE_PATTERN),
  compatibility: solidIcon([255, 224, 235, 255], PK, [[4,5],[4,6],[4,9],[4,10],[5,4],[5,5],[5,6],[5,7],[5,8],[5,9],[5,10],[5,11],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[6,10],[6,11],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[8,6],[8,7],[8,8],[8,9],[9,7],[9,8],[10,7],[10,8]]),
  daeun: solidIcon([224, 240, 255, 255], BL, [[4,3],[4,4],[5,2],[5,3],[5,4],[5,5],[6,3],[6,4],[6,5],[6,6],[7,4],[7,5],[7,6],[7,7],[8,5],[8,6],[8,7],[8,8],[9,6],[9,7],[9,8],[9,9],[10,7],[10,8],[10,9],[10,10],[11,8],[11,9],[11,10],[11,11],[12,9],[12,10]]),
  yearly: solidIcon([232, 224, 255, 255], [100, 60, 180, 255], [[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[5,5],[5,10],[6,5],[6,10],[7,5],[7,10],[8,5],[8,6],[8,7],[8,8],[8,9],[8,10],[10,6],[10,7],[10,8],[10,9],[12,5],[12,6],[12,7],[12,8],[12,9],[12,10]]),
  daily: solidIcon([255, 243, 224, 255], O, [[3,7],[3,8],[4,6],[4,7],[4,8],[4,9],[5,5],[5,6],[5,7],[5,8],[5,9],[5,10],[6,5],[6,6],[6,7],[6,8],[6,9],[6,10],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[8,6],[8,7],[8,8],[8,9],[9,7],[9,8],[2,7],[2,8],[10,7],[10,8],[6,3],[6,12],[7,3],[7,12]]),
  love: solidIcon([255, 224, 232, 255], R, [[4,4],[4,5],[4,9],[4,10],[5,3],[5,4],[5,5],[5,6],[5,8],[5,9],[5,10],[5,11],[6,3],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[6,10],[6,11],[7,4],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[8,5],[8,6],[8,7],[8,8],[8,9],[9,6],[9,7],[9,8],[10,7]]),
  wealth: solidIcon([255, 248, 224, 255], Y, [[4,6],[4,7],[4,8],[4,9],[5,5],[5,6],[5,10],[6,5],[6,7],[6,8],[7,5],[7,7],[7,8],[8,5],[8,7],[8,8],[9,5],[9,6],[9,10],[10,6],[10,7],[10,8],[10,9]]),
  health: solidIcon([232, 245, 233, 255], G, [[3,7],[3,8],[4,7],[4,8],[5,7],[5,8],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[6,10],[6,11],[7,4],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[7,11],[8,7],[8,8],[9,7],[9,8],[10,7],[10,8],[11,7],[11,8]]),
  career: solidIcon([227, 242, 253, 255], BL, [[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[4,4],[4,11],[5,4],[5,11],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[6,10],[6,11],[7,3],[7,4],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[7,11],[7,12],[8,3],[8,12],[9,3],[9,12],[10,3],[10,12],[11,3],[11,4],[11,5],[11,6],[11,7],[11,8],[11,9],[11,10],[11,11],[11,12]]),
  business: solidIcon([232, 234, 246, 255], [63, 81, 181, 255], [[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[5,4],[5,7],[5,8],[5,11],[7,4],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[7,11],[9,4],[9,7],[9,8],[9,11],[11,4],[11,5],[11,6],[11,7],[11,8],[11,9],[11,10],[11,11]]),
  chat: solidIcon([232, 245, 233, 255], G, [[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[4,3],[4,12],[5,3],[5,5],[5,6],[5,8],[5,9],[5,12],[6,3],[6,12],[7,3],[7,4],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[7,11],[7,12],[8,9],[8,10],[9,10],[9,11]]),
};

// Generate all icons
async function main() {
  const outDir = 'public/images/icons';
  mkdirSync(outDir, { recursive: true });

  // Mascot (32x scale = 512px)
  const mascotScaled = scalePixels(MASCOT, 32);
  const mascotPng = createPNG(mascotScaled.size, mascotScaled.size, mascotScaled.pixels);
  writeFileSync('public/images/mascot-pixel.png', mascotPng);
  console.log('✅ mascot-pixel.png (512x512)');

  // Favicon (16x scale = 256px)
  const faviconScaled = scalePixels(MASCOT, 16);
  const faviconPng = createPNG(faviconScaled.size, faviconScaled.size, faviconScaled.pixels);
  writeFileSync('public/favicon.png', faviconPng);
  console.log('✅ favicon.png (256x256)');

  // Service icons
  for (const [name, grid] of Object.entries(SERVICE_ICONS)) {
    const scaled = scalePixels(grid, 8); // 128x128
    const png = createPNG(scaled.size, scaled.size, scaled.pixels);
    writeFileSync(`${outDir}/${name}.png`, png);
    console.log(`✅ icons/${name}.png (128x128)`);
  }

  console.log('\nDone! Generated mascot + favicon + service icons');
}

main().catch(console.error);

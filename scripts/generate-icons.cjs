#!/usr/bin/env node
/**
 * Generate app icons: 256x256 PNG, .ico (Windows), .icns (macOS).
 * Run: node scripts/generate-icons.cjs
 */
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

async function main() {
  // 1) Create 256x256 PNG with Jimp (solid color; replace with your logo later)
  const { Jimp } = require('jimp');
  const size = 256;
  const img = new Jimp({ width: size, height: size, color: 0x0e639cff }); // #0e639c blue
  const pngPath = path.join(ASSETS, 'icon.png');
  await img.write(pngPath);
  console.log('Created', pngPath);

  // 2) PNG -> ICO for Windows
  const toIco = require('to-ico');
  const pngBuf = fs.readFileSync(pngPath);
  const icoBuf = await toIco(pngBuf, { resize: true });
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), icoBuf);
  console.log('Created assets/icon.ico');

  // 3) PNG -> ICNS for macOS (optional; icon-gen prefers Node 20+)
  try {
    const iconGen = require('icon-gen');
    await iconGen(pngPath, ASSETS, { name: 'icon', report: false });
    console.log('Created assets/icon.icns');
  } catch (e) {
    console.warn('icon.icns skipped (Node 20+ recommended for icon-gen):', e.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

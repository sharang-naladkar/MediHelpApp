/**
 * Generates the PWA icon set (PNG) from a parameterised SVG.
 * Run: npm run icons
 * Output: public/icons/{icon-192,icon-512,maskable-512,apple-touch-icon}.png
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "icons");

/**
 * Full-bleed red square with a white medical cross and four drone-rotor dots.
 * `contentScale` keeps the artwork inside the maskable safe zone when needed.
 */
function svg(contentScale) {
  const S = 512;
  const arm = 360 * contentScale; // cross arm length (tip to tip)
  const thick = 128 * contentScale; // cross bar thickness
  const dotOffset = 150 * contentScale; // rotor dot distance from center
  const dotR = 34 * contentScale;
  const rx = 64 * contentScale;
  const c = S / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="#dc2626"/>
  <g fill="#ffffff">
    <rect x="${c - thick / 2}" y="${c - arm / 2}" width="${thick}" height="${arm}" rx="${rx}"/>
    <rect x="${c - arm / 2}" y="${c - thick / 2}" width="${arm}" height="${thick}" rx="${rx}"/>
    <circle cx="${c - dotOffset}" cy="${c - dotOffset}" r="${dotR}"/>
    <circle cx="${c + dotOffset}" cy="${c - dotOffset}" r="${dotR}"/>
    <circle cx="${c - dotOffset}" cy="${c + dotOffset}" r="${dotR}"/>
    <circle cx="${c + dotOffset}" cy="${c + dotOffset}" r="${dotR}"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // "any" icons: artwork can go close to the edges.
  await sharp(Buffer.from(svg(1.0))).resize(192, 192).png().toFile(path.join(OUT_DIR, "icon-192.png"));
  await sharp(Buffer.from(svg(1.0))).resize(512, 512).png().toFile(path.join(OUT_DIR, "icon-512.png"));
  await sharp(Buffer.from(svg(1.0))).resize(180, 180).png().toFile(path.join(OUT_DIR, "apple-touch-icon.png"));

  // Maskable: artwork scaled into the safe zone (central ~80%).
  await sharp(Buffer.from(svg(0.6))).resize(512, 512).png().toFile(path.join(OUT_DIR, "maskable-512.png"));

  console.log("Icons written to", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

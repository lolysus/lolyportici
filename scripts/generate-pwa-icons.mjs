import sharp from "sharp";
import { mkdirSync } from "node:fs";

// Genera le icone della PWA per ogni ristorante.
//
// Marchio geometrico indipendente dai font (piatto + boccone): niente testo,
// così il risultato è identico ovunque venga rigenerato. Il colore distingue
// le due sedi — oro per YUKO, rosso per KouSushi.
//
// Rilancia con: node scripts/generate-pwa-icons.mjs

mkdirSync("public/brands", { recursive: true });

function markSvg(size, bg, fg, { ring, stroke, dot, bleed = true }) {
  const bgRect = bleed ? `<rect width="512" height="512" fill="${bg}"/>` : "";
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      ${bgRect}
      <circle cx="256" cy="256" r="${ring}" fill="none" stroke="${fg}" stroke-width="${stroke}"/>
      <circle cx="256" cy="256" r="${dot}" fill="${fg}"/>
    </svg>`,
  );
}

const brands = {
  yuko: { bg: "#D5AF55", fg: "#1A1206" },
  kousushi: { bg: "#E60012", fg: "#FFFFFF" },
};

for (const [slug, { bg, fg }] of Object.entries(brands)) {
  const any = markSvg(512, bg, fg, { ring: 168, stroke: 34, dot: 70 });
  await sharp(any).png().toFile(`public/brands/${slug}-icon-512.png`);
  await sharp(any).resize(192, 192).png().toFile(`public/brands/${slug}-icon-192.png`);
  // apple-touch: iOS arrotonda da sé, quindi pieno e senza trasparenza.
  await sharp(any).resize(180, 180).png().toFile(`public/brands/${slug}-apple-180.png`);
  // Maskable: marchio dentro la safe zone, per il mascheramento a cerchio/squircle.
  const maskable = markSvg(512, bg, fg, { ring: 132, stroke: 28, dot: 55 });
  await sharp(maskable).png().toFile(`public/brands/${slug}-maskable-512.png`);
}

// Badge notifica Android: monocromatico su trasparente, ricolorato dal sistema.
const badge = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 512 512">
    <circle cx="256" cy="256" r="150" fill="none" stroke="#FFFFFF" stroke-width="46"/>
    <circle cx="256" cy="256" r="64" fill="#FFFFFF"/>
  </svg>`,
);
await sharp(badge).png().toFile("public/brands/notification-badge.png");

console.log("Icone generate.");

#!/usr/bin/env node
// Génère les icônes PNG de la PWA à partir de public/icon.svg (Lot 5).
//   node tools/gen-icons.mjs
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = await readFile(join(PUBLIC, 'icon.svg'));

for (const size of [192, 512]) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(PUBLIC, `icon-${size}.png`));
  console.log(`✓ icon-${size}.png`);
}

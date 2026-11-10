#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * NAMNA — llevar las imágenes de diseño a Supabase
 *
 * Las imágenes decorativas (el hero de la portada, el de información,
 * las dos tarjetas) salen hoy de archivos locales en `assets/`, así
 * que cambiarlas exige tocar el código y desplegar.
 *
 * Esto sube las actuales a Storage y crea su fila en `imagenes_sitio`,
 * para que a partir de ahí se puedan cambiar desde el panel.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/subir-imagenes-sitio.mjs
 *
 *   --dry      enseña lo que haría
 *   --forzar   vuelve a subir las que ya estén
 *
 * Los archivos de `assets/` NO se tocan: siguen siendo el respaldo que
 * ve el visitante si Supabase no responde.
 * ════════════════════════════════════════════════════════════════
 */

import { readFileSync } from 'node:fs';

const DRY    = process.argv.includes('--dry');
const FORZAR = process.argv.includes('--forzar');
const URL_SB = process.env.SUPABASE_URL;
const KEY_SB = process.env.SUPABASE_SERVICE_KEY;

if (!DRY && (!URL_SB || !KEY_SB)) {
  console.error('\n  Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY. Usa --dry para probar.\n');
  process.exit(1);
}

let sharp = null;
try { ({ default: sharp } = await import('sharp')); } catch {}

/**
 * Los huecos vienen del atributo `data-site-img` del HTML.
 * Si añades uno nuevo en el código, añádelo también aquí y en
 * la constante HUECOS de panel.html.
 */
const HUECOS = [
  { clave: 'hero_main',   archivo: 'assets/hero_jewelry.webp' },
  { clave: 'hero_info',   archivo: 'assets/hero_info.webp' },
  { clave: 'info_card_1', archivo: 'assets/quienes_somos.webp' },
  { clave: 'info_card_2', archivo: 'assets/envios.webp' }
];

const cab = {
  apikey: KEY_SB,
  Authorization: `Bearer ${KEY_SB}`,
  'Content-Type': 'application/json'
};

const yaEstan = DRY ? new Set() : await fetch(`${URL_SB}/rest/v1/imagenes_sitio?select=clave`, { headers: cab })
  .then(r => r.json()).then(d => new Set(d.map(x => x.clave)));

console.log();
let subidas = 0, saltadas = 0;

for (const h of HUECOS) {
  if (yaEstan.has(h.clave) && !FORZAR) {
    console.log(`  · ${h.clave.padEnd(14)} ya está en Supabase (--forzar para rehacerla)`);
    saltadas++;
    continue;
  }

  let datos;
  try { datos = readFileSync(h.archivo); }
  catch { console.warn(`  ⚠ ${h.clave.padEnd(14)} no existe ${h.archivo}`); continue; }

  let ancho = null, alto = null;
  if (sharp) { const m = await sharp(datos).metadata(); ancho = m.width; alto = m.height; }

  const ruta = `_sitio/${h.clave}.webp`;

  if (DRY) {
    console.log(`  [dry] ${h.clave.padEnd(14)} ${h.archivo} → ${ruta}  ${ancho}x${alto}`);
    subidas++;
    continue;
  }

  const r = await fetch(`${URL_SB}/storage/v1/object/productos/${ruta}`, {
    method: 'POST',
    headers: { apikey: KEY_SB, Authorization: `Bearer ${KEY_SB}`, 'Content-Type': 'image/webp', 'x-upsert': 'true', 'cache-control': '31536000' },
    body: datos
  });
  if (!r.ok) { console.warn(`  ⚠ ${h.clave}: ${(await r.text()).slice(0, 120)}`); continue; }

  const url = `${URL_SB}/storage/v1/object/public/productos/${ruta}`;
  const fila = await fetch(`${URL_SB}/rest/v1/imagenes_sitio`, {
    method: 'POST',
    headers: { ...cab, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ clave: h.clave, url, ruta })
  });
  if (!fila.ok) { console.warn(`  ⚠ ${h.clave}: ${(await fila.text()).slice(0, 120)}`); continue; }

  console.log(`  ✓ ${h.clave.padEnd(14)} ${ancho}x${alto}  ${(datos.length / 1024).toFixed(0)} KB`);
  subidas++;
}

console.log(`\n  ${subidas} subidas · ${saltadas} ya estaban`);
console.log('  Los archivos de assets/ siguen intactos como respaldo.\n');

#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * NAMNA — generar sitemap.xml desde el catálogo real
 *
 * El sitemap escrito a mano tenía 6 URLs y ninguna de producto, así
 * que las 17 fichas no tenían forma de ser descubiertas. Además
 * declaraba cosas que no debería: una página `noindex`, un `.txt` y
 * un duplicado de la portada.
 *
 *   node scripts/generar-sitemap.mjs            # escribe sitemap.xml
 *   node scripts/generar-sitemap.mjs --dry      # solo lo enseña
 *
 * Volver a ejecutarlo cada vez que se añadan o retiren piezas.
 * Solo lee de Supabase con la clave pública: no escribe en la base.
 * ════════════════════════════════════════════════════════════════
 */

import { writeFileSync, readFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const SITIO = 'https://www.namnafine.com';

// La clave publicable sale del propio config.js del sitio: es pública
// por diseño y así no hay un segundo sitio donde mantenerla.
const cfg = readFileSync('js/config.js', 'utf8');
const URL_SB = (cfg.match(/SUPABASE_URL:\s*'([^']+)'/) || [])[1];
const CLAVE  = (cfg.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/) || [])[1];

if (!URL_SB || !CLAVE) {
  console.error('\n  No se pudo leer SUPABASE_URL / SUPABASE_ANON_KEY de js/config.js\n');
  process.exit(1);
}

// Páginas fijas. Se quedan fuera a propósito:
//   privacidad.html → no aporta nada a un buscador
//   llms.txt        → no es una página
//   index.html      → duplicado no canónico de "/"
//   producto.html   → sin ?id= es una ficha vacía
const ESTATICAS = [
  { ruta: '/',          prioridad: '1.0', frecuencia: 'daily'  },
  { ruta: '/info',      prioridad: '0.8', frecuencia: 'monthly' },
];

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const r = await fetch(`${URL_SB}/rest/v1/catalogo?select=id,nombre,actualizado_en,imagenes`, {
  headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}` }
});
if (!r.ok) {
  console.error(`\n  Supabase respondió ${r.status}. Sitemap NO regenerado (se conserva el actual).\n`);
  process.exit(1);
}
const productos = await r.json();

if (!Array.isArray(productos) || productos.length === 0) {
  console.error('\n  El catálogo vino vacío. Aborto para no dejar un sitemap sin productos.\n');
  process.exit(1);
}

const hoy = (productos[0].actualizado_en || new Date().toISOString()).slice(0, 10);

const bloques = [];

for (const p of ESTATICAS) {
  bloques.push(
    `  <url>\n` +
    `    <loc>${SITIO}${p.ruta}</loc>\n` +
    `    <lastmod>${hoy}</lastmod>\n` +
    `    <changefreq>${p.frecuencia}</changefreq>\n` +
    `    <priority>${p.prioridad}</priority>\n` +
    `  </url>`
  );
}

for (const prod of productos) {
  // Sin .html: el servidor redirige la forma con extension a /producto
  // perdiendo el ?id=. Esta es la que responde 200, y la misma que
  // declara el canonical de la ficha.
  const url = `${SITIO}/producto?id=${encodeURIComponent(prod.id)}`;
  const lastmod = (prod.actualizado_en || hoy).slice(0, 10);
  // La foto principal va en el sitemap: Google Imágenes es una vía de
  // entrada real para joyería, donde se compra por la vista.
  const foto = Array.isArray(prod.imagenes) && prod.imagenes[0] ? prod.imagenes[0] : null;

  bloques.push(
    `  <url>\n` +
    `    <loc>${esc(url)}</loc>\n` +
    `    <lastmod>${lastmod}</lastmod>\n` +
    `    <changefreq>weekly</changefreq>\n` +
    `    <priority>0.9</priority>` +
    (foto
      ? `\n    <image:image>\n` +
        `      <image:loc>${esc(foto)}</image:loc>\n` +
        `      <image:title>${esc(prod.nombre || prod.id)}</image:title>\n` +
        `    </image:image>`
      : '') +
    `\n  </url>`
  );
}

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<!-- Generado por scripts/generar-sitemap.mjs desde el catálogo de Supabase.\n` +
  `     No editar a mano: se reescribe. -->\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
  `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
  bloques.join('\n') + `\n` +
  `</urlset>\n`;

if (DRY) {
  console.log(xml);
  console.log(`\n  --dry: ${bloques.length} URLs (${ESTATICAS.length} estáticas + ${productos.length} productos). No se ha escrito nada.\n`);
} else {
  writeFileSync('sitemap.xml', xml);
  console.log(`\n  ✓ sitemap.xml: ${bloques.length} URLs — ${ESTATICAS.length} estáticas + ${productos.length} fichas de producto`);
  console.log(`  (antes tenía 6 y ninguna de producto)\n`);
}

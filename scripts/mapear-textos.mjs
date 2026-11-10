#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * NAMNA — mapear dónde va cada texto de la web
 *
 * Recorre los HTML buscando `data-txt="TXT-xxx"` y deduce de su sitio
 * en el documento una ficha legible: en qué página sale, en qué
 * sección, qué papel cumple (titular, botón, enlace de menú…) y qué
 * pone ahora mismo.
 *
 * Eso se vuelca en las columnas `pagina`, `seccion`, `papel`, `nota` y
 * `orden_ui` de la tabla `textos`, para que quien edite desde el panel
 * no vea un "TXT-017" sin más.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/mapear-textos.mjs
 *
 *   --dry   enseña el mapa sin escribir nada
 * ════════════════════════════════════════════════════════════════
 */

import { readFileSync } from 'node:fs';

const DRY = process.argv.includes('--dry');
const URL_SB = process.env.SUPABASE_URL;
const KEY_SB = process.env.SUPABASE_SERVICE_KEY;

if (!DRY && (!URL_SB || !KEY_SB)) {
  console.error('\n  Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.\n  Usa --dry para ver el mapa sin escribir.\n');
  process.exit(1);
}

// Páginas en el orden en que un visitante las recorre
const PAGINAS = [
  { archivo: 'index.html',    nombre: 'Portada',             base: 1000 },
  { archivo: 'info.html',     nombre: 'Información',         base: 2000 },
  { archivo: 'producto.html', nombre: 'Ficha de producto',   base: 3000 },
  { archivo: 'privacidad.html', nombre: 'Privacidad',        base: 4000 }
];

/** Qué papel cumple el elemento según su etiqueta y sus clases. */
function papelDe(etiqueta, atributos) {
  const cls = (atributos.match(/class="([^"]*)"/) || [, ''])[1].toLowerCase();
  const id  = (atributos.match(/\bid="([^"]*)"/) || [, ''])[1].toLowerCase();
  const señas = cls + ' ' + id;

  if (/announcement/.test(señas))                 return 'Barra superior';
  if (etiqueta === 'a' && /nav|menu/.test(señas)) return 'Enlace del menú';
  if (etiqueta === 'a' && /btn|button|cta/.test(señas)) return 'Botón';
  if (etiqueta === 'a')                           return 'Enlace';
  if (etiqueta === 'button')                      return 'Botón';
  if (/^h1$/.test(etiqueta))                      return 'Titular principal';
  if (/^h[23]$/.test(etiqueta))                   return 'Título de sección';
  if (/^h[456]$/.test(etiqueta))                  return 'Subtítulo';
  if (/label/.test(etiqueta))                     return 'Etiqueta de formulario';
  if (/subtitle|sub-|lead|tagline/.test(señas))   return 'Subtítulo';
  if (/eyebrow|overline|kicker/.test(señas))      return 'Antetítulo';
  if (/footer|copyright/.test(señas))             return 'Pie de página';
  if (/placeholder/.test(señas))                  return 'Texto de ayuda';
  return 'Párrafo';
}

/** ¿Estamos dentro de este elemento en esta posición? (abiertos > cerrados) */
function dentroDe(trozo, etiqueta) {
  const abre  = (trozo.match(new RegExp(`<${etiqueta}[\\s>]`, 'gi')) || []).length;
  const cierra = (trozo.match(new RegExp(`</${etiqueta}>`, 'gi')) || []).length;
  return abre > cierra;
}

/**
 * Dónde está el texto. Las zonas estructurales (pie, cabecera, panel
 * lateral) mandan sobre el último encabezado: si no, los enlaces del
 * pie heredaban el título de la sección anterior de la página.
 */
function seccionDe(html, posicion) {
  const trozo = html.slice(0, posicion);

  if (dentroDe(trozo, 'footer')) return 'Pie de página';
  if (dentroDe(trozo, 'header')) return 'Cabecera';
  if (dentroDe(trozo, 'aside'))  return 'Panel lateral';

  // Dentro de una <section> abierta: su id, y si hay un encabezado
  // suyo posterior, mejor ese
  const secciones = [...trozo.matchAll(/<section[^>]*\bid="([^"]+)"/gi)];
  const posSeccion = secciones.length ? trozo.lastIndexOf('<section') : -1;

  const encabezados = [...trozo.matchAll(/<h[123][^>]*>([\s\S]{0,120}?)<\/h[123]>/gi)];
  if (encabezados.length) {
    const ultimo = encabezados[encabezados.length - 1];
    const texto = ultimo[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (texto && ultimo.index > posSeccion) return texto.slice(0, 48);
  }

  if (secciones.length) {
    return secciones[secciones.length - 1][1]
      .replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return 'General';
}

/** Contenido actual del elemento, como pista de qué es. */
function contenidoDe(html, desde, etiqueta) {
  const cierre = html.indexOf(`</${etiqueta}`, desde);
  if (cierre === -1) return '';
  const dentro = html.slice(html.indexOf('>', desde) + 1, cierre);
  return dentro.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
}

// ── Recorrido ──
const mapa = new Map();

for (const pag of PAGINAS) {
  let html;
  try { html = readFileSync(pag.archivo, 'utf8'); }
  catch { continue; }

  const re = /<(\w+)([^>]*\bdata-txt="(TXT-[\w-]+)"[^>]*)>/gi;
  let m, n = 0;

  while ((m = re.exec(html)) !== null) {
    const [, etiqueta, atributos, id] = m;
    const tag = etiqueta.toLowerCase();

    // Un <span data-txt> dentro de un <a class="btn"> es un botón, no un
    // párrafo: para los elementos neutros miramos quién los envuelve.
    let tagEfectiva = tag, atrsEfectivos = atributos;
    if (/^(span|strong|em|b|i)$/.test(tag)) {
      const anterior = html.slice(Math.max(0, m.index - 400), m.index);
      const envoltorio = [...anterior.matchAll(/<(a|button|h[1-6]|label)([^>]*)>/gi)].pop();
      if (envoltorio) { tagEfectiva = envoltorio[1].toLowerCase(); atrsEfectivos = envoltorio[2]; }
    }
    const papel   = papelDe(tagEfectiva, atrsEfectivos);
    const seccion = seccionDe(html, m.index);
    const ahora   = contenidoDe(html, m.index, tag);

    if (!mapa.has(id)) {
      mapa.set(id, { id, apariciones: [], orden_ui: pag.base + (n++) });
    }
    mapa.get(id).apariciones.push({ pagina: pag.nombre, seccion, papel, ahora });
  }
}

// ── Redactar la ficha de cada texto ──
const filas = [...mapa.values()].map(t => {
  const primera = t.apariciones[0];
  const paginas = [...new Set(t.apariciones.map(a => a.pagina))];
  const papeles = [...new Set(t.apariciones.map(a => a.papel))];

  let nota = `${papeles.join(' / ')} en «${primera.seccion}»`;
  if (paginas.length > 1) {
    nota += `. Se repite en ${paginas.length} páginas: ${paginas.join(', ')}`;
  }
  if (t.apariciones.length > paginas.length) {
    nota += `. Sale ${t.apariciones.length} veces (p. ej. menú de escritorio y de móvil)`;
  }

  return {
    id: t.id,
    pagina: paginas.join(' · '),
    seccion: primera.seccion,
    papel: papeles[0],
    nota,
    orden_ui: t.orden_ui,
    _ahora: primera.ahora
  };
});

filas.sort((a, b) => a.orden_ui - b.orden_ui);

console.log(`\n  ${filas.length} textos localizados en el HTML\n`);
for (const f of filas) {
  console.log(`  ${f.id.padEnd(9)} ${f.pagina.padEnd(22)} ${f.papel.padEnd(22)} ${f.seccion}`);
  if (f._ahora) console.log(`            "${f._ahora}"`);
}

if (DRY) {
  console.log('\n  --dry: no se ha escrito nada.\n');
  process.exit(0);
}

// ── Guardar ──
const cabeceras = {
  apikey: KEY_SB,
  Authorization: `Bearer ${KEY_SB}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal'
};

let ok = 0, huerfanos = [];
const existentes = await fetch(`${URL_SB}/rest/v1/textos?select=id`, { headers: cabeceras })
  .then(r => r.json()).then(d => new Set(d.map(x => x.id)));

for (const f of filas) {
  if (!existentes.has(f.id)) { huerfanos.push(f.id); continue; }
  const { _ahora, ...campos } = f;
  const r = await fetch(`${URL_SB}/rest/v1/textos?id=eq.${encodeURIComponent(f.id)}`, {
    method: 'PATCH', headers: cabeceras, body: JSON.stringify(campos)
  });
  if (r.ok) ok++;
  else console.warn(`  ⚠ ${f.id}: ${await r.text()}`);
}

// Los que están en la base pero ya no se usan en ninguna página
const sinUsar = [...existentes].filter(id => !mapa.has(id)).sort();
if (sinUsar.length) {
  await fetch(`${URL_SB}/rest/v1/textos?id=in.(${sinUsar.map(encodeURIComponent).join(',')})`, {
    method: 'PATCH', headers: cabeceras,
    body: JSON.stringify({ pagina: 'Sin usar', seccion: '—', papel: 'Sin usar',
                           nota: 'No aparece en ninguna página. Puede ser de una versión anterior.',
                           orden_ui: 9000 })
  });
}

console.log(`\n  ✓ ${ok} textos documentados`);
if (sinUsar.length)   console.log(`  · ${sinUsar.length} marcados como "sin usar": ${sinUsar.join(', ')}`);
if (huerfanos.length) console.log(`  ⚠ ${huerfanos.length} usados en el HTML pero sin fila en la base: ${huerfanos.join(', ')}`);
console.log();

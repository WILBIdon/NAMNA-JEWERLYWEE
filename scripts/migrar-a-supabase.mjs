#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * NAMNA — migración de Google Sheets + Drive a Supabase
 *
 * Lee el catálogo del Apps Script actual (sin tocarlo) y lo vuelca
 * en Postgres + Storage. Las fotos se convierten a WebP si hay
 * `sharp` instalado; si no, se suben tal cual.
 *
 *   npm install @supabase/supabase-js
 *   npm install sharp            # opcional pero recomendado
 *
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_KEY="eyJ..." \
 *   node scripts/migrar-a-supabase.mjs
 *
 * Opciones:
 *   --dry        no escribe nada, solo informa de lo que haría
 *   --solo-datos migra productos y textos, se salta las fotos
 *   --forzar     vuelve a subir fotos que ya existen en Storage
 *
 * Es re-ejecutable: hace upsert por id y se salta las fotos ya
 * subidas salvo que pases --forzar. No borra nada en Google.
 * ════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';

const API = 'https://script.google.com/macros/s/AKfycbxw6YuRZnb-xskmMK3lMn3DpPczY77gE8vm9m-u69_Avfg3Iv2pNtlMskxSwnVVmIGT/exec';
const BUCKET = 'productos';
const ANCHO_MAX = 1400;
const CALIDAD = 82;

const args = new Set(process.argv.slice(2));
const DRY        = args.has('--dry');
const SOLO_DATOS = args.has('--solo-datos');
const FORZAR     = args.has('--forzar');

const URL_SB = process.env.SUPABASE_URL;
const KEY_SB = process.env.SUPABASE_SERVICE_KEY;

if (!DRY && (!URL_SB || !KEY_SB)) {
  console.error(`
  Faltan las variables de entorno.

    SUPABASE_URL          → Supabase · Project Settings · Data API · Project URL
    SUPABASE_SERVICE_KEY  → Supabase · Project Settings · API Keys · service_role

  La service_role salta el RLS: úsala solo aquí, nunca en el navegador,
  y no la dejes escrita en ningún archivo del repositorio.
  `);
  process.exit(1);
}

const sb = DRY ? null : createClient(URL_SB, KEY_SB, { auth: { persistSession: false } });

// ── sharp es opcional ──
let sharp = null;
try {
  ({ default: sharp } = await import('sharp'));
  console.log('✓ sharp disponible: las fotos se convertirán a WebP');
} catch {
  console.log('· sharp no instalado: las fotos se subirán sin convertir');
  console.log('  (npm install sharp  para reducirlas de ~300 KB a ~60 KB)');
}

const log   = (...a) => console.log(...a);
const aviso = (...a) => console.warn('  ⚠ ', ...a);

/** "N. Ruby D" → "n-ruby-d" */
function slug(texto) {
  return String(texto)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'producto';
}

/** Pide a Drive el original en vez de la miniatura de 800 px */
function urlOriginal(url) {
  return String(url).replace(/=w\d+$/, `=w${ANCHO_MAX * 2}`);
}

function fileIdDeDrive(url) {
  const m = String(url).match(/\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function descargar(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1024) throw new Error(`respuesta de ${buf.length} bytes, parece un error`);
  return buf;
}

async function optimizar(buf) {
  if (!sharp) return { datos: buf, tipo: 'image/jpeg', ext: 'jpg', ancho: null, alto: null };
  const img = sharp(buf, { failOn: 'none' });
  const meta = await img.metadata();
  const datos = await img
    .rotate()
    .resize({ width: ANCHO_MAX, withoutEnlargement: true })
    .webp({ quality: CALIDAD })
    .toBuffer();
  const metaFinal = await sharp(datos).metadata();
  return { datos, tipo: 'image/webp', ext: 'webp', ancho: metaFinal.width, alto: metaFinal.height, antes: buf.length };
}

// ════════════════════════════════════════════════════════════════
async function main() {
  log('\n── 1. Leyendo el catálogo actual ──');
  const origen = await fetch(API).then(r => r.json());
  const productos = origen.productos || origen.items || [];
  const textosEs = (origen.textos && origen.textos.es) || origen.textos_es || {};
  const textosEn = (origen.textos && origen.textos.en) || origen.textos_en || {};
  const imagenesSitio = origen.imagenesSitio || {};

  const totalFotos = productos.reduce((s, p) => s + (p.imagenes || []).length, 0);
  log(`   ${productos.length} productos · ${totalFotos} fotos · ` +
      `${Object.keys(textosEs).length} textos ES / ${Object.keys(textosEn).length} EN`);

  if (!productos.length) {
    console.error('   El origen no devolvió productos. Aborto para no vaciar nada.');
    process.exit(1);
  }

  // ── 2. Productos ──
  log('\n── 2. Productos ──');
  const filas = productos.map((p, i) => ({
    id: String(p.id).trim(),
    nombre: p.nombre || '',
    descripcion_es: p.descripcion_es || p.descripcion || '',
    descripcion_en: p.descripcion_en || '',
    categoria_es: p.categoria_es || p.categoria || '',
    categoria_en: p.categoria_en || '',
    precio: Number(p.precio) || 0,
    // Apps Script convierte la celda vacía de Stock en 0, y el sitio antiguo
    // lo deshacía con `Number(stock) || null`. Si no lo replicamos, los 17
    // productos entran con stock 0 y la web los marca «Agotado».
    // 0 en el origen = sin dato, no cero unidades.
    stock: (p.stock === null || p.stock === undefined || p.stock === '' || Number(p.stock) === 0)
      ? null : Number(p.stock),
    visible: true,              // el origen solo devuelve los visibles
    orden: i
  }));

  if (DRY) {
    log(`   [dry] upsert de ${filas.length} filas`);
    filas.slice(0, 3).forEach(f => log(`         ${f.id} · ${f.precio} € · ${f.categoria_es}`));
  } else {
    const { error } = await sb.from('productos').upsert(filas, { onConflict: 'id' });
    if (error) throw new Error('productos: ' + error.message);
    log(`   ✓ ${filas.length} productos`);
  }

  // ── 3. Textos ──
  log('\n── 3. Textos ──');
  const ids = [...new Set([...Object.keys(textosEs), ...Object.keys(textosEn)])];
  const filasTexto = ids.map(id => ({ id, es: textosEs[id] || '', en: textosEn[id] || '' }));
  if (DRY) {
    log(`   [dry] upsert de ${filasTexto.length} textos`);
  } else if (filasTexto.length) {
    const { error } = await sb.from('textos').upsert(filasTexto, { onConflict: 'id' });
    if (error) throw new Error('textos: ' + error.message);
    log(`   ✓ ${filasTexto.length} textos`);
  }

  if (SOLO_DATOS) { log('\n--solo-datos: fotos omitidas.\n'); return; }

  // ── 4. Fotos ──
  log('\n── 4. Fotos ──');
  let existentes = new Set();
  if (!DRY && !FORZAR) {
    const { data } = await sb.from('imagenes').select('ruta');
    existentes = new Set((data || []).map(r => r.ruta));
    if (existentes.size) log(`   ${existentes.size} fotos ya migradas, se saltan (--forzar para rehacerlas)`);
  }

  let subidas = 0, saltadas = 0, fallidas = 0, bytesAntes = 0, bytesDespues = 0;

  for (const p of productos) {
    const carpeta = slug(p.id);
    const fotos = p.imagenes || [];

    for (let i = 0; i < fotos.length; i++) {
      const urlDrive = fotos[i];
      if (!/googleusercontent|drive\.google/.test(urlDrive)) { saltadas++; continue; }

      const extTentativa = sharp ? 'webp' : 'jpg';
      const ruta = `${carpeta}/${String(i).padStart(2, '0')}.${extTentativa}`;

      if (existentes.has(ruta)) { saltadas++; continue; }
      if (DRY) { log(`   [dry] ${ruta}  ←  ${urlDrive.slice(0, 60)}…`); subidas++; continue; }

      try {
        const bruto = await descargar(urlOriginal(urlDrive));
        const { datos, tipo, ancho, alto } = await optimizar(bruto);
        bytesAntes += bruto.length;
        bytesDespues += datos.length;

        const { error: errSubida } = await sb.storage.from(BUCKET)
          .upload(ruta, datos, { contentType: tipo, upsert: true, cacheControl: '31536000' });
        if (errSubida) throw new Error(errSubida.message);

        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(ruta);

        const { error: errFila } = await sb.from('imagenes').upsert({
          producto_id: String(p.id).trim(),
          ruta, url: pub.publicUrl, orden: i,
          ancho, alto, bytes: datos.length,
          origen_drive: fileIdDeDrive(urlDrive)
        }, { onConflict: 'ruta' });
        if (errFila) throw new Error(errFila.message);

        subidas++;
        process.stdout.write(`\r   ${subidas} subidas · ${fallidas} fallos   `);
      } catch (e) {
        fallidas++;
        aviso(`${ruta}: ${e.message}`);
      }
    }
  }

  log(`\n   ✓ ${subidas} subidas · ${saltadas} saltadas · ${fallidas} fallos`);
  if (bytesAntes) {
    const mb = n => (n / 1024 / 1024).toFixed(1);
    log(`   Peso: ${mb(bytesAntes)} MB → ${mb(bytesDespues)} MB ` +
        `(−${Math.round((1 - bytesDespues / bytesAntes) * 100)} %)`);
  }

  // ── 5. Imágenes decorativas ──
  const clavesSitio = Object.keys(imagenesSitio);
  if (clavesSitio.length) {
    log('\n── 5. Imágenes del sitio ──');
    for (const clave of clavesSitio) {
      const url = imagenesSitio[clave];
      if (!url) continue;
      const ruta = `_sitio/${slug(clave)}.${sharp ? 'webp' : 'jpg'}`;
      if (DRY) { log(`   [dry] ${ruta}`); continue; }
      try {
        const { datos, tipo } = await optimizar(await descargar(urlOriginal(url)));
        await sb.storage.from(BUCKET).upload(ruta, datos, { contentType: tipo, upsert: true, cacheControl: '31536000' });
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(ruta);
        await sb.from('imagenes_sitio').upsert({ clave, url: pub.publicUrl, ruta }, { onConflict: 'clave' });
        log(`   ✓ ${clave}`);
      } catch (e) { aviso(`${clave}: ${e.message}`); }
    }
  }

  // ── 6. Comprobación ──
  if (!DRY) {
    log('\n── 6. Comprobación ──');
    const [{ count: nProd }, { count: nImg }, { count: nTxt }] = await Promise.all([
      sb.from('productos').select('*', { count: 'exact', head: true }),
      sb.from('imagenes').select('*', { count: 'exact', head: true }),
      sb.from('textos').select('*', { count: 'exact', head: true })
    ]);
    log(`   En Supabase: ${nProd} productos · ${nImg} imágenes · ${nTxt} textos`);
    log(`   En el origen: ${productos.length} productos · ${totalFotos} imágenes · ${ids.length} textos`);
    if (nProd !== productos.length || nImg !== totalFotos) {
      aviso('Los totales no cuadran. Revisa los fallos de arriba y vuelve a ejecutar.');
    } else {
      log('   ✓ Todo cuadra.');
    }
  }

  log('\nHecho. La Hoja de Google y Drive siguen intactos como respaldo.\n');
}

main().catch(e => { console.error('\n✖ ', e.message, '\n'); process.exit(1); });

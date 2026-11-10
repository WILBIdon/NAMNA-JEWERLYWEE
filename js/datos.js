/**
 * ════════════════════════════════════════════════════════════════
 * NAMNA — capa de datos
 *
 * Única puerta de entrada al catálogo. Intenta Supabase y, si no
 * está configurado o falla, cae a Apps Script. El resto del sitio
 * no se entera de cuál de los dos respondió.
 *
 * Hablamos con Supabase por REST (PostgREST) con fetch a pelo, sin
 * cargar la librería: son tres peticiones GET y así el sitio no
 * arrastra 100 KB de JavaScript de más.
 *
 * Requiere js/config.js cargado antes.
 * ════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  const CFG = window.NAMNA_CONFIG || {};
  const TIMEOUT_MS = 8000;

  function conTimeout(promesa, ms, etiqueta) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return promesa(ctrl.signal)
      .finally(() => clearTimeout(t))
      .catch(err => {
        throw new Error(`${etiqueta}: ${err.name === 'AbortError' ? 'tiempo agotado' : err.message}`);
      });
  }

  function rest(ruta, signal) {
    return fetch(`${CFG.SUPABASE_URL}/rest/v1/${ruta}`, {
      signal,
      headers: {
        apikey: CFG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${CFG.SUPABASE_ANON_KEY}`,
        Accept: 'application/json'
      }
    }).then(r => {
      if (!r.ok) return r.text().then(t => { throw new Error(`HTTP ${r.status} ${t.slice(0, 120)}`); });
      return r.json();
    });
  }

  /**
   * Quita de un texto lo que podria escaparse de una plantilla HTML.
   *
   * El catalogo se pinta con `innerHTML` en unos 30 sitios de app.js y
   * producto.js, metiendo el nombre, la categoria y la descripcion tanto
   * en el cuerpo como dentro de atributos (alt="...") y de llamadas
   * onclick('...'). Si alguien con acceso de escritura pusiera markup en
   * esos campos, se ejecutaria en el navegador de cada visitante.
   *
   * Se limpia AQUI, en la unica puerta por la que entran los datos, en vez
   * de escapar en los 30 puntos de salida: no hay forma de olvidarse de uno.
   *
   * No se escapan entidades (&amp;) porque estos mismos valores van tambien
   * a document.title y a metaetiquetas, donde se verian literales. Se
   * eliminan los angulos y se cambian las comillas por tipograficas, que en
   * una web de joyeria ademas se leen mejor.
   */
  function limpiar(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
      .replace(/[<>]/g, '')        // sin etiquetas: mata el vector de raiz
      .replace(/"/g, '\u201d')      // no puede cerrar un atributo
      .replace(/'/g, '\u2019')      // no puede cerrar un onclick('...')
      .replace(/\u0000/g, '');
  }

  /**
   * Normaliza un producto al formato que ya usan app.js y producto.js:
   * descripcion y categoria son getters que siguen el idioma activo.
   */
  function normalizar(item, estado) {
    const imgs = Array.isArray(item.imagenes) && item.imagenes.length
      ? item.imagenes.slice()
      : [];

    const obj = {
      id: limpiar(item.id),
      nombre: limpiar(item.nombre) || 'Producto sin nombre',
      _descripcion_es: limpiar(item.descripcion_es),
      _descripcion_en: limpiar(item.descripcion_en || item.descripcion_es),
      _categoria_es: limpiar(item.categoria_es) || 'Joyería',
      _categoria_en: limpiar(item.categoria_en || item.categoria_es) || 'Jewelry',
      precioPublico: Number(item.precio) || 0,
      // Apps Script convierte la celda vacia de Stock en 0. Si lo
      // tomaramos al pie de la letra, al caer al respaldo los 17
      // productos saldrian "Agotado" y con el boton de WhatsApp
      // desactivado: el respaldo cerraria la tienda en vez de salvarla.
      stock: (item.stock === null || item.stock === undefined || Number(item.stock) === 0)
        ? null : Number(item.stock),
      visible: item.visible !== false,
      imagenes: imgs
    };

    Object.defineProperties(obj, {
      descripcion: {
        get: () => (estado.lang === 'en' ? obj._descripcion_en : obj._descripcion_es),
        enumerable: true
      },
      categoria: {
        get: () => (estado.lang === 'en' ? obj._categoria_en : obj._categoria_es),
        enumerable: true
      }
    });

    return obj;
  }

  /**
   * Trae catálogo, textos e imágenes del sitio de Supabase.
   * @param {object} estado  el `state` global, para leer el idioma
   * @returns {Promise<{productos, textos_es, textos_en, imagenesSitio, origen, ms}>}
   */
  async function desdeSupabase(estado) {
    const t0 = performance.now();

    const [filas, textos, imgsSitio] = await Promise.all([
      conTimeout(s => rest('catalogo?select=*', s), TIMEOUT_MS, 'catálogo'),
      conTimeout(s => rest('textos?select=id,es,en', s), TIMEOUT_MS, 'textos'),
      conTimeout(s => rest('imagenes_sitio?select=clave,url', s), TIMEOUT_MS, 'imágenes del sitio')
        .catch(() => [])   // no es crítico
    ]);

    if (!Array.isArray(filas) || filas.length === 0) {
      throw new Error('Supabase respondió sin productos');
    }

    const textos_es = {};
    const textos_en = {};
    (textos || []).forEach(t => {
      textos_es[t.id] = limpiar(t.es);
      textos_en[t.id] = limpiar(t.en || t.es);
    });

    const imagenesSitio = {};
    (imgsSitio || []).forEach(i => { imagenesSitio[i.clave] = i.url; });

    return {
      productos: filas.map(f => normalizar(f, estado)),
      textos_es, textos_en, imagenesSitio,
      origen: 'supabase',
      ms: Math.round(performance.now() - t0)
    };
  }

  /** Lo que ya había: Apps Script. Se mantiene como red de seguridad. */
  async function desdeAppsScript(estado) {
    const t0 = performance.now();
    const datos = await conTimeout(
      s => fetch(CFG.APPS_SCRIPT_URL, { signal: s }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      TIMEOUT_MS, 'Apps Script'
    );
    if (datos.error) throw new Error(datos.message || 'error del servidor');

    const lista = datos.productos || datos.items || datos;
    if (!Array.isArray(lista) || !lista.length) throw new Error('Apps Script respondió sin productos');

    const textos_es = (datos.textos && datos.textos.es) || {};
    const textos_en = (datos.textos && datos.textos.en) || textos_es;

    return {
      productos: lista.map(p => normalizar({
        id: p.id,
        nombre: p.nombre,
        descripcion_es: p.descripcion_es || p.descripcion,
        descripcion_en: p.descripcion_en,
        categoria_es: p.categoria_es || p.categoria,
        categoria_en: p.categoria_en,
        precio: p.precio,
        stock: p.stock,
        visible: true,
        imagenes: p.imagenes
      }, estado)),
      textos_es, textos_en,
      imagenesSitio: datos.imagenesSitio || {},
      origen: 'apps-script',
      ms: Math.round(performance.now() - t0)
    };
  }

  /**
   * Carga el catálogo de donde se pueda. Supabase primero.
   * Lanza solo si fallan los dos.
   */
  async function cargarCatalogo(estado) {
    const fallos = [];

    if (CFG.usaSupabase) {
      try {
        const r = await desdeSupabase(estado);
        console.log(`⚡ NAMNA: ${r.productos.length} productos desde Supabase en ${r.ms} ms`);
        return r;
      } catch (e) {
        fallos.push(e.message);
        console.warn('NAMNA: Supabase no respondió, probando Apps Script —', e.message);
      }
    }

    if (CFG.APPS_SCRIPT_URL && CFG.APPS_SCRIPT_URL.trim()) {
      try {
        const r = await desdeAppsScript(estado);
        console.log(`NAMNA: ${r.productos.length} productos desde Apps Script en ${r.ms} ms (respaldo)`);
        return r;
      } catch (e) {
        fallos.push(e.message);
      }
    }

    throw new Error('No se pudo cargar el catálogo. ' + fallos.join(' · '));
  }

  /** Cuánto dura la caché del navegador según de dónde vengan los datos. */
  function duracionCache(origen) {
    return origen === 'supabase'
      ? (CFG.CACHE_DURATION_MS || 600000)
      : (CFG.CACHE_DURATION_FALLBACK_MS || 21600000);
  }

  window.NAMNA_DATOS = { cargarCatalogo, desdeSupabase, desdeAppsScript, duracionCache, normalizar, limpiar };
})();

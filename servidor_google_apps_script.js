/**
 * ================================================================
 * NAMNA JEWERLYWEE — Servidor Seguro Avanzado (Google Apps Script)
 * v1.6 — Junio 2026
 *
 * BLOQUES:
 * 1. doGet()           → API Web: sirve productos + fotos + textos
 * 2. autoCategorizar() → Rellena Categoría según prefijo del ID
 *    (N. = Necklace | E. = Earrings)
 * ================================================================
 */

const DRIVE_FOLDER_ID = "1U0PAfAUyimmUvDojxNygvhYYXtrteSuF";
const MASTER_SHEET_ID = "1Xb29JGt7XgwT_YJ08zusT6kvZs4w5lCn7H1lDlCzxbc"; // ← Hoja Maestra
const FALLBACK_IMAGE_URL = "https://via.placeholder.com/600x600/F3ECE3/3B4643?text=NAMNA+Jewelry";

// ═══════════════════════════════════════════════════════════════
// BLOQUE 1: LA API WEB (Sirve los datos al catálogo)
// ═══════════════════════════════════════════════════════════════
function doGet() {
  try {
    // IMPORTANTE: openById() es necesario cuando se ejecuta como API web.
    // getActiveSpreadsheet() solo funciona desde el editor, no en producción.
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);

    // ── PRODUCTOS (Hoja activa / primera pestaña) ──
    const sheet = ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();

    const headers = data[0];
    if (!headers.includes("ID_Producto") || !headers.includes("Precio_Publico") || !headers.includes("Visible")) {
      throw new Error("Estructura de la hoja alterada. Faltan columnas críticas.");
    }

    const idx = {
      id: headers.indexOf("ID_Producto"),
      nombre: headers.indexOf("Nombre"),
      desc: headers.indexOf("Descripción"),
      cat: headers.indexOf("Categoría"),
      precioPub: headers.indexOf("Precio_Publico"),
      visible: headers.indexOf("Visible"),
      stock: headers.indexOf("Stock")
    };

    // ── INDEXACIÓN EN MEMORIA (Fotos principales + Hijas) ──
    const mapaFotos = crearMapaFotos(DRIVE_FOLDER_ID);

    const productosValidos = [];

    // ── PROCESAMIENTO ──
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      const idProducto = String(row[idx.id]).trim();
      if (!idProducto) continue;

      const isVisible = String(row[idx.visible]).trim().toLowerCase();
      if (isVisible !== "sí" && isVisible !== "si") continue;

      const precio = Number(row[idx.precioPub]) || 0;
      const stock = Number(row[idx.stock]) || 0;
      const nombre = row[idx.nombre] ? String(row[idx.nombre]).trim() : "Producto sin nombre";
      const cat = row[idx.cat] ? String(row[idx.cat]).trim() : "Joyería";
      const desc = row[idx.desc] ? String(row[idx.desc]).trim() : "";

      // Quitamos espacios y puntos finales para hacer el match infalible
      let searchKey = idProducto.toLowerCase().replace(/\.+$/, '');
      const fotosDrive = mapaFotos[searchKey];
      let imagenes = [FALLBACK_IMAGE_URL];

      if (fotosDrive) {
        imagenes = [];
        if (fotosDrive.principal) {
          imagenes.push(`https://drive.google.com/thumbnail?id=${fotosDrive.principal}&sz=w800`);
        }
        fotosDrive.hijas.forEach(idHija => {
          imagenes.push(`https://drive.google.com/thumbnail?id=${idHija}&sz=w800`);
        });
        if (imagenes.length === 0) {
          imagenes.push(FALLBACK_IMAGE_URL);
        }
      }

      productosValidos.push({
        id: idProducto,
        nombre: nombre,
        descripcion: desc,
        categoria: cat,
        precio: precio,
        stock: stock,
        imagenes: imagenes,
        _debugKey: searchKey,
        _debugFound: !!fotosDrive
      });
    }

    // ── TEXTOS DINÁMICOS (Pestaña "Textos") ──
    const textos = leerTextos(ss);

    // ── IMÁGENES DEL SITIO (Carpeta Site_Assets) ──
    const imagenesSitio = leerImagenesSitio(DRIVE_FOLDER_ID);

    return ContentService
      .createTextOutput(JSON.stringify({
        version: "3.1",
        keysEncontradasEnDrive: Object.keys(mapaFotos),
        productos: productosValidos,
        textos: textos,
        imagenesSitio: imagenesSitio
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: true, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ── MÓDULO DE TEXTOS DINÁMICOS ──
 * Lee la pestaña "TEXTOS" y devuelve un diccionario { "TXT-001": "texto...", ... }
 * Si la pestaña no existe, devuelve un objeto vacío (la web usa sus valores por defecto).
 */
function leerTextos(ss) {
  const resultado = {
    es: {},
    en: {},
    _debug: {}
  };
  
  try {
    const todasLasPestanas = ss.getSheets().map(s => s.getName());
    resultado._debug.pestanas = todasLasPestanas;

    let hojaTextos = null;
    const nombresIntento = ["TEXTOS", "TEXTO", "Textos", "Texto", "textos", "texto", "Texto_ES"];
    for (const nombre of nombresIntento) {
      hojaTextos = ss.getSheetByName(nombre);
      if (hojaTextos) {
        resultado._debug.pestanaEncontrada = nombre;
        break;
      }
    }

    if (!hojaTextos) {
      resultado._debug.error = "No se encontró ninguna pestaña de textos";
      return resultado;
    }

    const datosTextos = hojaTextos.getDataRange().getValues();
    const cabeceras = datosTextos[0];
    resultado._debug.cabeceras = cabeceras.filter(c => c !== "");

    let iId = cabeceras.indexOf("ID_Texto");
    if (iId === -1) iId = cabeceras.indexOf("ID");
    if (iId === -1) iId = cabeceras.indexOf("id_texto");
    if (iId === -1) iId = cabeceras.indexOf("Id_Texto");

    let iTextoES = cabeceras.indexOf("Texto_ES");
    if (iTextoES === -1) iTextoES = cabeceras.indexOf("Texto");
    if (iTextoES === -1) iTextoES = cabeceras.indexOf("texto_es");
    if (iTextoES === -1) iTextoES = cabeceras.indexOf("texto");

    let iTextoEN = cabeceras.indexOf("Texto_EN");
    if (iTextoEN === -1) iTextoEN = cabeceras.indexOf("texto_en");

    resultado._debug.columnaId = iId;
    resultado._debug.columnaTextoES = iTextoES;
    resultado._debug.columnaTextoEN = iTextoEN;
    resultado._debug.totalFilas = datosTextos.length - 1;

    if (iId === -1 || iTextoES === -1) {
      resultado._debug.error = "Columnas ID o Texto_ES no encontradas";
      return resultado;
    }

    for (let i = 1; i < datosTextos.length; i++) {
      const id = String(datosTextos[i][iId]).trim();
      const textoES = String(datosTextos[i][iTextoES]).trim();
      const textoEN = iTextoEN !== -1 ? String(datosTextos[i][iTextoEN]).trim() : "";
      
      if (id && !id.startsWith("_")) {
        if (textoES) resultado.es[id] = textoES;
        // Si no hay traducción, usamos español como fallback
        resultado.en[id] = textoEN ? textoEN : textoES;
      }
    }
    resultado._debug.textosLeidosES = Object.keys(resultado.es).length;
    resultado._debug.textosLeidosEN = Object.keys(resultado.en).length;
  } catch (e) {
    resultado._debug.error = e.toString();
  }
  return resultado;
}

/**
 * ── MÓDULO DE MAPEO: SOPORTE PARA FOTOS HIJAS ──
 * Estructura del mapa:
 * mapa["n. ruby d."] = { principal: "id1", hijas: ["id2", "id3"] }
 */
function crearMapaFotos(folderId) {
  const mapa = {};
  try {
    const folder = DriveApp.getFolderById(folderId);
    const archivos = folder.getFiles();

    while (archivos.hasNext()) {
      const archivo = archivos.next();
      const id = archivo.getId();
      const nombreCompleto = archivo.getName();

      // Obtener el nombre sin la extensión (soporta nombres con puntos)
      let nombreSinExt = nombreCompleto.replace(/\.[a-zA-Z0-9]{3,4}$/, '');
      nombreSinExt = nombreSinExt.trim().toLowerCase();

      // EXCLUSIÓN: Si termina en punto (antes de la extensión), se ignora
      if (nombreSinExt.endsWith('.')) {
        continue;
      }

      const match = nombreSinExt.match(/-(\d+)$/);
      // Usamos 0 para fotos sin sufijo, así se ordenan primero
      const suffixNum = match ? parseInt(match[1], 10) : 0;

      // Quitamos el sufijo y también eliminamos cualquier PUNTO final sobrante
      let baseCode = nombreSinExt.replace(/-\d+$/, '').trim();
      baseCode = baseCode.replace(/\.+$/, '').trim();

      if (!mapa[baseCode]) {
        mapa[baseCode] = { lista: [] };
      }

      mapa[baseCode].lista.push({ id: id, num: suffixNum });
    }

    // Ahora ordenamos y asignamos principal y múltiples hijas
    for (const key in mapa) {
      const item = mapa[key];
      // Ordenar ascendentemente por el número (-1, -2, -3...)
      item.lista.sort((a, b) => a.num - b.num);

      if (item.lista.length > 0) {
        item.principal = item.lista[0].id;
        item.hijas = item.lista.slice(1).map(x => x.id);
      } else {
        item.principal = null;
        item.hijas = [];
      }
      delete item.lista; // Limpiar propiedad temporal
    }
  } catch (e) {
    console.error("Error leyendo carpeta de Drive", e);
  }
  return mapa;
}

// ═══════════════════════════════════════════════════════════════
// BLOQUE 2: AUTO-CATEGORIZAR (rellena columna Categoría)
// ═══════════════════════════════════════════════════════════════
/**
 * Rellena automáticamente la columna "Categoría" según el prefijo del ID_Producto:
 *   N. → Necklace
 *   E. → Earrings
 * La última letra del ID indica el color: D=Diamond, Y=Yellow, R=Red
 * 
 * Cómo usar: En Apps Script → Ejecutar → autoCategorizar
 */
function autoCategorizar() {
  try {
    const hoja = SpreadsheetApp.openById(MASTER_SHEET_ID).getSheets()[0];
    const datos = hoja.getDataRange().getValues();
    const cabeceras = datos[0];

    const iId = cabeceras.indexOf("ID_Producto");
    const iCat = cabeceras.indexOf("Categoría");

    if (iId === -1 || iCat === -1) {
      SpreadsheetApp.getUi().alert("❌ No se encontraron columnas ID_Producto o Categoría.");
      return;
    }

    // Mapa de prefijos → categoría
    const PREFIJOS = {
      "n.": "Necklace",
      "e.": "Earrings",
    };

    let actualizados = 0;
    let omitidos = 0;

    for (let i = 1; i < datos.length; i++) {
      const idRaw = String(datos[i][iId]).trim();
      if (!idRaw) continue;

      const idLower = idRaw.toLowerCase();
      let categoriaAsignada = null;

      for (const [prefijo, cat] of Object.entries(PREFIJOS)) {
        if (idLower.startsWith(prefijo)) {
          categoriaAsignada = cat;
          break;
        }
      }

      if (categoriaAsignada) {
        // Solo actualiza si la celda está vacía
        const catActual = String(datos[i][iCat]).trim();
        if (!catActual) {
          hoja.getRange(i + 1, iCat + 1).setValue(categoriaAsignada);
          actualizados++;
        } else {
          omitidos++;
        }
      }
    }

    SpreadsheetApp.getUi().alert(
      `✅ Auto-categorización completa.\n` +
      `- Actualizados: ${actualizados} productos\n` +
      `- Omitidos (ya tenían categoría): ${omitidos}`
    );

  } catch (error) {
    try { SpreadsheetApp.getUi().alert("❌ Error: " + error.message); } catch (e) { }
  }
}

/**
 * ── MÓDULO IMÁGENES DEL SITIO ──
 * Busca la carpeta "Site_Assets" dentro de la carpeta principal
 * y devuelve un mapa con los nombres de archivo (sin extensión) y sus URLs.
 */
function leerImagenesSitio(folderId) {
  const imagenes = {};
  try {
    const parentFolder = DriveApp.getFolderById(folderId);
    const folders = parentFolder.getFoldersByName("Site_Assets");
    
    if (folders.hasNext()) {
      const siteAssetsFolder = folders.next();
      const files = siteAssetsFolder.getFiles();
      
      while (files.hasNext()) {
        const file = files.next();
        const mime = file.getMimeType();
        
        // Solo procesar imágenes
        if (mime.includes('image/')) {
          let name = file.getName().replace(/\.[a-zA-Z0-9]{3,4}$/, '').toLowerCase().trim();
          imagenes[name] = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1200`;
        }
      }
    }
  } catch (e) {
    imagenes._error = e.toString();
  }
  return imagenes;
}

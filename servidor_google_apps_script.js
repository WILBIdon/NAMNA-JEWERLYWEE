/**
 * ================================================================
 * NAMNA JEWERLYWEE — Servidor Seguro Avanzado (Google Apps Script)
 * 
 * MOTOR DE SINCRONIZACIÓN INTELIGENTE (Fase 1.5):
 * 1. Módulo Drive: Indexa fotos principales y fotos hijas (-1, -2).
 * 2. Módulo Sincronizador: Alimenta la Hoja Maestra desde la Lista 
 *    Externa, llenando columnas vacías y creando nuevos productos.
 * ================================================================
 */

const DRIVE_FOLDER_ID = "1U0PAfAUyimmUvDojxNygvhYYXtrteSuF";
const EXTERNAL_PRICE_LIST_ID = "1CvFgHa_Z5RUSVZgac1w4KBWGGhfpWq0y";
const FALLBACK_IMAGE_URL = "https://via.placeholder.com/600x600/F3ECE3/3B4643?text=NAMNA+Jewelry";

// ═══════════════════════════════════════════════════════════════
// BLOQUE 1: LA API WEB (Sirve los datos al catálogo)
// ═══════════════════════════════════════════════════════════════
function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

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

    return ContentService
      .createTextOutput(JSON.stringify({
        version: "3.0",
        keysEncontradasEnDrive: Object.keys(mapaFotos),
        productos: productosValidos,
        textos: textos
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
  const resultado = { _debug: {} };
  try {
    // Debug: listar TODAS las pestañas del spreadsheet
    const todasLasPestanas = ss.getSheets().map(s => s.getName());
    resultado._debug.pestanas = todasLasPestanas;

    // Intentar encontrar la pestaña probando varios nombres
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

    // Buscar columnas con varios nombres posibles
    let iId = cabeceras.indexOf("ID_Texto");
    if (iId === -1) iId = cabeceras.indexOf("ID");
    if (iId === -1) iId = cabeceras.indexOf("id_texto");
    if (iId === -1) iId = cabeceras.indexOf("Id_Texto");

    let iTexto = cabeceras.indexOf("Texto_ES");
    if (iTexto === -1) iTexto = cabeceras.indexOf("Texto");
    if (iTexto === -1) iTexto = cabeceras.indexOf("texto_es");
    if (iTexto === -1) iTexto = cabeceras.indexOf("texto");

    resultado._debug.columnaId = iId;
    resultado._debug.columnaTexto = iTexto;
    resultado._debug.totalFilas = datosTextos.length - 1;

    if (iId === -1 || iTexto === -1) {
      resultado._debug.error = "Columnas ID o Texto no encontradas";
      return resultado;
    }

    for (let i = 1; i < datosTextos.length; i++) {
      const id = String(datosTextos[i][iId]).trim();
      const texto = String(datosTextos[i][iTexto]).trim();
      if (id && texto && !id.startsWith("_")) {
        resultado[id] = texto;
      }
    }
    resultado._debug.textosLeidos = Object.keys(resultado).filter(k => k !== "_debug").length;
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

      const match = nombreSinExt.match(/-(\d+)$/);
      const suffix = match ? match[1] : "";

      // Quitamos el sufijo y también eliminamos cualquier PUNTO final sobrante
      let baseCode = nombreSinExt.replace(/-\d+$/, '').trim();
      baseCode = baseCode.replace(/\.+$/, '').trim();

      if (!mapa[baseCode]) {
        mapa[baseCode] = { principal: null, hijas: [] };
      }

      // Si no tiene número, o si el número es "1" o "01", es la foto principal
      if (suffix === "" || suffix === "1" || suffix === "01") {
        mapa[baseCode].principal = id;
      } else {
        // Cualquier otro número (-2, -02, -3, etc.) es hija
        mapa[baseCode].hijas.push(id);
      }
    }
  } catch (e) {
    console.error("Error leyendo carpeta de Drive", e);
  }
  return mapa;
}

// ═══════════════════════════════════════════════════════════════
// BLOQUE 2: SINCRONIZADOR DE CATÁLOGO (Precios -> Hoja Maestra)
// ═══════════════════════════════════════════════════════════════
function sincronizarCatalogo() {
  try {
    const hojaMaestra = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const datosMaestros = hojaMaestra.getDataRange().getValues();
    const cabecerasM = datosMaestros[0];

    // Indices Hoja Maestra
    const iIdM = cabecerasM.indexOf("ID_Producto");
    const iNomM = cabecerasM.indexOf("Nombre");
    const iDescM = cabecerasM.indexOf("Descripción");
    const iCatM = cabecerasM.indexOf("Categoría");
    const iPreM = cabecerasM.indexOf("Precio_Publico");
    const iVisM = cabecerasM.indexOf("Visible");
    const iStockM = cabecerasM.indexOf("Stock");

    if (iIdM === -1 || iPreM === -1) throw new Error("Faltan columnas en hoja maestra.");

    // Mapa de productos existentes en la maestra [ID -> IndiceFila]
    const productosMaestra = {};
    for (let i = 1; i < datosMaestros.length; i++) {
      const id = String(datosMaestros[i][iIdM]).trim().toLowerCase();
      if (id) productosMaestra[id] = i;
    }

    // Leer Lista Externa
    const hojaExterna = SpreadsheetApp.openById(EXTERNAL_PRICE_LIST_ID).getSheets()[0];
    const datosExternos = hojaExterna.getDataRange().getValues();
    const cabecerasExt = datosExternos[0];

    // Indices Lista Externa
    const iRefE = cabecerasExt.indexOf("Referencia");
    const iMetalE = cabecerasExt.indexOf("Peso metal ");
    const iCantE = cabecerasExt.indexOf("Cantidad");
    const iPiedraE = cabecerasExt.indexOf("Piedra ct");
    const iDiamE = cabecerasExt.indexOf("diamantes ct");
    const iPrecioE = cabecerasExt.indexOf("precio de venta");

    let filasNuevas = [];
    let actualizaciones = 0;

    for (let i = 1; i < datosExternos.length; i++) {
      const rowExt = datosExternos[i];
      const refRaw = rowExt[iRefE];
      if (!refRaw) continue;

      const ref = String(refRaw).trim();
      const refLower = ref.toLowerCase();

      // Limpieza de datos numéricos
      let precioNum = Number(String(rowExt[iPrecioE]).replace(/[^0-9.-]+/g, ""));
      let cantidadNum = Number(rowExt[iCantE]) || 0;

      // Generar descripción enriquecida
      let descAuto = [];
      if (rowExt[iMetalE]) descAuto.push(`Metal: ${rowExt[iMetalE]}`);
      if (rowExt[iPiedraE]) descAuto.push(`Piedra: ${rowExt[iPiedraE]}`);
      if (rowExt[iDiamE]) descAuto.push(`Diamantes: ${rowExt[iDiamE]}ct`);
      const descripcionFinal = descAuto.join(" • ");

      if (productosMaestra[refLower] !== undefined) {
        // ACTUALIZAR PRODUCTO EXISTENTE
        const rowIdx = productosMaestra[refLower];
        const numFilaSheet = rowIdx + 1; // +1 porque los arrays son base 0

        // Sobrescribir siempre Precio y Stock
        hojaMaestra.getRange(numFilaSheet, iPreM + 1).setValue(precioNum);
        hojaMaestra.getRange(numFilaSheet, iStockM + 1).setValue(cantidadNum);

        // Si la descripción o nombre están vacíos, llenarlos
        if (!datosMaestros[rowIdx][iNomM] && iNomM !== -1) {
          hojaMaestra.getRange(numFilaSheet, iNomM + 1).setValue(ref);
        }
        if (!datosMaestros[rowIdx][iDescM] && iDescM !== -1 && descripcionFinal) {
          hojaMaestra.getRange(numFilaSheet, iDescM + 1).setValue(descripcionFinal);
        }
        actualizaciones++;

      } else {
        // CREAR PRODUCTO NUEVO
        let nuevaFila = new Array(cabecerasM.length).fill("");

        if (iIdM !== -1) nuevaFila[iIdM] = ref;
        if (iNomM !== -1) nuevaFila[iNomM] = ref;
        if (iDescM !== -1) nuevaFila[iDescM] = descripcionFinal;
        if (iCatM !== -1) nuevaFila[iCatM] = "Joyería"; // Categoría por defecto
        if (iPreM !== -1) nuevaFila[iPreM] = precioNum;
        if (iVisM !== -1) nuevaFila[iVisM] = "Sí"; // Visible por defecto
        if (iStockM !== -1) nuevaFila[iStockM] = cantidadNum;

        filasNuevas.push(nuevaFila);
      }
    }

    // Insertar todas las filas nuevas al final de golpe
    if (filasNuevas.length > 0) {
      hojaMaestra.getRange(hojaMaestra.getLastRow() + 1, 1, filasNuevas.length, cabecerasM.length).setValues(filasNuevas);
    }

    SpreadsheetApp.getUi().alert(`✅ Sincronización Completada.\n- Creados: ${filasNuevas.length} joyas nuevas.\n- Actualizados: ${actualizaciones} joyas.`);

  } catch (error) {
    console.error("Error en sincronización", error);
    try {
      try { SpreadsheetApp.getUi().alert("❌ Error: " + error.message); } catch(e){}
    } catch (e) { }
  }
}

// ═══════════════════════════════════════════════════════════════
// BLOQUE 3: AUTO-CATEGORIZAR (rellena columna Categoría)
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
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const datos = hoja.getDataRange().getValues();
    const cabeceras = datos[0];

    const iId  = cabeceras.indexOf("ID_Producto");
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
    try { SpreadsheetApp.getUi().alert("❌ Error: " + error.message); } catch(e) {}
  }
}

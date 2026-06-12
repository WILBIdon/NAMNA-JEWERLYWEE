/**
 * ================================================================
 * NAMNA JEWERLYWEE — Servidor Seguro Avanzado (Google Apps Script)
 * 
 * ARQUITECTURA DE ALTO RENDIMIENTO:
 * 1. Módulo de Indexación de Drive: Lee la carpeta 1 vez por sesión
 *    creando un mapa [Código] -> [ID_Foto] en memoria (O(1)).
 * 2. Módulo de Sincronización: Conecta la Lista Externa de precios
 *    con la Hoja Maestra.
 * ================================================================
 */

// ╔═══════════════════════════════════════════════════════════╗
// ║  CONFIGURACIÓN DEL SISTEMA                                ║
// ╚═══════════════════════════════════════════════════════════╝
// 1. ID de la carpeta de Google Drive con las fotos
const DRIVE_FOLDER_ID = "1LhBRO7GDiPh_ROtLF9ip6lnBxwz0MYyP";

// 2. ID del archivo externo de Lista de Precios
const EXTERNAL_PRICE_LIST_ID = "1CvFgHa_Z5RUSVZgac1w4KBWGGhfpWq0y";

// 3. Fallback visual (Imagen que se muestra si el producto no tiene foto)
const FALLBACK_IMAGE_URL = "https://via.placeholder.com/400x400/F3ECE3/3B4643?text=NAMNA+Jewelry";


// ═══════════════════════════════════════════════════════════════
// BLOQUE 1: EL SERVIDOR WEB (API para la página móvil)
// ═══════════════════════════════════════════════════════════════
function doGet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    // ── 1. CONTROL DE DAÑOS: Validar estructura ──
    const headers = data[0];
    if (!headers.includes("ID_Producto") || !headers.includes("Precio_Publico") || !headers.includes("Visible")) {
      throw new Error("Estructura de la hoja alterada. Faltan columnas críticas.");
    }

    const idx = {
      id:        headers.indexOf("ID_Producto"),
      nombre:    headers.indexOf("Nombre"),
      desc:      headers.indexOf("Descripción"),
      cat:       headers.indexOf("Categoría"),
      precioPub: headers.indexOf("Precio_Publico"),
      visible:   headers.indexOf("Visible")
    };

    // ── 2. INDEXACIÓN EN MEMORIA (El secreto de la velocidad) ──
    // Se ejecuta una sola vez. No consulta a Drive fila por fila.
    const mapaFotos = crearMapaFotos(DRIVE_FOLDER_ID);

    const productosValidos = [];

    // ── 3. PROCESAMIENTO COMBINADO ──
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const idProducto = String(row[idx.id]).trim();
      if (!idProducto) continue; 
      
      if (String(row[idx.visible]).trim().toLowerCase() !== "sí") continue;

      // Limpieza de datos
      const precio     = Number(row[idx.precioPub]) || 0;
      const nombre     = row[idx.nombre] ? String(row[idx.nombre]).trim() : "Producto sin nombre";
      const categoria  = row[idx.cat]    ? String(row[idx.cat]).trim()    : "General";
      const descripcion = row[idx.desc]  ? String(row[idx.desc]).trim()   : "";

      // ── 4. ASOCIACIÓN DINÁMICA DE FOTOS EN TIEMPO REAL ──
      let urlImagen = FALLBACK_IMAGE_URL;
      
      // Busca el ID del producto en nuestro mapa en memoria
      const idDriveFoto = mapaFotos[idProducto.toLowerCase()];
      
      if (idDriveFoto) {
        // Construye URL de descarga nativa optimizada a 400px
        urlImagen = `https://drive.google.com/uc?export=view&id=${idDriveFoto}&sz=w400`;
      }

      productosValidos.push({
        id:          idProducto,
        nombre:      nombre,
        descripcion: descripcion,
        categoria:   categoria,
        precio:      precio,
        imagen:      urlImagen
      });
    }

    // ── 5. ENTREGA SEGURA AL FRONTEND ──
    return ContentService
      .createTextOutput(JSON.stringify(productosValidos))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: true, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ── MÓDULO DE MAPEO INDEXADO (Indexa la carpeta en un Diccionario RAM) ──
 * Lee todos los archivos de Drive y crea un mapa [NombreSinExt] => [IdArchivo]
 */
function crearMapaFotos(folderId) {
  const mapa = {};
  try {
    const folder = DriveApp.getFolderById(folderId);
    const archivos = folder.getFiles();
    
    while (archivos.hasNext()) {
      const archivo = archivos.next();
      const id = archivo.getId();
      const nombreCompleto = archivo.getName(); // Ej: "PROD-001.jpg"
      
      // Limpiar la extensión (.jpg, .png, .jpeg) para dejar el código base
      const nombreBase = nombreCompleto.split('.')[0].trim().toLowerCase();
      
      mapa[nombreBase] = id;
    }
  } catch(e) {
    console.error("Error leyendo carpeta de Drive", e);
  }
  return mapa;
}


// ═══════════════════════════════════════════════════════════════
// BLOQUE 2: SINCRONIZADOR DE PRECIOS (Lista Externa -> Hoja Maestra)
// ═══════════════════════════════════════════════════════════════
/**
 * ── FUNCIÓN ESPEJO ──
 * Ejecuta esta función manualmente o configura un "Trigger" en Apps Script
 * para que corra cada noche automáticamente.
 */
function sincronizarPrecios() {
  try {
    // 1. Leer la Lista Externa de Precios
    const hojaExterna = SpreadsheetApp.openById(EXTERNAL_PRICE_LIST_ID).getSheets()[0];
    const datosExternos = hojaExterna.getDataRange().getValues();
    
    // Suponiendo que en la lista externa: Col A = Referencia, Col F = precio de venta
    const cabecerasExt = datosExternos[0];
    const idxRefExt = cabecerasExt.indexOf("Referencia");
    const idxPrecioExt = cabecerasExt.indexOf("precio de venta");
    
    if (idxRefExt === -1 || idxPrecioExt === -1) {
      throw new Error("No se encontraron las columnas en la lista de precios externa.");
    }

    // Crear un mapa de precios [Referencia] -> [Precio]
    const mapaPrecios = {};
    for (let i = 1; i < datosExternos.length; i++) {
      const ref = String(datosExternos[i][idxRefExt]).trim().toLowerCase();
      let precioRaw = datosExternos[i][idxPrecioExt];
      
      // Limpiar símbolos de moneda o texto
      let precioNum = Number(String(precioRaw).replace(/[^0-9.-]+/g,""));
      
      if (ref && !isNaN(precioNum)) {
        mapaPrecios[ref] = precioNum;
      }
    }

    // 2. Actualizar la Hoja Maestra (Data Hub)
    const hojaMaestra = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const datosMaestros = hojaMaestra.getDataRange().getValues();
    const cabecerasM = datosMaestros[0];
    
    const idxIdM = cabecerasM.indexOf("ID_Producto");
    const idxPrecioPubM = cabecerasM.indexOf("Precio_Publico");
    
    if (idxIdM === -1 || idxPrecioPubM === -1) {
      throw new Error("Faltan columnas ID_Producto o Precio_Publico en hoja maestra.");
    }

    // Se actualizan las filas una por una
    // Para optimizar en hojas gigantes, se debería construir un array y hacer un solo setValues()
    let valoresPrecioNuevos = [];

    for (let i = 1; i < datosMaestros.length; i++) {
      const idProducto = String(datosMaestros[i][idxIdM]).trim().toLowerCase();
      let precioExistente = datosMaestros[i][idxPrecioPubM];
      
      // Si el código existe en el mapa de precios, usamos el nuevo precio
      if (mapaPrecios[idProducto] !== undefined) {
        valoresPrecioNuevos.push([mapaPrecios[idProducto]]);
      } else {
        // Mantener el existente si no hay actualización
        valoresPrecioNuevos.push([precioExistente]);
      }
    }

    // 3. Escribir masivamente en la columna Precio_Publico (muy rápido)
    // Asumiendo que Precio_Publico es la columna E (índice 4, columna número 5)
    const numColumnaPrecio = idxPrecioPubM + 1;
    hojaMaestra.getRange(2, numColumnaPrecio, valoresPrecioNuevos.length, 1).setValues(valoresPrecioNuevos);
    
    SpreadsheetApp.getUi().alert("✅ Sincronización de precios completada con éxito.");

  } catch (error) {
    console.error("Error en sincronización", error);
    try {
      SpreadsheetApp.getUi().alert("❌ Error en sincronización: " + error.message);
    } catch(e) { /* Si corre en trigger, el UI falla silenciosamente */ }
  }
}

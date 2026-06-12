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

const DRIVE_FOLDER_ID = "1LhBRO7GDiPh_ROtLF9ip6lnBxwz0MYyP";
const EXTERNAL_PRICE_LIST_ID = "1CvFgHa_Z5RUSVZgac1w4KBWGGhfpWq0y";
const FALLBACK_IMAGE_URL = "https://via.placeholder.com/600x600/F3ECE3/3B4643?text=NAMNA+Jewelry";

// ═══════════════════════════════════════════════════════════════
// BLOQUE 1: LA API WEB (Sirve los datos al catálogo)
// ═══════════════════════════════════════════════════════════════
function doGet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
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
      visible:   headers.indexOf("Visible"),
      stock:     headers.indexOf("Stock")
    };

    // ── INDEXACIÓN EN MEMORIA (Fotos principales + Hijas) ──
    const mapaFotos = crearMapaFotos(DRIVE_FOLDER_ID);

    const productosValidos = [];

    // ── PROCESAMIENTO ──
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const idProducto = String(row[idx.id]).trim();
      if (!idProducto) continue; 
      
      if (String(row[idx.visible]).trim().toLowerCase() !== "sí") continue;

      const precio = Number(row[idx.precioPub]) || 0;
      const stock  = Number(row[idx.stock]) || 0;
      const nombre = row[idx.nombre] ? String(row[idx.nombre]).trim() : "Producto sin nombre";
      const cat    = row[idx.cat]    ? String(row[idx.cat]).trim()    : "Joyería";
      const desc   = row[idx.desc]   ? String(row[idx.desc]).trim()   : "";

      // ── ASIGNACIÓN DE FOTOS (Principal e Hijas) ──
      const fotosDrive = mapaFotos[idProducto.toLowerCase()];
      let imagenes = [FALLBACK_IMAGE_URL];

      if (fotosDrive) {
        imagenes = [];
        
        // Foto principal (si existe, va primero)
        if (fotosDrive.principal) {
          imagenes.push(`https://drive.google.com/uc?export=view&id=${fotosDrive.principal}&sz=w600`);
        }
        
        // Fotos hijas
        fotosDrive.hijas.forEach(idHija => {
          imagenes.push(`https://drive.google.com/uc?export=view&id=${idHija}&sz=w600`);
        });

        // Si no hay ninguna por algún motivo, poner fallback
        if (imagenes.length === 0) {
          imagenes.push(FALLBACK_IMAGE_URL);
        }
      }

      productosValidos.push({
        id:          idProducto,
        nombre:      nombre,
        descripcion: desc,
        categoria:   cat,
        precio:      precio,
        stock:       stock,
        imagenes:    imagenes // Ahora es un Array de imágenes
      });
    }

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
      const nombreCompleto = archivo.getName(); // Ej: "N. Ruby D..jpg" o "N. Ruby D.-1.jpg"
      
      const nombreSinExt = nombreCompleto.split('.')[0].trim().toLowerCase();
      
      // Detectar si es una foto hija (termina en guión y un número, ej: "-1")
      // Regex: quita "-1", "-2" del final para obtener el código base del producto
      const baseCode = nombreSinExt.replace(/-\d+$/, '').trim();
      
      if (!mapa[baseCode]) {
        mapa[baseCode] = { principal: null, hijas: [] };
      }
      
      if (nombreSinExt === baseCode) {
        // Es la foto principal
        mapa[baseCode].principal = id;
      } else {
        // Es una foto hija
        mapa[baseCode].hijas.push(id);
      }
    }
  } catch(e) {
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
    const iIdM    = cabecerasM.indexOf("ID_Producto");
    const iNomM   = cabecerasM.indexOf("Nombre");
    const iDescM  = cabecerasM.indexOf("Descripción");
    const iCatM   = cabecerasM.indexOf("Categoría");
    const iPreM   = cabecerasM.indexOf("Precio_Publico");
    const iVisM   = cabecerasM.indexOf("Visible");
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
    const iRefE    = cabecerasExt.indexOf("Referencia");
    const iMetalE  = cabecerasExt.indexOf("Peso metal ");
    const iCantE   = cabecerasExt.indexOf("Cantidad");
    const iPiedraE = cabecerasExt.indexOf("Piedra ct");
    const iDiamE   = cabecerasExt.indexOf("diamantes ct");
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
      let precioNum = Number(String(rowExt[iPrecioE]).replace(/[^0-9.-]+/g,""));
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
      SpreadsheetApp.getUi().alert("❌ Error: " + error.message);
    } catch(e) {}
  }
}

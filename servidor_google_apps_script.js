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
      id: headers.findIndex(h => h === "ID_Producto"),
      nombre: headers.findIndex(h => h === "Nombre"),
      desc_es: headers.findIndex(h => h === "Descripción Es" || h === "Descripción"),
      desc_en: headers.findIndex(h => h === "Descripción En"),
      cat_es: headers.findIndex(h => h === "Categoría Es" || h === "Categoría"),
      cat_en: headers.findIndex(h => h === "Categoría En"),
      precioPub: headers.findIndex(h => h === "Precio_Publico"),
      visible: headers.findIndex(h => h === "Visible"),
      stock: headers.findIndex(h => h === "Stock")
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
      const cat_es = idx.cat_es > -1 && row[idx.cat_es] ? String(row[idx.cat_es]).trim() : "Joyería";
      const cat_en = idx.cat_en > -1 && row[idx.cat_en] ? String(row[idx.cat_en]).trim() : "Jewelry";
      const desc_es = idx.desc_es > -1 && row[idx.desc_es] ? String(row[idx.desc_es]).trim() : "";
      const desc_en = idx.desc_en > -1 && row[idx.desc_en] ? String(row[idx.desc_en]).trim() : "";

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
        descripcion_es: desc_es,
        descripcion_en: desc_en,
        categoria_es: cat_es,
        categoria_en: cat_en,
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

/**
 * ── FUNCIÓN DE AYUDA (EJECUTAR MANUALMENTE) ──
 * Inyecta la columna Texto_EN y los textos automáticamente en la hoja TEXTOS
 */
function inyectarTextosIngles() {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  
  // Encontrar la pestaña de textos
  let hoja = null;
  const nombres = ["TEXTOS", "TEXTO", "Textos", "Texto_ES", "textos"];
  for (const n of nombres) {
    hoja = ss.getSheetByName(n);
    if (hoja) break;
  }
  
  if (!hoja) {
    console.error("No encontré la pestaña de Textos.");
    return;
  }
  
  const datos = hoja.getDataRange().getValues();
  const cabeceras = datos[0];
  
  // Identificar columnas
  const iId = cabeceras.findIndex(c => c && c.toString().toUpperCase().includes("ID"));
  const iEs = cabeceras.findIndex(c => c && (c.toString().toUpperCase().includes("TEXTO_ES") || c === "Texto" || c === "texto"));
  
  if (iId === -1 || iEs === -1) {
    console.error("No encontré las columnas ID y Texto_ES.");
    return;
  }
  
  // Buscar o crear Texto_EN
  let iEn = cabeceras.findIndex(c => c && c.toString().toUpperCase().includes("TEXTO_EN"));
  if (iEn === -1) {
    iEn = cabeceras.length;
    hoja.getRange(1, iEn + 1).setValue("Texto_EN");
  }
  
  // El diccionario completo
  const NUEVOS_TEXTOS = [
    { id: "TXT-001", es: "Envío gratis en pedidos superiores a €999 a toda España y Europa — Piezas únicas hechas a mano", en: "Free shipping on orders over €999 to all of Spain and Europe — Unique handmade pieces" },
    { id: "TXT-002", es: "Alta Joyería", en: "Fine Jewelry" },
    { id: "TXT-003", es: "Elegancia Atemporal", en: "Timeless Elegance" },
    { id: "TXT-004", es: "Descubre nuestra exclusiva colección de joyería fina. Cada pieza es una obra de arte diseñada para iluminar tu esencia y acompañarte para siempre.", en: "Discover our exclusive fine jewelry collection. Each piece is a work of art designed to illuminate your essence." },
    { id: "TXT-005", es: "Explorar Colección", en: "Explore Collection" },
    { id: "TXT-006", es: "Nuestra Colección", en: "Our Collection" },
    { id: "TXT-007", es: "En NAMNA Jewelry, creemos en la belleza de lo atemporal. Nuestras piezas son creadas con pasión, fusionando la maestría artesanal tradicional con diseños contemporáneos para dar vida a joyas únicas que cuentan historias.", en: "At NAMNA Jewelry, we believe in the beauty of the timeless. Our pieces are crafted with passion, blending traditional craftsmanship with contemporary design." },
    { id: "TXT-008", es: "Seleccionamos cuidadosamente nuestros metales y piedras preciosas, asegurando la más alta calidad y un origen ético. Cada anillo, collar y par de aretes está diseñado para realzar tu luz interior y acompañarte en los momentos más especiales de tu vida.", en: "We carefully select our metals and gemstones, ensuring the highest quality and ethical sourcing. Each piece is designed to enhance your inner light." },
    { id: "TXT-009", es: "Realizamos envíos rápidos a toda España y Europa a través de mensajería asegurada. Todos nuestros pedidos se procesan con el mayor cuidado y se envían en nuestro empaque premium distintivo para garantizar una experiencia de lujo.", en: "We ship quickly to all of Spain and Europe through insured courier. All orders are processed with care in our distinctive premium packaging to ensure a luxury experience." },
    { id: "TXT-010", es: "Tiempos de entrega: Los envíos dentro de España tardan entre 2 a 5 días hábiles. Los envíos al resto de Europa pueden variar entre 5 y 10 días hábiles.", en: "Delivery times: Orders within Spain take 2-5 business days. Orders to the rest of Europe may vary between 5-10 business days." },
    { id: "TXT-011", es: "Tu satisfacción es nuestra máxima prioridad. Aceptamos cambios o devoluciones dentro de los primeros 14 días posteriores a la recepción de tu joya, siempre y cuando la pieza se encuentre en su estado original, sin signos de uso y con su empaque intacto.", en: "Your satisfaction is our top priority. We accept returns within 14 days, as long as the piece is in its original condition." },
    { id: "TXT-012", es: "Las piezas personalizadas o grabadas a medida no son elegibles para devolución. Para iniciar un proceso de cambio o devolución, por favor contacta a nuestro equipo directamente por WhatsApp y te guiaremos paso a paso.", en: "Custom or engraved pieces are not eligible for returns. To start a return, contact our team via WhatsApp." },
    { id: "TXT-013", es: "Para asegurar que tu joya tenga el ajuste perfecto, recomendamos medir el diámetro interior de un anillo que ya tengas y te quede bien, o medir la circunferencia de tu dedo con un hilo suave.", en: "To ensure a perfect fit, we recommend measuring the inner diameter of a ring you already own." },
    { id: "TXT-014", es: "Si tienes dudas sobre tu talla exacta, nuestro equipo de asesores en WhatsApp estará encantado de brindarte atención personalizada para encontrar la medida ideal de tu pieza NAMNA.", en: "If you're unsure about your size, our WhatsApp advisors will be happy to help you find the perfect fit." },
    { id: "TXT-015", es: "Joyas únicas que iluminan tu esencia.", en: "Unique jewelry that illuminates your essence." },
    { id: "TXT-019", es: "© 2026 NAMNA Jewelry. Todos los derechos reservados.", en: "© 2026 NAMNA Jewelry. All rights reserved." },
    { id: "TXT-020", es: "Colección", en: "Collection" },
    { id: "TXT-021", es: "Novedades", en: "New Arrivals" },
    { id: "TXT-022", es: "Quiénes Somos", en: "About Us" },
    { id: "TXT-023", es: "Novedades", en: "New Arrivals" },
    { id: "TXT-024", es: "Recién llegados", en: "Just arrived" },
    { id: "TXT-025", es: "Todos", en: "All" },
    { id: "TXT-026", es: "Cargando piezas...", en: "Loading pieces..." },
    { id: "TXT-027", es: "Tienda", en: "Shop" },
    { id: "TXT-028", es: "Colección Completa", en: "Full Collection" },
    { id: "TXT-029", es: "Información", en: "Information" },
    { id: "TXT-030", es: "Envíos", en: "Shipping" },
    { id: "TXT-031", es: "Devoluciones", en: "Returns" },
    { id: "TXT-032", es: "Guía de Tallas", en: "Sizing Guide" },
    { id: "TXT-033", es: "Contacto", en: "Contact" },
    { id: "TXT-034", es: "Hecho a mano con ♡", en: "Handmade with ♡" },
    { id: "TXT-035", es: "Nuestra Historia", en: "Our Story" },
    { id: "TXT-036", es: "Donde la artesanía se encuentra con la elegancia atemporal", en: "Where craftsmanship meets timeless elegance" },
    { id: "TXT-037", es: "Políticas de Envío", en: "Shipping Policies" },
    { id: "TXT-038", es: "Políticas de Devolución", en: "Return Policies" },
    { id: "TXT-039", es: "Guía de Tallas", en: "Sizing Guide" },
    { id: "TXT-040", es: "¿Tienes alguna pregunta? Escríbenos y te responderemos a la brevedad.", en: "Have a question? Write to us and we'll reply shortly." },
    { id: "TXT-041", es: "Nombre", en: "Name" },
    { id: "TXT-042", es: "Mensaje", en: "Message" },
    { id: "TXT-043", es: "Enviar por WhatsApp", en: "Send via WhatsApp" },
    { id: "TXT-044", es: "Privacidad y Datos", en: "Privacy & Data" },
    { id: "TXT-045", es: "Garantía", en: "Warranty" },
    { id: "TXT-046", es: "Nuestras joyas están diseñadas para durar toda la vida. Ofrecemos una garantía contra defectos de fabricación. Si tu pieza presenta algún problema de calidad que no sea resultado del uso natural o mal manejo, nos haremos cargo de repararla o reemplazarla.", en: "Our jewelry is designed to last a lifetime. We offer a warranty against manufacturing defects. If your piece presents any quality issue that is not the result of natural wear or mishandling, we will repair or replace it." },
    { id: "TXT-047", es: "Para activar tu garantía o realizar una consulta sobre el cuidado de tu joya, comunícate a través de nuestro WhatsApp oficial.", en: "To activate your warranty or inquire about the care of your jewelry, please contact us through our official WhatsApp." }
  ];
  
  // Mapear los IDs existentes
  const filasExistentes = {};
  for (let i = 1; i < datos.length; i++) {
    const id = String(datos[i][iId]).trim();
    if (id) filasExistentes[id] = i + 1; // 1-indexed for reference
  }
  
  let añadidos = 0;
  let actualizados = 0;
  
  for (const item of NUEVOS_TEXTOS) {
    if (filasExistentes[item.id]) {
      const rowIndex = filasExistentes[item.id] - 1; // 0-indexed for array
      // Sobrescribir ambos para asegurar que la web se actualice con los textos de España/Europa
      datos[rowIndex][iEs] = item.es;
      datos[rowIndex][iEn] = item.en;
      actualizados++;
    } else {
      const newRow = new Array(cabeceras.length).fill("");
      newRow[iId] = item.id;
      newRow[iEs] = item.es;
      newRow[iEn] = item.en;
      datos.push(newRow);
      añadidos++;
    }
  }
  
  // Asegurar que todas las filas tengan la misma longitud para setValues
  const colCount = cabeceras.length;
  for (let i = 0; i < datos.length; i++) {
    while (datos[i].length < colCount) datos[i].push("");
  }
  
  // Escribir todo de golpe (súper rápido, evita timeout)
  hoja.getRange(1, 1, datos.length, colCount).setValues(datos);
  
  console.log(`✅ Textos inyectados!\n- Textos en inglés agregados/actualizados: ${actualizados}\n- Textos nuevos completos añadidos: ${añadidos}`);
}

/**
 * ── FUNCIÓN DE AYUDA (EJECUTAR MANUALMENTE) ──
 * Traduce las categorías y descripciones de la hoja de productos.
 */
function inyectarTraduccionesProductos() {
  const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
  const hoja = ss.getSheets()[0]; // La primera pestaña asumiendo que son los productos
  
  const datos = hoja.getDataRange().getValues();
  const cabeceras = datos[0];
  
  const iDescEs = cabeceras.findIndex(h => h === "Descripción Es" || h === "Descripción");
  const iDescEn = cabeceras.findIndex(h => h === "Descripción En");
  const iCatEs = cabeceras.findIndex(h => h === "Categoría Es" || h === "Categoría");
  const iCatEn = cabeceras.findIndex(h => h === "Categoría En");
  
  if (iDescEs === -1 || iDescEn === -1 || iCatEs === -1 || iCatEn === -1) {
    console.error("Faltan las columnas 'Descripción Es', 'Descripción En', 'Categoría Es' o 'Categoría En'.");
    return;
  }
  
  // Diccionario de traducciones para los productos existentes
  const traducciones = {
    "Necklace": { cat_es: "Collar", cat_en: "Necklace" },
    "Earrings": { cat_es: "Aretes", cat_en: "Earrings" },
    "Elegante pieza de joyería fina en metal (0.71g), coronada por un vibrante rubí de 0.20 quilates y destellos sutiles de diamantes (0.05 ct).": "Elegant piece of fine metal jewelry (0.71g), crowned by a vibrant 0.20-carat ruby and subtle sparkles of diamonds (0.05 ct).",
    "Exquisito diseño elaborado con 0.85g de metal precioso, iluminado mágicamente por 7 brillantes diamantes que suman 0.13 quilates.": "Exquisite design crafted with 0.85g of precious metal, magically illuminated by 7 brilliant diamonds totaling 0.13 carats.",
    "Delicada pieza con motivos florales en 0.70g de metal, engastada meticulosamente con 7 diamantes luminosos (0.10 quilates en total).": "Delicate piece with floral motifs in 0.70g of metal, meticulously set with 7 luminous diamonds (0.10 total carats).",
    "Diseño romántico y atemporal en metal de 0.70g, sutilmente acentuado por un delicado diamante de 0.02 quilates.": "Romantic and timeless design in 0.70g metal, subtly accentuated by a delicate 0.02-carat diamond.",
    "Pieza de encanto celestial en 0.70g de metal, resplandeciendo con el brillo enigmático de sus diamantes (0.05 ct).": "Piece of celestial charm in 0.70g of metal, shining with the enigmatic brilliance of its diamonds (0.05 ct).",
    "Clásico y majestuoso solitario fabricado con 1.59g de metal precioso, destacando un espectacular diamante central de 0.20 quilates.": "Classic and majestic solitaire crafted with 1.59g of precious metal, highlighting a spectacular 0.20-carat central diamond.",
    "Pieza magistral de lujo absoluto en platino (PT 2.11g), deslumbrando con un conjunto de 10 diamantes que suman 0.76 quilates de brillo puro.": "Masterful piece of absolute luxury in platinum (PT 2.11g), dazzling with a set of 10 diamonds totaling 0.76 carats of pure brilliance.",
    "Encantadora pieza minimalista de 0.28g, diseñada para evocar romanticismo, elegancia sutil y sofisticación diaria.": "Charming minimalist piece of 0.28g, designed to evoke romance, subtle elegance, and daily sophistication.",
    "Impresionante diseño de alta joyería, protagonizado por un majestuoso juego de diamantes de 1.20 quilates que regala destellos inigualables.": "Stunning high-jewelry design, featuring a majestic set of 1.20-carat diamonds that deliver unmatched sparkles.",
    "Elegante joya de diseño exclusivo, acentuada a la perfección con 3 diamantes que suman 0.44 quilates, aportando un toque de lujo sofisticado.": "Elegant jewel of exclusive design, perfectly accentuated with 3 diamonds totaling 0.44 carats, providing a touch of sophisticated luxury."
  };
  
  let actualizados = 0;
  
  for (let i = 1; i < datos.length; i++) {
    const descEs = String(datos[i][iDescEs]).trim();
    const catEs = String(datos[i][iCatEs]).trim();
    
    // Categorías
    if (catEs && traducciones[catEs] && traducciones[catEs].cat_es) {
      datos[i][iCatEs] = traducciones[catEs].cat_es;
      datos[i][iCatEn] = traducciones[catEs].cat_en;
      actualizados++;
    }
    
    // Descripciones
    if (descEs && traducciones[descEs] && !datos[i][iDescEn]) {
      datos[i][iDescEn] = traducciones[descEs];
      actualizados++;
    }
  }
  
  hoja.getRange(1, 1, datos.length, cabeceras.length).setValues(datos);
  console.log(`✅ Traducciones de productos inyectadas: ${actualizados} celdas actualizadas.`);
}

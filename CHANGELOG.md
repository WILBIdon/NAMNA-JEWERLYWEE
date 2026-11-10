# Registro de Cambios (Changelog) - Proyecto NAMNA JEWERLYWEE

> [!IMPORTANT]  
> **TAREA PERMANENTE:** Todo cambio realizado en el proyecto debe ser registrado obligatoriamente en este documento. Es responsabilidad de cualquier asistente o desarrollador mantener este registro actualizado para tener un control claro de las modificaciones.

## Convenciones

- Entradas nuevas: **siempre fechadas** `YYYY-MM-DD`, lo más reciente arriba.
- Las entradas marcadas `**Reciente**` son históricas y anteriores al 2026-10-22; no tienen fecha fiable.
- La estructura del proyecto se documenta en [PROCESO.md](PROCESO.md), no aquí.

---

## 2026-11-10 — Los textos dicen dónde van

- **feat:** `scripts/mapear-textos.mjs` — recorre los HTML, localiza cada `data-txt` y deduce en qué página sale, en qué zona, qué papel cumple y si se repite. Lo vuelca en `textos.pagina/seccion/papel/nota/orden_ui`. No hay nada escrito a mano: si un texto cambia de sitio en el código, se vuelve a ejecutar.
- **feat:** la pestaña de textos del panel se agrupa por página y sigue el recorrido real de la web, no el orden del ID. Cada texto lleva su etiqueta de papel y una frase de dónde va. El buscador entiende «pie de página» o «botón».
- **feat:** los textos que ya no aparecen en ningún HTML se marcan «Sin usar».
- **feat:** `supabase/02-textos-ubicacion.sql` — las 4 columnas nuevas.
- Detectado al mapear: la detección de sección tenía que ser estructural. Por el último `<h2>`, los enlaces del pie heredaban el título de la sección anterior («Mis Favoritos»). Y un `<span data-txt>` dentro de un `<a class="btn">` salía como párrafo: ahora se mira el contenedor.

---

## 2026-11-09 (noche) — Panel sobre Supabase

- **feat:** `panel.html` reescrito contra Supabase. Auth propia (email + contraseña) con token JWT renovado solo, CRUD sobre Postgres y subida a Storage. El panel anterior queda en `_archivo/panel-v1-appsscript.html`.
- **feat:** las fotos se reducen a 1400 px y se convierten a **WebP en el navegador** antes de subirlas. Medido: PNG de 82 KB → 10 KB.
- **feat:** reordenar fotos arrastrando; la primera es la principal.
- **feat:** filtro «Archivados» con botón de restaurar, y exportación a CSV del catálogo.
- **refactor:** desaparecen `configurarAdmin()`, el sistema de tokens de sesión hecho a mano y la dependencia de Apps Script para escribir.
- **fix:** PostgREST devuelve `numeric` como cadena (`"590.00"`); sin convertir, llegaba así a un `input type=number` con `step=1`.

### Seguridad verificada contra la base real
Con la clave pública que va en el JavaScript del sitio: `UPDATE` no cambia nada, `DELETE` no borra, `INSERT` rechazado (401), textos intactos, Storage rechaza subidas (400) y los productos ocultos o archivados son invisibles. El `HTTP 204` de PostgREST en escrituras anónimas es «0 filas afectadas», no éxito: comprobado leyendo el dato después.

---

## 2026-11-09 (tarde) — Migración a Supabase, fase 1

- **feat:** `supabase/schema.sql` — esquema Postgres con `productos`, `imagenes`, `textos`, `imagenes_sitio`, la vista `catalogo` y políticas RLS (lectura pública solo de lo visible, escritura solo autenticada). Columnas `archivado`/`archivada` en vez de borrado. Campos nuevos: `orden`, `precio_mayorista`, fechas.
- **feat:** `scripts/migrar-a-supabase.mjs` — vuelca el catálogo del Apps Script a Postgres + Storage. Re-ejecutable, con `--dry`, `--solo-datos` y `--forzar`, y comprobación de totales al final. Convierte las fotos a WebP 1400 px: medido sobre 4 reales, **−98 %** (PNG de 5‑6 MB → ~80 KB).
- **feat:** `js/config.js` — configuración única del sitio. Resuelve el punto 3 del backlog: la `APPS_SCRIPT_URL` estaba copiada en 4 archivos.
- **feat:** `js/datos.js` — capa de datos con Supabase primero y Apps Script de respaldo automático. Habla con PostgREST por `fetch` a pelo, sin cargar la librería de Supabase.
- **refactor:** `app.js` y `producto.js` pasan por la capa nueva. Sin Supabase configurado el comportamiento es idéntico al de antes.
- **perf:** la caché del navegador baja de 6 h a 10 min cuando los datos vienen de Supabase, y se mantiene en 6 h si se cae a Apps Script.
- **fix:** `saveToCache()` declaraba `cacheData` dentro del `try`, así que el reintento del `catch` petaba con `ReferenceError` cuando `localStorage` estaba lleno.
- **docs:** `MIGRACION-SUPABASE.md` con los pasos, la vuelta atrás y lo que falta.

### Medido en producción antes de decidir
Apps Script tarda **1.540 ms** en devolver 25 KB desde su propia caché; Drive sirve las fotos en ~100 ms. El cuello de botella era Apps Script, no Drive. El sitio además se sirve desde Railway en Miami (`x-railway-edge: mia1`) vendiendo a España y Europa.

---

## 2026-11-09

- **feat:** panel de gestión `panel.html` (Fase 2) — alta, edición, publicación y retirada de productos; precios, stock, categorías y descripciones ES/EN; subida y retirada de fotos a Drive; edición de los textos de la web; botón de publicar cambios. Buscador, filtros y diseño responsive con la identidad de la marca. Ver [PANEL-ADMIN.md](PANEL-ADMIN.md).
- **feat:** API de escritura en `servidor_google_apps_script.js` (BLOQUE 5) — `doPost` con las acciones login, listar, guardarProducto, cambiarVisible, archivarProducto, guardarTexto, subirFoto, archivarFoto e invalidar.
- **security:** la contraseña de administración deja de estar en el cliente. Ahora se guarda como hash SHA-256 con sal en `PropertiesService` y se valida en el servidor (`configurarAdmin()`), con sesiones de 2 h por token. Resuelve el punto 1 del backlog.
- **security:** `?action=invalidate` exige token de sesión en cuanto hay contraseña configurada. Resuelve el punto 2 del backlog.
- **security:** eliminada la contraseña en texto plano `Junio2026` del disparador 💎 de `index.html`; ahora enlaza a `panel.html`. **La clave antigua queda comprometida: hay que usar otra.**
- **chore:** `robots.txt` bloquea también `/panel.html`, `/generador-seo.html` y `/_archivo/`.
- **chore:** nada se borra — eliminar un producto lo mueve a la pestaña `ARCHIVO_PRODUCTOS`; quitar una foto la mueve a la subcarpeta `ARCHIVO` de Drive.
- **test:** sitio verificado en local — 18 productos, 108 tarjetas, 87 textos, todas las rutas 200. Panel probado de punta a punta con backend simulado: interruptores, alta, edición, validaciones de ID, fotos, textos y publicación.

- **docs:** crear `CLAUDE.md` — contexto de arranque del proyecto (arquitectura, mapa de archivos, reglas, riesgos abiertos) con punteros a los demás documentos en vez de duplicarlos.
- **chore:** copia local verificada del sitio en `copia-local/sitio-2026-11-09/` (69 archivos, SHA-1 idéntico al origen) + `copia-local/BITACORA.md`. Carpeta ignorada por git.
- **chore:** limpieza — `Untitled.html` movido a `_archivo/` (página huérfana con dos `<title>`); `gemini-code-1781227114465.md` renombrado a `BLUEPRINT.md` (deja de estar ignorado por el patrón `gemini-code-*.md`).
- **docs:** `CHANGELOG.md` — eliminada la sección «Estructura del Proyecto» duplicada de `PROCESO.md` y adoptadas entradas fechadas.

---

## Histórico (sin fecha, anterior a 2026-10-22)
- **Reciente** docs: añadir `PROCESO.md` (funcionamiento técnico de punta a punta) y `ESTATUS_Y_MEJORAS.md` (estado por fases y backlog priorizado).
- **Reciente** style: optimizar ventana de producto para móvil — ocupa 100% de pantalla sin scroll, imagen al 42%, detalles compactos con tipografía reducida, botón CTA fijo al fondo; en desktop se mantiene el layout lado a lado.
- **Reciente** fix: implementar funcionalidad completa del menú hamburguesa en móvil en `index.html` e `info.html` — panel de navegación lateral con overlay, animación del botón (☰→✕), links con transiciones escalonadas, cierre al tocar overlay/Escape/link, y botón de WhatsApp en el pie del menú.
- **Reciente** feat: buscador inteligente (Smart Search) a pantalla completa con atajos a páginas de índice (contacto, envíos).
- **Reciente** feat: lista de deseos (Wishlist/Favoritos) guardada en `localStorage` con panel lateral y opción de pedir carrito por WhatsApp.
- **Reciente** UX: configuración de inglés por defecto, banner sugeridor de idioma según IP (navigator) y sincronización de traducciones sin parpadeos.
- **Reciente** fix: arreglar descripciones bilingües y traducciones dinámicas que se perdían al pasar por la memoria caché.
- **Reciente** style: optimización de CSS para el loader centralizado y banderas en el botón de idiomas.
- **Reciente** seo: actualización de meta descripciones y etiquetas geo-regionales (España y Europa) en `index.html` e `info.html`.
- **Reciente** feat: inyector de traducciones (script) optimizado para actualizar en lote los textos ES y EN enfocados a envíos para toda España y Europa.
- **Reciente** feat: internacionalización completa (i18n) con soporte ES/EN, guardado en localStorage y cambio dinámico sin recargar página.
- **Reciente** feat: integración de Google Drive (`Site_Assets`) para cargar dinámicamente imágenes decorativas (hero, banners de info) en lugar de assets locales.
- **Reciente** security: escudo anti-clonación (shield.js) — bloqueo de clic derecho, selección de texto, atajos de teclado, arrastre de imágenes, detección de DevTools, protección anti-iframe y advertencia en consola.
- **Reciente** security: headers de seguridad (X-Frame-Options DENY, CSP frame-ancestors none, referrer policy).
- **Reciente** security: cambiar contraseña del admin a nueva clave.
- **Reciente** feat: rediseño completo de info.html con hero visual, secciones con íconos, formulario de contacto a WhatsApp y diseño premium.
- **Reciente** feat: sección de Novedades (últimos 4 productos de la tabla) con carrusel horizontal y badge "Nuevo".
- **Reciente** seo: Schema.org JSON-LD (JewelryStore), Open Graph completo, Twitter Card, canonical URL y meta robots mejorados en index.html.
- **Reciente** seo: Schema.org AboutPage y meta tags SEO en info.html.
- **Reciente** seo: crear sitemap.xml, robots.txt y llms.txt para buscadores e IA.
- **Reciente** feat: imagen hero generada para la página de información.
- **Reciente** feat: añadir función de zoom a pantalla completa (Lightbox) con lupa en la imagen del producto para facilitar pinch-to-zoom en móviles.
- **Reciente** style: restaurar visibilidad del botón admin manteniendo la contraseña.
- **Reciente** style: ajustar ventana de producto (modal) para acoplarse a la pantalla sin scroll interno.
- **Reciente** feat: ordenar imágenes del carrusel por número de sufijo (-1, -2, etc) y excluir imágenes que terminan en punto.
- **`2e07578`** fix: remover bandera -s de npx serve para evitar redirección de info.html a index.html
- **`88c196e`** fix: asegurar que la versión con diagnósticos automáticos se suba correctamente
- **`ab33535`** debug: añadir diagnóstico para encontrar pestaña TEXTOS automáticamente
- **`ade7b48`** fix: corregir copyright a TXT-019 según hoja TEXTOS del usuario
- **`0611711`** fix: corregir nombre pestaña a TEXTOS (con S)
- **`a4cfc0d`** fix: corregir nombre de pestaña TEXTO y columnas ID_Texto/Texto_ES
- **`3273a06`** feat: integrar textos dinámicos desde pestaña Textos de Google Sheets (TXT-001 a TXT-016)
- **`5d4e916`** feat: actualizar textos generales, aumentar tamaño de logo y corregir menú
- **`d6427cc`** feat: aumentar tamaño de logo, agregar página de info y arreglar links de footer y whatsapp general
- **`bfd4a16`** feat: actualizar número de WhatsApp para pedidos



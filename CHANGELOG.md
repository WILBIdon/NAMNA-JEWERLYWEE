# Registro de Cambios (Changelog) - Proyecto NAMNA JEWERLYWEE

> [!IMPORTANT]  
> **TAREA PERMANENTE:** Todo cambio realizado en el proyecto debe ser registrado obligatoriamente en este documento. Es responsabilidad de cualquier asistente o desarrollador mantener este registro actualizado para tener un control claro de las modificaciones.

## Cambios Recientes

### Últimas actualizaciones
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

## Estructura del Proyecto
- `index.html`: Página de inicio
- `info.html`: Página de información
- `admin.html`: Panel de administración
- `servidor_google_apps_script.js`: Código del servidor (Google Apps Script)
- `js/app.js`: Lógica de la aplicación web
- `css/styles.css`: Hojas de estilo del proyecto

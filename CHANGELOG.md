# Registro de Cambios (Changelog) - Proyecto NAMNA JEWERLYWEE

> [!IMPORTANT]  
> **TAREA PERMANENTE:** Todo cambio realizado en el proyecto debe ser registrado obligatoriamente en este documento. Es responsabilidad de cualquier asistente o desarrollador mantener este registro actualizado para tener un control claro de las modificaciones.

## Cambios Recientes

### Últimas actualizaciones
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

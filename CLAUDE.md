# NAMNA Fine Jewelry — contexto del proyecto

Catálogo de joyería **estático** (HTML + CSS + JS vanilla, sin build ni framework) cuyo backend es un Google Apps Script que lee una Hoja de Google (productos y textos) y una carpeta de Drive (fotos). El pedido se cierra por WhatsApp; no hay checkout.

```
Sheets + Drive → Apps Script (doGet, caché 6 h) → js/app.js (localStorage 6 h) → HTML → WhatsApp
                      └ respaldo si falla: lectura directa gviz de la hoja
```

## Mapa de archivos

| Archivo | Rol |
|---|---|
| `index.html` | Portada y catálogo |
| `producto.html?id=XXX` | Ficha individual (`js/producto.js`) |
| `info.html` | Info/contacto/FAQ — **106 KB, no leer entero** (ver abajo) |
| `privacidad.html` | Legal |
| `admin.html` | Herramientas y documentación interna (`noindex`) |
| `generador-seo.html` | Generador de JSON-LD (`noindex`) |
| `js/app.js` (1295 ln) | Catálogo: carga, caché, i18n, render, wishlist, búsqueda. `CONFIG` al inicio |
| `js/producto.js` (782 ln) | Ficha. **Duplica** carga/caché/i18n/`formatPrice` de `app.js` |
| `js/shield.js` | Anti-clonación (clic derecho, selección, DevTools, anti-iframe) |
| `css/styles.css` (2172 ln), `css/wishlist_search.css` | Estilos |
| `servidor_google_apps_script.js` (36 KB) | Backend. **No se ejecuta aquí**: se pega en el editor de Apps Script |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` | SEO e IA |

## Comandos

```bash
npm start   # npx serve . → http://localhost:3000
```

No hay tests, lint ni build. Sin `-s` en `serve`: esa bandera redirige `info.html` a `index.html`.

## Reglas del proyecto

- **Todo cambio se registra en `CHANGELOG.md`.** Es obligatorio (lo dice el propio archivo). Fecha las entradas nuevas en `YYYY-MM-DD`; las antiguas dicen "Reciente" y no sirven para ordenar.
- `CONFIG` (`APPS_SCRIPT_URL`, `SHEET_ID`, WhatsApp `34695261649`) está **duplicado** en `js/app.js`, `js/producto.js` y `admin.html`. Al cambiar uno, cambiar los tres.
- Idioma por defecto: **EN**. Todo texto nuevo necesita par ES/EN.
- Caché doble de 6 h (servidor + navegador): un cambio en la hoja no se ve hasta refrescar caché desde `admin.html`.
- La copia local de trabajo vive en `copia-local/` (ignorada por git). **Excluirla de las búsquedas** o cada resultado sale duplicado.
- `_archivo/` guarda archivos retirados. No se publica ni se enlaza; ignorar en búsquedas.

## Abierto y conocido

Dos riesgos de seguridad sin resolver, detallados en `ESTATUS_Y_MEJORAS.md`: la contraseña de `admin.html` está en texto plano en el JS del cliente, y el endpoint `?action=invalidate` es público (cualquiera puede vaciar la caché). Analítica preparada pero desactivada (IDs vacíos).

## Documentación — leer solo la que haga falta

| Documento | Cuándo |
|---|---|
| `PROCESO.md` (5 KB) | Flujo de punta a punta: operador, servidor, navegador |
| `ESTATUS_Y_MEJORAS.md` (3 KB) | Estado por fases y backlog priorizado |
| `CHANGELOG.md` (5 KB) | Historial |
| `PLAN-SEO-GEO.md` (19 KB) | **Solo** en tareas de SEO/GEO — es el doc más caro |
| `BLUEPRINT.md` (5 KB) | Visión original del proyecto por fases |
| `copia-local/BITACORA.md` | Registro de la copia local y hallazgos de eficiencia |

## Economía de tokens

- `info.html` (106 KB ≈ 27 k tokens) y `servidor_google_apps_script.js` (36 KB): localizar con `grep -n` y leer solo el rango con `sed -n 'A,Bp'`. Nunca `cat` completo.
- `assets/` tiene cada imagen en `.png` y `.webp`; `Fotos WEB Defaul/` son fotos de respaldo. No inspeccionarlas salvo que la tarea sea de imágenes.
- Para entender cualquier lógica del catálogo, `js/app.js` es la fuente; `producto.js` es su copia parcial.

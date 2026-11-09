# NAMNA Fine Jewelry — contexto del proyecto

Catálogo de joyería **estático** (HTML + CSS + JS vanilla, sin build ni framework). El pedido se cierra por WhatsApp; no hay checkout. Alojado en Railway (`namnafine.com`), que hoy sirve desde Miami.

**En migración de Google Sheets a Supabase.** Las dos rutas conviven y `js/datos.js` elige:

```
Supabase (Postgres + Storage)  ──┐
                                 ├─→ js/datos.js → app.js / producto.js → HTML → WhatsApp
Apps Script → Sheets + Drive  ───┘   (respaldo automático)
```

La ruta activa depende de si `SUPABASE_URL` está relleno en `js/config.js`. Vacío = todo por Apps Script, como siempre. Ver `MIGRACION-SUPABASE.md`.

## Mapa de archivos

| Archivo | Rol |
|---|---|
| `index.html` | Portada y catálogo |
| `producto.html?id=XXX` | Ficha individual (`js/producto.js`) |
| `info.html` | Info/contacto/FAQ — **106 KB, no leer entero** (ver abajo) |
| `privacidad.html` | Legal |
| `panel.html` | **Panel de gestión** (Fase 2): CRUD de productos, fotos y textos. Login contra `doPost` (`noindex`) |
| `admin.html` | Panel antiguo: documentación y prueba de API (`noindex`) |
| `generador-seo.html` | Generador de JSON-LD (`noindex`) |
| `js/config.js` | **Configuración única.** Se carga antes que todo lo demás |
| `js/datos.js` | **Capa de datos.** Supabase primero, Apps Script de respaldo |
| `js/app.js` (1310 ln) | Catálogo: carga, caché, i18n, render, wishlist, búsqueda. `CONFIG` al inicio |
| `js/producto.js` (782 ln) | Ficha. **Duplica** carga/caché/i18n/`formatPrice` de `app.js` |
| `js/shield.js` | Anti-clonación (clic derecho, selección, DevTools, anti-iframe) |
| `css/styles.css` (2172 ln), `css/wishlist_search.css` | Estilos |
| `servidor_google_apps_script.js` (46 KB) | Backend. **No se ejecuta aquí**: se pega en el editor de Apps Script. BLOQUE 5 = API de escritura del panel |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` | SEO e IA |

## Comandos

```bash
npm start   # npx serve . → http://localhost:3000
```

No hay tests, lint ni build. Sin `-s` en `serve`: esa bandera redirige `info.html` a `index.html`.

## Reglas del proyecto

- **Todo cambio se registra en `CHANGELOG.md`.** Es obligatorio (lo dice el propio archivo). Fecha las entradas nuevas en `YYYY-MM-DD`; las antiguas dicen "Reciente" y no sirven para ordenar.
- La configuración vive **solo** en `js/config.js`. `app.js` y `producto.js` ya la leen de ahí; `admin.html` y `panel.html` todavía la llevan dentro.
- Nunca pongas la `service_role` key de Supabase en el frontend ni en el repo. En el navegador solo la `anon key`, que está protegida por RLS.
- Idioma por defecto: **EN**. Todo texto nuevo necesita par ES/EN.
- Caché doble de 6 h (servidor + navegador): un cambio en la hoja no se ve hasta refrescar caché desde `admin.html`.
- La copia local de trabajo vive en `copia-local/` (ignorada por git). **Excluirla de las búsquedas** o cada resultado sale duplicado.
- `_archivo/` guarda archivos retirados. No se publica ni se enlaza; ignorar en búsquedas.

## Abierto y conocido

- **Bloqueante:** el panel de gestión no funciona hasta que el operador suba el Apps Script nuevo, ejecute `configurarAdmin("...")` y vuelva a publicar la app web. Pasos en `PANEL-ADMIN.md`.
- La contraseña antigua `Junio2026` estuvo publicada en el código fuente de `index.html`. Comprometida.
- Analítica preparada pero desactivada (IDs vacíos).
- `panel.html` es estático: la página de login es pública aunque no se pueda entrar. Falta auth básica en el hosting.

## Nada se borra

Regla del proyecto: las operaciones destructivas archivan en vez de eliminar. Productos → pestaña `ARCHIVO_PRODUCTOS`. Fotos → subcarpeta `ARCHIVO` de Drive. Archivos del repo → `_archivo/`. Mantener este criterio en cualquier función nueva.

## Documentación — leer solo la que haga falta

| Documento | Cuándo |
|---|---|
| `PROCESO.md` (5 KB) | Flujo de punta a punta: operador, servidor, navegador |
| `ESTATUS_Y_MEJORAS.md` (3 KB) | Estado por fases y backlog priorizado |
| `CHANGELOG.md` (5 KB) | Historial |
| `PLAN-SEO-GEO.md` (19 KB) | **Solo** en tareas de SEO/GEO — es el doc más caro |
| `BLUEPRINT.md` (5 KB) | Visión original del proyecto por fases |
| `MIGRACION-SUPABASE.md` (5 KB) | Estado y pasos de la migración a Postgres |
| `supabase/schema.sql` | Esquema y políticas RLS |
| `PANEL-ADMIN.md` (4 KB) | Puesta en marcha del panel y solución de problemas |
| `copia-local/BITACORA.md` | Registro de la copia local y hallazgos de eficiencia |

## Economía de tokens

- `info.html` (106 KB ≈ 27 k tokens) y `servidor_google_apps_script.js` (36 KB): localizar con `grep -n` y leer solo el rango con `sed -n 'A,Bp'`. Nunca `cat` completo.
- `assets/` tiene cada imagen en `.png` y `.webp`; `Fotos WEB Defaul/` son fotos de respaldo. No inspeccionarlas salvo que la tarea sea de imágenes.
- Para entender cualquier lógica del catálogo, `js/app.js` es la fuente; `producto.js` es su copia parcial.

# Migración de Google Sheets a Supabase

Sustituir la Hoja de Google y Drive por Postgres y Storage, sin dejar de poder volver atrás.

> **Por qué.** Medido en producción el 09‑nov‑2026: Apps Script tarda **1.540 ms** en devolver 25 KB
> *sirviéndolos desde su propia caché*. Ese es el cuello de botella, no Drive (que sirve en ~100 ms).
> Lo que se percibe como «la foto tarda en salir» son los dos cachés de 6 h encadenados más el
> retardo de Drive al publicar un archivo nuevo. Con Supabase la consulta baja a ~80 ms y los cachés
> dejan de hacer falta: publicar vuelve a ser instantáneo.

---

## Estado

| Pieza | Estado |
|---|---|
| Esquema Postgres + RLS (`supabase/schema.sql`) | ✅ Escrito |
| Script de migración (`scripts/migrar-a-supabase.mjs`) | ✅ Escrito y probado en seco |
| Capa de datos del sitio (`js/config.js`, `js/datos.js`) | ✅ Escrita y probada con Supabase simulado |
| `app.js` y `producto.js` enganchados | ✅ Hecho, con respaldo automático a Apps Script |
| Panel (`panel.html`) contra Supabase + Auth | ⏳ Pendiente: necesita el proyecto creado |
| Fotos en WebP al subir desde el panel | ⏳ Pendiente |

**Ahora mismo el sitio funciona exactamente igual que antes.** Mientras `SUPABASE_URL` esté vacío en
`js/config.js`, todo sigue yendo por Apps Script. La migración se activa rellenando dos valores.

---

## Pasos

### 1. Crear el proyecto

En [supabase.com](https://supabase.com) → New project.

- **Region: EU (Ireland) o EU (Frankfurt).** No `Americas`: tus clientes están en España y Europa, y
  la región no se puede cambiar después sin recrear el proyecto.
- Guarda la contraseña de Postgres en tu gestor de contraseñas. No hace falta para nada de esto.

### 2. Crear las tablas

SQL Editor → pegar entero `supabase/schema.sql` → Run.

Crea `productos`, `imagenes`, `textos` e `imagenes_sitio`, la vista `catalogo`, el bucket de Storage
y las políticas RLS. Es idempotente: se puede volver a ejecutar sin romper nada.

**Qué protege el RLS:** con la `anon key` (la que va en el navegador) solo se pueden *leer* los
productos visibles y no archivados. Escribir exige sesión iniciada. Un visitante no puede ver
productos ocultos ni modificar nada aunque se saque la clave del código fuente.

### 3. Migrar los datos

```bash
npm install
```

Luego, con tus claves de **Project Settings → API**:

```bash
SUPABASE_URL="https://xxxx.supabase.co" \
SUPABASE_SERVICE_KEY="eyJ..." \
node scripts/migrar-a-supabase.mjs
```

Prueba primero en seco con `--dry`, que no escribe nada:

```bash
node scripts/migrar-a-supabase.mjs --dry
```

Lee el catálogo del Apps Script actual y vuelca 18 productos, 64 fotos y 47 textos.
Es re-ejecutable: hace upsert por id y se salta las fotos ya subidas (`--forzar` para rehacerlas).
Al final compara los totales de origen y destino y avisa si no cuadran.

> La `service_role` key salta el RLS. Úsala solo en este comando, nunca en el navegador, y no la
> dejes escrita en ningún archivo del repositorio.

**Las fotos se convierten a WebP a 1400 px.** Medido sobre 4 fotos reales: los originales en Drive
son PNG de 5‑6 MB y quedan en ~80 KB, un **98 % menos**. El catálogo entero pasa a ocupar unos 5 MB.

### 4. Encender Supabase en el sitio

En `js/config.js`, rellenar:

```javascript
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',     // la anon / public, NO la service_role
```

Con eso el sitio pasa a leer de Supabase. Si Supabase fallara, `js/datos.js` cae solo a Apps Script
sin que el visitante note nada.

### 5. Crear el usuario del panel

Authentication → Users → Add user, con tu email y una contraseña nueva.
(El panel todavía no usa esto: ver «Lo que falta».)

### 6. Comprobar y retirar

Con el sitio ya leyendo de Supabase, verifica que salen los 18 productos y las fotos.
Deja Apps Script como respaldo unas semanas. Cuando lo retires:

- Vacía `APPS_SCRIPT_URL` y `SHEET_ID` en `js/config.js`.
- La Hoja y el Drive se quedan como están, de archivo histórico.

---

## Cómo volver atrás

Vaciar `SUPABASE_URL` en `js/config.js`. El sitio vuelve a Apps Script en la siguiente recarga.
No hay más que deshacer: la migración **no toca nada** en Google.

---

## Lo que falta

1. **Panel contra Supabase.** Hoy `panel.html` escribe en la Hoja vía Apps Script. Hay que cambiarlo
   a Supabase Auth (email + contraseña) y a escrituras sobre Postgres y Storage. Con eso desaparece
   el sistema de tokens hecho a mano y `configurarAdmin()`.
2. **WebP al subir desde el panel**, redimensionando en el navegador con canvas antes de enviar.
   Son unas 30 líneas y es donde está la mayor parte de la ganancia de peso a futuro.
3. **Exportar a CSV** desde el panel, para que el catálogo se pueda seguir mirando en una hoja.
4. **Mover el frontend a un CDN europeo** (Cloudflare Pages o Vercel). Hoy se sirve desde Railway en
   Miami: `x-railway-edge: mia1`, 122 ms de TTFB. Nada que ver con Supabase, pero es la otra mitad
   del problema de velocidad.

---

## Estructura de datos

| Tabla | Para qué |
|---|---|
| `productos` | Una fila por pieza. El `id` sigue siendo el texto de siempre (`N. Ruby D`) para no romper enlaces |
| `imagenes` | Una fila por foto. `orden = 0` es la principal |
| `textos` | Lo que hoy está en la pestaña `TEXTOS`, con `es` y `en` en columnas |
| `imagenes_sitio` | Hero y banners, lo que hoy vive en `Site_Assets` de Drive |
| `catalogo` (vista) | Producto + sus fotos ya ordenadas, en una sola consulta |

**Nada se borra.** `productos.archivado` y `imagenes.archivada` sustituyen al borrado: la fila se
conserva entera y deja de verse. Es la misma regla que ya seguía el panel.

Campos nuevos que la Hoja no tenía: `orden` (para ordenar el catálogo a mano, que hoy no se puede),
`precio_mayorista` (preparado para la Fase 2b) y las fechas de creación y modificación.

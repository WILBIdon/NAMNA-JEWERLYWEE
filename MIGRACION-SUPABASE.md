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
| Proyecto creado (Frankfurt) | ✅ `mublwuvrpyztgblxqrmn` |
| Esquema aplicado en la base | ✅ 4 tablas, 1 vista, 12 políticas, 1 bucket |
| Datos migrados | ✅ 17 productos · 60 fotos · 47 textos · 0 fallos |
| Sitio leyendo de Supabase | ✅ Portada y ficha de producto, 0 peticiones a Google |
| Panel (`panel.html`) contra Supabase + Auth | ⏳ Pendiente |
| Fotos en WebP al subir desde el panel | ⏳ Pendiente |

**Ahora mismo el sitio funciona exactamente igual que antes.** Mientras `SUPABASE_URL` esté vacío en
`js/config.js`, todo sigue yendo por Apps Script. La migración se activa rellenando dos valores.

---

## Pasos

### 1. Crear el proyecto ✅ hecho

Proyecto `namna-jewelry`, región **Central EU (Frankfurt)** `eu-central-1`.

```
https://mublwuvrpyztgblxqrmn.supabase.co
```

Comprobado el 09‑nov‑2026: responde en **37–115 ms**, contra los 1.540 ms de Apps Script.
La URL ya está puesta en `js/config.js`; falta la `anon key`.

### 2. Crear las tablas ✅ hecho

SQL Editor → pegar entero `supabase/schema.sql` → Run.

Para comprobar que fue bien, al final del archivo hay una consulta comentada que debe devolver
4 tablas y 1 vista.

Crea `productos`, `imagenes`, `textos` e `imagenes_sitio`, la vista `catalogo`, el bucket de Storage
y las políticas RLS. Es idempotente: se puede volver a ejecutar sin romper nada.

**Qué protege el RLS:** con la `anon key` (la que va en el navegador) solo se pueden *leer* los
productos visibles y no archivados. Escribir exige sesión iniciada. Un visitante no puede ver
productos ocultos ni modificar nada aunque se saque la clave del código fuente.

### 3. Migrar los datos ✅ hecho

Ejecutado el 09‑nov‑2026: 17 productos, 60 fotos, 47 textos, **0 fallos**.
Peso de las fotos: **179,3 MB → 5,5 MB (−97 %)**.

<details><summary>Cómo volver a ejecutarlo</summary>


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

**Las fotos se convierten a WebP a 1400 px.** Los originales en Drive eran PNG de 5‑6 MB.

</details>

### 4. Encender Supabase en el sitio ✅ hecho

En `js/config.js`, rellenar:

```javascript
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',     // la anon / public, NO la service_role
```

Con eso el sitio pasa a leer de Supabase. Si Supabase fallara, `js/datos.js` cae solo a Apps Script
sin que el visitante note nada.

### 5. Crear el usuario del panel ← **pendiente**

Authentication → Users → Add user, con tu email y una contraseña nueva.
(El panel todavía no lo usa: ver «Lo que falta».)

### 5b. Rotar la clave secreta ← **pendiente**

La `sb_secret_` se compartió por chat durante la migración. En Project Settings → API Keys → Roll.
Ya no hace falta para nada: el sitio solo usa la publicable.

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

## Dos cosas que aparecieron al migrar

**La Hoja pasó de 18 a 17 productos** entre dos mediciones del mismo día, con sus 4 fotos. No fue la
migración: ambos orígenes devuelven ahora los mismos 17 IDs. Conviene revisar en la Hoja si una pieza
se ocultó sin querer.

**Todos los productos entraban como «Agotado».** La columna `Stock` de la Hoja está vacía y Apps
Script convierte el vacío en `0`; el sitio antiguo lo deshacía con `Number(stock) || null`, así que
nunca se vio. Al migrar fielmente, los 17 llegaron con stock 0 y la web los marcó agotados.
Corregido en la base (`stock = NULL`, que es «sin control de inventario») y en el migrador, para que
una reejecución no lo reintroduzca.

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

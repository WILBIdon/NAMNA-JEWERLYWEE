# Auditoría del 10-nov-2026 — backlog

Siete dimensiones auditadas en paralelo, cada hallazgo con verificación adversarial.
Lo que ya se arregló está en [CHANGELOG.md](CHANGELOG.md); aquí queda lo pendiente.

> **Cómo leer esto.** Los **confirmados** pasaron un verificador que intentó refutarlos contra el
> código real. Los **sin verificar** perdieron su verificador por un corte de sesión: son pistas,
> no conclusiones. Uno de los que sí se verificó («3 productos existen solo en la Hoja») resultó
> **falso**, así que trátalos con la misma desconfianza hasta comprobarlos.

---

## Confirmados

### CRITICA · Las 17 fichas de producto no tienen ninguna ruta rastreable: ni enlace HTML ni entrada en el sitemap

**Dónde:** sitemap.xml:4-43 → 6 URLs y ninguna lleva ?id=. js/app.js:918 → `card.querySelector('.product-card-image > img').addEventListener('click', () => openModal(product))`: la tarjeta del catálogo es un <article> con escuchadores de clic, no un <a href>. `grep -rn "producto?id=" --include=*.html .` (sin c

**Por qué importa:** Un buscador no puede llegar a ninguna ficha: no hay enlace que seguir ni URL que leer en el sitemap. Las 17 páginas de producto son invisibles en Google y en los buscadores de IA, así que todo el tráfico orgánico depende de la portada. Para un catálogo sin checkout, donde la ficha es la página que convierte a WhatsApp, es la pérdida más grande del sitio.

**Arreglo:** Dos cosas. (1) Envolver la imagen y el nombre de la tarjeta en un <a href="/producto?id=<id codificado>"> real y dejar que el modal siga abriéndose con preventDefault() sobre ese enlace: el humano no nota el cambio y el crawler ya tiene por dónde entrar. (2) Generar sitemap.xml desde Supabase (vista `catalogo`) con las 17 URLs `/producto?id=…` más las estáticas, en un script de scripts/ al estilo 

_Esfuerzo: horas_

### ALTA · Railway publica el repositorio entero: CLAUDE.md, el esquema con las políticas RLS, los scripts de migración y la carpeta `_archivo`

**Dónde:** `npx serve .` sirve el directorio completo (package.json:6). Comprobado en producción: `curl -o /dev/null -w '%{http_code}' -L https://www.namnafine.com/<ruta>` → 200 en /CLAUDE.md, /MIGRACION-SUPABASE.md, /supabase/schema.sql, /scripts/migrar-a-supabase.mjs, /package.json, /_archivo/panel-v1-appssc

**Por qué importa:** Cualquiera que teclee la ruta obtiene el mapa exacto de las debilidades del sitio: la lista interna de problemas abiertos, el modelo de permisos completo (que es justo lo que hace explotable el hallazgo 1) y el panel retirado apuntando al backend vivo. Convierte un ataque de adivinanza en un ataque guiado, y expone documentación interna de negocio que nunca se pensó para clientes.

**Arreglo:** Mover lo publicable a una carpeta `publico/` (HTML, css, js, assets, robots, sitemap, llms) y servir solo esa: `serve publico`. La documentación, `supabase/`, `scripts/`, `_archivo/` y `copia-local/` se quedan fuera de la raíz servida. Nada se borra: solo deja de estar expuesto. Verificar luego con el mismo bucle de `curl` que esas rutas devuelven 404.

_Esfuerzo: horas_

### ALTA · La ficha y el catálogo llegan vacíos sin JavaScript, y el Product JSON-LD estático es un hueco sin precio ni oferta

**Dónde:** `curl -sS "https://www.namnafine.com/producto?id=N.%20Ruby%20D"` → HTTP 200, 14.421 bytes, `<title>NAMNA Fine Jewelry — Product</title>` y `grep -c "N. Ruby D"` sobre esa respuesta → 0. producto.html:41-48: el Product JSON-LD solo tiene `name: "NAMNA Fine Jewelry"` y `brand`, sin image, description,

**Por qué importa:** Todo el contenido vendible (nombre, precio, descripción, fotos, schema con offers) existe solo después de que el navegador ejecute JS y complete un fetch de origen cruzado a mublwuvrpyztgblxqrmn.supabase.co. Google renderiza, pero en una segunda pasada y sin garantías; los rastreadores de IA (GPTBot, PerplexityBot, ClaudeBot), los previsualizadores de enlaces y Bing en gran medida no ejecutan nada

**Arreglo:** Prerenderizar: un script en scripts/ que lea la vista `catalogo` de Supabase y escriba el nombre, precio, descripción, imágenes y el Product JSON-LD completo dentro del HTML, dejando que el JS actual hidrate encima. Ojo: PLAN-SEO-GEO.md:116-117 diseña ese generador leyendo el Sheet por gviz y llamando al Apps Script con ?refresh=true, fuente que ya no alimenta la web desde la migración; hay que re

_Esfuerzo: dias_

### MEDIA · El tercer nivel de respaldo (fetchFromGoogleSheets por gviz) sigue vivo y sirve el catálogo con fotos de relleno, cacheado 6 h

**Dónde:** `js/app.js:327-341` llama a `fetchFromGoogleSheets()` (definida en js/app.js:455-511) en cuanto falla la capa de datos; lo mismo en `js/producto.js:207-220` y `js/producto.js:306-347`. La función construye cada producto con `imagenes: [CATEGORY_IMAGE_FALLBACK[cat_es] || CATEGORY_IMAGE_FALLBACK._defa

**Por qué importa:** Con Supabase caído y Apps Script en frío, la web no muestra un error: muestra las 17 piezas con `assets/fallback_necklace.webp` y `fallback_default.webp` en lugar de la joya real, y lo guarda 6 horas. Para una marca de joyería es peor que no cargar: el visitante ve un catálogo de imágenes genéricas y se va. Esta ruta además lee la Hoja directamente, que desde el 2026-11-09 ya no la escribe nadie (

**Arreglo:** Retirar el nivel gviz del camino de lectura: quitar los bloques `js/app.js:327-341` y `js/producto.js:207-220`, y mover `fetchFromGoogleSheets` a `_archivo/` según la regla de que nada se borra. Si se quiere conservar como red de emergencia, que no cachee (no llamar a `saveToCache`) y que pinte un aviso visible de «catálogo en modo degradado, consulta por WhatsApp».

_Esfuerzo: minutos_

### MEDIA · Las cabeceras de seguridad que el CHANGELOG da por hechas no existen en producción: van en `<meta>`, que el navegador ignora

**Dónde:** CHANGELOG.md:95 las registra como resueltas: «security: headers de seguridad (X-Frame-Options DENY, CSP frame-ancestors none, referrer policy)». Pero están como `<meta http-equiv>` en index.html:9-10, info.html:9-10 y producto.html:9-10, y `curl -I https://www.namnafine.com/` devuelve solo: accept-r

**Por qué importa:** Queda sin red de seguridad lo que el proyecto cree cubierto: el sitio es embebible en un iframe de un clon (la única barrera real es el JS de js/shield.js:205-208, que se neutraliza con `sandbox="allow-scripts"`), no hay CSP que contenga un XSS como el del hallazgo 4, y sin HSTS la primera petición es interceptable en una wifi pública. Daña la confianza en el único canal de venta que tiene la marc

**Arreglo:** Las cabeceras solo las puede poner el servidor. Poner delante un servidor que las emita (Caddy con un bloque `header`, o un Express mínimo de 20 líneas en Railway) con: `Content-Security-Policy` real (script-src propio + fonts.googleapis/gstatic, connect-src el proyecto Supabase, frame-ancestors 'none'), `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Po

_Esfuerzo: horas_

### MEDIA · producto.html?id= responde 301 y pierde el ?id; la URL de producto del sitemap acaba en un soft 404 indexable

**Dónde:** `curl -o /dev/null -w "%{http_code} -> %{redirect_url}" "https://www.namnafine.com/producto.html?id=N.%20Ruby%20D"` → `301 -> https://www.namnafine.com/producto` (la cadena de consulta desaparece). `curl "https://www.namnafine.com/producto"` → HTTP 200, con `name="robots" content="index, follow, max

**Por qué importa:** La única URL de producto que el sitemap declara lleva a la página «Producto no encontrado» devolviendo 200: Google la trata como soft 404 y, al ser index,follow, puede indexarla y mostrarla como resultado. Además el canonical, el og:url y el breadcrumb que leen los crawlers y los previsualizadores de enlaces señalan una URL con redirección, que es exactamente la señal que anula la consolidación de

**Arreglo:** Pasar todas las referencias estáticas de producto.html a la forma sin extensión (`/producto`), que es la que sirve 200, y hacer que showNotFound() (js/producto.js:664) inyecte `<meta name="robots" content="noindex,follow">` cuando no hay producto. Quitar `/producto.html` del sitemap y sustituirlo por las 17 URLs con ?id=. Si se quiere conservar el formato antiguo circulando por WhatsApp, configura

_Esfuerzo: minutos_

### MEDIA · Las miniaturas del catálogo son las fotos a tamaño completo: 1,47 MB de 1,71 MB que pesa la portada

**Dónde:** js/app.js:909 pinta `product.imagenes[0]` tal cual en la tarjeta. css/styles.css:887-896 y :913-915 dan 4 columnas dentro de un contenedor de 1280 px con gutter de 3rem y gap de 1,5rem → tarjeta de 278 px, aspect-ratio 3/4, object-fit cover. Medidas las 17 fotos principales: 1.501.728 bytes (hasta 1

**Por qué importa:** Son el 86 % del peso de la portada (1.466 KB de 1.713 KB) y lo único que un comprador de joyería mira. En 4G española el catálogo completo tarda 4-6 s en estar visible. Peor: la mitad de las fotos son horizontales (1400x933) metidas en una tarjeta vertical 3/4 con object-fit: cover, así que se descarga pixel que ni se llega a ver.

**Arreglo:** panel.html ya redimensiona en canvas (`aWebp()`, ANCHO_MAX 1400): llamarlo dos veces, a 1400 px y a 600 px, y subir las dos. Añadir `imagenes.thumb_url` al esquema (columna nueva, nada se borra) y devolverla en la vista `catalogo` (supabase/schema.sql:181, el jsonb_agg). Que la tarjeta de js/app.js:909 y la de novedades (:738) usen thumb_url con fallback a url. Backfill de las 17 principales con u

_Esfuerzo: horas_

### MEDIA · Railway no manda NINGUNA cabecera de caché: el navegador revalida cada CSS, JS e imagen contra Miami en cada página

**Dónde:** `curl -sS -o /dev/null -D - https://www.namnafine.com/js/app.js | grep -ciE 'last-modified|cache-control|expires|max-age'` → 0. El volcado completo de cabeceras de /css/styles.css solo trae: accept-ranges, content-disposition, content-encoding, content-type, date, etag, server, vary, x-railway-reque

**Por qué importa:** En cada navegación interna (portada → ficha de producto) y en cada visita repetida, el navegador revalida styles.css, wishlist_search.css, config.js, datos.js, app.js o producto.js, shield.js, Logo-namna2.png y el hero antes de poder pintar. CSS y JS son bloqueantes, así que es un viaje completo a Miami (~130 ms desde España) de retraso puro en cada página, en algo que con la cabecera correcta ser

**Arreglo:** Añadir la configuración de cabeceras que lea el hosting (serve.json con `headers` si sigue bajo `serve`; _headers si se mueve a Cloudflare Pages, que además resuelve el edge en Miami). Un año inmutable para /assets/* y el logo (`public, max-age=31536000, immutable`), porque ya no cambian. Para /css/* y /js/*, que sí cambian en cada despliegue y no llevan hash en el nombre, empezar con `public, max

_Esfuerzo: horas_

---

## Sin verificar — comprobar antes de actuar

- **[CRITICA]** No existe ninguna copia de seguridad de la base ni de Storage, y el único camino de «recuperación» pisaría lo nuevo  
  Hoy no hay forma de volver atrás ante nada: un borrado, un `update` masivo mal hecho, una fila pisada o una foto eliminada son definitivos. El plan gratuito no guarda copias automáticas, y el reposito  
  _horas_

- **[ALTA]** `/panel` y `/admin` se sirven abiertos, y el panel viejo todavía escribe en Google Sheets  
  El formulario de acceso y los 53 KB de JavaScript del panel —con los nombres de tablas, columnas y rutas del bucket— quedan a mano de cualquiera para estudiarlos y para intentar fuerza bruta contra Su  
  _horas_

- **[ALTA]** hreflang inválido: las tres etiquetas apuntan a la misma URL y el español no tiene URL propia que indexar  
  Un hreflang en el que las tres variantes comparten URL es una anotación que Google descarta: no gana nada y además declara dos idiomas para un documento que solo puede servir uno. Como el idioma se gu  
  _dias_

- **[ALTA]** El hero y los 3 banners se descargan dos veces, byte a byte idénticos: 102 KB tirados en la portada y 320 KB en info.html  
  102 KB desperdiciados en cada carga de portada y 320 KB en cada carga de info.html, sin un píxel de diferencia en pantalla. Además el reemplazo llega al final de la cascada (HTML → 4 scripts con defer  
  _minutos_

- **[ALTA]** Subir fotos en el panel usa la variable global EDITANDO después de los await: deja archivos huérfanos o cuelga la foto del producto equivocado  
  Si quien administra cierra el modal o pulsa Escape mientras suben varias fotos (el caso normal: se arrastran 4 y se tarda), el .webp ya está en Storage pero el dbInsert revienta con un TypeError en in  
  _minutos_

- **[ALTA]** La regla «nada se borra» solo existe en el panel: Postgres deja borrar filas a cualquier sesión autenticada  
  Si alguien borra una fila por error —un texto, una foto, una imagen de diseño— se va de verdad, y combinado con la falta de copias no hay ningún camino de vuelta. La regla del proyecto está escrita en  
  _minutos_

- **[ALTA]** Tres productos (1.850 €) existen solo en la Hoja — y ahí está la explicación del 18 → 17  
  1.850 € de catálogo existen únicamente en la Hoja de Google, que ya no alimenta la web. En cuanto se retire Apps Script («unas semanas», MIGRACION-SUPABASE.md:122) esas 3 piezas desaparecen sin rastro  
  _horas_

- **[ALTA]** El catálogo y la ficha emergente no se pueden usar con teclado ni con lector de pantalla  
  El único camino de compra (abrir la pieza → botón «Pedir por WhatsApp») es invisible para quien navega con teclado y no se anuncia a un lector de pantalla: el foco se queda detrás del overlay y hay qu  
  _horas_

- **[ALTA]** Los colores de marca para texto pequeño están por debajo del mínimo legible (WCAG AA 4.5:1)  
  La categoría de cada pieza, las migas de navegación y el aviso de últimas unidades son prácticamente ilegibles con luz de día en un móvil o para cualquier persona con visión reducida — y el público de  
  _horas_

- **[ALTA]** El escudo anti-clonación impide a los clientes copiar datos e imprimir la página  
  El pedido se cierra por WhatsApp pegando el código de la pieza, pero el cliente no puede seleccionar ni copiar «N. Ruby D», ni el precio, ni el correo namnafine@gmail.com, ni la dirección de envíos; e  
  _minutos_

- **[ALTA]** Cuando la carga de datos falla, ni la web ni el panel lo dicen: los dos muestran «no hay nada»  
  Un visitante con la red inestable, en modo avión momentáneo o con supabase.co bloqueado por su red corporativa concluye que la tienda no tiene piezas y se va; no hay ningún camino alternativo al pedid  
  _horas_

- **[MEDIA]** shield.js no protege nada y sí estorba: bloquea imprimir, copiar y seleccionar, y su aviso de iframe enlaza a un dominio que no es el del negocio  
  Cero defensa real —el que quiera clonar el catálogo lo baja por la API pública en una línea— a cambio de fricción medible en la compra: una clienta que quiere imprimir la ficha de un anillo de 280 € v  
  _minutos_

- **[MEDIA]** El panel retirado _archivo/panel-v1-appsscript.html está desplegado y operativo en producción, escribiendo en la Hoja  
  Si la dueña tiene ese panel en marcadores (era el panel de gestión hasta el 2026-11-09) y entra con su contraseña, guarda productos, precios, textos y fotos en la Hoja y en Drive. La web ya no lee de   
  _minutos_

- **[MEDIA]** PROCESO.md describe un proyecto que ya no existe y CLAUDE.md afirma cosas que el código desmiente  
  PROCESO.md es el documento que CLAUDE.md señala para «entender el flujo de punta a punta»: cualquiera que lo lea, persona o asistente, reconstruirá el sistema viejo, editará la Hoja y tocará las URLs   
  _horas_

- **[MEDIA]** La URL de Apps Script y el SHEET_ID siguen codificados en app.js y producto.js, así que vaciarlos en config.js no retira Apps Script  
  El paso 6 de MIGRACION-SUPABASE.md («Vacía APPS_SCRIPT_URL y SHEET_ID en js/config.js») no hace lo que promete: al ejecutarlo se creerá que Apps Script quedó retirado, y privacidad.html seguirá llamán  
  _horas_

- **[MEDIA]** llms.txt y llms-full.txt describen un catálogo que ya no existe: inventan colecciones y omiten 6 de los 17 productos  
  Son los dos archivos escritos expresamente para que los modelos citen la marca, y hoy les dan datos falsos: un asistente que lea llms.txt recomendará colecciones que no se venden y no sabrá de seis pi  
  _horas_

- **[MEDIA]** El sitemap declara una página noindex, un .txt y un duplicado de la portada, con lastmod congelado en junio  
  De las 6 URLs declaradas, 3 no deberían estar (una pide expresamente no ser indexada, otra no es una página, otra es un duplicado no canónico) y la sexta redirige. El sitemap le dice a Google que nada  
  _minutos_

- **[MEDIA]** Un @import dentro del CSS bloqueante añade un viaje a Miami en serie en la ruta crítica  
  Un viaje de ida y vuelta extra, en serie, con el renderizado parado, en cada página del sitio. Desde España contra el edge de Miami son ~130 ms añadidos al First Contentful Paint. Y como no hay cabece  
  _minutos_

- **[MEDIA]** No hay preconnect al origen de Supabase, del que depende todo lo que el visitante ve  
  DNS + TCP + TLS contra Frankfurt se pagan al final de la cascada (HTML → CSS/JS → DOMContentLoaded → Supabase) en vez de solaparse con la descarga del CSS y del JS. De ese origen salen el catálogo, lo  
  _minutos_

- **[MEDIA]** Un fallo en la tabla `textos` tumba toda la ruta de Supabase y dispara el respaldo roto  
  Los textos del sitio no son críticos (la web tiene todos sus literales en el HTML y el catálogo ya vendría cargado), pero su fallo arrastra a los productos: el visitante acaba viendo el catálogo del r  
  _minutos_

- **[MEDIA]** Un producto nuevo se crea visible y sin fotos: imagen `undefined`, og:image roto y schema.org sin imagen  
  Cuando alguien comparte el enlace de esa pieza por WhatsApp —el único canal de venta— la vista previa sale sin foto, que es justo lo que hace clicar en una joyería. Google además marca el Product como  
  _minutos_

- **[MEDIA]** Las tres piezas más caras del catálogo están en una categoría fantasma «Joyería/Jewelry»  
  Las tres piezas de mayor precio quedan fuera del recorrido natural del visitante, escondidas tras un botón genérico que no significa nada para quien compra, mientras el resto del catálogo se navega po  
  _minutos_

- **[MEDIA]** El panel tira el trabajo sin guardar al cerrar la ficha, y la foto principal solo se cambia arrastrando  
  Quien gestiona la tienda escribe descripciones bilingües largas en los dos <textarea> de la ficha; un clic fuera del recuadro o un Escape borran todo sin preguntar, y como no es programadora no tiene   
  _minutos_

- **[BAJA]** De los 11 textos «Sin usar», 7 son filas vacías y uno guarda el email y el teléfono equivocados  
  Hoy no se ve, porque ningún HTML referencia esos IDs. El problema es que el panel presenta las 11 filas como textos editables normales, y TXT-018 es precisamente el que un operador copiaría al poner l  
  _minutos_

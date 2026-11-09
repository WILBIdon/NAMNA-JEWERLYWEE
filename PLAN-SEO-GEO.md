# Plan modular SEO + GEO — NAMNA Fine Jewelry
**Mercado objetivo:** búsqueda en Europa (ES primario, EN como lengua franca del resto de la UE)
**Línea base (2026-10-27):** Search SEO 46/100 (F) · AI Visibility 40/100 (F, limitado por fallo sev-5)
**Stack:** estático en Railway, deploy automático desde GitHub `main`, catálogo en Google Sheets vía Apps Script + gviz
**Decisiones cerradas (2026-10-27):** solo online, sin tienda física · `x-default` → EN · checkout se queda en WhatsApp · publicación cron 6 h + botón manual
**Principio rector:** cada módulo se despliega solo, se verifica solo y se puede revertir solo. Nada que hoy funcione se elimina — se le añade una capa estática por debajo.

---

## Decisión de arquitectura (la que condiciona todo el plan)

El problema raíz es que el catálogo solo existe después de ejecutar JS. Hay tres salidas:

| Opción | Qué implica | Veredicto |
|---|---|---|
| **A. Prerender en GitHub Actions, HTML commiteado** | Un generador lee el Sheet, escribe HTML, commitea → Railway redeploya | **Elegida** |
| B. Build command en Railway | `npm run build` antes de `serve`; lee el Sheet en cada deploy | Descartada: toca la infra que hoy funciona y el Sheet solo se refleja al hacer push |
| C. Servidor con SSR | Express en Railway renderizando en caliente | Descartada: cambia el modo de hosting, añade superficie de fallo y coste |

**Por qué A:** Railway sigue sirviendo estático puro (cero cambio de infra), el HTML generado queda versionado en git (ves el diff, revierte con un `git revert`), y la hoja sigue siendo la única fuente de verdad para ti.

**La clave para no romper nada — hidratación por encima del prerender:**
el HTML prerenderizado trae el catálogo para los crawlers; el JS actual **sigue intacto** y al cargar vuelve a leer el Sheet para refrescar stock y precio. El visitante humano nunca ve datos rancios; el crawler ya no ve "Cargando piezas…". No se borra una línea de `app.js`: se le pone suelo.

**Cadencia de publicación:** cron cada 6 h + `workflow_dispatch` manual + un botón "Publicar" en la propia hoja (el Apps Script que ya existe llama al GitHub API). Tú decides cuándo sale.

---

## Orden en cascada

```
M0 Red de seguridad ─┬─> M1 Higiene de indexación ──> M2 Identidad y titles ─┐
                     │                                                        │
                     └─> M3 Prerender del catálogo (M3.1…M3.6) ───────────────┼──> M4 i18n Europa
                                                                              │
                                        M5 Contenido de autoridad <───────────┘
                                        M6 E-E-A-T y entidad
                                        M7 Comercio por IA
                                        M8 Rendimiento fino
```

M1 y M2 son independientes de M3: se pueden soltar ya mismo mientras M3 se construye. M4 espera a M3 para no prerenderizar dos veces.

---

## M0 — Red de seguridad
**Sin esto, "mejorar" es opinión.** No toca SEO; hace que todo lo demás sea verificable y reversible.

- Rotar el PAT de GitHub filtrado en `.git/config`; remote por SSH.
- Verificar **Google Search Console** (ES + propiedad de dominio) y **Bing Webmaster Tools** (cubre Europa y alimenta a ChatGPT vía Bing).
- Instalar analítica: GA4 o Plausible. Hoy `GOOGLE_ANALYTICS_ID` está vacío en `js/app.js:26`.
- Escribir `tools/verify.sh`: comprueba los invariantes del sitio y falla con código ≠ 0 si algo se rompió.
  - status 200 en `/`, `/info`, `/producto`, `/privacidad`; 404 en una URL inexistente
  - `/admin` NO indexable; canonicals sin `.html`; ninguna URL del sitemap devuelve 301
  - cada página tiene exactamente un `<h1>`, un canonical y un title único
  - el JSON-LD parsea y `Product` trae `offers.price`
  - el catálogo aparece en el HTML sin ejecutar JS (recuento mínimo de productos)
- Congelar la auditoría actual como baseline para comparar.

**Verificación:** `tools/verify.sh` pasa contra producción tal como está hoy (con los fallos conocidos marcados como "pendiente", no como "roto").
**Riesgo:** nulo · **Esfuerzo:** 1 sesión · **Impacto en score:** 0 (es el andamio)

---

## M1 — Higiene de indexación
Quick wins puros. No cambia ni un píxel de lo que ve el usuario.

- `robots.txt`: `Disallow: /admin` (hoy dice `/admin.html`, que 301ea a `/admin` → la regla no aplica y `/admin` da 200).
- `<meta name="robots" content="noindex,nofollow">` en `admin.html` — robots.txt bloquea el rastreo, no la indexación.
- Canonicals a URLs limpias: `/info`, `/producto`, `/privacidad` (hoy apuntan a `.html`, que redirige).
  *Matiz verificado: en las fichas, `producto.js` **sí** reescribe el canonical correctamente al ejecutarse (`/producto?id=…`). El canonical roto es el del HTML estático, que es justo el que leen los crawlers sin JS.*
- Añadir canonical a `/privacidad` (hoy no tiene ninguno).
- `sitemap.xml` con URLs limpias; fuera `/index.html` y `/llms.txt`; `lastmod` real.
- Enlaces internos a URLs limpias: `info.html#about` → `/info#about` (y los de `#shipping`, `#returns`, `#faq`).
- Limpieza: fuera `meta keywords`, fuera el `href="#"` muerto, el `<h1>` del `<noscript>` pasa a `<h2>` (hoy la home tiene dos h1).

**Verificación:** `verify.sh` + "Inspección de URL" en Search Console sobre `/info` y `/admin`.
**Riesgo:** bajo · **Esfuerzo:** 1 sesión
**Impacto:** Indexabilidad 43→85 · Sitemaps 32→85 · Enlazado 40→65 · **Search SEO ≈ 46→58**

---

## M2 — Identidad de marca y titles para Europa
Prepara el terreno de M4: **un idioma por URL**, nunca los dos en el mismo campo.

- Titles y descriptions por página, en un solo idioma, con los términos que de verdad se buscan en Europa. Hoy la home es `NAMNA Jewelry — Fine Jewelry` (28 caracteres, sin "18k", sin "diamantes", sin geo) y la description mezcla ES y EN en un campo, diluyendo los dos.
- `Organization` + `WebSite` con `potentialAction`/`SearchAction`.
- **Tipo de entidad — resuelto: solo online.** Se cambia `JewelryStore` por `Organization` + `OnlineStore` y **se eliminan el `geo` y el `PostalAddress` incompletos**. Hoy hay `addressCountry: ES` a secas y un `geo` en el centro de Madrid (40.4168, −3.7038) que es un pin inventado: en un subtipo de `LocalBusiness` eso es una señal de ubicación fabricada, y quitarlo es una mejora en sí misma. Se conservan `areaServed` (los 14 países), `knowsAbout`, `alternateName` y `contactPoint`, que son lo valioso del schema actual.
- Sin local SEO ni Google Business Profile: no aplica a un negocio sin tienda. El eje europeo se juega en M4 y M5, no en el local pack.
- `sameAs` ampliado más allá de Instagram.
- `og:locale` coherente con el idioma de cada URL.

**Verificación:** Rich Results Test + Schema.org validator; titles únicos en `verify.sh`.
**Riesgo:** bajo · **Esfuerzo:** 1 sesión
**Impacto:** Meta/on-page 53→80 · Schema 63→75 · **Search SEO ≈ 58→64**

---

## M3 — Prerender del catálogo
**El módulo que desbloquea todo.** Subdividido para que entre en cascada y no como big bang. Cada submódulo se despliega y verifica por separado.

### M3.0 — La cadena de stock anula el seguimiento de inventario
*Rebajado de P0 tras verificarlo en navegador: el schema renderizado dice `InStock`, precio 590, 4 imágenes. No hay fichas declarándose agotadas.*

Lo que hay es un fallo latente por dos coerciones que se cancelan:
- `servidor_google_apps_script.js:114` → `Number(row[idx.stock]) || 0` convierte celda vacía en **0**
- `js/producto.js:273` y `js/app.js:422` → `Number(item.stock) || null` convierten ese 0 en **null**
- `js/producto.js:572` → `stock !== null` es falso → **InStock**

Hoy no hace daño porque la columna está vacía. Pero **colapsa "sin dato" y "cero unidades" en el mismo valor**: el día que empieces a llevar inventario, una pieza realmente agotada seguirá anunciándose disponible. Y las insignias de "solo quedan N" nunca se disparan, porque `stock` siempre es `null`.

Arreglo: distinguir vacío (`null`) de cero en el Apps Script — `row[idx.stock] === '' ? null : Number(...)` — y propagar `null` sin coercionarlo en el cliente.
**Cuándo:** no urge ahora; es **requisito de M7**, porque Merchant Center exige `availability` fiable. Déjalo anclado ahí.

### M3.1 — Generador de datos (solo datos, cero HTML)
`build/generate.mjs` lee el Sheet por gviz y escribe `data/catalog.json` versionado en git.
Llama al Apps Script con **`?refresh=true`** (documentado en `PROCESO.md` §3) para saltarse el `CacheService` de 6 h — si no, prerenderizarías datos de hasta 6 h de antigüedad.

**Slugs semánticos:** los `ID_Producto` son etiquetas internas (`N. Ruby D`, `E. Zafiros`), y como slug darían `/producto/n-ruby-d/` — ilegible y sin valor de búsqueda. El generador produce slugs del tipo `colgante-rubi-diamantes-oro-18k`, con un mapa `id → slug` versionado para que no cambien nunca una vez publicados.
*De paso: `E. wartefall D` parece un typo de "Waterfall" — corregir en la hoja antes de generar slugs.*

*Verificable solo: el JSON tiene los 14 productos con nombre, precio, categoría, descripción ES/EN y slug estable.*

### M3.2 — Espejar las imágenes a dominio propio
*Corregido tras verificar el endpoint real: las fotos reales **sí** se sirven en producción. El fallback de categoría de `js/app.js:487` es solo la ruta de respaldo (gviz), no la de producción.*

El problema real es otro: las ~55 imágenes (14 piezas × 3-4 fotos) están **hotlinkeadas desde Google Drive** (`lh3.googleusercontent.com/d/<id>=w800`). Eso implica:
- fuera de tu dominio → cero autoridad de imagen propia y un image sitemap inútil
- URLs que Drive puede cambiar o limitar por tasa — patrón conocido de romperse
- **Merchant Center no acepta de forma fiable imágenes hotlinkeadas de Drive**, así que esto bloquea M7
- sin control de caché ni de formato: sirves lo que Drive decida

Arreglo: el build descarga las imágenes una vez, las convierte a WebP y las escribe en `assets/productos/<slug>-N.webp`. Drive sigue siendo tu panel de subida; el sitio deja de depender de él en caliente. Con las imágenes en tu dominio, M7 (feed) se desbloquea.
*Depende de M3.1 (necesita el JSON con las URLs).*

### M3.3 — Prerender de fichas
`/producto/<slug>.html` con title y description propios, descripción en el HTML, `Product` + `offers` completo (`price`, `availability`, `image`, `sku`).
Hoy `/producto?id=1` devuelve a GPTBot 83 palabras y el texto **"Producto no encontrado"** — el schema estático es un placeholder sin `offers`; el bueno se construye en `js/producto.js:557`, después de JS.
**No romper lo compartido:** `/producto?id=X` sigue vivo con 301 a la nueva URL. Hay enlaces de WhatsApp circulando con ese formato.
*Aquí desaparece el fallo severidad 5 que limita el score IA a 40.*

### M3.4 — Prerender del grid de colección
El grid sale en el HTML de la home; el JS actual hidrata encima. Hoy la home tiene 164 palabras estáticas y su contenido principal es literalmente `"Cargando piezas..."`.

### M3.5 — Sitemap y enlazado
Sitemap con todas las fichas; enlaces `<a href>` reales desde el grid. Hoy no existe **ninguna** ruta rastreable a un producto: ni en el sitemap ni como enlace HTML.

### M3.6 — Automatización
GitHub Action: **cron cada 6 h + `workflow_dispatch` + botón "Publicar" en la hoja (resuelto)**. Commitea solo si el diff no está vacío, así el cron no genera ruido cuando no cambia nada. El botón **no hay que inventarlo**: `admin.html` ya tiene *Refrescar caché del servidor* (`?action=invalidate`, `PROCESO.md` §2.5). Se le añade al lado un *Publicar al sitio* que dispara el `workflow_dispatch`.

**Verificación:** `curl -A "…GPTBot/1.1" <url>` muestra nombre, precio y descripción sin JS · `verify.sh` cuenta productos en el HTML · Rich Results Test sobre 3 fichas · Search Console: fichas indexadas.
**Riesgo:** medio — mitigado por los 6 submódulos, `verify.sh` y `git revert`
**Esfuerzo:** 3-4 sesiones
**Impacto:** Extractabilidad 47→90 · E-commerce 8→70 · Encabezados 38→80 · se cae el cap sev-5 · **Search SEO ≈ 64→78 · AI Visibility ≈ 40→72**

---

## M4 — Arquitectura i18n para Europa
Depende de M3: hacerlo antes obliga a prerenderizar dos veces.

- `/es/…` y `/en/…` reales, con `hreflang` cruzado correcto. Hoy las tres etiquetas (`es`, `en`, `x-default`) apuntan a la **misma** URL — hreflang inválido — y la home declara `<html lang="en">` con contenido en español.
- `lang` correcto por página; el toggle JS pasa a ser un enlace entre URLs (mejor para el usuario y para el crawler).
- **`x-default` → `/en/` (resuelto).** Es la entrada de 13 de los 14 países de tu `areaServed`; `/es/` queda para España y LatAm.
- 301 de las URLs viejas a su equivalente, sin cadenas de redirección.
- Más adelante, y solo con contenido realmente traducido: `de`, `fr`, `it` (los tres mercados de mayor valor de tu `areaServed`).

**Verificación:** hreflang recíproco validado; Search Console → Segmentación internacional sin errores.
**Riesgo:** medio (cambian URLs) — mitigado con 301 y un mapa de redirecciones versionado
**Esfuerzo:** 2 sesiones
**Impacto:** hreflang 9→90 · **Search SEO ≈ 78→85**

---

## M5 — Contenido de autoridad para búsqueda europea
Aquí se gana el eje IA. **Y con 14 piezas en 2 categorías (9 colgantes, 5 pendientes), este módulo sube de prioridad:** con un catálogo así no compites por volumen de fichas, compites por ser la respuesta que los motores citan. M5 pasa a ir en paralelo con M4, no después.

- **Páginas de categoría reales** (`/es/collares-oro-18k/`, `/es/pendientes/`, `/en/18k-gold-necklaces/`). Hoy solo hay anclas `#catalogo` — no existe una URL que posicionar por categoría.
- **Páginas de envío por mercado** (Alemania, Francia, Italia, Países Bajos). Con sustancia real: plazos, aduanas, IVA, devoluciones por país. *Si son thin son doorway pages y hacen daño — o se hacen con información real o no se hacen.*
- **Guías citables por motores de IA:** "cómo distinguir un diamante natural de uno de laboratorio", "oro 18k vs 14k", "cómo elegir la talla". Respuestas cortas y autocontenidas, igual que tu FAQ actual — que es tu mejor activo y la única razón por la que el eje IA no está más abajo.
- Fechas de publicación y actualización visibles + `dateModified`. Hoy el `lastmod` está congelado en 2026-06-30 y no hay ninguna fecha en página.

**Verificación:** las guías aparecen como respuesta en Perplexity/ChatGPT sobre su consulta objetivo; cobertura en Search Console.
**Riesgo:** bajo · **Esfuerzo:** continuo
**Impacto:** Densidad de hechos 62→85 · Frescura 30→80 · Contenido 50→75 · **AI Visibility ≈ 72→84**

---

## M6 — E-E-A-T y entidad
Lo que permite a un motor de IA corroborar que la marca existe.

- Razón social y NIF en el pie y en `/info` (además, obligatorio para comercio en la UE).
- Equipo o fundador identificado con nombre y foto.
- Reseñas reales de clientes → `AggregateRating` **solo si son auténticas y verificables**. Marcar reseñas inventadas es una penalización manual, no un atajo.
- Presencia de entidad: LinkedIn y Wikidata (sin Google Business Profile — no hay tienda física). Hoy `sameAs` solo tiene Instagram.
- Nombre de marca y datos de contacto consistentes en todas las plataformas.

**Riesgo:** bajo · **Esfuerzo:** 1-2 sesiones
**Impacto:** Entidad 62→90 · **AI Visibility ≈ 84→88**

---

## M7 — Comercio por IA y agent-readiness
Hoy este eje está en **0/100**: compra solo por WhatsApp, sin checkout programático, sin feed.

- **Feed de producto para Google Merchant Center** — se genera gratis desde `data/catalog.json` de M3.1 y abre los listados gratuitos de Shopping en toda Europa. Mejor relación impacto/esfuerzo de este módulo.
- `shippingDetails` y `hasMerchantReturnPolicy` por país en cada `Offer`; `sku`, `priceValidUntil`. Sin esto no hay elegibilidad para fichas de producto enriquecidas.
- `agents.md` y `.well-known/agents.json` (hoy 404). *Peso 0 en el score — hazlo porque es barato, no porque puntúe.*
- **Checkout — resuelto: se queda en WhatsApp.** Agent-readiness se queda en ~40/100 en vez de 70: ningún agente de compra puede cerrar la venta por sí solo. Es un techo asumido a cambio de no tocar un canal que en joyería convierte bien. El feed de Merchant Center **sí funciona sin checkout propio** (los listados gratuitos llevan a la ficha), así que se gana lo principal.
- Queda anotado como **M9 (sin fecha)**: pago real con Stripe, si algún día el volumen lo justifica.

**Riesgo:** bajo (alcance reducido al feed y al schema) · **Esfuerzo:** 2 sesiones
**Impacto:** Agent-readiness 0→40 · Schema IA 67→90

---

## M8 — Rendimiento fino
**Deliberadamente al final.** Hoy el rendimiento ya está en 62 con TTFB de 249 ms y Brotli activo (20.389 B → 5.535 B). No es el cuello de botella; tocarlo antes sería optimizar lo que ya funciona.

- `cache-control` en assets estáticos (hoy solo `etag`: revalidación en cada visita).
- `width`/`height` en todas las imágenes — ninguna lo declara hoy → CLS.
- `fetchpriority="high"` en el hero; `loading="lazy"` por debajo del pliegue.
- Fuentes self-hosted (hoy Google Fonts bloquea el render desde origen externo).
- El `fetch` del Sheet fuera del camino crítico del LCP (hoy con timeout de 12 s). *M3.4 ya resuelve la mitad: el grid deja de depender de la red.*

**Riesgo:** bajo · **Esfuerzo:** 1 sesión
**Impacto:** Rendimiento 62→85 · **Search SEO ≈ 85→89**

---

## Trayectoria esperada

| Hito | Search SEO | AI Visibility |
|---|---|---|
| Hoy | 46 F | 40 F *(limitado)* |
| + M1 + M2 | 64 D | 44 F *(sigue limitado)* |
| + M3 | 78 C | 72 C |
| + M4 | 85 B | 74 C |
| + M5 + M6 | 87 B | 88 B |
| + M7 + M8 | 91 A | 90 A |

M1+M2 son 2 sesiones y suben 18 puntos de Search. Pero **el eje IA no se mueve hasta M3**: mientras las fichas respondan "Producto no encontrado" a los crawlers, el cap de severidad 5 sigue puesto. Por eso M3 no se puede posponer aunque sea el módulo más grande.

## Decisiones tomadas
| # | Decisión | Consecuencia en el plan |
|---|---|---|
| 1 | **Solo online**, sin tienda física | M2: `Organization` + `OnlineStore`, fuera el `geo` falso de Madrid. M6 sin local SEO ni GBP. |
| 2 | **`x-default` → EN** | M4: `/en/` es la entrada por defecto de Europa; `/es/` para España y LatAm. |
| 3 | **Checkout en WhatsApp** | M7 se limita a feed + schema. Agent-readiness con techo en ~40. Stripe queda como M9 sin fecha. |
| 4 | **Cron 6 h + botón manual** | M3.6: Action con cron y `workflow_dispatch`, commit solo si hay diff. |

## Siguiente paso
**M0 — Red de seguridad.** Nada de SEO hasta que haya medición y un `verify.sh` que demuestre que no rompimos nada.

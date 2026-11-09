# Estatus y Mejoras — NAMNA Fine Jewelry

_Última revisión: 22‑oct‑2026_

## 1. Estado por fase (según el blueprint)

| Fase | Descripción | Estado |
|---|---|---|
| **1** | Catálogo inteligente + sincronización Sheets/Drive | ✅ Completada (fase 1.5: galería de fotos hijas) |
| **2** | Clientes y precios diferenciados (`Precio_Mayorista`) | ⏳ Pendiente |
| **3** | Control de stock e inventario (`Stock`) | 🟡 Columna leída, sin lógica en la web |
| **4** | Checkout automatizado + descuento de inventario | ⏳ Pendiente (hoy el pedido es por WhatsApp) |

## 2. Funcionalidades en producción
- ✅ Catálogo dinámico con caché doble (servidor 6 h + navegador 6 h) y respaldo directo a Sheets
- ✅ Página de producto individual (`producto.html?id=`) y galería
- ✅ Bilingüe ES/EN con sugeridor de idioma
- ✅ Buscador a pantalla completa y favoritos (wishlist) con pedido por WhatsApp
- ✅ Menú móvil, modal de producto optimizado para móvil
- ✅ SEO: metas geo (España/Europa), JSON‑LD de productos y FAQ, sitemap, `llms.txt`
- ✅ Panel `admin.html` (test API, refrescar caché, limpiar caché local) y `generador-seo.html`
- ✅ Escudo anti‑clonación (`shield.js`)
- ⚪ Analítica preparada pero **desactivada** (`GOOGLE_ANALYTICS_ID` y `META_PIXEL_ID` vacíos)

## 3. Mejoras recomendadas

### 🔴 Prioridad alta (seguridad / riesgos)
1. **Contraseña del admin expuesta**: `admin.html` tiene la clave en texto plano dentro del JS (cualquiera la ve con "ver código"). → Moverla a validación en Apps Script o proteger la ruta desde el hosting (auth básica).
2. **Endpoint `?action=invalidate` público**: cualquiera puede vaciar la caché y forzar cargas lentas. → Exigir un token secreto (guardado en `PropertiesService`).
3. **Configuración duplicada**: `APPS_SCRIPT_URL` y `SHEET_ID` repetidos en `app.js`, `producto.js` y `admin.html`. → Centralizar en un `js/config.js`.
4. **Respaldo directo a Sheets** obliga a que la hoja sea pública. → Valorar quitarlo o publicar solo una pestaña limitada.

### 🟡 Prioridad media (rendimiento / mantenimiento)
5. Código duplicado entre `app.js` y `producto.js` (carga, caché, i18n, `formatPrice`…). → Extraer módulo común.
6. Limpiar archivos sobrantes: `Untitled.html` (tiene dos `<title>`), `gemini-code-*.md` → renombrar a `BLUEPRINT.md`.
7. `sitemap.xml` tiene 6 URLs: generar URLs por producto (`producto.html?id=`) o páginas estáticas por producto para SEO real.
8. Mostrar **"Agotado"** cuando `Stock = 0` (adelanto de Fase 3).
9. Imágenes: servir siempre `.webp` con `<picture>` y `loading="lazy"`; eliminar los `.png` duplicados si no se usan.
10. Minificar CSS/JS para producción (`styles.css` tiene ~2.200 líneas).

### 🟢 Prioridad baja (crecimiento)
11. Activar Google Analytics 4 y Meta Pixel + banner de consentimiento de cookies (RGPD).
12. Eventos de conversión: clic en WhatsApp, añadir a favoritos, búsqueda.
13. Fase 2: login ligero o código VIP para mostrar `Precio_Mayorista`.
14. Fase 4: pasarela de pago (Stripe/Redsys) con descuento de stock en la Hoja.
15. PWA (manifest + service worker) para uso offline e "instalar app".

## 4. Próximos pasos sugeridos
- [ ] Corregir puntos 1 y 2 (seguridad)
- [ ] Crear `js/config.js` (punto 3)
- [ ] Mostrar "Agotado" según stock (punto 8)
- [ ] Activar analítica + cookies (punto 11)

# Panel de gestión

Vive en `panel.html` y gestiona el catálogo y los textos de la web sobre Supabase.
Se entra por el **diamante 💎 del pie de la portada** (doble clic) o en `https://www.namnafine.com/panel.html`.

> **Nada se borra.** Eliminar un producto o una foto solo los marca como archivados: la fila y el
> archivo siguen ahí y se recuperan desde el filtro «Archivados».

---

## ⚠️ Falta un paso: crear tu usuario

**Supabase → Authentication → Users → Add user**, con tu email y una contraseña nueva.
Marca *Auto Confirm User* para no tener que validar el correo.

https://supabase.com/dashboard/project/mublwuvrpyztgblxqrmn/auth/users

Sin eso, el panel dirá *«Email o contraseña incorrectos»* por mucho que la escribas bien.

---

## Qué hace

| Acción | Dónde escribe |
|---|---|
| Interruptor verde | `productos.visible` |
| Editar nombre, precio, stock, categoría, descripción ES/EN | Fila de `productos` |
| Nuevo producto | Fila nueva en `productos` |
| Eliminar producto | `productos.archivado = true` (recuperable) |
| Subir foto | Storage + fila en `imagenes` |
| Reordenar fotos | Arrastrando; reescribe `imagenes.orden` |
| Quitar foto | `imagenes.archivada = true` (el archivo se conserva) |
| Editar textos | Tabla `textos`, columnas `es` y `en` |
| Ver dónde va cada texto | Columnas `pagina`, `seccion`, `papel`, `nota` (las rellena `scripts/mapear-textos.mjs`) |
| Cambiar imágenes de diseño | Storage + tabla `imagenes_sitio` |
| Exportar CSV | Descarga, no escribe nada |

### Las fotos se optimizan solas

Al subir, el navegador las reduce a 1400 px y las convierte a WebP **antes** de enviarlas.
Comprobado: un PNG de 82 KB sale a 10 KB; los originales de 5-6 MB quedan en torno a 80 KB.
No hace falta que prepares nada: arrastra la foto tal cual salga de la cámara.

La primera foto es la principal, la de la tarjeta. Para cambiarla, arrastra otra al primer puesto.

### Los textos dicen dónde van

La pestaña de textos no enseña una lista de `TXT-001`, `TXT-002`… sin más. Cada uno viene con:

- **En qué página sale** — y están agrupados por eso.
- **En qué zona** — Cabecera, Hero, Pie de página, la sección concreta…
- **Qué es** — Titular principal, Botón, Enlace del menú, Párrafo…
- **Un aviso si se repite**, por ejemplo «Se repite en 3 páginas. Sale 6 veces (menú de escritorio y de móvil)». Eso importa: cambiarlo lo cambia en todos los sitios a la vez.

El orden no es el del ID, es **el del recorrido real de la web**: primero la portada de arriba abajo,
luego el resto. Y el buscador entiende «pie de página» o «botón», no solo el ID.

Esa información no está escrita a mano: `scripts/mapear-textos.mjs` lee los `data-txt` de los HTML y
la deduce. Si mueves un texto de sitio en el código, vuelve a ejecutarlo y se actualiza sola.
Los textos que ya no aparecen en ninguna página se marcan como **«Sin usar»**.

### Imágenes de diseño

Pestaña aparte, para las fotos que no son de producto. Hay 4 huecos:

| Hueco | Dónde sale | Tamaño recomendado |
|---|---|---|
| Encabezado de la portada | Detrás de «Timeless Elegance» | 1600×1600, cuadrada |
| Encabezado de Información | Al abrir la página de información | 1600×1200, apaisada |
| Tarjeta «Quiénes somos» | Junto a la historia de la marca | 1600×1200, apaisada |
| Tarjeta «Envíos» | Junto a las políticas de envío | 1024×1536, vertical |

Se convierten a WebP igual que las de producto. Cada cambio guarda un nombre de archivo nuevo: si
reusara el mismo, el navegador y el CDN seguirían sirviendo la anterior durante un año.

Si alguna fallara, la web cae a la copia local de `assets/`, así que nunca se queda en blanco.
Los huecos los define el atributo `data-site-img` del HTML: si añades uno, hay que añadirlo también
a `scripts/subir-imagenes-sitio.mjs` y a la constante `HUECOS` de `panel.html`.

### Sobre el ID

El `ID_Producto` es lo que aparece en la URL de la ficha (`producto.html?id=`), así que **no se puede
cambiar desde el panel**. Para renombrarlo hay que hacerlo en la base.

### Publicar ya no existe

Los cambios se guardan en Postgres al instante y la web los lee en la siguiente carga.
Lo único que puede retrasarlos es la caché de tu propio navegador, que dura 10 minutos; el botón
«Limpiar mi caché local» la vacía.

---

## Seguridad

| | |
|---|---|
| Autenticación | Supabase Auth (email + contraseña). La contraseña nunca pasa por nuestro código |
| Sesión | Token JWT en `sessionStorage`, renovado solo antes de caducar |
| Permisos | RLS en Postgres: la clave pública del navegador solo **lee** lo visible |

Verificado contra la base real el 09‑nov‑2026, con la clave pública que va en el JavaScript del sitio:

- ✅ `UPDATE` anónimo no cambia nada
- ✅ `DELETE` anónimo no borra
- ✅ `INSERT` anónimo rechazado (401)
- ✅ No puede tocar los textos
- ✅ Storage rechaza subidas anónimas (400)
- ✅ Los productos ocultos y archivados son invisibles para el público

Sigue sin cubrir: `panel.html` es un archivo estático, así que cualquiera puede **ver** la pantalla
de login (no entrar). Está marcada `noindex` y bloqueada en `robots.txt`. Si quieres que ni se vea,
hace falta auth básica en el hosting.

---

## Si algo falla

| Mensaje | Qué pasa |
|---|---|
| «Email o contraseña incorrectos» | O están mal, o **el usuario no existe todavía** (ver arriba) |
| «El usuario existe pero no está confirmado» | Supabase → Users → confirmarlo a mano |
| «La sesión ha caducado» | Vuelve a entrar; normalmente se renueva sola |
| El cambio no se ve en la web | «Limpiar mi caché local» y recarga con Ctrl/Cmd + Shift + R |
| «Falta configurar Supabase en js/config.js» | `SUPABASE_URL` o la clave están vacías |

---

## Lo anterior

`admin.html` sigue ahí con la documentación de las hojas y la prueba de API, pero **escribe en Google
Sheets, que ya no alimenta la web**. No lo uses para editar.

El panel que hablaba con Apps Script está guardado en `_archivo/panel-v1-appsscript.html` por si
hiciera falta mirarlo. Con él desaparecieron `configurarAdmin()` y el sistema de tokens hecho a mano.

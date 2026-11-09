# Panel de gestión — puesta en marcha

El panel vive en `panel.html` y gestiona el catálogo y los textos de la web sin tocar la Hoja de Google a mano.
Se entra por el **diamante 💎 del pie de la portada** (doble clic) o directamente en `https://tu-dominio/panel.html`.

> **Nada se borra nunca.** Eliminar un producto lo mueve a la pestaña `ARCHIVO_PRODUCTOS` de la hoja;
> quitar una foto la mueve a la subcarpeta `ARCHIVO` de Drive. Todo se puede devolver a mano.

---

## ⚠️ Faltan 3 pasos para que funcione

El código ya está escrito y probado, pero **el Apps Script publicado todavía es la versión antigua** (solo tiene `doGet`).
Hasta que hagas esto, el panel mostrará *"Respuesta inesperada del servidor"*.

### Paso 1 — Subir el código nuevo

1. Abre tu proyecto en [script.google.com](https://script.google.com).
2. Copia **todo** el contenido de `servidor_google_apps_script.js` y pégalo encima del código actual.
3. Guarda (💾).

### Paso 2 — Poner la contraseña

En el editor de Apps Script, pega esto arriba del todo, **cambiando la contraseña**:

```javascript
function unaVez() {
  configurarAdmin("LaQueTuQuieras2026");
}
```

Selecciona `unaVez` en el desplegable de funciones → **Ejecutar**. Acepta los permisos que pida.
Debe aparecer en el registro: `✅ Contraseña de administración configurada`.

Después **borra esas 4 líneas** para no dejar la contraseña escrita en el editor. La contraseña queda guardada
como hash SHA-256 con sal en `PropertiesService`: ni se almacena en claro ni viaja nunca al navegador.

> Mínimo 8 caracteres. Para cambiarla más adelante, repite este paso con la nueva.

### Paso 3 — Volver a publicar la app web

**Implementar → Gestionar implementaciones → ✏️ editar → Versión: Nueva versión → Implementar.**

Es imprescindible: Apps Script sirve la versión *publicada*, no la que tienes guardada en el editor.
La URL no cambia, así que no hay que tocar nada en la web.

**Comprobación:** entra en `panel.html`, mete la contraseña y deberías ver tus 18 productos.

---

## Qué hace el panel

| Acción | Dónde escribe |
|---|---|
| Interruptor verde publicar/retirar | Columna `Visible` de la hoja (`SI`/`NO`) |
| Editar nombre, precio, stock, categoría, descripción ES/EN | Fila del producto en la hoja |
| Nuevo producto | Fila nueva al final de la hoja |
| Eliminar producto | Mueve la fila a la pestaña `ARCHIVO_PRODUCTOS` |
| Subir foto | Carpeta de Drive, nombrada según la convención |
| Quitar foto | Mueve el archivo a la subcarpeta `ARCHIVO` de Drive |
| Editar textos de la web | Pestaña `TEXTOS`, columnas `Texto_ES` y `Texto_EN` |
| Publicar cambios | Vacía la caché del servidor y la del navegador |

### Sobre el ID y las fotos

El `ID_Producto` es lo que enlaza la fila con sus fotos en Drive, así que **no se puede cambiar desde el panel**.
Si necesitas renombrarlo, hazlo en la hoja y renombra también las fotos.

Convención de nombres, que el panel respeta solo:

```
N. Ruby D.jpg      → foto principal (la de la tarjeta)
N. Ruby D-1.jpg    → galería
N. Ruby D-2.jpg    → galería
```

Al subir fotos desde el panel, la primera se guarda sin sufijo y las siguientes se numeran solas.

### Sobre la caché

Hay dos cachés de 6 horas encadenadas (servidor y navegador). Cada operación del panel vacía la del servidor
automáticamente, pero **el navegador de un visitante que ya estuvo en la web puede seguir viendo lo viejo
hasta 6 h**. El botón «Publicar cambios» fuerza las dos.

---

## Seguridad

Lo que cambió respecto al panel anterior:

| Antes | Ahora |
|---|---|
| Contraseña en texto plano dentro de `index.html` — visible con "ver código fuente" | Hash SHA-256 con sal en `PropertiesService`, validado en el servidor |
| `?action=invalidate` abierto a cualquiera | Exige token de sesión válido en cuanto configuras la contraseña |
| Sin sesión: la clave se pedía en cada visita | Token de sesión de 2 h en `sessionStorage`, renovable |

Freno contra fuerza bruta: 400 ms de espera por intento.

**Lo que sigue sin cubrir:** `panel.html` es un archivo estático, así que cualquiera puede *abrir la página*
de login (no entrar). Si quieres que ni se vea, añade autenticación básica en el hosting para esa ruta.
Está bloqueada en `robots.txt` y marcada `noindex`.

> **Importante:** la contraseña antigua `Junio2026` estuvo publicada en el código fuente de la portada.
> Dala por comprometida y usa una distinta en el paso 2.

---

## Si algo falla

| Mensaje | Qué pasa |
|---|---|
| «Respuesta inesperada del servidor» | Falta el paso 3: volver a publicar la app web |
| «Falta ejecutar configurarAdmin» | Falta el paso 2 |
| «Contraseña incorrecta» | Esa no es. Repite el paso 2 para ponerle otra |
| «Sesión caducada» | Han pasado 2 h. Vuelve a entrar |
| El cambio no se ve en la web | «Publicar cambios» y recarga con Ctrl/Cmd + Shift + R |
| Una foto no aparece | Puede tardar unos minutos en propagarse por el CDN de Drive |

El panel antiguo, con la documentación de las hojas y la prueba de API, sigue intacto en `admin.html`.

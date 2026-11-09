# Blueprint: Sistema de Catálogo Autónomo e Inteligente
## Arquitectura Modular basada en Google Workspace

Este documento define la estructura de ingeniería, el plan de desarrollo por fases y el modelo de control de daños para la construcción de una plataforma web de catálogo automatizado. El sistema utiliza **Google Sheets** como única base de datos/panel de control y **Google Drive** como repositorio de activos, priorizando la velocidad móvil, la seguridad y la facilidad de uso absoluta para el operador.

---

## 🎯 Principios Rectores del Proyecto

1. **Velocidad Móvil Extrema:** Carga inicial en milisegundos mediante técnicas de desacoplamiento de datos (Caché), paginación y optimización dinámica de imágenes.
2. **Seguridad Absoluta:** Ninguna credencial privada de Google ni lógica sensible de precios se expone en el navegador del cliente. Todo se procesa en el servidor (Backend Intermedio).
3. **Facilidad de Uso Cero-Curva:** El cliente no utiliza un panel de administración en HTML. El control total del negocio (productos, precios, stock) se realiza directamente editando celdas en la hoja maestra de Google.
4. **Arquitectura de Bloques (Estilo Lego):** Código desacoplado basado en contratos de datos que permite la integración de fases futuras sin reescribir lo ya construido.

---

## 🏗️ Mapa de Ruta y Escalabilidad (Fases del Proyecto)

El proyecto se concibe como un sistema modular que crece a demanda del negocio:

* **FASE 1: Catálogo Inteligente & Sincronización Básica (Fase Actual)**
    * Lectura automatizada de Google Sheets con sistema de caché segura.
    * Mapeo dinámico de imágenes desde Google Drive basadas en el ID del producto.
    * Frontend rápido y responsivo con filtros dinámicos por categorías.
* **FASE 2: Gestión de Clientes & Precios Diferenciados (Siguiente Conexión)**
    * Módulo de inicio de sesión (Auth) para clientes mayoristas o inscritos.
    * Filtro en el servidor para conmutar entre `Precio_Publico` y `Precio_Mayorista`.
* **FASE 3: Control de Stock e Inventario**
    * Lectura de la columna `Stock` para inhabilitar botones de compra o mostrar etiquetas de "Agotado".
* **FASE 4: Checkout Automatizado & Descuento de Inventario**
    * Pasarela de pedidos (ej. WhatsApp o carrito) con un webhook que entra a la hoja de Google y resta automáticamente las unidades vendidas de la columna correspondiente.

---

## 📊 Estructura de la Base de Datos (Google Sheets)

La Fila 1 de la hoja de cálculo estará estrictamente **protegida y bloqueada** a nivel de permisos de Google Workspace. El cliente solo gestionará datos a partir de la Fila 2.

| Columna | Campo Técnico | Tipo de Dato | Validación de Celda | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `ID_Producto` | Alfanumérico | Único, obligatorio | Llave maestra. Debe coincidir con el nombre de la foto en Drive (Ej: `PROD-001`). |
| **B** | `Nombre` | Texto | Obligatorio | Nombre comercial en la web. |
| **C** | `Descripción` | Texto Largo | Libre | Detalles del producto en el modal. |
| **D** | `Categoría` | Texto | Lista o Libre | El frontend agrupa estos valores y crea los botones de filtro solos. |
| **E** | `Precio_Publico` | Número | Entero Positivo | Precio visible para visitantes anónimos. |
| **F** | `Visible` | Opción | Menú (Sí / No) | Control de daños: Si es "No", la web lo ignora. |
| **G** | `Precio_Mayorista`| Número | *Reserva Fase 2* | Precio para usuarios VIP/Inscritos. |
| **H** | `Stock` | Número | *Reserva Fase 3* | Inventario disponible. |

---

## 📂 Repositorio de Imágenes (Google Drive)

* **Carpeta Raíz:** `Fotos_Productos` (Permiso de lectura: "Cualquiera con el enlace").
* **Logística del Cliente:** Sube la foto en formato estándar (`.jpg` o `.png`) nombrada exactamente igual al código de la hoja (Ej: `PROD-102.jpg`).
* **Lógica del Código:** El backend intercepta el ID del producto y concatena los parámetros nativos de compresión de Google (`&sz=w400`) para servir una versión optimizada en peso de forma transparente.

---

## 🛠️ Arquitectura de Software y Componentes de Código

Para mantener las piezas independientes, el proyecto se divide en las siguientes capas de abstracción:

### 1. El Núcleo de Datos (Core Entities)
Define el contrato del objeto `Producto` antes de que toque cualquier base de datos o interfaz.
```text
Producto {
  id: String,
  nombre: String,
  descripcion: String,
  precioPublico: Number,
  precioMayorista: Number (Inactivo en Fase 1),
  stock: Number (Inactivo en Fase 1),
  urlImagen: String
}
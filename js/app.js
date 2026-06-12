/**
 * ================================================================
 * NAMNA JEWERLYWEE — Catalog Application (Motor Híbrido CONECTADO)
 * 
 * CONEXIÓN DIRECTA a Google Sheets:
 * Hoja: MASTRA JOYERIA NAMNA
 * ID: 1Xb29JGt7XgwT_YJ08zusT6kvZs4w5lCn7H1lDlCzxbc
 * 
 * ARQUITECTURA BLINDADA:
 * 1. Lee la hoja en vivo via Google Visualization API
 * 2. Filtra solo productos con Visible = "Sí"
 * 3. Si falla → Caché local (5 min) → Datos demo
 * 4. Imágenes: Google Drive → Fallback demo local
 * 5. NUNCA se rompe la experiencia visual
 * ================================================================
 */

// ── CONFIGURACIÓN CONECTADA ────────────────────────────────────
const CONFIG = {
  // Conexión directa a tu Google Sheet (ya conectada)
  SHEET_ID: '1Xb29JGt7XgwT_YJ08zusT6kvZs4w5lCn7H1lDlCzxbc',

  // URL de Apps Script (opcional, para cuando instales el servidor)
  // Si está vacía, usa la conexión directa al Sheet
  APPS_SCRIPT_URL: '',

  // WhatsApp (cambia por tu número real con código de país)
  WHATSAPP_NUMBER: '521234567890',

  // Moneda y formato
  CURRENCY: 'COP',
  LOCALE: 'es-CO',

  // Caché en RAM del navegador
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutos
};

// ── DATOS DEMO (Red de seguridad visual — NUNCA se eliminan) ──
const DEMO_PRODUCTS = [
  {
    id: 'NM-001',
    nombre: 'Anillo Esmeralda Minimal',
    descripcion: 'Anillo delicado en oro de 14k con una esmeralda natural engastada en bisel. Diseño minimalista perfecto para uso diario. Cada piedra es seleccionada a mano por su color y claridad únicos.',
    categoria: 'Anillos',
    precioPublico: 1850,
    visible: true,
    badge: 'Nuevo',
    urlImagen: 'assets/product_ring.png'
  },
  {
    id: 'NM-002',
    nombre: 'Collar Gota de Oro',
    descripcion: 'Cadena fina en oro de 18k con pendiente en forma de gota pulida. La simplicidad de su diseño lo convierte en la pieza perfecta para combinar con cualquier atuendo. Cierre de resorte seguro.',
    categoria: 'Collares',
    precioPublico: 2450,
    visible: true,
    badge: null,
    urlImagen: 'assets/product_necklace.png'
  },
  {
    id: 'NM-003',
    nombre: 'Aretes Aro Perla',
    descripcion: 'Aretes tipo aro en oro con perlas de agua dulce. Cada perla es única en su forma y lustre, creando una pieza verdaderamente irrepetible. Cierre de clip cómodo y seguro.',
    categoria: 'Aretes',
    precioPublico: 1290,
    visible: true,
    badge: 'Bestseller',
    urlImagen: 'assets/product_earrings.png'
  },
  {
    id: 'NM-004',
    nombre: 'Brazalete Geometría',
    descripcion: 'Brazalete abierto en oro con detalles geométricos grabados a mano. Su diseño ajustable se adapta a cualquier muñeca. Acabado satinado que combina elegancia moderna con tradición artesanal.',
    categoria: 'Pulseras',
    precioPublico: 1680,
    visible: true,
    badge: 'Nuevo',
    urlImagen: 'assets/product_bracelet.png'
  },
  {
    id: 'NM-005',
    nombre: 'Colgante Turmalina Verde',
    descripcion: 'Pendiente con turmalina verde natural en bruto, engastada en oro de 14k con garras artesanales. La piedra conserva su forma orgánica, celebrando la belleza imperfecta de la naturaleza.',
    categoria: 'Collares',
    precioPublico: 3200,
    visible: true,
    badge: 'Edición Limitada',
    urlImagen: 'assets/product_pendant.png'
  },
  {
    id: 'NM-006',
    nombre: 'Anillo Banda Clásico',
    descripcion: 'Anillo de banda en oro pulido con un acabado espejo impecable. Perfecto para apilar con otras piezas o usar solo como un statement minimalista. Disponible en varias tallas.',
    categoria: 'Anillos',
    precioPublico: 1450,
    visible: true,
    badge: null,
    urlImagen: 'assets/product_ring.png'
  },
  {
    id: 'NM-007',
    nombre: 'Aretes Cascada Dorada',
    descripcion: 'Aretes largos con cadenas finas en cascada que capturan la luz con cada movimiento. Diseño elegante para ocasiones especiales. Cierre de mariposa en oro.',
    categoria: 'Aretes',
    precioPublico: 1950,
    visible: true,
    badge: null,
    urlImagen: 'assets/product_earrings.png'
  },
  {
    id: 'NM-008',
    nombre: 'Pulsera Cadena Delicada',
    descripcion: 'Pulsera de cadena fina en oro de 14k con pequeño charm de corazón. La cadena tiene un brillo sutil que aporta un toque de elegancia discreta a tu día a día.',
    categoria: 'Pulseras',
    precioPublico: 980,
    visible: true,
    badge: 'Nuevo',
    urlImagen: 'assets/product_bracelet.png'
  }
];

// ── Mapeo de categorías a imágenes demo (fallback de imagen) ──
const CATEGORY_IMAGE_FALLBACK = {
  'Anillos':    'assets/product_ring.png',
  'Collares':   'assets/product_necklace.png',
  'Aretes':     'assets/product_earrings.png',
  'Pulseras':   'assets/product_bracelet.png',
  'Accesorios': 'assets/product_pendant.png',
  'Calzado':    'assets/product_bracelet.png',
  'Ropa':       'assets/product_necklace.png',
  'General':    'assets/product_pendant.png',
  '_default':   'assets/product_pendant.png'
};

// ── Application State ──
const state = {
  products: [],
  filteredProducts: [],
  activeCategory: 'all',
  modalOpen: false,
  dataSource: 'demo', // 'sheets' | 'apps-script' | 'cache' | 'demo'
  lastFetch: null,
  sheetProducts: 0,
  totalInSheet: 0
};

// ── DOM References ──
const dom = {
  header: document.getElementById('main-header'),
  categoriesContainer: document.getElementById('categories-container'),
  productsGrid: document.getElementById('products-grid'),
  loader: document.getElementById('catalog-loader'),
  productCount: document.getElementById('product-count'),
  modal: document.getElementById('product-modal'),
  modalBody: document.getElementById('modal-body'),
  closeModalBtn: document.getElementById('close-modal-btn')
};

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  loadProducts();
  initModal();
  initSmoothScroll();
});

// ── Header Behavior ──
function initHeader() {
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 50) {
      dom.header.classList.add('scrolled');
    } else {
      dom.header.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════
// MOTOR HÍBRIDO CONECTADO
// Prioridad: Apps Script → Google Sheets Directo → Caché → Demo
// ═══════════════════════════════════════════════════════════════
async function loadProducts() {
  // ── RUTA 1: ¿Hay Apps Script configurado? (servidor seguro)
  if (CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_URL.trim() !== '') {
    try {
      console.log('🔐 NAMNA: Conectando via Apps Script (servidor seguro)...');
      const apiProducts = await fetchFromAppsScript();
      if (apiProducts && apiProducts.length > 0) {
        state.products = apiProducts;
        state.dataSource = 'apps-script';
        state.sheetProducts = apiProducts.length;
        saveToCache(apiProducts);
        console.log(`✅ NAMNA: ${apiProducts.length} productos via Apps Script`);
        finishLoading();
        return;
      }
    } catch (err) {
      console.warn('⚠️ Apps Script falló:', err.message);
    }
  }

  // ── RUTA 2: Conexión directa a Google Sheets (Visualization API)
  if (CONFIG.SHEET_ID && CONFIG.SHEET_ID.trim() !== '') {
    try {
      console.log('📊 NAMNA: Conectando directo a Google Sheets...');
      const sheetProducts = await fetchFromGoogleSheets();
      if (sheetProducts && sheetProducts.length > 0) {
        state.products = sheetProducts;
        state.dataSource = 'sheets';
        state.sheetProducts = sheetProducts.length;
        saveToCache(sheetProducts);
        console.log(`✅ NAMNA: ${sheetProducts.length} productos cargados desde Google Sheets EN VIVO`);
        finishLoading();
        return;
      }
    } catch (err) {
      console.warn('⚠️ Google Sheets directo falló:', err.message);
    }
  }

  // ── RUTA 3: ¿Hay caché válida?
  const cached = loadFromCache();
  if (cached) {
    state.products = cached;
    state.dataSource = 'cache';
    state.sheetProducts = cached.length;
    console.log(`📦 NAMNA: ${cached.length} productos desde caché`);
    finishLoading();
    return;
  }

  // ── RUTA 4: Datos demo (la web NUNCA se rompe)
  console.log('🎨 NAMNA: Usando catálogo demo');
  state.products = DEMO_PRODUCTS.filter(p => p.visible);
  state.dataSource = 'demo';
  await new Promise(r => setTimeout(r, 600));
  finishLoading();
}

// ═══════════════════════════════════════════════════════════════
// FETCH: Google Sheets Directo (Visualization API)
// Lee la hoja en vivo, parsea el JSON, filtra por visibilidad
// ═══════════════════════════════════════════════════════════════
async function fetchFromGoogleSheets() {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    let text = await response.text();

    // Extraer el JSON del wrapper de Google Visualization
    // Formato: google.visualization.Query.setResponse({...});
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error('Respuesta no contiene JSON válido');
    }
    const jsonStr = text.substring(jsonStart, jsonEnd + 1);
    const gvizData = JSON.parse(jsonStr);

    if (gvizData.status !== 'ok') {
      throw new Error(`Google Sheets status: ${gvizData.status}`);
    }

    // ── Parsear columnas ──
    const cols = gvizData.table.cols;
    const rows = gvizData.table.rows;

    // Encontrar índices de columnas por su etiqueta (tolera reordenamiento)
    const colIndex = {};
    cols.forEach((col, i) => {
      colIndex[col.label] = i;
    });

    // Validar columnas críticas
    if (colIndex['ID_Producto'] === undefined ||
        colIndex['Precio_Publico'] === undefined ||
        colIndex['Visible'] === undefined) {
      throw new Error('Faltan columnas críticas en la hoja: ID_Producto, Precio_Publico o Visible');
    }

    state.totalInSheet = rows.length;

    // ── Parsear filas ──
    const productos = [];

    for (const row of rows) {
      const cells = row.c;

      // Extraer valores con null-safety
      const getValue = (colName) => {
        const idx = colIndex[colName];
        if (idx === undefined || !cells[idx]) return null;
        return cells[idx].v;
      };

      const id = getValue('ID_Producto');
      if (!id) continue; // Saltarse filas sin ID

      const visible = String(getValue('Visible') || '').trim().toLowerCase();
      if (visible !== 'sí' && visible !== 'si') continue; // Solo visibles

      const nombre = getValue('Nombre') || 'Producto sin nombre';
      const descripcion = getValue('Descripción') || '';
      const categoria = getValue('Categoría') || 'General';
      const precio = Number(getValue('Precio_Publico')) || 0;
      const stock = Number(getValue('Stock')) || null;

      // Imagen: fallback a imagen demo por categoría
      const urlImagen = CATEGORY_IMAGE_FALLBACK[categoria] || CATEGORY_IMAGE_FALLBACK._default;

      productos.push({
        id: String(id).trim(),
        nombre: String(nombre).trim(),
        descripcion: String(descripcion).trim(),
        categoria: String(categoria).trim(),
        precioPublico: precio,
        visible: true,
        badge: null,
        urlImagen: urlImagen,
        stock: stock
      });
    }

    return productos;

  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// FETCH: Apps Script (servidor seguro, Fase futura)
// ═══════════════════════════════════════════════════════════════
async function fetchFromAppsScript() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.message);
    if (!Array.isArray(data) || data.length === 0) throw new Error('Datos vacíos');

    return data.map(item => ({
      id: item.id || `PROD-${Date.now()}`,
      nombre: item.nombre || 'Producto sin nombre',
      descripcion: item.descripcion || '',
      categoria: item.categoria || 'General',
      precioPublico: Number(item.precio) || 0,
      visible: true,
      badge: null,
      urlImagen: (item.imagen && !item.imagen.includes('PLACEHOLDER') && item.imagen.startsWith('http'))
        ? item.imagen
        : (CATEGORY_IMAGE_FALLBACK[item.categoria] || CATEGORY_IMAGE_FALLBACK._default)
    }));

  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Caché (sessionStorage) ──
function saveToCache(products) {
  try {
    sessionStorage.setItem('namna_cache', JSON.stringify({
      data: products,
      timestamp: Date.now()
    }));
  } catch (e) { /* sessionStorage no disponible */ }
}

function loadFromCache() {
  try {
    const raw = sessionStorage.getItem('namna_cache');
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp < CONFIG.CACHE_DURATION_MS && cached.data?.length > 0) {
      return cached.data;
    }
    sessionStorage.removeItem('namna_cache');
    return null;
  } catch (e) { return null; }
}

// ── Finalizar Carga ──
function finishLoading() {
  state.filteredProducts = [...state.products];
  buildCategoryFilters();
  renderProducts();
  hideLoader();
  showDataSourceBadge();
}

// ── Badge de Fuente de Datos ──
function showDataSourceBadge() {
  const existing = document.getElementById('data-source-badge');
  if (existing) existing.remove();

  const labels = {
    'sheets':       { text: `● Google Sheets EN VIVO — ${state.sheetProducts} productos`, color: '#25D366' },
    'apps-script':  { text: `● Apps Script conectado — ${state.sheetProducts} productos`, color: '#25D366' },
    'cache':        { text: `● Datos en caché (${state.sheetProducts} productos)`, color: '#E78A5E' },
    'demo':         { text: '● Catálogo demo', color: '#6B7A76' }
  };

  const info = labels[state.dataSource];
  const badge = document.createElement('div');
  badge.id = 'data-source-badge';
  badge.setAttribute('role', 'status');
  badge.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 16px;
    z-index: 400;
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: ${info.color};
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    padding: 0.5rem 0.85rem;
    border-radius: 6px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.1);
    border: 1px solid rgba(0,0,0,0.06);
    opacity: 0;
    transform: translateY(8px);
    animation: badgeIn 0.4s ease-out 0.5s forwards;
    pointer-events: none;
  `;
  badge.textContent = info.text;

  // Inyectar animación si no existe
  if (!document.getElementById('badge-anim-style')) {
    const style = document.createElement('style');
    style.id = 'badge-anim-style';
    style.textContent = `
      @keyframes badgeIn { to { opacity: 1; transform: translateY(0); } }
      @keyframes badgeOut { to { opacity: 0; transform: translateY(8px); } }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(badge);

  // Auto-hide después de 5 segundos
  setTimeout(() => {
    badge.style.animation = 'badgeOut 0.3s ease-in forwards';
    setTimeout(() => badge.remove(), 300);
  }, 5000);
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA VISUAL (100% intacto — animaciones, filtros, modal)
// ═══════════════════════════════════════════════════════════════

// ── Build Category Filters ──
function buildCategoryFilters() {
  const allBtn = dom.categoriesContainer.querySelector('[data-category="all"]');
  dom.categoriesContainer.innerHTML = '';
  dom.categoriesContainer.appendChild(allBtn);

  const categories = [...new Set(state.products.map(p => p.categoria))];

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.category = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => filterByCategory(cat));
    dom.categoriesContainer.appendChild(btn);
  });

  allBtn.addEventListener('click', () => filterByCategory('all'));

  dom.categoriesContainer.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === state.activeCategory);
  });
}

// ── Filter Products ──
function filterByCategory(category) {
  state.activeCategory = category;

  dom.categoriesContainer.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  if (category === 'all') {
    state.filteredProducts = [...state.products];
  } else {
    state.filteredProducts = state.products.filter(p => p.categoria === category);
  }

  renderProducts();
}

// ── Render Products ──
function renderProducts() {
  const grid = dom.productsGrid;
  grid.innerHTML = '';

  dom.productCount.textContent = `${state.filteredProducts.length} pieza${state.filteredProducts.length !== 1 ? 's' : ''}`;

  if (state.filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✦</div>
        <h3>No hay piezas en esta categoría</h3>
        <p>Prueba con otra categoría o explora toda la colección.</p>
      </div>
    `;
    return;
  }

  state.filteredProducts.forEach((product, index) => {
    const card = createProductCard(product, index);
    grid.appendChild(card);
  });

  observeCards();
}

// ── Create Product Card ──
function createProductCard(product, index) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.productId = product.id;
  card.style.transitionDelay = `${index * 0.08}s`;

  const badgeHTML = product.badge
    ? `<span class="product-badge">${product.badge}</span>`
    : '';

  const priceText = formatPrice(product.precioPublico);
  const fallbackImg = CATEGORY_IMAGE_FALLBACK[product.categoria] || CATEGORY_IMAGE_FALLBACK._default;

  // Stock indicator (si viene de la hoja)
  const stockHTML = (product.stock !== null && product.stock !== undefined && product.stock <= 5 && product.stock > 0)
    ? `<span class="product-badge" style="background: var(--color-primary);">Últimas ${product.stock}</span>`
    : '';

  card.innerHTML = `
    <div class="product-card-image">
      ${badgeHTML || stockHTML}
      <img
        src="${product.urlImagen}"
        alt="${product.nombre}"
        loading="lazy"
        onerror="this.src='${fallbackImg}'"
      />
      <button class="quick-view-btn" aria-label="Vista rápida de ${product.nombre}">
        Vista Rápida
      </button>
    </div>
    <div class="product-card-info">
      <p class="product-card-category">${product.categoria}</p>
      <h3 class="product-card-name">${product.nombre}</h3>
      <p class="product-card-price">${priceText}</p>
    </div>
  `;

  card.addEventListener('click', () => openModal(product));

  return card;
}

// ── Format Price ──
function formatPrice(amount) {
  if (!amount || amount <= 0) return 'Consultar precio';
  return `$${amount.toLocaleString(CONFIG.LOCALE)}`;
}

// ── Intersection Observer for Staggered Animation ──
function observeCards() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.product-card').forEach(card => {
    observer.observe(card);
  });
}

// ── Modal ──
function initModal() {
  dom.closeModalBtn.addEventListener('click', closeModal);

  dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.modalOpen) closeModal();
  });
}

function openModal(product) {
  state.modalOpen = true;

  const priceText = formatPrice(product.precioPublico);
  const fallbackImg = CATEGORY_IMAGE_FALLBACK[product.categoria] || CATEGORY_IMAGE_FALLBACK._default;

  // Stock info para el modal
  let stockInfo = '';
  if (product.stock !== null && product.stock !== undefined) {
    if (product.stock > 0 && product.stock <= 10) {
      stockInfo = `<p style="color: var(--color-accent); font-size: var(--text-sm); font-weight: 500; margin-bottom: var(--space-md);">⚡ Solo quedan ${product.stock} unidades</p>`;
    } else if (product.stock <= 0) {
      stockInfo = `<p style="color: var(--color-text-muted); font-size: var(--text-sm); font-weight: 500; margin-bottom: var(--space-md);">Agotado temporalmente</p>`;
    }
  }

  dom.modalBody.innerHTML = `
    <div class="modal-image-wrapper">
      <img
        src="${product.urlImagen}"
        alt="${product.nombre}"
        onerror="this.src='${fallbackImg}'"
      />
    </div>
    <div class="modal-details">
      <p class="modal-category">${product.categoria}</p>
      <h2 class="modal-title">${product.nombre}</h2>
      <p class="modal-price">${priceText} ${CONFIG.CURRENCY}</p>
      ${stockInfo}
      ${product.descripcion ? `<p class="modal-description">${product.descripcion}</p>` : ''}
      <button class="modal-cta" onclick="handleWhatsAppOrder('${product.id}', '${product.nombre}')">
        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" fill="currentColor"/></svg>
        Pedir por WhatsApp
      </button>
      <p style="text-align: center; margin-top: var(--space-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
        Código: ${product.id}
      </p>
    </div>
  `;

  dom.modal.classList.add('active');
  dom.modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModal() {
  state.modalOpen = false;
  dom.modal.classList.remove('active');
  dom.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

// ── WhatsApp Order ──
function handleWhatsAppOrder(productId, productName) {
  const message = encodeURIComponent(
    `¡Hola! Me interesa la pieza "${productName}" (Código: ${productId}). ¿Podrían darme más información?`
  );
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${message}`, '_blank');
}

window.handleWhatsAppOrder = handleWhatsAppOrder;

// ── Hide Loader ──
function hideLoader() {
  dom.loader.classList.add('hidden');
}

// ── Smooth Scroll for Anchor Links ──
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      e.preventDefault();
      const target = document.querySelector(targetId);
      if (target) {
        const headerOffset = 140;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

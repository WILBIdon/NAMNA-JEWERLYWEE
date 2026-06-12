/**
 * ================================================================
 * NAMNA JEWERLYWEE — Catalog Application (Motor Híbrido CONECTADO)
 * 
 * FASE 1.5: Sincronización Inteligente Total
 * Soporta galería de fotos hijas desde el servidor Apps Script.
 * ================================================================
 */

// ── CONFIGURACIÓN CONECTADA ────────────────────────────────────
const CONFIG = {
  // Pega aquí la URL de tu Google Apps Script implementado
  // Es OBLIGATORIO para cargar las múltiples fotos desde Drive
  APPS_SCRIPT_URL: '',

  // Conexión directa a tu Google Sheet (Respaldo si falla Apps Script)
  SHEET_ID: '1Xb29JGt7XgwT_YJ08zusT6kvZs4w5lCn7H1lDlCzxbc',

  WHATSAPP_NUMBER: '521234567890',
  CURRENCY: 'COP',
  LOCALE: 'es-CO',
  CACHE_DURATION_MS: 5 * 60 * 1000,
};

// ── DATOS DEMO (Respaldo visual) ──
const DEMO_PRODUCTS = [
  {
    id: 'NM-001',
    nombre: 'Anillo Esmeralda Minimal',
    descripcion: 'Anillo delicado en oro de 14k con una esmeralda natural engastada en bisel.',
    categoria: 'Anillos',
    precioPublico: 1850,
    visible: true,
    badge: 'Nuevo',
    imagenes: ['assets/product_ring.png']
  },
  {
    id: 'NM-002',
    nombre: 'Collar Gota de Oro',
    descripcion: 'Cadena fina en oro de 18k con pendiente en forma de gota pulida.',
    categoria: 'Collares',
    precioPublico: 2450,
    visible: true,
    badge: null,
    imagenes: ['assets/product_necklace.png']
  },
  {
    id: 'NM-003',
    nombre: 'Aretes Aro Perla',
    descripcion: 'Aretes tipo aro en oro con perlas de agua dulce.',
    categoria: 'Aretes',
    precioPublico: 1290,
    visible: true,
    badge: 'Bestseller',
    imagenes: ['assets/product_earrings.png']
  },
  {
    id: 'NM-004',
    nombre: 'Brazalete Geometría',
    descripcion: 'Brazalete abierto en oro con detalles geométricos grabados a mano.',
    categoria: 'Pulseras',
    precioPublico: 1680,
    visible: true,
    badge: 'Nuevo',
    imagenes: ['assets/product_bracelet.png']
  }
];

// ── Mapeo de categorías a imágenes demo (fallback) ──
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
  dataSource: 'demo',
  sheetProducts: 0
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

function initHeader() {
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 50) {
      dom.header.classList.add('scrolled');
    } else {
      dom.header.classList.remove('scrolled');
    }
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════
// MOTOR HÍBRIDO CONECTADO
// ═══════════════════════════════════════════════════════════════
async function loadProducts() {
  if (CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_URL.trim() !== '') {
    try {
      console.log('🔐 NAMNA: Conectando via Apps Script (fotos múltiples)...');
      const apiProducts = await fetchFromAppsScript();
      if (apiProducts && apiProducts.length > 0) {
        state.products = apiProducts;
        state.dataSource = 'apps-script';
        state.sheetProducts = apiProducts.length;
        saveToCache(apiProducts);
        finishLoading();
        return;
      }
    } catch (err) {
      console.warn('⚠️ Apps Script falló:', err.message);
    }
  }

  if (CONFIG.SHEET_ID && CONFIG.SHEET_ID.trim() !== '') {
    try {
      console.log('📊 NAMNA: Conectando directo a Google Sheets...');
      const sheetProducts = await fetchFromGoogleSheets();
      if (sheetProducts && sheetProducts.length > 0) {
        state.products = sheetProducts;
        state.dataSource = 'sheets';
        state.sheetProducts = sheetProducts.length;
        saveToCache(sheetProducts);
        finishLoading();
        return;
      }
    } catch (err) {
      console.warn('⚠️ Google Sheets directo falló:', err.message);
    }
  }

  const cached = loadFromCache();
  if (cached) {
    state.products = cached;
    state.dataSource = 'cache';
    state.sheetProducts = cached.length;
    finishLoading();
    return;
  }

  state.products = DEMO_PRODUCTS;
  state.dataSource = 'demo';
  await new Promise(r => setTimeout(r, 600));
  finishLoading();
}

async function fetchFromAppsScript() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.message);
    
    return data.map(item => {
      // Validar array de imágenes
      let imgs = Array.isArray(item.imagenes) ? item.imagenes : [];
      if (item.imagen && imgs.length === 0) imgs.push(item.imagen);
      if (imgs.length === 0) imgs.push(CATEGORY_IMAGE_FALLBACK[item.categoria] || CATEGORY_IMAGE_FALLBACK._default);

      return {
        id: item.id || `PROD-${Date.now()}`,
        nombre: item.nombre || 'Producto sin nombre',
        descripcion: item.descripcion || '',
        categoria: item.categoria || 'Joyería',
        precioPublico: Number(item.precio) || 0,
        stock: Number(item.stock) || null,
        visible: true,
        imagenes: imgs
      };
    });
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchFromGoogleSheets() {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    let text = await response.text();
    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const gvizData = JSON.parse(jsonStr);
    
    const colIndex = {};
    gvizData.table.cols.forEach((col, i) => colIndex[col.label] = i);

    const productos = [];
    for (const row of gvizData.table.rows) {
      const cells = row.c;
      const getValue = (colName) => cells[colIndex[colName]]?.v || null;

      const id = getValue('ID_Producto');
      if (!id) continue;
      
      const visible = String(getValue('Visible') || '').trim().toLowerCase();
      if (visible !== 'sí' && visible !== 'si') continue;

      const cat = getValue('Categoría') || 'Joyería';
      productos.push({
        id: String(id).trim(),
        nombre: String(getValue('Nombre') || 'Producto sin nombre').trim(),
        descripcion: String(getValue('Descripción') || '').trim(),
        categoria: String(cat).trim(),
        precioPublico: Number(getValue('Precio_Publico')) || 0,
        stock: Number(getValue('Stock')) || null,
        visible: true,
        imagenes: [CATEGORY_IMAGE_FALLBACK[cat] || CATEGORY_IMAGE_FALLBACK._default] // Sheets API can't read Drive
      });
    }
    return productos;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function saveToCache(products) {
  try {
    sessionStorage.setItem('namna_cache', JSON.stringify({ data: products, timestamp: Date.now() }));
  } catch (e) {}
}

function loadFromCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem('namna_cache'));
    if (Date.now() - cached.timestamp < CONFIG.CACHE_DURATION_MS && cached.data?.length > 0) return cached.data;
    return null;
  } catch (e) { return null; }
}

function finishLoading() {
  state.filteredProducts = [...state.products];
  buildCategoryFilters();
  renderProducts();
  hideLoader();
  showDataSourceBadge();
}

function showDataSourceBadge() {
  const existing = document.getElementById('data-source-badge');
  if (existing) existing.remove();

  const labels = {
    'sheets': { text: `● Sheets (Sin Fotos Hijas) — ${state.sheetProducts} prod`, color: '#F59E0B' },
    'apps-script': { text: `● Sincronización Total (Drive) — ${state.sheetProducts} prod`, color: '#25D366' },
    'cache': { text: `● Caché (${state.sheetProducts} prod)`, color: '#E78A5E' },
    'demo': { text: '● Demo', color: '#6B7A76' }
  };

  const info = labels[state.dataSource];
  const badge = document.createElement('div');
  badge.id = 'data-source-badge';
  badge.style.cssText = `
    position: fixed; bottom: 16px; left: 16px; z-index: 400;
    font-family: var(--font-body, 'DM Sans', sans-serif); font-size: 0.6875rem; font-weight: 500;
    color: ${info.color}; background: rgba(255,255,255,0.95); padding: 0.5rem 0.85rem;
    border-radius: 6px; box-shadow: 0 2px 16px rgba(0,0,0,0.1); pointer-events: none;
  `;
  badge.textContent = info.text;
  document.body.appendChild(badge);
  setTimeout(() => badge.remove(), 5000);
}

// ═══════════════════════════════════════════════════════════════
// SISTEMA VISUAL
// ═══════════════════════════════════════════════════════════════
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

function filterByCategory(category) {
  state.activeCategory = category;
  dom.categoriesContainer.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  state.filteredProducts = category === 'all' ? [...state.products] : state.products.filter(p => p.categoria === category);
  renderProducts();
}

function renderProducts() {
  dom.productsGrid.innerHTML = '';
  dom.productCount.textContent = `${state.filteredProducts.length} pieza${state.filteredProducts.length !== 1 ? 's' : ''}`;

  if (state.filteredProducts.length === 0) {
    dom.productsGrid.innerHTML = `<div class="empty-state"><h3>No hay piezas en esta categoría</h3></div>`;
    return;
  }

  state.filteredProducts.forEach((product, index) => {
    dom.productsGrid.appendChild(createProductCard(product, index));
  });
  observeCards();
}

function createProductCard(product, index) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.style.transitionDelay = `${index * 0.08}s`;

  // La imagen principal de la card siempre es la primera del array
  const mainImage = product.imagenes[0];

  const stockHTML = (product.stock !== null && product.stock <= 5 && product.stock > 0)
    ? `<span class="product-badge" style="background: var(--color-primary);">Últimas ${product.stock}</span>`
    : '';

  card.innerHTML = `
    <div class="product-card-image">
      ${stockHTML}
      <img src="${mainImage}" alt="${product.nombre}" loading="lazy" />
      <button class="quick-view-btn" aria-label="Vista rápida">Vista Rápida</button>
    </div>
    <div class="product-card-info">
      <p class="product-card-category">${product.categoria}</p>
      <h3 class="product-card-name">${product.nombre}</h3>
      <p class="product-card-price">${formatPrice(product.precioPublico)}</p>
    </div>
  `;
  card.addEventListener('click', () => openModal(product));
  return card;
}

function formatPrice(amount) {
  return (!amount || amount <= 0) ? 'Consultar precio' : `$${amount.toLocaleString(CONFIG.LOCALE)}`;
}

function observeCards() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.product-card').forEach(card => observer.observe(card));
}

// ── Modal con Galería de Fotos Hijas ──
function initModal() {
  dom.closeModalBtn.addEventListener('click', closeModal);
  dom.modal.addEventListener('click', (e) => { if (e.target === dom.modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.modalOpen) closeModal(); });
}

function openModal(product) {
  state.modalOpen = true;

  let stockInfo = '';
  if (product.stock !== null) {
    if (product.stock > 0 && product.stock <= 10) {
      stockInfo = `<p style="color: var(--color-accent); font-size: var(--text-sm); font-weight: 500;">⚡ Solo quedan ${product.stock} unidades</p>`;
    } else if (product.stock <= 0) {
      stockInfo = `<p style="color: var(--color-text-muted); font-size: var(--text-sm); font-weight: 500;">Agotado temporalmente</p>`;
    }
  }

  // Renderizar la mini-galería si hay más de 1 imagen
  let galleryHTML = '';
  if (product.imagenes.length > 1) {
    galleryHTML = `<div class="modal-gallery">`;
    product.imagenes.forEach((imgUrl, idx) => {
      galleryHTML += `<img src="${imgUrl}" class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="changeModalMainImage(this, '${imgUrl}')" />`;
    });
    galleryHTML += `</div>`;
  }

  dom.modalBody.innerHTML = `
    <div class="modal-media-container">
      <div class="modal-image-wrapper">
        <img id="modal-main-image" src="${product.imagenes[0]}" alt="${product.nombre}" />
      </div>
      ${galleryHTML}
    </div>
    <div class="modal-details">
      <p class="modal-category">${product.categoria}</p>
      <h2 class="modal-title">${product.nombre}</h2>
      <p class="modal-price">${formatPrice(product.precioPublico)} ${CONFIG.CURRENCY}</p>
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

// Función global para cambiar la imagen principal al hacer clic en una miniatura
window.changeModalMainImage = function(thumbElement, newImgUrl) {
  const mainImg = document.getElementById('modal-main-image');
  if (mainImg) mainImg.src = newImgUrl;
  
  // Actualizar clase activa en miniaturas
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumbElement.classList.add('active');
}

function closeModal() {
  state.modalOpen = false;
  dom.modal.classList.remove('active');
  dom.modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function handleWhatsAppOrder(productId, productName) {
  const message = encodeURIComponent(`¡Hola! Me interesa la pieza "${productName}" (Código: ${productId}). ¿Podrían darme más información?`);
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${message}`, '_blank');
}
window.handleWhatsAppOrder = handleWhatsAppOrder;

function hideLoader() { dom.loader.classList.add('hidden'); }
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
      if (this.getAttribute('href') === '#') return;
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 140, behavior: 'smooth' });
    });
  });
}

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
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxAhAWbrLuZudbI18FB-AT0wrk3jp1GNUzpdSP3TybOS_QuRaYsm-zW2-z0yVNYbPhC/exec',

  // Conexión directa a tu Google Sheet (Respaldo si falla Apps Script)
  SHEET_ID: '1Xb29JGt7XgwT_YJ08zusT6kvZs4w5lCn7H1lDlCzxbc',

  WHATSAPP_NUMBER: '4917670201873',
  CURRENCY: 'EUR',
  LOCALE: 'es-ES',
  CACHE_DURATION_MS: 5 * 60 * 1000,
};

// ── DATOS DEMO ELIMINADOS ──
// La web ahora es 100% real y se alimenta exclusivamente de la hoja maestra y el servidor.

// ── Categorías Iniciales (Fijas) ──
// Convención: N. = Necklace | E. = Earrings | última letra = color (D=Diamond, Y=Yellow, R=Red)
const INITIAL_CATEGORIES = ['Necklace', 'Earrings'];

// ── Mapeo de categorías a imágenes demo (fallback) ──
const CATEGORY_IMAGE_FALLBACK = {
  'Necklace':   'assets/product_necklace.png',
  'Earrings':   'assets/product_earrings.png',
  'Collares':   'assets/product_necklace.png',
  'Dijes':      'assets/product_pendant.png',
  'Aretes':     'assets/product_earrings.png',
  'Sets':       'assets/product_necklace.png',
  '_default':   'assets/product_pendant.png'
};

// ── Application State ──
const state = {
  products: [],
  filteredProducts: [],
  activeCategory: 'all',
  modalOpen: false,
  dataSource: 'loading',
  sheetProducts: 0,
  lang: localStorage.getItem('namna_lang') || (navigator.language.startsWith('es') ? 'es' : 'en'),
  textos_es: {},
  textos_en: {},
  siteImages: {}
};

// ── i18n Dictionary for JS Strings ──
const i18n = {
  es: {
    quickView: 'Vista Rápida',
    emptyCategory: 'No hay piezas en esta categoría',
    askPrice: 'Consultar precio',
    onlyLeft: '⚡ Solo quedan {n} unidades',
    outOfStock: 'Agotado temporalmente',
    orderWhatsApp: 'Pedir por WhatsApp',
    code: 'Código',
    newBadge: 'Nuevo',
    whatsappMessage: '¡Hola! Me interesa la pieza "{name}" (Código: {id}). ¿Podrían darme más información?',
    piece: 'pieza',
    pieces: 'piezas'
  },
  en: {
    quickView: 'Quick View',
    emptyCategory: 'No items in this category',
    askPrice: 'Inquire Price',
    onlyLeft: '⚡ Only {n} units left',
    outOfStock: 'Temporarily out of stock',
    orderWhatsApp: 'Order via WhatsApp',
    code: 'Code',
    newBadge: 'New',
    whatsappMessage: 'Hello! I am interested in the piece "{name}" (Code: {id}). Could you provide more information?',
    piece: 'piece',
    pieces: 'pieces'
  }
};
function t(key, params = {}) {
  let str = i18n[state.lang][key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

// ── DOM References ──
const dom = {
  header: document.getElementById('main-header'),
  categoriesContainer: document.getElementById('categories-container'),
  productsGrid: document.getElementById('products-grid'),
  loader: document.getElementById('catalog-loader'),
  productCount: document.getElementById('product-count'),
  modal: document.getElementById('product-modal'),
  modalBody: document.getElementById('modal-body'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  nuevosGrid: document.getElementById('nuevos-grid'),
  langToggleBtns: document.querySelectorAll('.lang-toggle')
};

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initHeader();
  loadProducts();
  initModal();
  initSmoothScroll();
});

function initHeader() {
  if (!dom.header) return;
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

  // Si todo falla, no hay demo. Catálogo vacío.
  state.products = [];
  state.dataSource = 'error';
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
    
    // ── Textos e Imágenes del Sitio ──
    if (data.textos) {
      if (data.textos.es) state.textos_es = data.textos.es;
      if (data.textos.en) state.textos_en = data.textos.en;
      // Compatibilidad con la versión anterior que enviaba objeto plano
      if (!data.textos.es && typeof data.textos === 'object') state.textos_es = data.textos;
      updateTranslations();
    }
    
    if (data.imagenesSitio) {
      state.siteImages = data.imagenesSitio;
      applySiteImages();
    }
    
    const arrayData = data.productos ? data.productos : data;
    
    return arrayData.map(item => {
      let imgs = Array.isArray(item.imagenes) ? item.imagenes : [];
      if (item.imagen && imgs.length === 0) imgs.push(item.imagen);
      if (imgs.length === 0) imgs.push(CATEGORY_IMAGE_FALLBACK[item.categoria] || CATEGORY_IMAGE_FALLBACK._default);

      const cat_es = item.categoria_es || item.categoria || 'Joyería';
      const cat_en = item.categoria_en || item.categoria || 'Jewelry';
      const desc_es = item.descripcion_es || item.descripcion || '';
      const desc_en = item.descripcion_en || item.descripcion || '';
      
      const obj = {
        id: item.id || `PROD-${Date.now()}`,
        nombre: item.nombre || 'Producto sin nombre',
        _descripcion_es: desc_es,
        _descripcion_en: desc_en,
        _categoria_es: cat_es,
        _categoria_en: cat_en,
        precioPublico: Number(item.precio) || 0,
        stock: Number(item.stock) || null,
        visible: true,
        imagenes: imgs
      };
      
      Object.defineProperties(obj, {
        descripcion: { get: () => state.lang === 'en' ? obj._descripcion_en : obj._descripcion_es, enumerable: true },
        categoria: { get: () => state.lang === 'en' ? obj._categoria_en : obj._categoria_es, enumerable: true }
      });
      
      return obj;
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

      const cat_es = String(getValue('Categoría Es') || getValue('Categoría') || 'Joyería').trim();
      const cat_en = String(getValue('Categoría En') || 'Jewelry').trim();
      const desc_es = String(getValue('Descripción Es') || getValue('Descripción') || '').trim();
      const desc_en = String(getValue('Descripción En') || '').trim();

      const obj = {
        id: String(id).trim(),
        nombre: String(getValue('Nombre') || 'Producto sin nombre').trim(),
        _descripcion_es: desc_es,
        _descripcion_en: desc_en,
        _categoria_es: cat_es,
        _categoria_en: cat_en,
        precioPublico: Number(getValue('Precio_Publico')) || 0,
        stock: Number(getValue('Stock')) || null,
        visible: true,
        imagenes: [CATEGORY_IMAGE_FALLBACK[cat_es] || CATEGORY_IMAGE_FALLBACK._default] // Sheets API can't read Drive
      };
      
      Object.defineProperties(obj, {
        descripcion: { get: () => state.lang === 'en' ? obj._descripcion_en : obj._descripcion_es, enumerable: true },
        categoria: { get: () => state.lang === 'en' ? obj._categoria_en : obj._categoria_es, enumerable: true }
      });
      
      productos.push(obj);
    }
    return productos;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function saveToCache(data) {
  try {
    const cacheData = { timestamp: Date.now(), items: data, textos_es: state.textos_es, textos_en: state.textos_en, siteImages: state.siteImages };
    sessionStorage.setItem('namna_catalog', JSON.stringify(cacheData));
  } catch (e) {
    console.warn('⚠️ No se pudo guardar en caché:', e);
  }
}

function loadFromCache() {
  try {
    const cached = sessionStorage.getItem('namna_catalog');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CONFIG.CACHE_DURATION_MS) {
      sessionStorage.removeItem('namna_catalog');
      return null;
    }
    if (parsed.textos_es) state.textos_es = parsed.textos_es;
    if (parsed.textos_en) state.textos_en = parsed.textos_en;
    if (parsed.siteImages) state.siteImages = parsed.siteImages;
    updateTranslations();
    applySiteImages();
    return parsed.items;
  } catch (e) {
    return null;
  }
}

// ── i18n Logic ──
function initI18n() {
  dom.langToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.lang = state.lang === 'es' ? 'en' : 'es';
      localStorage.setItem('namna_lang', state.lang);
      updateTranslations();
      state.activeCategory = 'all'; // Reset filter when lang changes
      buildCategoryFilters();
      renderProducts();
      renderNuevos();
    });
  });
}

function updateTranslations() {
  // Update lang toggles text
  document.querySelectorAll('#current-lang').forEach(el => {
    el.textContent = state.lang.toUpperCase();
  });
  
  // Update HTML lang attribute
  document.documentElement.lang = state.lang;
  
  // Translate data-txt elements
  const currentTextos = state.lang === 'es' ? state.textos_es : state.textos_en;
  if (currentTextos) {
    document.querySelectorAll('[data-txt]').forEach(el => {
      const id = el.getAttribute('data-txt');
      if (currentTextos[id]) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = currentTextos[id];
        } else {
          el.textContent = currentTextos[id];
        }
      }
    });
  }
}

// ── Site Images Logic ──
function applySiteImages() {
  if (!state.siteImages) return;
  document.querySelectorAll('img[data-site-img]').forEach(img => {
    const key = img.getAttribute('data-site-img');
    if (state.siteImages[key]) {
      img.src = state.siteImages[key];
    }
  });
}

function finishLoading() {
  state.filteredProducts = [...state.products];
  buildCategoryFilters();
  renderProducts();
  renderNuevos();
  hideLoader();
  showDataSourceBadge();
}

// ── Novedades: últimos 4 productos añadidos ──
function renderNuevos(products = state.products) {
  if (!dom.nuevosGrid) return;
  dom.nuevosGrid.innerHTML = '';

  // Los últimos productos de la tabla son los más recientes
  const nuevos = products.slice(-4).reverse();

  if (nuevos.length === 0) {
    dom.nuevosGrid.closest('.nuevos-section').style.display = 'none';
    return;
  }

  nuevos.forEach((product, index) => {
    const card = document.createElement('article');
    card.className = 'nuevos-card';
    card.style.animationDelay = `${index * 0.12}s`;
    card.innerHTML = `
      <div class="nuevos-card-image">
        <span class="product-badge">${t('newBadge')}</span>
        <img src="${product.imagenes[0]}" alt="${product.nombre}" loading="lazy" />
      </div>
      <div class="nuevos-card-info">
        <p class="nuevos-card-category">${product.categoria}</p>
        <h3 class="nuevos-card-name">${product.nombre}</h3>
        <p class="nuevos-card-price">${formatPrice(product.precioPublico)}</p>
      </div>
    `;
    card.addEventListener('click', () => openModal(product));
    dom.nuevosGrid.appendChild(card);
  });
}

function showDataSourceBadge() {
  const existing = document.getElementById('data-source-badge');
  if (existing) existing.remove();

  const labels = {
    'sheets': { text: `● Sheets (Sin Fotos Hijas) — ${state.sheetProducts} prod`, color: '#F59E0B' },
    'apps-script': { text: `● Sincronización Total (Drive) — ${state.sheetProducts} prod`, color: '#25D366' },
    'cache': { text: `● Caché (${state.sheetProducts} prod)`, color: '#E78A5E' },
    'error': { text: '● Catálogo Vacío / Error', color: '#EF4444' }
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
  if (!dom.categoriesContainer) return;
  const allBtn = dom.categoriesContainer.querySelector('[data-category="all"]');
  if (!allBtn) return;
  dom.categoriesContainer.innerHTML = '';
  dom.categoriesContainer.appendChild(allBtn);

  // Unir categorías iniciales fijas con las que vengan de los productos
  const productCategories = [...new Set(state.products.map(p => p.categoria))];
  const finalCategories = [...new Set([...INITIAL_CATEGORIES, ...productCategories])];

  finalCategories.forEach(cat => {
    // Evitar crear botón para categorías vacías o nulas
    if (!cat || cat.trim() === '') return;
    
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
  if (!dom.categoriesContainer) return;
  state.activeCategory = category;
  dom.categoriesContainer.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  state.filteredProducts = category === 'all' ? [...state.products] : state.products.filter(p => p.categoria === category);
  renderProducts();
}

function renderProducts() {
  if (!dom.productsGrid) return;
  dom.productsGrid.innerHTML = '';
  
  if (state.filteredProducts.length === 0) {
    if (dom.productCount) dom.productCount.textContent = `0 ${t('pieces')}`;
    dom.productsGrid.innerHTML = `<div class="empty-state"><h3>${t('emptyCategory')}</h3></div>`;
    return;
  }

  if (dom.productCount) dom.productCount.textContent = `${state.filteredProducts.length} ${state.filteredProducts.length !== 1 ? t('pieces') : t('piece')}`;

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
    ? `<span class="product-badge" style="background: var(--color-accent);">Últimas ${product.stock}</span>`
    : '';

  card.innerHTML = `
    <div class="product-card-image">
      ${stockHTML}
      <img src="${mainImage}" alt="${product.nombre}" loading="lazy" />
      <button class="quick-view-btn" aria-label="${t('quickView')}">${t('quickView')}</button>
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
  return (!amount || amount <= 0) ? t('askPrice') : `€${amount.toLocaleString(CONFIG.LOCALE)}`;
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
  if (!dom.closeModalBtn || !dom.modal) return;
  dom.closeModalBtn.addEventListener('click', closeModal);
  dom.modal.addEventListener('click', (e) => { if (e.target === dom.modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.modalOpen) closeModal(); });
}

function openModal(product) {
  state.modalOpen = true;

  let stockInfo = '';
  if (product.stock !== null) {
    if (product.stock > 0 && product.stock <= 10) {
      stockInfo = `<p style="color: var(--color-accent); font-size: var(--text-sm); font-weight: 500;">${t('onlyLeft', {n: product.stock})}</p>`;
    } else if (product.stock <= 0) {
      stockInfo = `<p style="color: var(--color-text-muted); font-size: var(--text-sm); font-weight: 500;">${t('outOfStock')}</p>`;
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
      <div class="modal-image-wrapper" onclick="this.classList.toggle('fullscreen')">
        <img id="modal-main-image" src="${product.imagenes[0]}" alt="${product.nombre}" />
        <div class="zoom-hint">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </div>
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
        ${t('orderWhatsApp')}
      </button>
      <p style="text-align: center; margin-top: var(--space-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
        ${t('code')}: ${product.id}
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
  const message = encodeURIComponent(t('whatsappMessage', {name: productName, id: productId}));
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${message}`, '_blank');
}
window.handleWhatsAppOrder = handleWhatsAppOrder;

function hideLoader() {
  if (dom.loader) dom.loader.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════════════
// TEXTOS DINÁMICOS — Inyección desde Google Sheets
// ═══════════════════════════════════════════════════════════════
// La función aplicarTextos anterior se elimina porque updateTranslations hace ese trabajo
function aplicarTextos(textos) {
  // Solo se mantiene como compatibilidad por si algo más lo llamaba
  if (textos && !state.textos_es) state.textos_es = textos;
  updateTranslations();
}

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

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

  WHATSAPP_NUMBER: '34695261649',
  CURRENCY: 'EUR',
  LOCALE: 'es-ES',
  CACHE_DURATION_MS: 30 * 60 * 1000,  // 30 minutos — carga instantánea para visitantes recurrentes
};

// ── DATOS DEMO ELIMINADOS ──
// La web ahora es 100% real y se alimenta exclusivamente de la hoja maestra y el servidor.

// ── Categorías Iniciales (Fijas) ──
// Convención: N. = Necklace | E. = Earrings | última letra = color (D=Diamond, Y=Yellow, R=Red)


// ── Mapeo de categorías a imágenes demo (fallback) ──
const CATEGORY_IMAGE_FALLBACK = {
  'Necklace':   'assets/fallback_necklace.webp',
  'Earrings':   'assets/fallback_earrings.webp',
  'Collares':   'assets/fallback_necklace.webp',
  'Dijes':      'assets/fallback_pendant.webp',
  'Aretes':     'assets/fallback_earrings.webp',
  'Sets':       'assets/fallback_necklace.webp',
  '_default':   'assets/fallback_default.webp'
};

// ── Application State ──
const state = {
  products: [],
  filteredProducts: [],
  activeCategory: 'all',
  modalOpen: false,
  dataSource: 'loading',
  sheetProducts: 0,
  lang: localStorage.getItem('namna_lang') || 'en',
  textos_es: {},
  textos_en: {},
  siteImages: {},
  wishlist: JSON.parse(localStorage.getItem('namna_wishlist') || '[]')
};

// ── i18n Dictionary for JS Strings ──
const i18n = {
  es: {
    quickView: 'Vista Rápida',
    emptyCategory: 'No hay piezas en esta categoría',
    askPrice: 'Consultar precio',
    onlyLeft: '⚡ Solo quedan {n} unidades',
    outOfStock: 'Agotado',
    orderWhatsApp: 'Pedir por WhatsApp',
    code: 'Código',
    newBadge: 'NUEVO',
    whatsappMessage: '¡Hola! Me interesa la pieza "{name}" (Código: {id}). ¿Podrían darme más información?',
    piece: 'pieza',
    pieces: 'piezas'
  },
  en: {
    quickView: 'Quick View',
    emptyCategory: 'No items in this category',
    askPrice: 'Inquire Price',
    onlyLeft: '⚡ Only {n} units left',
    outOfStock: 'Sold out',
    orderWhatsApp: 'Order via WhatsApp',
    code: 'Code',
    newBadge: 'NUEVO',
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

// ── Sincronización Inmediata del Idioma (Evita parpadeos) ──
(function() {
  const cachedStr = localStorage.getItem('namna_catalog');
  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      if (cached.textos_es) state.textos_es = cached.textos_es;
      if (cached.textos_en) state.textos_en = cached.textos_en;
    } catch(e) {}
  }
  // Ejecuta la traducción en cuanto el DOM está listo
  document.addEventListener('DOMContentLoaded', () => {
    updateTranslations();
  });
})();

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initHeader();
  initMobileMenu();
  loadProducts();
  initModal();
  initSmoothScroll();
  initSearch();
  initWishlist();
  
  // Language recommendation removed as default is now English
});

function showLanguageRecommendation() {
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:12px 24px;border-radius:30px;z-index:9999;box-shadow:0 4px 15px rgba(0,0,0,0.2);display:flex;align-items:center;gap:15px;font-family:var(--font-body);font-size:14px;animation:fadeSlideUp 0.5s ease-out;';
  banner.innerHTML = `
    <span>Prefer to view the site in English? 🇬🇧</span>
    <button style="background:var(--color-accent);color:#fff;border:none;padding:6px 12px;border-radius:20px;cursor:pointer;font-weight:600;">Switch to EN</button>
    <button style="background:transparent;border:none;color:#ccc;cursor:pointer;font-size:18px;">&times;</button>
  `;
  document.body.appendChild(banner);
  
  const btns = banner.querySelectorAll('button');
  btns[0].addEventListener('click', () => {
    state.lang = 'en';
    localStorage.setItem('namna_lang', 'en');
    updateTranslations();
    state.activeCategory = 'all';
    buildCategoryFilters();
    renderProducts();
    renderNuevos();
    banner.remove();
  });
  btns[1].addEventListener('click', () => banner.remove());
  setTimeout(() => { if (banner.parentNode) banner.remove() }, 10000);
}

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

// ── Mobile Menu ──
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const panel = document.getElementById('mobile-nav-panel');
  const overlay = document.getElementById('mobile-nav-overlay');
  const closeBtn = document.getElementById('mobile-nav-close');

  if (!menuBtn || !panel) return;

  const openMenu = () => {
    menuBtn.classList.add('active');
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.classList.add('active');
    document.body.classList.add('mobile-menu-open');
  };

  const closeMenu = () => {
    menuBtn.classList.remove('active');
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('mobile-menu-open');
  };

  menuBtn.addEventListener('click', () => {
    if (panel.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);

  // Close menu when clicking a navigation link
  panel.querySelectorAll('.mobile-nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('active')) {
      closeMenu();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// MOTOR HÍBRIDO CONECTADO — Estrategia: Cache-First + Background Refresh
// 1. Si hay caché válido → muestra INSTANTÁNEO, luego actualiza en background
// 2. Si no hay caché → muestra loader y espera al servidor
// ═══════════════════════════════════════════════════════════════
async function loadProducts() {
  // PASO 1: Intentar caché primero (carga instantánea)
  const cached = loadFromCache();
  if (cached && cached.length > 0) {
    console.log('⚡ NAMNA: Carga instantánea desde caché (' + cached.length + ' productos)');
    state.products = cached;
    state.dataSource = 'cache';
    state.sheetProducts = cached.length;
    finishLoading();
    // PASO 2: Actualizar en background sin bloquear la UI
    refreshInBackground();
    return;
  }

  // Sin caché → carga normal (muestra loader)
  console.log('🔄 NAMNA: Sin caché, cargando del servidor...');
  await loadFromServer();
}

// ── Carga desde servidor (bloqueante, muestra loader) ──
async function loadFromServer() {
  if (CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_URL.trim() !== '') {
    try {
      console.log('🔐 NAMNA: Conectando via Apps Script...');
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

  // Si todo falla, catálogo vacío
  state.products = [];
  state.dataSource = 'error';
  finishLoading();
}

// ── Actualización silenciosa en background ──
async function refreshInBackground() {
  try {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.trim() === '') return;
    console.log('🔄 NAMNA: Actualizando en background...');
    const freshProducts = await fetchFromAppsScript();
    if (freshProducts && freshProducts.length > 0) {
      // Comparar el hash real de los datos para saber si hay algún cambio de precio/texto
      const oldHash = JSON.stringify(state.products);
      const newHash = JSON.stringify(freshProducts);
      
      if (oldHash !== newHash) {
        state.products = freshProducts;
        state.filteredProducts = state.activeCategory === 'all'
          ? [...freshProducts]
          : freshProducts.filter(p => p.categoria === state.activeCategory);
        state.dataSource = 'apps-script';
        state.sheetProducts = freshProducts.length;
        saveToCache(freshProducts);
        
        buildCategoryFilters();
        renderProducts();
        renderNuevos();
        console.log('✅ NAMNA: Catálogo actualizado por cambios detectados.');
      } else {
        // Renovar el tiempo del caché para que no expire tan rápido si no hay cambios
        saveToCache(freshProducts);
        console.log('✅ NAMNA: Catálogo confirmado al día (sin cambios).');
      }
    }
  } catch (err) {
    // Silencioso — el usuario ya tiene contenido del caché
    console.log('ℹ️ NAMNA: Background refresh no disponible, usando caché');
  }
}

async function fetchFromAppsScript() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const fetchUrl = `${CONFIG.APPS_SCRIPT_URL}${CONFIG.APPS_SCRIPT_URL.includes('?') ? '&' : '?'}t=${Date.now()}`;
    const response = await fetch(fetchUrl, { signal: controller.signal, cache: 'no-store' });
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
    localStorage.setItem('namna_catalog', JSON.stringify(cacheData));
  } catch (e) {
    // Si localStorage está lleno, intentar limpiar y reintentar
    console.warn('⚠️ No se pudo guardar en caché:', e);
    try {
      localStorage.removeItem('namna_catalog');
      localStorage.setItem('namna_catalog', JSON.stringify(cacheData));
    } catch (e2) {
      console.warn('⚠️ Caché no disponible');
    }
  }
}

function loadFromCache() {
  try {
    const cached = localStorage.getItem('namna_catalog');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CONFIG.CACHE_DURATION_MS) {
      localStorage.removeItem('namna_catalog');
      return null;
    }
    if (parsed.textos_es) state.textos_es = parsed.textos_es;
    if (parsed.textos_en) state.textos_en = parsed.textos_en;
    if (parsed.siteImages) state.siteImages = parsed.siteImages;
    updateTranslations();
    applySiteImages();
    // Re-attach getters that were lost during JSON.stringify
    return parsed.items.map(obj => {
      Object.defineProperties(obj, {
        descripcion: { get: () => state.lang === 'en' ? obj._descripcion_en : obj._descripcion_es, enumerable: true },
        categoria: { get: () => state.lang === 'en' ? obj._categoria_en : obj._categoria_es, enumerable: true }
      });
      return obj;
    });
  } catch (e) {
    return null;
  }
}

// ── i18n Logic ──
function initI18n() {
  dom.langToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.classList.add('lang-switching');
      
      setTimeout(() => {
        state.lang = state.lang === 'es' ? 'en' : 'es';
        localStorage.setItem('namna_lang', state.lang);
        updateTranslations();
        state.activeCategory = 'all'; // Reset filter when lang changes
        buildCategoryFilters();
        renderProducts();
        renderNuevos();
        
        setTimeout(() => {
          document.body.classList.remove('lang-switching');
        }, 20); // slight delay to allow DOM to update before fading in
      }, 100); // 100ms matches the CSS transition duration
    });
  });
}

function updateTranslations() {
  // Update lang toggles text
  document.querySelectorAll('#current-lang').forEach(el => {
    el.textContent = state.lang === 'es' ? '🇪🇸 ES' : '🇬🇧 EN';
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
          el.innerHTML = currentTextos[id];
        }
      }
    });
  }
  
  // Translate generic WhatsApp links
  const waMsg = state.lang === 'en' 
    ? "Hello! I am interested in knowing more about your jewelry." 
    : "¡Hola! Estoy interesado en conocer más información sobre sus joyas.";
  document.querySelectorAll('.whatsapp-float, .footer-links a[href^="https://wa.me"], .mobile-nav-footer a[href^="https://wa.me"]').forEach(a => {
    a.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;
  });
}

// ── Site Images Logic (con protección contra imágenes fantasma) ──
function applySiteImages() {
  if (!state.siteImages) return;
  document.querySelectorAll('img[data-site-img]').forEach(img => {
    const key = img.getAttribute('data-site-img');
    if (state.siteImages[key]) {
      const originalSrc = img.src; // Guardar imagen local como fallback
      const newImg = new Image();
      newImg.onload = () => {
        img.src = state.siteImages[key]; // Solo cambiar si cargó bien
      };
      newImg.onerror = () => {
        console.warn('⚠️ Imagen de Drive no disponible:', key, '→ usando local');
        // No cambiar — mantener la imagen local original
      };
      newImg.src = state.siteImages[key];
    }
  });
}

// ── Manejo global de imágenes rotas (anti-fantasma) ──
document.addEventListener('error', function(e) {
  if (e.target.tagName === 'IMG' && e.target.src.includes('drive.google.com')) {
    const cat = e.target.closest('[data-category]')?.dataset?.category || '';
    const fallback = CATEGORY_IMAGE_FALLBACK[cat] || CATEGORY_IMAGE_FALLBACK._default;
    e.target.src = fallback;
    e.target.style.opacity = '1';
    console.warn('🖼️ Imagen de Drive falló, usando fallback:', e.target.alt);
  }
}, true);

function finishLoading() {
  state.filteredProducts = [...state.products];
  buildCategoryFilters();
  renderProducts();
  renderNuevos();
  hideLoader();
  showDataSourceBadge();
}

function getSingularCategory(cat) {
  const lowerCat = String(cat).toLowerCase().trim();
  const singularMap = {
    'collares': 'Collar', 'pendientes': 'Pendiente', 'aretes': 'Arete', 
    'anillos': 'Anillo', 'pulseras': 'Pulsera', 'dijes': 'Dije', 
    'colgantes': 'Colgante', 'sets': 'Set', 'joyas': 'Joya',
    'necklaces': 'Necklace', 'earrings': 'Earring', 'rings': 'Ring', 
    'bracelets': 'Bracelet', 'pendants': 'Pendant', 'jewelry': 'Jewelry'
  };
  return singularMap[lowerCat] || cat.replace(/s$/i, '');
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
        ${product.stock !== null && product.stock <= 0 ? `<span class="product-badge" style="background: var(--color-text-muted);">${t('outOfStock')}</span>` : ''}
        ${product.stock !== null && product.stock <= 5 && product.stock > 0 ? `<span class="product-badge" style="background: var(--color-accent);">${t('onlyLeft', {n: product.stock}).replace('⚡ ', '')}</span>` : ''}
        <img src="${product.imagenes[0]}" alt="${product.nombre}" onerror="this.onerror=null; this.src='${CATEGORY_IMAGE_FALLBACK[product._categoria_es] || CATEGORY_IMAGE_FALLBACK._default}'" />
      </div>
      <div class="nuevos-card-info">
        <p class="nuevos-card-category">${getSingularCategory(product.categoria)}</p>
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
  const finalCategories = productCategories;

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
  injectProductSchema(state.filteredProducts);
}

// ── SEO: Inyectar Schema.org Product para Google Rich Results ──
function injectProductSchema(products) {
  // Eliminar schema anterior si existe
  const old = document.getElementById('dynamic-product-schema');
  if (old) old.remove();

  const items = products.slice(0, 20).map(p => ({
    "@type": "Product",
    "name": p.nombre,
    "image": p.imagenes[0],
    "description": p.descripcion || `${getSingularCategory(p.categoria)} by NAMNA Fine Jewelry. 18k gold with natural stones.`,
    "brand": { "@type": "Brand", "name": "NAMNA Fine Jewelry" },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "EUR",
      "price": p.precioPublico || 0,
      "availability": (p.stock !== null && p.stock <= 0) 
        ? "https://schema.org/OutOfStock" 
        : "https://schema.org/InStock",
      "url": "https://www.namnafine.com/",
      "seller": { "@type": "Organization", "name": "NAMNA Fine Jewelry" }
    }
  }));

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'dynamic-product-schema';
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "NAMNA Fine Jewelry Collection",
    "numberOfItems": items.length,
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": item
    }))
  });
  document.head.appendChild(script);
}

function createProductCard(product, index) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.style.transitionDelay = `${index * 0.08}s`;

  // La imagen principal de la card siempre es la primera del array
  const mainImage = product.imagenes[0];

  let stockHTML = '';
  if (product.stock !== null) {
    if (product.stock <= 0) {
      stockHTML = `<span class="product-badge" style="background: var(--color-text-muted);">${t('outOfStock')}</span>`;
    } else if (product.stock <= 5) {
      stockHTML = `<span class="product-badge" style="background: var(--color-accent);">${t('onlyLeft', {n: product.stock}).replace('⚡ ', '')}</span>`;
    }
  }

  const isWished = state.wishlist.includes(product.id);
  const heartIconHTML = `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

  card.innerHTML = `
    <div class="product-card-image">
      ${stockHTML}
      <button class="wishlist-heart-btn ${isWished ? 'active' : ''}" data-id="${product.id}" aria-label="Favorito">
        ${heartIconHTML}
      </button>
      <img src="${mainImage}" alt="${product.nombre}" loading="lazy" onerror="this.onerror=null; this.src='${CATEGORY_IMAGE_FALLBACK[product._categoria_es] || CATEGORY_IMAGE_FALLBACK._default}'" />
      <button class="quick-view-btn" aria-label="${t('quickView')}">${t('quickView')}</button>
    </div>
    <div class="product-card-info">
      <p class="product-card-category">${getSingularCategory(product.categoria)}</p>
      <h3 class="product-card-name">${product.nombre}</h3>
      <p class="product-card-price">${formatPrice(product.precioPublico)}</p>
    </div>
  `;
  card.querySelector('.product-card-image > img').addEventListener('click', () => openModal(product));
  card.querySelector('.quick-view-btn').addEventListener('click', (e) => { e.stopPropagation(); openModal(product); });
  card.querySelector('.wishlist-heart-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleWishlist(product.id, e.currentTarget); });
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

  let singularCat = getSingularCategory(product.categoria);

  let descHtml = '';
  if (product.descripcion) {
    if (product.descripcion.includes('\n')) {
      const listItems = product.descripcion.split('\n').filter(l => l.trim()).map(line => `<li>${line.trim()}</li>`).join('');
      descHtml = `<ul class="modal-description-list" style="text-align: left; margin: 0 auto var(--space-md); max-width: fit-content; color: var(--color-text-muted); padding-left: 1.5rem;">${listItems}</ul>`;
    } else {
      descHtml = `<p class="modal-description">${product.descripcion}</p>`;
    }
  }

  dom.modalBody.innerHTML = `
    <div class="modal-media-container">
      <div class="modal-image-wrapper" onclick="this.classList.toggle('fullscreen')">
        <img id="modal-main-image" src="${product.imagenes[0]}" alt="${product.nombre}" onerror="this.onerror=null; this.src='${CATEGORY_IMAGE_FALLBACK[product._categoria_es] || CATEGORY_IMAGE_FALLBACK._default}'" />
        <div class="zoom-hint">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </div>
      </div>
      ${galleryHTML}
    </div>
    <div class="modal-details">
      <div class="modal-details-scroll">
        <p class="modal-category">${singularCat}</p>
        <h2 class="modal-title">${product.nombre}</h2>
        <p class="modal-price">${formatPrice(product.precioPublico)} ${CONFIG.CURRENCY}</p>
        ${stockInfo}
        ${descHtml}
      </div>
      <div class="modal-actions">
        ${product.stock !== null && product.stock <= 0 ? `
        <button class="modal-cta" disabled style="background: var(--color-text-muted); cursor: not-allowed; opacity: 0.8;">
          ${t('outOfStock')}
        </button>
        ` : `
        <button class="modal-cta" onclick="handleWhatsAppOrder('${product.id}', '${product.nombre.replace(/'/g, "\\'")}')">
          <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" fill="currentColor"/></svg>
          ${t('orderWhatsApp')}
        </button>
        `}
        <button class="modal-share-btn" onclick="shareProductLink('${product.id}', '${product.nombre.replace(/'/g, "\\'")}')">
          <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span>${state.lang === 'es' ? 'Compartir enlace' : 'Share link'}</span>
        </button>
        <div class="share-toast" id="modal-share-toast">
          <svg viewBox="0 0 24 24" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${state.lang === 'es' ? '¡Enlace copiado!' : 'Link copied!'}</span>
        </div>
        <p style="text-align: center; margin-top: var(--space-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
          ${t('code')}: ${product.id}
        </p>
      </div>
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

// ── Share Product Link ──
window.shareProductLink = function(productId, productName) {
  const shareUrl = `${window.location.origin}/producto.html?id=${encodeURIComponent(productId)}`;

  // Try native Web Share API first (mobile)
  if (navigator.share) {
    navigator.share({
      title: `${productName} — NAMNA Fine Jewelry`,
      url: shareUrl
    }).catch(() => {
      // User cancelled or error — fallback to clipboard
      copyProductLink(shareUrl);
    });
  } else {
    copyProductLink(shareUrl);
  }
};

function copyProductLink(text) {
  navigator.clipboard.writeText(text).then(() => {
    showModalShareToast();
  }).catch(() => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showModalShareToast();
  });
}

function showModalShareToast() {
  const toast = document.getElementById('modal-share-toast');
  if (!toast) return;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

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

// ═══════════════════════════════════════════════════════════════
// SMART SEARCH
// ═══════════════════════════════════════════════════════════════
function initSearch() {
  const searchBtn = document.getElementById('search-btn');
  const overlay = document.getElementById('search-overlay');
  const closeBtn = document.getElementById('close-search-btn');
  const input = document.getElementById('search-input');
  const resultsDiv = document.getElementById('search-results');
  
  if (!searchBtn || !overlay) return;

  const closeSearch = () => {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    input.value = '';
    resultsDiv.innerHTML = '';
  };

  searchBtn.addEventListener('click', () => {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    input.focus();
  });
  
  closeBtn.addEventListener('click', closeSearch);
  
  input.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    resultsDiv.innerHTML = '';
    if (!q) return;

    // Static Index Links
    const staticLinks = [
      { keys: ['contacto', 'contact'], url: 'info.html#contacto', title: state.lang==='es'?'Contacto':'Contact' },
      { keys: ['nosotros', 'about', 'who', 'quien'], url: 'info.html#about', title: state.lang==='es'?'Quiénes Somos':'About Us' },
      { keys: ['envio', 'envío', 'shipping', 'delivery', 'tallas', 'size'], url: 'info.html', title: state.lang==='es'?'Info de Envíos y Tallas':'Shipping & Sizing' }
    ];
    
    let html = '';
    
    staticLinks.forEach(link => {
      if (link.keys.some(k => k.includes(q) || q.includes(k))) {
        html += `<a href="${link.url}" class="search-result-item" onclick="document.getElementById('search-overlay').classList.remove('active');">
          <div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;background:var(--color-bg);border-radius:var(--radius-sm);"><svg style="width:24px;height:24px;stroke:var(--color-primary);fill:none;" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <div class="search-result-info"><span class="search-result-name">${link.title}</span><span class="search-result-cat">Página</span></div>
        </a>`;
      }
    });

    // Product search
    const results = state.products.filter(p => 
      p.nombre.toLowerCase().includes(q) || 
      p.id.toLowerCase().includes(q) || 
      p._descripcion_es.toLowerCase().includes(q) || 
      p._descripcion_en.toLowerCase().includes(q) ||
      p._categoria_es.toLowerCase().includes(q) ||
      p._categoria_en.toLowerCase().includes(q)
    ).slice(0, 8); // top 8 results
    
    results.forEach(p => {
      html += `<div class="search-result-item" onclick="document.getElementById('search-overlay').classList.remove('active'); window.openModalById('${p.id}')">
        <img src="${p.imagenes[0]}" class="search-result-img" />
        <div class="search-result-info">
          <span class="search-result-name">${p.nombre}</span>
          <span class="search-result-cat">${p.categoria} - ${formatPrice(p.precioPublico)}</span>
        </div>
      </div>`;
    });
    
    if (html === '') html = `<p style="padding:20px;text-align:center;color:var(--color-text-muted);">No se encontraron resultados</p>`;
    resultsDiv.innerHTML = html;
  });
}

window.openModalById = function(id) {
  const p = state.products.find(x => x.id === id);
  if (p) openModal(p);
};

// ═══════════════════════════════════════════════════════════════
// WISHLIST (FAVORITOS)
// ═══════════════════════════════════════════════════════════════
function initWishlist() {
  const btn = document.getElementById('wishlist-btn');
  const drawer = document.getElementById('wishlist-drawer');
  const overlay = document.getElementById('wishlist-drawer-overlay');
  const closeBtn = document.getElementById('close-drawer-btn');
  
  if (!btn || !drawer) return;
  updateWishlistBadge();

  const closeDrawer = () => {
    drawer.classList.remove('active');
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  };

  btn.addEventListener('click', () => {
    renderWishlistDrawer();
    drawer.classList.add('active');
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
  });

  closeBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
}

function toggleWishlist(id, btnElement) {
  const idx = state.wishlist.indexOf(id);
  if (idx > -1) {
    state.wishlist.splice(idx, 1);
    btnElement.classList.remove('active');
  } else {
    state.wishlist.push(id);
    btnElement.classList.add('active');
    // Pequeña animación de rebote extra
    btnElement.style.transform = 'scale(1.2)';
    setTimeout(() => btnElement.style.transform = '', 200);
  }
  localStorage.setItem('namna_wishlist', JSON.stringify(state.wishlist));
  
  updateWishlistBadge();
}

// Actualizar también el botón en el modal
window.updateModalWishlistBtn = function(id) {
  const btn = document.getElementById('modal-wishlist-btn');
  if (btn) {
    if (state.wishlist.includes(id)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
};

window.scrollCarousel = function(id, dir) {
  const el = document.getElementById(id);
  if (el) {
    const scrollAmount = window.innerWidth > 700 ? 400 : 250;
    el.scrollBy({ left: scrollAmount * dir, behavior: 'smooth' });
  }
};

function updateWishlistBadge() {
  const badge = document.getElementById('wishlist-badge');
  if (!badge) return;
  if (state.wishlist.length > 0) {
    badge.style.display = 'flex';
    badge.textContent = state.wishlist.length;
  } else {
    badge.style.display = 'none';
  }
}

function renderWishlistDrawer() {
  const body = document.getElementById('wishlist-body');
  if (!body) return;
  
  if (state.wishlist.length === 0) {
    body.innerHTML = `<div class="wishlist-empty">${state.lang === 'es' ? 'Aún no tienes joyas guardadas.' : 'No saved jewelry yet.'}</div>`;
    return;
  }
  
  let html = '';
  state.wishlist.forEach(id => {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    html += `
      <div class="search-result-item" style="position:relative;">
        <img src="${p.imagenes[0]}" class="search-result-img" onclick="window.openModalById('${p.id}')" />
        <div class="search-result-info" onclick="window.openModalById('${p.id}')" style="flex:1;">
          <span class="search-result-name">${p.nombre}</span>
          <span class="search-result-cat">${p.categoria} - ${formatPrice(p.precioPublico)}</span>
        </div>
        <button onclick="window.removeWishlistItem('${p.id}')" style="background:none;border:none;color:var(--color-text-muted);font-size:24px;cursor:pointer;padding:0 10px;">&times;</button>
      </div>
    `;
  });
  body.innerHTML = html;
}

window.removeWishlistItem = function(id) {
  const idx = state.wishlist.indexOf(id);
  if (idx > -1) {
    state.wishlist.splice(idx, 1);
    localStorage.setItem('namna_wishlist', JSON.stringify(state.wishlist));
    updateWishlistBadge();
    renderWishlistDrawer();
    // Actualizar también el botón en la grid si está visible
    document.querySelectorAll(`.wishlist-heart-btn[data-id="${id}"]`).forEach(b => b.classList.remove('active'));
  }
};

window.handleWishlistWhatsAppOrder = function() {
  if (state.wishlist.length === 0) return;
  const items = state.wishlist.map(id => {
    const p = state.products.find(x => x.id === id);
    return p ? `- ${p.nombre} (${p.id})` : id;
  }).join('%0A');
  
  const greeting = state.lang === 'es' ? '¡Hola! Me interesan las siguientes piezas de mi lista de favoritos:' : 'Hello! I am interested in the following pieces from my wishlist:';
  const message = encodeURIComponent(greeting) + '%0A' + items;
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${message}`, '_blank');
};

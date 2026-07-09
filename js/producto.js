/**
 * ================================================================
 * NAMNA JEWERLYWEE — Product Detail Page (producto.js)
 * 
 * Script independiente para producto.html
 * Carga un producto específico via ?id= query parameter
 * Reutiliza la misma fuente de datos (Apps Script / Google Sheets / Caché)
 * ================================================================
 */

// ── CONFIGURACIÓN (duplicada de app.js para independencia) ──
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxAhAWbrLuZudbI18FB-AT0wrk3jp1GNUzpdSP3TybOS_QuRaYsm-zW2-z0yVNYbPhC/exec',
  SHEET_ID: '1Xb29JGt7XgwT_YJ08zusT6kvZs4w5lCn7H1lDlCzxbc',
  WHATSAPP_NUMBER: '34695261649',
  CURRENCY: 'EUR',
  LOCALE: 'es-ES',
  CACHE_DURATION_MS: 30 * 60 * 1000,
  SITE_URL: 'https://www.namnafine.com'
};

const CATEGORY_IMAGE_FALLBACK = {
  'Necklace':   'assets/fallback_necklace.webp',
  'Earrings':   'assets/fallback_earrings.webp',
  'Collares':   'assets/fallback_necklace.webp',
  'Dijes':      'assets/fallback_pendant.webp',
  'Aretes':     'assets/fallback_earrings.webp',
  'Sets':       'assets/fallback_necklace.webp',
  '_default':   'assets/fallback_default.webp'
};

// ── State ──
const state = {
  product: null,
  products: [],
  lang: localStorage.getItem('namna_lang') || 'en',
  textos_es: {},
  textos_en: {}
};

// ── i18n ──
const i18n = {
  es: {
    askPrice: 'Consultar precio',
    onlyLeft: '⚡ Solo quedan {n} unidades',
    outOfStock: 'Agotado',
    orderWhatsApp: 'Pedir por WhatsApp',
    code: 'Código',
    whatsappMessage: '¡Hola! Me interesa la pieza "{name}" (Código: {id}). ¿Podrían darme más información?',
    share: 'Compartir',
    linkCopied: '¡Enlace copiado!',
    notFoundTitle: 'Producto no encontrado',
    notFoundText: 'La pieza que buscas no está disponible o el enlace es incorrecto.',
    viewCollection: 'Ver Colección',
    home: 'Inicio',
    collection: 'Colección',
    loading: 'Cargando pieza...'
  },
  en: {
    askPrice: 'Inquire Price',
    onlyLeft: '⚡ Only {n} units left',
    outOfStock: 'Sold out',
    orderWhatsApp: 'Order via WhatsApp',
    code: 'Code',
    whatsappMessage: 'Hello! I am interested in the piece "{name}" (Code: {id}). Could you provide more information?',
    share: 'Share',
    linkCopied: 'Link copied!',
    notFoundTitle: 'Product not found',
    notFoundText: 'The piece you are looking for is not available or the link is incorrect.',
    viewCollection: 'View Collection',
    home: 'Home',
    collection: 'Collection',
    loading: 'Loading piece...'
  }
};

function t(key, params = {}) {
  let str = i18n[state.lang][key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

function formatPrice(amount) {
  return (!amount || amount <= 0) ? t('askPrice') : `€${amount.toLocaleString(CONFIG.LOCALE)}`;
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

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initHeader();
  initMobileMenu();
  loadProductFromURL();
});

// ── Get product ID from URL ──
function getProductIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// ── Main load function ──
async function loadProductFromURL() {
  const productId = getProductIdFromURL();

  if (!productId) {
    showNotFound();
    return;
  }

  // Try cache first
  const cached = loadFromCache();
  if (cached && cached.length > 0) {
    state.products = cached;
    const product = cached.find(p => p.id === productId);
    if (product) {
      state.product = product;
      renderProduct(product);
      // Background refresh
      refreshInBackground(productId);
      return;
    }
  }

  // No cache or product not found in cache → load from server
  await loadFromServer(productId);
}

// ── Server Loading ──
async function loadFromServer(productId) {
  if (CONFIG.APPS_SCRIPT_URL && CONFIG.APPS_SCRIPT_URL.trim() !== '') {
    try {
      const apiProducts = await fetchFromAppsScript();
      if (apiProducts && apiProducts.length > 0) {
        state.products = apiProducts;
        saveToCache(apiProducts);
        const product = apiProducts.find(p => p.id === productId);
        if (product) {
          state.product = product;
          renderProduct(product);
          return;
        }
      }
    } catch (err) {
      console.warn('⚠️ Apps Script falló:', err.message);
    }
  }

  if (CONFIG.SHEET_ID && CONFIG.SHEET_ID.trim() !== '') {
    try {
      const sheetProducts = await fetchFromGoogleSheets();
      if (sheetProducts && sheetProducts.length > 0) {
        state.products = sheetProducts;
        saveToCache(sheetProducts);
        const product = sheetProducts.find(p => p.id === productId);
        if (product) {
          state.product = product;
          renderProduct(product);
          return;
        }
      }
    } catch (err) {
      console.warn('⚠️ Google Sheets falló:', err.message);
    }
  }

  showNotFound();
}

// ── Background Refresh ──
async function refreshInBackground(productId) {
  try {
    if (!CONFIG.APPS_SCRIPT_URL) return;
    const freshProducts = await fetchFromAppsScript();
    if (freshProducts && freshProducts.length > 0) {
      state.products = freshProducts;
      saveToCache(freshProducts);
      const freshProduct = freshProducts.find(p => p.id === productId);
      if (freshProduct) {
        state.product = freshProduct;
        // Silently update if data changed
        renderProduct(freshProduct);
      }
    }
  } catch (err) {
    // Silent — user already has cached content
  }
}

// ── Fetch from Apps Script (same logic as app.js) ──
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

    if (data.textos) {
      if (data.textos.es) state.textos_es = data.textos.es;
      if (data.textos.en) state.textos_en = data.textos.en;
      if (!data.textos.es && typeof data.textos === 'object') state.textos_es = data.textos;
      updateTranslations();
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

// ── Fetch from Google Sheets (fallback) ──
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
        imagenes: [CATEGORY_IMAGE_FALLBACK[cat_es] || CATEGORY_IMAGE_FALLBACK._default]
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

// ── Cache ──
function saveToCache(data) {
  try {
    const cacheData = { timestamp: Date.now(), items: data, textos_es: state.textos_es, textos_en: state.textos_en };
    localStorage.setItem('namna_catalog', JSON.stringify(cacheData));
  } catch (e) {
    try {
      localStorage.removeItem('namna_catalog');
      const cacheData = { timestamp: Date.now(), items: data, textos_es: state.textos_es, textos_en: state.textos_en };
      localStorage.setItem('namna_catalog', JSON.stringify(cacheData));
    } catch (e2) {}
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
    updateTranslations();
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

// ── Render Product ──
function renderProduct(product) {
  // Hide loader, show detail
  const loader = document.getElementById('product-loader');
  const detail = document.getElementById('product-detail');
  const notFound = document.getElementById('product-not-found');

  if (loader) loader.classList.add('hidden');
  if (notFound) notFound.style.display = 'none';
  if (detail) detail.style.display = '';

  // Breadcrumb
  const breadcrumbName = document.getElementById('breadcrumb-product-name');
  if (breadcrumbName) breadcrumbName.textContent = product.nombre;

  // Main Image
  const mainImg = document.getElementById('product-main-image');
  if (mainImg) {
    mainImg.src = product.imagenes[0];
    mainImg.alt = product.nombre;
    mainImg.onerror = function() {
      this.onerror = null;
      this.src = CATEGORY_IMAGE_FALLBACK[product._categoria_es] || CATEGORY_IMAGE_FALLBACK._default;
    };
  }

  // Fullscreen zoom on main image click
  const mainImgWrapper = document.getElementById('product-main-image-wrapper');
  if (mainImgWrapper) {
    mainImgWrapper.onclick = function() {
      this.classList.toggle('fullscreen');
    };
  }

  // Thumbnails
  const thumbsContainer = document.getElementById('product-thumbnails');
  if (thumbsContainer) {
    thumbsContainer.innerHTML = '';
    if (product.imagenes.length > 1) {
      product.imagenes.forEach((imgUrl, idx) => {
        const thumb = document.createElement('img');
        thumb.src = imgUrl;
        thumb.alt = `${product.nombre} - ${idx + 1}`;
        thumb.className = `product-detail-thumb ${idx === 0 ? 'active' : ''}`;
        thumb.addEventListener('click', () => {
          mainImg.src = imgUrl;
          thumbsContainer.querySelectorAll('.product-detail-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
        });
        thumbsContainer.appendChild(thumb);
      });
    }
  }

  // Category
  const catEl = document.getElementById('product-category');
  if (catEl) catEl.textContent = getSingularCategory(product.categoria);

  // Name
  const nameEl = document.getElementById('product-name');
  if (nameEl) nameEl.textContent = product.nombre;

  // Price
  const priceEl = document.getElementById('product-price');
  if (priceEl) priceEl.textContent = `${formatPrice(product.precioPublico)} ${CONFIG.CURRENCY}`;

  // Stock
  const stockEl = document.getElementById('product-stock-info');
  if (stockEl) {
    stockEl.innerHTML = '';
    if (product.stock !== null) {
      if (product.stock > 0 && product.stock <= 10) {
        stockEl.innerHTML = `<p class="product-detail-stock warning">${t('onlyLeft', { n: product.stock })}</p>`;
      } else if (product.stock <= 0) {
        stockEl.innerHTML = `<p class="product-detail-stock muted">${t('outOfStock')}</p>`;
      }
    }
  }

  // Description
  const descEl = document.getElementById('product-description');
  if (descEl) {
    if (product.descripcion) {
      if (product.descripcion.includes('\n')) {
        const listItems = product.descripcion.split('\n').filter(l => l.trim()).map(line => `<li>${line.trim()}</li>`).join('');
        descEl.innerHTML = `<ul class="product-detail-desc-list">${listItems}</ul>`;
      } else {
        descEl.innerHTML = `<p>${product.descripcion}</p>`;
      }
    }
  }

  // Actions (WhatsApp button)
  const actionsEl = document.getElementById('product-actions-buttons');
  if (actionsEl) {
    if (product.stock !== null && product.stock <= 0) {
      actionsEl.innerHTML = `
        <button class="modal-cta" disabled style="background: var(--color-text-muted); cursor: not-allowed; opacity: 0.8;">
          ${t('outOfStock')}
        </button>
      `;
    } else {
      actionsEl.innerHTML = `
        <button class="modal-cta" id="product-whatsapp-btn">
          <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" fill="currentColor"/></svg>
          ${t('orderWhatsApp')}
        </button>
      `;
      document.getElementById('product-whatsapp-btn').addEventListener('click', () => {
        const message = encodeURIComponent(t('whatsappMessage', { name: product.nombre, id: product.id }));
        window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${message}`, '_blank');
      });
    }
  }

  // Share button
  const shareBtn = document.getElementById('product-share-btn');
  const shareBtnText = document.getElementById('share-btn-text');
  if (shareBtn) {
    if (shareBtnText) shareBtnText.textContent = t('share');
    shareBtn.addEventListener('click', () => shareProduct(product));
  }

  // Code
  const codeEl = document.getElementById('product-code');
  if (codeEl) codeEl.textContent = `${t('code')}: ${product.id}`;

  // ── Update SEO Meta Tags ──
  updateMetaTags(product);

  // ── Page title ──
  document.title = `${product.nombre} — NAMNA Fine Jewelry`;
}

// ── Update Meta Tags for SEO / Social Sharing ──
function updateMetaTags(product) {
  const productUrl = `${CONFIG.SITE_URL}/producto?id=${encodeURIComponent(product.id)}`;
  const desc = product.descripcion || `${getSingularCategory(product.categoria)} by NAMNA Fine Jewelry. 18k gold with natural stones.`;
  const image = product.imagenes[0];

  // Standard meta
  const metaDesc = document.getElementById('meta-description');
  if (metaDesc) metaDesc.content = desc;

  const canonical = document.getElementById('meta-canonical');
  if (canonical) canonical.href = productUrl;

  // Open Graph
  const ogTitle = document.getElementById('og-title');
  if (ogTitle) ogTitle.content = `${product.nombre} — NAMNA Fine Jewelry`;

  const ogDesc = document.getElementById('og-description');
  if (ogDesc) ogDesc.content = desc;

  const ogUrl = document.getElementById('og-url');
  if (ogUrl) ogUrl.content = productUrl;

  const ogImage = document.getElementById('og-image');
  if (ogImage) ogImage.content = image;

  // Twitter
  const twTitle = document.getElementById('tw-title');
  if (twTitle) twTitle.content = `${product.nombre} — NAMNA Fine Jewelry`;

  const twDesc = document.getElementById('tw-description');
  if (twDesc) twDesc.content = desc;

  const twImage = document.getElementById('tw-image');
  if (twImage) twImage.content = image;

  // Schema.org Product
  const schemaEl = document.getElementById('product-schema');
  if (schemaEl) {
    schemaEl.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.nombre,
      "image": product.imagenes,
      "description": desc,
      "brand": { "@type": "Brand", "name": "NAMNA Fine Jewelry" },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "EUR",
        "price": product.precioPublico || 0,
        "availability": (product.stock !== null && product.stock <= 0)
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
        "url": productUrl,
        "seller": { "@type": "Organization", "name": "NAMNA Fine Jewelry" }
      }
    });
  }

  // Schema.org Breadcrumb
  const breadcrumbSchema = document.getElementById('breadcrumb-schema');
  if (breadcrumbSchema) {
    breadcrumbSchema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "NAMNA Fine Jewelry", "item": `${CONFIG.SITE_URL}/` },
        { "@type": "ListItem", "position": 2, "name": state.lang === 'es' ? 'Colección' : 'Collection', "item": `${CONFIG.SITE_URL}/index.html#catalogo` },
        { "@type": "ListItem", "position": 3, "name": product.nombre, "item": productUrl }
      ]
    });
  }
}

// ── Share Product ──
function shareProduct(product) {
  const shareUrl = `${CONFIG.SITE_URL}/producto?id=${encodeURIComponent(product.id)}`;

  // Try native Web Share API first (mobile)
  if (navigator.share) {
    navigator.share({
      title: `${product.nombre} — NAMNA Fine Jewelry`,
      text: product.descripcion || `${getSingularCategory(product.categoria)} by NAMNA Fine Jewelry`,
      url: shareUrl
    }).catch(() => {
      // User cancelled or error — fallback to clipboard
      copyToClipboard(shareUrl);
    });
  } else {
    copyToClipboard(shareUrl);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showShareToast();
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
    showShareToast();
  });
}

function showShareToast() {
  const toast = document.getElementById('share-toast');
  const toastText = document.getElementById('share-toast-text');
  if (!toast) return;

  if (toastText) toastText.textContent = t('linkCopied');
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ── Show Not Found ──
function showNotFound() {
  const loader = document.getElementById('product-loader');
  const detail = document.getElementById('product-detail');
  const notFound = document.getElementById('product-not-found');

  if (loader) loader.classList.add('hidden');
  if (detail) detail.style.display = 'none';
  if (notFound) {
    notFound.style.display = '';
    const title = document.getElementById('not-found-title');
    const text = document.getElementById('not-found-text');
    const btn = document.getElementById('not-found-btn');
    if (title) title.textContent = t('notFoundTitle');
    if (text) text.textContent = t('notFoundText');
    if (btn) btn.querySelector('span').textContent = t('viewCollection');
  }

  document.title = `${t('notFoundTitle')} — NAMNA Fine Jewelry`;
}

// ── i18n ──
function initI18n() {
  const langBtns = document.querySelectorAll('.lang-toggle');
  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.classList.add('lang-switching');
      setTimeout(() => {
        state.lang = state.lang === 'es' ? 'en' : 'es';
        localStorage.setItem('namna_lang', state.lang);
        updateTranslations();
        // Re-render product with new language
        if (state.product) renderProduct(state.product);
        setTimeout(() => {
          document.body.classList.remove('lang-switching');
        }, 20);
      }, 100);
    });
  });
  updateTranslations();
}

function updateTranslations() {
  document.querySelectorAll('#current-lang').forEach(el => {
    el.textContent = state.lang === 'es' ? '🇪🇸 ES' : '🇬🇧 EN';
  });

  document.documentElement.lang = state.lang;

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

  // Update inline i18n elements
  document.querySelectorAll('[data-txt-inline]').forEach(el => {
    const key = el.getAttribute('data-txt-inline');
    if (i18n[state.lang][key]) {
      el.textContent = i18n[state.lang][key];
    }
  });

  // Translate generic WhatsApp links
  const waMsg = state.lang === 'en'
    ? "Hello! I am interested in knowing more about your jewelry."
    : "¡Hola! Estoy interesado en conocer más información sobre sus joyas.";
  document.querySelectorAll('.whatsapp-float, .footer-links a[href^="https://wa.me"], .mobile-nav-footer a[href^="https://wa.me"]').forEach(a => {
    a.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;
  });
}

// ── Header ──
function initHeader() {
  const header = document.getElementById('main-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
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
    panel.classList.contains('active') ? closeMenu() : openMenu();
  });

  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);

  panel.querySelectorAll('.mobile-nav-links a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('active')) closeMenu();
  });
}

// ── Global error handler for Drive images ──
document.addEventListener('error', function(e) {
  if (e.target.tagName === 'IMG' && e.target.src.includes('drive.google.com')) {
    e.target.src = CATEGORY_IMAGE_FALLBACK._default;
    e.target.style.opacity = '1';
  }
}, true);

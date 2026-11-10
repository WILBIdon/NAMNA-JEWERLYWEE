/**
 * ════════════════════════════════════════════════════════════════
 * NAMNA — configuración única del sitio
 *
 * Antes esto estaba copiado en app.js, producto.js, admin.html y
 * panel.html. Ahora vive solo aquí: se carga ANTES que el resto de
 * scripts y los demás leen window.NAMNA_CONFIG.
 *
 * Cárgalo así, siempre primero:
 *   <script src="js/config.js"></script>
 * ════════════════════════════════════════════════════════════════
 */
window.NAMNA_CONFIG = {

  // ── Supabase (fuente de verdad desde noviembre de 2026) ──
  // La anon key es pública por diseño: el RLS es lo que protege los
  // datos. Nunca pongas aquí la service_role.
  SUPABASE_URL: 'https://mublwuvrpyztgblxqrmn.supabase.co',
  SUPABASE_ANON_KEY: '',     // ← pegar aquí la anon/public key (Project Settings · API Keys)

  // ── Google Apps Script (respaldo durante la transición) ──
  // Se usa solo si Supabase no está configurado o falla. Cuando la
  // migración lleve unas semanas estable, se puede vaciar.
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxw6YuRZnb-xskmMK3lMn3DpPczY77gE8vm9m-u69_Avfg3Iv2pNtlMskxSwnVVmIGT/exec',
  SHEET_ID: '1Xb29JGt7XgwT_YJ08zusT6kvZs4w5lCn7H1lDlCzxbc',

  // ── Negocio ──
  WHATSAPP_NUMBER: '34695261649',
  CURRENCY: 'EUR',
  LOCALE: 'es-ES',

  // ── Caché del navegador ──
  // Con Supabase las consultas tardan ~80 ms, así que la caché pasa a
  // ser solo un acelerador de la primera pintura, no un parche contra
  // la lentitud. 10 min en vez de 6 h: publicar vuelve a ser inmediato.
  CACHE_DURATION_MS: 10 * 60 * 1000,
  CACHE_DURATION_FALLBACK_MS: 6 * 60 * 60 * 1000,  // si toca tirar de Apps Script

  // ── Analítica (vacío = desactivada) ──
  GOOGLE_ANALYTICS_ID: '',
  META_PIXEL_ID: ''
};

/** true cuando Supabase está configurado y se puede usar. */
window.NAMNA_CONFIG.usaSupabase = !!(
  window.NAMNA_CONFIG.SUPABASE_URL && window.NAMNA_CONFIG.SUPABASE_ANON_KEY
);

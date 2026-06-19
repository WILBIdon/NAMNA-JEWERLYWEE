/**
 * ================================================================
 * NAMNA JEWERLYWEE — Security Shield (Escudo Anti-Clonación)
 * ================================================================
 * Protecciones:
 * 1. Bloqueo de clic derecho (menú contextual)
 * 2. Bloqueo de selección de texto en contenido sensible
 * 3. Bloqueo de atajos de teclado (Ctrl+U, Ctrl+S, F12, etc.)
 * 4. Bloqueo de arrastre de imágenes
 * 5. Detección de DevTools abierto
 * 6. Protección de consola con advertencia
 * 7. Ofuscación de la estructura del DOM visible
 * 
 * NOTA: No interfiere con la funcionalidad normal del sitio.
 * ================================================================
 */

(function() {
  'use strict';

  // ── 1. Bloquear clic derecho ──
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  });

  // ── 2. Bloquear selección de texto (excepto en inputs/textareas del formulario) ──
  document.addEventListener('selectstart', function(e) {
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    e.preventDefault();
    return false;
  });

  // ── 3. Bloquear atajos de teclado peligrosos ──
  document.addEventListener('keydown', function(e) {
    // F12 (DevTools)
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I (Inspeccionar), Ctrl+Shift+J (Consola), Ctrl+Shift+C (Selector)
    if (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) {
      e.preventDefault();
      return false;
    }

    // Ctrl+U (Ver fuente)
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+S (Guardar página)
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+A (Seleccionar todo) — solo fuera de inputs
    if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        e.preventDefault();
        return false;
      }
    }

    // Ctrl+P (Imprimir)
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      return false;
    }

    // Cmd equivalents for Mac
    if (e.metaKey) {
      if (e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) {
        e.preventDefault();
        return false;
      }
      if (['u','U','s','S','p','P'].includes(e.key)) {
        e.preventDefault();
        return false;
      }
      if ((e.key === 'a' || e.key === 'A') && !['input','textarea'].includes(document.activeElement?.tagName?.toLowerCase())) {
        e.preventDefault();
        return false;
      }
    }
  });

  // ── 4. Bloquear arrastre de imágenes ──
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  });

  // Prevenir que se copien imágenes vía clic derecho o arrastre
  document.addEventListener('DOMContentLoaded', function() {
    // Deshabilitar arrastre en todas las imágenes
    document.querySelectorAll('img').forEach(function(img) {
      img.setAttribute('draggable', 'false');
      img.style.pointerEvents = 'auto'; // Mantener clics funcionales
    });

    // Observar nuevas imágenes que se añadan dinámicamente
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            if (node.tagName === 'IMG') {
              node.setAttribute('draggable', 'false');
            }
            node.querySelectorAll && node.querySelectorAll('img').forEach(function(img) {
              img.setAttribute('draggable', 'false');
            });
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  // ── 5. Protección de consola ──
  const warningStyle = 'color:#E78A5E;font-size:2rem;font-weight:bold;text-shadow:1px 1px 2px rgba(0,0,0,0.2)';
  const bodyStyle = 'color:#3B4643;font-size:1rem';

  console.log('%c⚠️ ALTO', warningStyle);
  console.log('%cEsta es una función del navegador destinada a desarrolladores.', bodyStyle);
  console.log('%cSi alguien te dijo que copiaras y pegaras algo aquí, es una estafa.', bodyStyle);
  console.log('%c© NAMNA Jewelry — Todos los derechos reservados.', 'color:#6B7A76;font-size:0.8rem');

  // ── 6. CSS anti-selección y anti-copia ──
  const shieldStyle = document.createElement('style');
  shieldStyle.textContent = `
    /* Anti-selección global (excepto formularios) */
    body {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    
    /* Permitir selección en inputs y textareas */
    input, textarea, [contenteditable="true"] {
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      user-select: text;
    }
    
    /* Proteger imágenes */
    img {
      -webkit-user-drag: none;
      -khtml-user-drag: none;
      -moz-user-drag: none;
      -o-user-drag: none;
      user-drag: none;
    }

    /* Prevenir impresión directa de la página */
    @media print {
      body {
        display: none !important;
      }
      html::after {
        content: "© NAMNA Jewelry — Contenido protegido. Impresión no autorizada.";
        display: block;
        text-align: center;
        padding: 4rem;
        font-size: 1.5rem;
        color: #3B4643;
      }
    }
  `;
  document.head.appendChild(shieldStyle);

  // ── 7. Detección básica de DevTools ──
  let devtoolsOpen = false;
  const threshold = 160;

  function checkDevTools() {
    const widthCheck = window.outerWidth - window.innerWidth > threshold;
    const heightCheck = window.outerHeight - window.innerHeight > threshold;
    
    if (widthCheck || heightCheck) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        console.clear();
        console.log('%c⚠️ NAMNA Jewelry', warningStyle);
        console.log('%cEste sitio está protegido. La inspección del código no está autorizada.', bodyStyle);
      }
    } else {
      devtoolsOpen = false;
    }
  }

  // Verificar cada 2 segundos (bajo impacto de rendimiento)
  setInterval(checkDevTools, 2000);

  // ── 8. Proteger contra iframe embedding (clickjacking) ──
  if (window.self !== window.top) {
    // La página está siendo embebida en un iframe externo
    document.body.innerHTML = '<div style="padding:4rem;text-align:center;font-family:sans-serif;"><h1>⚠️ Acceso no autorizado</h1><p>Este contenido no puede ser embebido.</p><a href="https://wilbidon.github.io/NAMNA-JEWERLYWEE/">Visitar NAMNA Jewelry</a></div>';
  }

  // ── 9. Deshabilitar view-source vía URL ──
  if (window.location.protocol === 'view-source:') {
    window.location.href = 'about:blank';
  }

})();

/**
 * Pont ECLAIR (uciel.php) ↔ extension, chargé à document_start.
 *
 * ECLAIR sonde la présence d'une extension OLAF via un attribut sur <html>
 * et un échange postMessage (uciel_olaf_ext_banner.js). On y répond pour que
 * le bandeau de statut (visible pour certains rôles) reflète l'extension.
 * Contrairement à « OLAF Check », on ne se désactive pas selon le flag
 * bêta-testeur posé par le serveur.
 */
(function () {
  'use strict';

  const rt = (typeof browser !== 'undefined' ? browser : chrome).runtime;
  const PAGE_SOURCE = 'uciel';
  const EXT_SOURCE = 'olaf-ciel-ext';

  function version() {
    try { return String((rt.getManifest() || {}).version || ''); } catch (e) { return ''; }
  }

  function mark() {
    try {
      const root = document.documentElement;
      root.setAttribute('data-olaf-ciel-ext', '1');
      root.setAttribute('data-olaf-ciel-ext-ver', version());
    } catch (e) { /* ignore */ }
  }

  async function status() {
    const base = { installed: true, version: version(), olafOpen: false, olafConnected: false, ready: false };
    try {
      const r = await rt.sendMessage({ type: 'olaf-status' });
      if (r && r.connected) {
        base.olafOpen = true;
        base.olafConnected = true;
        base.ready = true;
      }
    } catch (e) { /* background indisponible */ }
    return base;
  }

  async function reply(requestId) {
    const s = await status();
    window.postMessage({ source: EXT_SOURCE, type: 'olaf-ciel-status', requestId: requestId || null, status: s },
      window.location.origin);
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== PAGE_SOURCE) return;
    if (d.type === 'olaf-ciel-status-request' || d.type === 'olaf-ciel-ping') reply(d.requestId);
  });
  window.addEventListener('olaf-ciel-status-request', (ev) => {
    reply(ev && ev.detail ? ev.detail.requestId : null);
  });

  mark();
  reply(null);
})();

/**
 * Orchestrateur principal
 *
 * Les contours (ICN_OUTLINE) et les étoiles (ICN_REMPLA_DISPLAY)
 * ne sont (re)calculés que dans ces cas précis :
 *  1. Arrivée sur la page (init) — avec auto-chargement OLAF si activé
 *  2. Changement de mois détecté par l'observer
 *  3. Appel explicite à window.ICN_MAIN.applyAll() par PanelHandlers
 *     (bouton "Mettre à jour les contours", ajout/retrait classe alpha/beta)
 */
(async function() {
  let tableObserver = null;

  async function getEnabled() {
    const r = await window.ICN_STORAGE.get('icn_enabled');
    return Boolean(r.icn_enabled);
  }

  // ── Helpers OLAF ──────────────────────────────────────────────────────────

  async function autoLoadOlaf(monthLabel) {
    const settings = await window.ICN_STORAGE.get(['icn_olaf_autoload', 'olaf_login', 'olaf_pass', 'icn_olaf_cible']);
    if (!settings.icn_olaf_autoload || !settings.olaf_login || !settings.olaf_pass) return false;

    const parser = new CielParser();
    const parsed = parser.parseMonthLabel(monthLabel);
    if (!parsed) return false;

    const { year, month } = parsed;
    try {
      const olafReport = await window.ICN_OLAF.buildReport({
        login: settings.olaf_login,
        pass: settings.olaf_pass,
        year,
        month,
        cible: settings.icn_olaf_cible
      });
      if (!olafReport.ok) {
        window.ICN_DEBUG.error('[ICN] Auto-load OLAF échoué:', olafReport.error);
        return false;
      }
      const olafDataToStore = {};
      for (const day of olafReport.days || []) {
        olafDataToStore[day.day_str] = { alpha: day.alpha, beta: day.beta };
      }
      await window.ICN_STORAGE.set({ icn_olaf_data: olafDataToStore });
      window.ICN_DEBUG.log('[ICN] ✅ Auto-load OLAF réussi');
      return true;
    } catch (err) {
      window.ICN_DEBUG.error('[ICN] Erreur auto-load OLAF:', err.message || err);
      return false;
    }
  }

  // ── Application des contours ──────────────────────────────────────────────

  async function applyAll() {
    const enabled = await getEnabled();
    if (!enabled) return;
    if (window.ICN_OUTLINE)        await window.ICN_OUTLINE.apply();
    if (window.ICN_REMPLA_DISPLAY) await window.ICN_REMPLA_DISPLAY.apply();
  }

  // ── Observer : détecte uniquement le changement de mois ──────────────────

  function installObservers() {
    const table = window.ICN_DOM.getCielTable();
    if (!table) return;

    let lastMonthLabel = window.ICN_DOM.getMonthLabel();

    tableObserver = new MutationObserver(async (mutations) => {
      // Ignorer les mutations issues de nos propres éléments
      const isOnlyOurs = mutations.every(m =>
        [...m.addedNodes, ...m.removedNodes].every(n =>
          n.nodeType === 1 && n.hasAttribute && n.hasAttribute('data-icn-ignore')
        )
      );
      if (isOnlyOurs) return;

      const currentMonthLabel = window.ICN_DOM.getMonthLabel();
      if (currentMonthLabel === lastMonthLabel) return; // Pas de changement de mois → rien à faire

      window.ICN_DEBUG.log('[ICN] Mois changé:', lastMonthLabel, '→', currentMonthLabel);
      lastMonthLabel = currentMonthLabel;

      // Recharger les settings du panel
      if (window.ICN_PANEL_UI?.panel) await window.ICN_PANEL_UI.loadSettings();

      // Auto-load OLAF si activé puis appliquer les contours
      await autoLoadOlaf(currentMonthLabel);
      await applyAll();
    });

    tableObserver.observe(table, { childList: true, subtree: true });
  }

  function disconnectObserver() {
    if (tableObserver) tableObserver.disconnect();
  }

  function reconnectObserver() {
    const table = window.ICN_DOM.getCielTable();
    if (table && tableObserver) tableObserver.observe(table, { childList: true, subtree: true });
  }

  // ── Message handler ───────────────────────────────────────────────────────

  browser.runtime.onMessage.addListener(async (msg) => {
    if (!msg) return;

    if (msg.type === 'ICN_TOGGLE') {
      const enabled = Boolean(msg.enabled);
      await window.ICN_STORAGE.set({ icn_enabled: enabled });
      if (enabled) {
        await applyAll();
      } else {
        if (window.ICN_OUTLINE)        await window.ICN_OUTLINE.clearAll();
        if (window.ICN_REMPLA_DISPLAY) await window.ICN_REMPLA_DISPLAY.clearAll();
      }
      return;
    }

    if (msg.type === 'ICN_REFRESH_OUTLINES') {
      await applyAll();
      return;
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    try {
      window.ICN_DEBUG.log('[ICN] Initializing...');

      await window.ICN_PANEL_UI.create();
      const handlers = new window.ICN_PANEL_HANDLERS(window.ICN_PANEL_UI);
      await handlers.attach();

      // Auto-load OLAF si activé (avant d'appliquer les contours)
      const monthLabel = window.ICN_DOM.getMonthLabel();
      await autoLoadOlaf(monthLabel);

      // Appliquer les contours à l'arrivée
      await applyAll();

      installObservers();
      window.ICN_DEBUG.log('[ICN] ✅ Init complete');
    } catch (err) {
      window.ICN_DEBUG.error('[ICN] ❌ Init failed:', err.message, err.stack);
    }
  }

  // ── Détection changement d'URL ────────────────────────────────────────────

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    window.ICN_DEBUG.log('[ICN] URL changée, réinitialisation...');
    setTimeout(async () => {
      if (window.ICN_PANEL_UI?.panel) await window.ICN_PANEL_UI.loadSettings();
      const monthLabel = window.ICN_DOM.getMonthLabel();
      await autoLoadOlaf(monthLabel);
      await applyAll();
    }, 500);
  }).observe(document, { subtree: true, childList: true });

  // ── Exports ───────────────────────────────────────────────────────────────

  window.ICN_MAIN = {
    disconnectObserver,
    reconnectObserver,
    applyAll   // exposé pour PanelHandlers (bouton + ajout classe)
  };

  await init();
})();

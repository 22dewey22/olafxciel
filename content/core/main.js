/**
 * Orchestrateur.
 *
 * Contours et étoiles sont (re)calculés :
 *  1. à l'arrivée sur la page (avec auto-chargement OLAF si activé) ;
 *  2. quand ECLAIR remplace la grille (événement `uciel:grid-updated`, ou
 *     remplacement de table#ciel détecté par observer) ;
 *  3. sur action explicite du panneau (ICN_MAIN.applyAll()).
 */
(async function () {
  let lastPeriodKey = '';
  let olafPeriodKey = '';   // période couverte par les données OLAF en mémoire
  let busy = false;
  let pendingReason = null;
  let hostObserver = null;

  async function getEnabled() {
    const r = await window.ICN_STORAGE.get('icn_enabled');
    return r.icn_enabled === undefined ? true : Boolean(r.icn_enabled);
  }

  // ── OLAF ──────────────────────────────────────────────────────────────────

  /**
   * Charge OLAF pour la période affichée. { force } ignore le cache mémoire.
   */
  async function loadOlaf({ force = false } = {}) {
    const period = window.ICN_DOM.getPeriod();
    if (!period) return { ok: false, error: 'Période CIEL introuvable' };
    if (!force && olafPeriodKey === period.key && window.ICN_OUTLINE.hasOlafData()) {
      return { ok: true, cached: true, days: Object.keys(window.ICN_OUTLINE.getOlafData()).length };
    }

    const cible = await window.ICN_OLAF.detectCible();
    if (!cible.ok) return { ok: false, error: cible.error };

    let report = await window.ICN_OLAF.buildReport({ months: period.months, cible: cible.cible });
    if (!report.ok && cible.cached) {
      // La cible mémorisée peut être périmée : on la redétecte une fois
      const again = await window.ICN_OLAF.detectCible(true);
      if (again.ok) report = await window.ICN_OLAF.buildReport({ months: period.months, cible: again.cible });
    }
    if (!report.ok) return { ok: false, error: report.error };

    const data = {};
    for (const d of report.days || []) data[d.day_str] = { alpha: d.alpha, beta: d.beta };
    window.ICN_OUTLINE.setOlafData(data);
    olafPeriodKey = period.key;
    await applyAll();
    return { ok: true, days: Object.keys(data).length };
  }

  async function autoLoadIfEnabled() {
    const s = await window.ICN_STORAGE.get('icn_olaf_autoload');
    const autoload = s.icn_olaf_autoload === undefined ? true : Boolean(s.icn_olaf_autoload);
    if (!autoload) return;
    const status = await window.ICN_OLAF_PROXY.status();
    if (window.ICN_PANEL_UI?.panel) window.ICN_PANEL_UI.setConnection(status);
    if (!status.connected) return;
    const r = await loadOlaf();
    if (!r.ok) window.ICN_DEBUG.warn('[ICN] auto-load OLAF :', r.error);
    else if (!r.cached && window.ICN_PANEL_UI?.panel) window.ICN_PANEL_UI.showStatus(`OLAF chargé (${r.days} jour(s))`, 'success');
  }

  // ── Contours ──────────────────────────────────────────────────────────────

  async function applyAll() {
    if (!(await getEnabled())) return;
    if (busy) { pendingReason = 'queued'; return; }
    busy = true;
    try {
      if (window.ICN_OUTLINE) await window.ICN_OUTLINE.apply();
      if (window.ICN_REMPLA_DISPLAY) await window.ICN_REMPLA_DISPLAY.apply();
    } catch (e) {
      window.ICN_DEBUG.error('[ICN] applyAll :', e);
    } finally {
      busy = false;
      if (pendingReason) { pendingReason = null; setTimeout(() => applyAll(), 50); }
    }
  }

  async function clearAll() {
    if (window.ICN_OUTLINE) await window.ICN_OUTLINE.clearAll();
    if (window.ICN_REMPLA_DISPLAY) window.ICN_REMPLA_DISPLAY.clearAll();
    window.ICN_DOM.eclairRemerge();
  }

  // ── Changement de grille / période ────────────────────────────────────────

  let debounceTimer = null;
  function onGridChanged(reason) {
    if (busy) return; // nos propres mutations (défusion/refusion, pastilles)
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const period = window.ICN_DOM.getPeriod();
      if (!period) return;
      window.ICN_DOM.invalidateCaches();
      const periodChanged = period.key !== lastPeriodKey;
      lastPeriodKey = period.key;
      window.ICN_DEBUG.log('[ICN] grille mise à jour (' + reason + ')', periodChanged ? 'nouvelle période ' + period.key : 'même période');
      if (periodChanged) {
        if (window.ICN_PANEL_HANDLERS_INSTANCE) await window.ICN_PANEL_HANDLERS_INSTANCE.renderCycle();
        await autoLoadIfEnabled();
      }
      await applyAll();
      installHostObserver();
    }, 250);
  }

  function installHostObserver() {
    const table = window.ICN_DOM.getCielTable();
    if (!table || !table.parentNode) return;
    if (hostObserver && hostObserver._target === table.parentNode) return;
    if (hostObserver) hostObserver.disconnect();
    hostObserver = new MutationObserver((mutations) => {
      const swapped = mutations.some(m =>
        [...m.addedNodes].some(n => n.nodeType === 1 && (n.id === 'ciel' || (n.querySelector && n.querySelector('table#ciel')))));
      if (swapped) onGridChanged('host-mutation');
    });
    hostObserver.observe(table.parentNode, { childList: true });
    hostObserver._target = table.parentNode;
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    if (!window.ICN_DOM.getCielTable()) {
      window.ICN_DEBUG.log('[ICN] pas de table#ciel, extension inactive sur cette page');
      return;
    }
    await window.ICN_PANEL_UI.create();
    const handlers = new window.ICN_PANEL_HANDLERS(window.ICN_PANEL_UI);
    window.ICN_PANEL_HANDLERS_INSTANCE = handlers;
    await handlers.attach();

    const period = window.ICN_DOM.getPeriod();
    lastPeriodKey = period ? period.key : '';

    await autoLoadIfEnabled();
    await applyAll();

    document.addEventListener('uciel:grid-updated', () => onGridChanged('uciel:grid-updated'));
    installHostObserver();
    window.ICN_DEBUG.log('[ICN] prêt');
  }

  window.ICN_MAIN = { applyAll, clearAll, loadOlaf };

  try {
    await init();
  } catch (e) {
    window.ICN_DEBUG.error('[ICN] init :', e);
  }
})();

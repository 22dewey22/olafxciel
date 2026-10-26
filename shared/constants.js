/**
 * Polyfill Chrome : `browser` → `chrome`
 */
if (typeof browser === 'undefined') {
  // eslint-disable-next-line no-var
  var browser = chrome;
}

/**
 * Debug global — doit être défini en premier.
 */
window.ICN_DEBUG = {
  enabled: false,
  log(...args)  { if (this.enabled) console.log(...args); },
  warn(...args) { if (this.enabled) console.warn(...args); },
  info(...args) { if (this.enabled) console.info(...args); },
  error(...args) { console.error(...args); }
};

/**
 * Storage avec repli automatique : browser.storage → localStorage → mémoire.
 */
(function () {
  const memoryStorage = {};
  const PREFIX = 'icn_';

  window.ICN_STORAGE = {
    async get(keys) {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      try {
        return await browser.storage.local.get(keys);
      } catch (e) {
        window.ICN_DEBUG.warn('[ICN-STORAGE] browser.storage.get KO:', e.message);
      }
      try {
        const result = {};
        for (const key of keyArray) {
          const v = localStorage.getItem(PREFIX + key);
          if (v !== null) { try { result[key] = JSON.parse(v); } catch (e) { result[key] = v; } }
        }
        return result;
      } catch (e) {
        window.ICN_DEBUG.warn('[ICN-STORAGE] localStorage.get KO:', e.message);
      }
      const result = {};
      for (const key of keyArray) if (key in memoryStorage) result[key] = memoryStorage[key];
      return result;
    },

    async set(items) {
      try { await browser.storage.local.set(items); return; }
      catch (e) { window.ICN_DEBUG.warn('[ICN-STORAGE] browser.storage.set KO:', e.message); }
      try {
        for (const key of Object.keys(items)) localStorage.setItem(PREFIX + key, JSON.stringify(items[key]));
        return;
      } catch (e) { window.ICN_DEBUG.warn('[ICN-STORAGE] localStorage.set KO:', e.message); }
      Object.assign(memoryStorage, items);
    },

    async remove(keys) {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      try { await browser.storage.local.remove(keys); }
      catch (e) { window.ICN_DEBUG.warn('[ICN-STORAGE] browser.storage.remove KO:', e.message); }
      try { for (const key of keyArray) localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
      for (const key of keyArray) delete memoryStorage[key];
    }
  };
})();

window.ICN_CONST = {
  KEY_ENABLED: 'icn_enabled',
  KEY_CYCLE_OVERRIDE: 'icn_cycle_override',

  // Repli si la page ne publie pas sa config cycle
  DEFAULT_CYCLE_CONFIG: {
    cycleStartDate: '2008-09-11',
    cycleLength: 12,
    workingDays: [1, 2, 3, 6, 7, 8, 12],
    source: 'default'
  },

  /**
   * Config cycle publiée par ECLAIR : <script type="application/json" id="uciel-olaf-cycle-config">
   * { cycleStartDate, cycleLength, workingDays, j1RefTs, source:"uciel" }
   */
  getPageCycleConfig() {
    try {
      const el = document.getElementById('uciel-olaf-cycle-config');
      if (!el) return null;
      const cfg = JSON.parse(el.textContent || '');
      if (!cfg || !cfg.cycleStartDate || !cfg.cycleLength) return null;
      return {
        cycleStartDate: String(cfg.cycleStartDate),
        cycleLength: parseInt(cfg.cycleLength, 10),
        workingDays: Array.isArray(cfg.workingDays) ? cfg.workingDays.map(Number) : [],
        source: cfg.source || 'uciel'
      };
    } catch (e) {
      return null;
    }
  },

  /**
   * Config effective = config page (ou défaut) + surcharge éventuelle des jours
   * travaillés choisie par l'utilisateur dans les paramètres.
   */
  async getCycleConfig() {
    const base = this.getPageCycleConfig() || this.DEFAULT_CYCLE_CONFIG;
    let override = null;
    try {
      const r = await window.ICN_STORAGE.get(this.KEY_CYCLE_OVERRIDE);
      override = r[this.KEY_CYCLE_OVERRIDE] || null;
    } catch (e) { /* ignore */ }
    if (override && Array.isArray(override.workingDays) && override.workingDays.length
        && override.cycleLength === base.cycleLength) {
      return Object.assign({}, base, { workingDays: override.workingDays.slice(), overridden: true });
    }
    return Object.assign({}, base, { overridden: false });
  },

  // Jour dans le cycle (1..cycleLength) pour une date ISO, par arithmétique
  getDayInCycle(dateStr, cycleStartDate, cycleLength) {
    const start = Date.UTC(...cycleStartDate.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v)));
    const cur = Date.UTC(...dateStr.split('-').map((v, i) => i === 1 ? Number(v) - 1 : Number(v)));
    const diffDays = Math.round((cur - start) / 86400000);
    return ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;
  },

  /**
   * Jour travaillé ? Priorité au numéro de cycle affiché par ECLAIR dans la
   * ligne J1/J2… (data-ciel-jc), sinon arithmétique sur la config.
   */
  isWorkingDay(dateStr, config) {
    let jc = null;
    if (window.ICN_DOM && window.ICN_DOM.getJcForDate) jc = window.ICN_DOM.getJcForDate(dateStr);
    if (jc == null) jc = this.getDayInCycle(dateStr, config.cycleStartDate, config.cycleLength);
    return config.workingDays.includes(jc);
  },

  // Contours
  OUTLINE_ALPHA_DEFAULT:   '2px solid #25b6eb',
  OUTLINE_ALPHA_VALIDATED: '2px solid #15803d',
  OUTLINE_ALPHA_PENDING:   '2px solid #faa92e',
  OUTLINE_ALPHA_INVALID:   '2px solid #ef4444',
  OUTLINE_BETA_DEFAULT:    '2px solid #25b6eb',
  OUTLINE_BETA_VALID:      '2px solid #15803d',
  OUTLINE_BETA_INVALID:    '2px solid #ef4444',
  OUTLINE_TYPE_MISMATCH:   '2px solid #a855f7',

  SHADOW_ALPHA_DEFAULT:   '0 0 8px rgba(37, 182, 235, 0.5)',
  SHADOW_ALPHA_VALIDATED: '0 0 8px rgba(21, 128, 61, 0.5)',
  SHADOW_ALPHA_PENDING:   '0 0 8px rgba(250, 169, 46, 0.5)',
  SHADOW_ALPHA_INVALID:   '0 0 8px rgba(239, 68, 68, 0.5)',
  SHADOW_BETA_DEFAULT:    '0 0 8px rgba(37, 182, 235, 0.5)',
  SHADOW_BETA_VALID:      '0 0 8px rgba(21, 128, 61, 0.5)',
  SHADOW_BETA_INVALID:    '0 0 8px rgba(239, 68, 68, 0.5)',
  SHADOW_TYPE_MISMATCH:   '0 0 8px rgba(168, 85, 247, 0.5)'
};

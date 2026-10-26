/**
 * Accès au DOM du cahier ECLAIR (table#ciel).
 *
 * Depuis ECLAIR, le cahier affiche une période libre (pas forcément un mois) :
 * chaque colonne jour porte data-date="YYYY-MM-DD" et data-ts. La ligne
 * « cycles » porte data-ciel-jc (numéro du jour dans le cycle).
 */
(function () {
  function getCielTable() {
    return document.querySelector('table#ciel');
  }

  function _headRows(table) {
    return table ? Array.from(table.querySelectorAll('thead tr')) : [];
  }

  // Ligne des dates : celle qui porte les liens historique (ts=) ou la classe ECLAIR
  function _findDatesRow(table) {
    if (!table) return null;
    return table.querySelector('thead tr.ciel-entete-dates')
      || _headRows(table).find(r => r.querySelector("a[href*='ts=']"))
      || null;
  }

  // Ligne des cycles (J1/J2/JE…) : juste après la ligne des dates
  function _findCyclesRow(table) {
    if (!table) return null;
    const explicit = table.querySelector('thead tr.ciel-entete-jc');
    if (explicit) return explicit;
    const rows = _headRows(table);
    const idx = rows.indexOf(_findDatesRow(table));
    return idx >= 0 ? rows[idx + 1] || null : null;
  }

  function _tsFromCell(td) {
    if (td.dataset && td.dataset.ts) return String(td.dataset.ts);
    const a = td.querySelector("a[href*='ts=']");
    const m = a ? /[?&]ts=(\d+)/.exec(a.getAttribute('href') || '') : null;
    return m ? m[1] : null;
  }

  function _dateFromCell(td, ts) {
    if (td.dataset && td.dataset.date) return td.dataset.date;
    if (!ts) return null;
    const d = new Date(parseInt(ts, 10) * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Colonnes jours dans l'ordre d'affichage.
   * → [{ ts, date:"YYYY-MM-DD", label:"Jeu.1", cell }]
   */
  function getColumns() {
    const table = getCielTable();
    const row = _findDatesRow(table);
    if (!row) return [];
    const out = [];
    for (const td of row.querySelectorAll('td')) {
      const ts = _tsFromCell(td);
      if (!ts) continue;
      const date = _dateFromCell(td, ts);
      if (!date) continue;
      out.push({ ts, date, label: (td.textContent || '').replace(/\s+/g, ' ').trim(), cell: td });
    }
    return out;
  }

  // Compat : ancien nom
  function getTsOrderAndLabels() {
    return getColumns();
  }

  /**
   * Période affichée : { start, end, key, months:[{year, month}] }
   */
  function getPeriod() {
    const cols = getColumns();
    if (!cols.length) return null;
    const dates = cols.map(c => c.date).sort();
    const start = dates[0];
    const end = dates[dates.length - 1];
    const months = [];
    let [y, m] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      months.push({ year: y, month: m });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return { start, end, key: `${start}_${end}`, months, count: cols.length };
  }

  /**
   * Map ts → cellule de la ligne cycles (alignement par data-ts, sinon positionnel)
   */
  function getCycleCellForTs(ts) {
    const table = getCielTable();
    const row = _findCyclesRow(table);
    if (!row) return null;
    const direct = row.querySelector(`td[data-ts="${ts}"]`);
    if (direct) return direct;
    const cols = getColumns();
    const idx = cols.findIndex(c => c.ts === String(ts));
    if (idx === -1) return null;
    const dayTds = Array.from(row.querySelectorAll('td')).filter(td => !td.classList.contains('uciel-gutter-col'));
    // Les premières cellules sont les colonnes gelées (nom, période) : on aligne par la fin
    const offset = dayTds.length - cols.length;
    return dayTds[idx + Math.max(0, offset)] || null;
  }

  /**
   * Map date → numéro de jour de cycle, lu dans la ligne cycles d'ECLAIR
   * (data-ciel-jc). Vide si l'info n'est pas publiée.
   */
  let _jcCache = { key: null, map: null };
  function getDateToJcMap() {
    const period = getPeriod();
    const key = period ? period.key : null;
    if (_jcCache.key === key && _jcCache.map) return _jcCache.map;
    const map = new Map();
    const table = getCielTable();
    const row = _findCyclesRow(table);
    if (row) {
      for (const td of row.querySelectorAll('td[data-date]')) {
        const jc = parseInt(td.dataset.cielJc, 10);
        if (Number.isFinite(jc)) map.set(td.dataset.date, jc);
      }
    }
    _jcCache = { key, map };
    return map;
  }

  function getJcForDate(dateStr) {
    const v = getDateToJcMap().get(dateStr);
    return v == null ? null : v;
  }

  function invalidateCaches() {
    _jcCache = { key: null, map: null };
  }

  function getTsToCycleMap() {
    const map = new Map();
    for (const col of getColumns()) {
      const cell = getCycleCellForTs(col.ts);
      map.set(col.ts, cell ? (cell.textContent || '').replace(/\s+/g, ' ').trim() : '—');
    }
    return map;
  }

  // Lignes agents (tbody) — ECLAIR a aussi des lignes « ligneeffligneNNN »
  // (Renforts, Infos toutes équipes…) qui ne sont pas des agents.
  function getAgentRows() {
    const table = getCielTable();
    if (!table) return [];
    return Array.from(table.querySelectorAll("tbody tr[id^='ligneeff']"))
      .filter(tr => /^ligneeff\d+$/.test(tr.id));
  }

  function getAgentIdFromRow(tr) {
    const m = /ligneeff(\d+)/.exec(tr?.id || '');
    return m ? m[1] : null;
  }

  function getAgentNameFromRow(tr) {
    const a = tr?.querySelector('td.eff a');
    const name = (a ? a.textContent : '').replace(/\s+/g, ' ').trim();
    return name || 'UNKNOWN';
  }

  function getCellFor(tr, ts) {
    const effId = getAgentIdFromRow(tr);
    if (!effId) return null;
    return document.getElementById(`ts${ts}cell${effId}`);
  }

  /**
   * ECLAIR fusionne les cases consécutives de même sigle (colspan). Ces
   * événements, écoutés par uciel_core.js, défusionnent / refusionnent.
   */
  function eclairUnmergeAll() {
    try { document.dispatchEvent(new CustomEvent('icn-olaf-unmerge-all-sigles')); } catch (e) { /* ignore */ }
  }
  function eclairRemerge() {
    try { document.dispatchEvent(new CustomEvent('icn-olaf-remarge-sigles')); } catch (e) { /* ignore */ }
  }

  window.ICN_DOM = {
    getCielTable,
    getColumns,
    getTsOrderAndLabels,
    getPeriod,
    getCycleCellForTs,
    getDateToJcMap,
    getJcForDate,
    invalidateCaches,
    getTsToCycleMap,
    getAgentRows,
    getAgentIdFromRow,
    getAgentNameFromRow,
    getCellFor,
    eclairUnmergeAll,
    eclairRemerge
  };
})();

(function () {
  function getCielTable() {
    return document.querySelector("table#ciel");
  }

  function getMonthLabel() {
    const el = document.querySelector("#ciel thead tr.h1 td.l1");
    const txt = (el ? el.textContent : "").replace(/\s+/g, " ").trim();
    return txt || "mois courant";
  }

  // Trouve parmi les tr.h1 du thead celle qui contient les liens historique.php?ts=
  // Robuste face aux nouvelles lignes insérées par CIEL (ex: ciel-mini-filtre-row)
  function _findDatesRow(table) {
    if (!table) return null;
    const rows = table.querySelectorAll("thead tr.h1");
    for (const row of rows) {
      if (row.querySelector("a[href*='ts=']")) return row;
    }
    return null;
  }

  // Trouve la ligne de cycles (celle juste après la ligne des dates, qui contient J1/J2/JE...)
  function _findCyclesRow(table) {
    if (!table) return null;
    const rows = table.querySelectorAll("thead tr.h1");
    let foundDates = false;
    for (const row of rows) {
      if (foundDates) return row;
      if (row.querySelector("a[href*='ts=']")) foundDates = true;
    }
    return null;
  }

  // Récupère l'ordre des colonnes jours à partir des liens historique.php?ts=...
  // -> [{ ts:"1767..", label:"Sam.3" }, ...]
  function getTsOrderAndLabels() {
    const table = getCielTable();
    if (!table) {
      window.ICN_DEBUG.error('[DOM] No table found!');
      return [];
    }

    const row0 = _findDatesRow(table);
    window.ICN_DEBUG.log('[DOM] dates row found:', !!row0);

    const anchors = row0 ? row0.querySelectorAll("a[href*='ts=']") : [];
    window.ICN_DEBUG.log('[DOM] Anchors found:', anchors.length);

    const out = [];
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const m = /[?&]ts=(\d+)/.exec(href);
      if (!m) continue;
      out.push({
        ts: m[1],
        label: (a.textContent || "").replace(/\s+/g, " ").trim()
      });
    }

    window.ICN_DEBUG.log('[DOM] Returning order with', out.length, 'columns');
    return out;
  }

  // Map ts -> cycle label ("J1 IFR", etc.) en s'alignant sur l'ordre des jours
  function getTsToCycleMap() {
    const order = getTsOrderAndLabels().map(x => x.ts);
    const table = getCielTable();
    const row1 = _findCyclesRow(table);
    if (!row1) return new Map();

    const tds = row1.querySelectorAll("td");
    const dayTds = Array.from(tds).slice(2); // skip colsup + mois

    const map = new Map();
    for (let i = 0; i < order.length && i < dayTds.length; i++) {
      const cycle = (dayTds[i].textContent || "").replace(/\s+/g, " ").trim();
      map.set(order[i], cycle || "—");
    }
    return map;
  }

  // Lignes agents (tbody)
  function getAgentRows() {
    const table = getCielTable();
    if (!table) return [];
    return Array.from(table.querySelectorAll("tbody tr[id^='ligneeff']"));
  }

  function getAgentIdFromRow(tr) {
    // ex: id="ligneeff747"
    const id = tr?.id || "";
    const m = /ligneeff(\d+)/.exec(id);
    return m ? m[1] : null;
  }

  function getAgentNameFromRow(tr) {
    // ex: <td class='eff ...'><a>NAME</a></td>
    const a = tr?.querySelector("td.eff a");
    const name = (a ? a.textContent : "").replace(/\s+/g, " ").trim();
    return name || "UNKNOWN";
  }

  function getCellFor(tr, ts) {
    const effId = getAgentIdFromRow(tr);
    if (!effId) return null;
    return document.getElementById(`ts${ts}cell${effId}`);
  }

  window.ICN_DOM = {
    getCielTable,
    getMonthLabel,
    getTsOrderAndLabels,
    getTsToCycleMap,
    getAgentRows,
    getAgentIdFromRow,
    getAgentNameFromRow,
    getCellFor
  };
})();

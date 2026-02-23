(function () {
  function getCielTable() {
    return document.querySelector("table#ciel");
  }

  function getMonthLabel() {
    const el = document.querySelector("#ciel thead tr.h1 td.l1");
    const txt = (el ? el.textContent : "").replace(/\s+/g, " ").trim();
    return txt || "mois courant";
  }

  // Récupère l'ordre des colonnes jours à partir des liens historique.php?ts=...
  // -> [{ ts:"1767..", label:"Sam.3" }, ...]
  function getTsOrderAndLabels() {
    const table = getCielTable();
    const row0 = table?.querySelector("thead tr.h1:nth-of-type(1)");
    const anchors = row0 ? row0.querySelectorAll("a[href*='ts=']") : [];
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
    return out;
  }

  // Map ts -> cycle label ("J1 IFR", etc.) en s'alignant sur l'ordre des jours
  function getTsToCycleMap() {
    const order = getTsOrderAndLabels().map(x => x.ts);
    const table = getCielTable();
    const row1 = table?.querySelector("thead tr.h1:nth-of-type(2)");
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

/**
 * CycleClient — Récupère et interprète les données de cycle OLAF
 * Endpoint : GET /dist/ajax/congesGestion/getCycle.php (session-based, aucun param)
 */
class CycleClient {
  constructor() {
    this._BASE = 'https://olafatco.dsna.aviation-civile.gouv.fr';
  }

  async fetchCycleData() {
    const resp = await fetch(`${this._BASE}/dist/ajax/congesGestion/getCycle.php`, {
      credentials: 'include'
    });
    if (!resp.ok) throw new Error(`getCycle HTTP ${resp.status}`);
    return await resp.json();
  }

  /**
   * Retourne les infos d'un jour donné à partir des données cycle.
   * @param {object} cycleData  Réponse complète de getCycle.php
   * @param {string} dateStr    "YYYY-MM-DD"
   * @returns {{ position, label, horaires, isRest }}
   */
  getDayInfo(cycleData, dateStr) {
    const icna = cycleData?.ICNA;
    if (!icna) return { position: 0, label: '', horaires: false, isRest: false };

    const refDate   = new Date(icna.carac.calage.date); // "2003-07-19"
    const target    = new Date(dateStr);
    const diffDays  = Math.floor((target - refDate) / 86400000);
    const nbJours   = icna.carac.nbJours; // 12
    const position  = ((diffDays % nbJours) + nbJours) % nbJours + 1;

    // Trouver la période active à cette date
    const periods = cycleData.cycleByPeriod || {};
    let activePeriod = null;
    for (const pid in periods) {
      const p = periods[pid];
      if (p.validitystart <= dateStr && dateStr <= p.validityend) {
        activePeriod = p;
        break;
      }
    }

    const jours   = activePeriod?.jours || icna.jours || {};
    const dayData = jours[String(position)];

    // h: false = repos ; h: [null,...] = travaillé sans heure précise ; h: ["06H30-..."] = horaires réels
    const h = dayData?.h;
    const isRest = !h || h === false || (Array.isArray(h) && h.every(v => v === null));
    const horaires = isRest ? false : h;

    return {
      position,
      label:    dayData?.label || `J${position}`,
      horaires,
      isRest
    };
  }
}

window.ICN_CYCLE = new CycleClient();

/**
 * Client OLAF — planning mensuel équipe (afficherMois.php) + parsing.
 * Produit, pour chaque jour travaillé de la période, les agents en congé
 * (alpha) et en stage (beta) avec leur statut OLAF.
 */
class OlafClient {
  constructor() {
    this.EXCLUDED_IDS = [];
  }

  /**
   * Détecte la « cible » (agenda d'équipe) de l'utilisateur, mise en cache.
   */
  async detectCible(force = false) {
    if (!force) {
      const stored = await window.ICN_STORAGE.get('icn_olaf_cible');
      if (stored.icn_olaf_cible) return { ok: true, cible: stored.icn_olaf_cible, cached: true };
    }
    const r = await window.ICN_OLAF_PROXY.request({
      path: '/dist/module/planningMonth.php?page_id=40',
      headers: { 'Accept': 'text/html', 'Cache-Control': 'no-cache' }
    });
    if (!r.ok) return { ok: false, error: r.status === 401 ? 'OLAF non connecté' : (r.error || `HTTP ${r.status}`) };
    const html = r.text || '';
    let m = html.match(/olafatco\.planningMonth\s*=\s*\{[^}]*cible\s*:\s*["'](\d+)["']/)
         || html.match(/cible\s*:\s*["']?(\d+)["']?/);
    if (!m) return { ok: false, error: 'Cible OLAF introuvable' };
    const cible = parseInt(m[1], 10);
    await window.ICN_STORAGE.set({ icn_olaf_cible: cible });
    return { ok: true, cible };
  }

  async fetchMonth({ year, month, cible }) {
    const formData = new URLSearchParams({
      page_id: '40',
      today: `${year}-${String(month).padStart(2, '0')}-01`,
      annee: String(year),
      mois: String(month),
      cible: String(cible)
    });
    const r = await window.ICN_OLAF_PROXY.json({
      path: '/dist/ajax/planningMonth/afficherMois.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    });
    if (!r.ok) return { ok: false, error: r.status === 401 ? 'OLAF non connecté' : r.error };
    return { ok: true, data: r.data };
  }

  /**
   * Parse le HTML agenda d'un mois → Map(dateStr → [{agentId, agentName, classes, text}])
   */
  parseAgenda(agendaHtml, year, month, isWorkingDate) {
    const doc = new DOMParser().parseFromString(agendaHtml, 'text/html');

    const agentNames = {};
    doc.querySelectorAll('div[id^="nom_"]').forEach(div => {
      const m = div.id.match(/nom_(\d+)/);
      if (!m) return;
      const name = (div.getAttribute('title') || '').split(/<br>|&lt;br&gt;/i)[0].trim();
      if (name) agentNames[m[1]] = name;
    });

    const byDate = new Map();
    doc.querySelectorAll('div[id^="case_"]').forEach(caseDiv => {
      const dayNum = parseInt(caseDiv.getAttribute('data-n'), 10);
      const agentId = caseDiv.getAttribute('data-ki');
      if (!Number.isFinite(dayNum) || !agentId) return;
      if (this.EXCLUDED_IDS.includes(agentId)) return;

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      if (!isWorkingDate(dateStr)) return;

      if (!byDate.has(dateStr)) byDate.set(dateStr, []);
      byDate.get(dateStr).push({
        agentId,
        agentName: agentNames[agentId] || `Agent_${agentId}`,
        classes: caseDiv.className || '',
        text: (caseDiv.textContent || '').trim()
      });
    });
    return byDate;
  }

  hasTPA(text, classes) {
    return /\btpa\b/.test(`${text} ${classes}`.toLowerCase());
  }

  hasStClass(classes) {
    return classes.split(/\s+/).includes('st');
  }

  /**
   * Rapport pour une période (plusieurs mois possibles).
   * @returns {{ok:boolean, days?:Array<{day_str, alpha:Object, beta:Object}>, error?:string}}
   */
  async buildReport({ months, cible }) {
    try {
      const cycleConfig = await window.ICN_CONST.getCycleConfig();
      const isWorkingDate = (d) => window.ICN_CONST.isWorkingDay(d, cycleConfig);

      let cielAgentsList = [];
      if (window.ICN_AGENTS) {
        const agentsMap = await window.ICN_AGENTS.getAgentsList();
        cielAgentsList = Object.values(agentsMap || {}).map(a => a.fullName);
      }

      const days = [];
      for (const { year, month } of months) {
        const result = await this.fetchMonth({ year, month, cible });
        if (!result.ok) return { ok: false, error: `OLAF : ${result.error}` };
        const agendaHtml = result.data?.agenda;
        if (!agendaHtml) return { ok: false, error: `OLAF : agenda vide (${month}/${year})` };

        const byDate = this.parseAgenda(agendaHtml, year, month, isWorkingDate);
        for (const [dateStr, cases] of byDate.entries()) {
          const alpha = {};
          const beta = {};
          for (const c of cases) {
            if (c.agentName.startsWith('Agent_')) continue;
            if (this.hasTPA(c.text, c.classes)) continue;

            let cielMatch = null;
            if (cielAgentsList.length && window.ICN_AGENT_MATCHER) {
              cielMatch = window.ICN_AGENT_MATCHER.findCielMatch(c.agentName, cielAgentsList);
            }
            const name = cielMatch || c.agentName;

            let status = null;
            if (c.classes.includes('statut_18')) status = 'validated';
            else if (c.classes.includes('statut_17')) status = 'pending';

            if (c.classes.includes('conges')) alpha[name] = status;
            else if (this.hasStClass(c.classes)) beta[name] = status;
          }
          days.push({ day_str: dateStr, alpha, beta });
        }
      }
      return { ok: true, days };
    } catch (error) {
      window.ICN_DEBUG.error('[ICN-OLAF] buildReport:', error);
      return { ok: false, error: error.message || String(error) };
    }
  }
}

window.ICN_OLAF = new OlafClient();

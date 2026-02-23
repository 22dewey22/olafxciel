/**
 * Parse CIEL et génère rapport
 */
class CielParser {
  constructor() {
    this.monthNames = {
      'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4,
      'mai': 5, 'juin': 6, 'juillet': 7, 'août': 8,
      'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12
    };
  }

  parseMonthLabel(monthLabel) {
    const match = /([a-zéûù]+)-(\d+)/i.exec(monthLabel);
    if (!match) return null;
    
    const monthName = match[1].toLowerCase();
    const year = 2000 + parseInt(match[2], 10);
    const month = this.monthNames[monthName];
    
    return month ? { year, month, monthName } : null;
  }

  extractCycleMap() {
    const monthLabel = window.ICN_DOM.getMonthLabel();
    const parsed = this.parseMonthLabel(monthLabel);
    if (!parsed) return {};
    
    const { year, month } = parsed;
    const cycleMap = {};
    const order = window.ICN_DOM.getTsOrderAndLabels();
    const tsToCycle = window.ICN_DOM.getTsToCycleMap();
    
    for (const { ts, label } of order) {
      const cycleLabel = tsToCycle.get(ts);
      if (!cycleLabel) continue;
      
      const dayMatch = /\.(\d+)/.exec(label);
      if (!dayMatch) continue;
      const dayNum = parseInt(dayMatch[1], 10);
      
      const jMatch = /\b(J\d+)\b/i.exec(cycleLabel);
      if (!jMatch) continue;
      const jNum = parseInt(jMatch[1].substring(1), 10);
      
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cycleMap[dateStr] = jNum;
    }
    
    return cycleMap;
  }

  async isWorkingCycle(cycleLabel) {
    const match = /\b(J\d+)\b/i.exec(cycleLabel || "");
    if (!match) return false;
    
    // Extraire le numéro du jour (J1 → 1, J12 → 12)
    const dayNum = parseInt(match[1].substring(1), 10);
    
    // Charger la config du cycle
    const cycleConfig = await window.ICN_CONST.getCycleConfig();
    
    // Vérifier si ce jour fait partie des jours travaillés
    return cycleConfig.workingDays.includes(dayNum);
  }

  async buildReport() {
    const monthLabel = window.ICN_DOM.getMonthLabel();
    const parsed = this.parseMonthLabel(monthLabel);
    if (!parsed) {
      return { ok: false, error: 'Impossible de parser le mois' };
    }

    const { year, month } = parsed;
    const order = window.ICN_DOM.getTsOrderAndLabels();
    const tsToCycle = window.ICN_DOM.getTsToCycleMap();
    const agentRows = window.ICN_DOM.getAgentRows();

    let agentsList = null;
    if (window.ICN_AGENTS) {
      agentsList = await window.ICN_AGENTS.getAgentsList();
    }

    const days = [];

    for (const { ts, label } of order) {
      const cycle = tsToCycle.get(ts) || "—";
      if (!this.isWorkingCycle(cycle)) continue;

      const alphaAgents = [];
      const betaAgents = [];

      for (const tr of agentRows) {
        const cell = window.ICN_DOM.getCellFor(tr, ts);
        const cls = await window.ICN_CLASSIFY.classifyCell(cell);
        if (!cls) continue;

        const agentId = tr.id.match(/ligneeff(\d+)/)?.[1];
        
        let short3;
        if (agentsList && agentId && agentsList[agentId]) {
          short3 = agentsList[agentId].tri;
        } else {
          const name = window.ICN_DOM.getAgentNameFromRow(tr);
          short3 = window.ICN_TEXT.first3Upper(name);
        }

        if (cls === "alpha") alphaAgents.push(short3);
        else if (cls === "beta") betaAgents.push(short3);
      }

      const uniq = (arr) => Array.from(new Set(arr)).sort();
      const dayMatch = /\.(\d+)/.exec(label);
      if (!dayMatch) continue;
      const dayNum = parseInt(dayMatch[1], 10);
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      days.push({
        ts,
        day_str: dayStr,
        label,
        cycle,
        alpha_count: uniq(alphaAgents).length,
        alpha_agents: uniq(alphaAgents).join(" "),
        beta_count: uniq(betaAgents).length,
        beta_agents: uniq(betaAgents).join(" ")
      });
    }

    const cycleMap = this.extractCycleMap();

    return {
      ok: true,
      meta: `${monthLabel} • ${days.length} jour(s) travaillés`,
      month_label: monthLabel,
      days,
      cycleMap
    };
  }
}

window.ICN_REPORT = new CielParser();

/**
 * Client OLAF - API calls + parsing
 */
class OlafClient {
  constructor() {
    this.BASE_URL = "https://olafatco.dsna.aviation-civile.gouv.fr";
    
    // IDs d'agents à exclure du parsing (lignes de total, etc.)
    this.EXCLUDED_IDS = [];
  }

  async detectCible(login, pass) {
    try {
      const authHeader = "Basic " + btoa(`${login}:${pass}`);
      const url = `${this.BASE_URL}/dist/module/planningMonth.php?page_id=40`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Accept": "text/html",
          "Cache-Control": "no-cache"
        },
        credentials: 'include',
        mode: 'cors'
      });

      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }

      const html = await response.text();
      
      let match = html.match(/olafatco\.planningMonth\s*=\s*\{[^}]*cible\s*:\s*["'](\d+)["']/);
      if (match && match[1]) {
        const cible = parseInt(match[1], 10);
        await window.ICN_STORAGE.set({ icn_olaf_cible: cible });
        return { ok: true, cible };
      }

      match = html.match(/cible\s*:\s*["']?(\d+)["']?/);
      if (match && match[1]) {
        const cible = parseInt(match[1], 10);
        await window.ICN_STORAGE.set({ icn_olaf_cible: cible });
        return { ok: true, cible };
      }

      return { ok: false, error: "Cible non trouvée" };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async fetchMonth({ login, pass, year, month, cible }) {
    if (!login || !pass) {
      return { ok: false, error: "Credentials manquants" };
    }

    if (!cible) {
      const stored = await window.ICN_STORAGE.get('icn_olaf_cible');
      cible = stored.icn_olaf_cible;
      if (!cible) {
        return { ok: false, error: "Cible non détectée" };
      }
    }

    const today = `${year}-${String(month).padStart(2, '0')}-01`;
    const formData = new URLSearchParams({
      page_id: "40",
      today,
      annee: String(year),
      mois: String(month),
      cible: String(cible)
    });

    try {
      const authHeader = "Basic " + btoa(`${login}:${pass}`);
      const response = await fetch(`${this.BASE_URL}/dist/ajax/planningMonth/afficherMois.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Authorization": authHeader,
          "X-Requested-With": "XMLHttpRequest"
        },
        body: formData.toString()
      });

      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async parseAgenda(agendaHtml, year, month, cycleConfig) {
    // Parser le HTML en DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(agendaHtml, 'text/html');
    
    // Extraire les noms des agents
    const agentNamesMap = {};
    const nomDivs = doc.querySelectorAll('div[id^="nom_"]');
    nomDivs.forEach(div => {
      const match = div.id.match(/nom_(\d+)/);
      if (match) {
        const agentId = match[1];
        const title = div.getAttribute('title') || '';
        // Extraire le nom avant <br> ou &lt;br&gt;
        const name = title.split(/<br>|&lt;br&gt;/i)[0].trim();
        if (name) {
          agentNamesMap[agentId] = name;
        }
      }
    });
    
    // Extraire les cases (cellules du planning)
    const byDay = new Map();
    const caseDivs = doc.querySelectorAll('div[id^="case_"]');
    
    caseDivs.forEach(caseDiv => {
      const dayNum = parseInt(caseDiv.getAttribute('data-n'), 10);
      const agentId = caseDiv.getAttribute('data-ki');
      const classes = caseDiv.className;
      const text = caseDiv.textContent.trim();

      if (this.EXCLUDED_IDS.includes(agentId)) return;

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      // Vérifier si c'est un jour travaillé
      if (!window.ICN_CONST.isWorkingDay(dateStr, cycleConfig)) return;
      
      // Calculer le jour dans le cycle pour affichage
      const jCycle = window.ICN_CONST.getDayInCycle(dateStr, cycleConfig.cycleStartDate, cycleConfig.cycleLength);

      // Si OLAF ne renvoie pas de nom, tant pis → Agent_ID
      const agentName = agentNamesMap[agentId] || `Agent_${agentId}`;

      if (!byDay.has(dayNum)) {
        byDay.set(dayNum, { dayNum, jCycle, cases: [] });
      }

      byDay.get(dayNum).cases.push({ agentId, agentName, classes, text });
    });

    return byDay;
  }

  hasTPA(text, classes) {
    return /\btpa\b/.test(`${text} ${classes}`.toLowerCase());
  }

  hasStClass(classes) {
    return classes.split(/\s+/).includes('st');
  }

  async buildReport({ login, pass, year, month, cible }) {
    try {
      // Charger la config du cycle
      const cycleConfig = await window.ICN_CONST.getCycleConfig();

      let cielAgentsList = [];
      if (window.ICN_AGENTS) {
        const agentsMap = await window.ICN_AGENTS.getAgentsList();
        cielAgentsList = Object.keys(agentsMap);
      if (agentsMap) {
        cielAgentsList = Object.values(agentsMap).map(a => a.fullName);
      }
    }

    const result = await this.fetchMonth({ login, pass, year, month, cible });
    if (!result.ok) return { ok: false, error: `OLAF: ${result.error}` };

    const agendaHtml = result.data?.agenda;
    if (!agendaHtml) return { ok: false, error: "OLAF: agenda vide" };

    const byDay = await this.parseAgenda(agendaHtml, year, month, cycleConfig);
    const days = [];

    for (const [dayNum, dayData] of byDay.entries()) {
      const alpha = new Map(); // Changé de Set à Map pour stocker {nom: statut}
      const beta = new Map();

      for (const caseInfo of dayData.cases) {
        const olafName = caseInfo.agentName;
        if (olafName.startsWith('Agent_')) continue;

        let cielMatch = null;
        if (cielAgentsList.length > 0 && window.ICN_AGENT_MATCHER) {
          cielMatch = window.ICN_AGENT_MATCHER.findCielMatch(olafName, cielAgentsList);
        }
        
        const nameToUse = cielMatch || olafName;
        
        if (this.hasTPA(caseInfo.text, caseInfo.classes)) continue;

        // Extraire le statut
        let status = null;
        if (caseInfo.classes.includes('statut_18')) {
          status = 'validated'; // Congé validé
        } else if (caseInfo.classes.includes('statut_17')) {
          status = 'pending'; // Congé en attente
        }

        if (caseInfo.classes.includes('conges')) {
          alpha.set(nameToUse, status);
        } else if (this.hasStClass(caseInfo.classes)) {
          beta.set(nameToUse, status);
        }
      }

      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      // Convertir Map en objet {nom: statut}
      const alphaObj = {};
      const betaObj = {};
      alpha.forEach((status, name) => { alphaObj[name] = status; });
      beta.forEach((status, name) => { betaObj[name] = status; });
      
      days.push({
        day_str: dateStr,
        alpha: alphaObj,
        beta: betaObj
      });
    }

    return { ok: true, days };
    
    } catch (error) {
      console.error('[ICN-OLAF] buildReport failed:', error);
      return { ok: false, error: error.message || String(error) };
    }
  }
}

window.ICN_OLAF = new OlafClient();

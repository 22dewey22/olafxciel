/**
 * Gestionnaire d'affichage des demandes de remplacement
 */
class RemplacementDisplay {
  constructor() {
    this.asterisks = [];
  }

  /**
   * Nettoie tous les astérisques affichés
   */
  clearAll() {
    this.asterisks.forEach(el => el.remove());
    this.asterisks = [];
  }

  /**
   * Crée un astérisque rouge
   */
  createAsterisk() {
    const asterisk = document.createElement('div');
    asterisk.className = 'icn-rempla-asterisk';
    asterisk.setAttribute('data-icn-ignore', '1');
    asterisk.style.cssText = `
      position: absolute;
      color: #ef4444;
      font-size: 20px;
      font-weight: bold;
      z-index: 1000;
      pointer-events: none;
      text-shadow: 0 0 4px rgba(239, 68, 68, 0.8);
    `;
    asterisk.textContent = '★';
    return asterisk;
  }

  /**
   * Affiche les astérisques pour les demandes de remplacement
   */
  async apply() {
    this.clearAll();

    // Récupérer les demandes
    const remplaResult = await window.ICN_REMPLA.getRemplacements();
    
    if (!remplaResult.ok) {
      console.error('[REMPLA-DISPLAY] Erreur chargement:', remplaResult.error);
      return;
    }

    const remplasByDate = remplaResult.demandes;
    
    if (remplasByDate.size === 0) {
      console.log('[REMPLA-DISPLAY] Aucune demande de remplacement');
      return;
    }

    // Récupérer le mois affiché
    const monthLabel = window.ICN_DOM.getMonthLabel();
    const parser = new CielParser();
    const parsed = parser.parseMonthLabel(monthLabel);
    
    if (!parsed) {
      console.error('[REMPLA-DISPLAY] Impossible de parser le mois');
      return;
    }

    const { year, month } = parsed;
    
    // Filtrer les remplas du mois
    const remplasDuMois = new Map();
    for (const [dateStr, demandes] of remplasByDate.entries()) {
      const [y, m] = dateStr.split('-').map(Number);
      if (y === year && m === month) {
        remplasDuMois.set(dateStr, demandes);
      }
    }

    console.log(`[REMPLA-DISPLAY] ${remplasDuMois.size} dates avec remplas en ${monthLabel}`);

    if (remplasDuMois.size === 0) return;

    // Récupérer l'ordre des colonnes
    const order = window.ICN_DOM.getTsOrderAndLabels();
    
    if (!order || order.length === 0) {
      console.error('[REMPLA-DISPLAY] Impossible de récupérer les colonnes');
      return;
    }

    const table = window.ICN_DOM.getCielTable();
    if (!table) return;

    // Créer une map ts -> dateStr
    const tsToDate = new Map();
    const datesToTs = new Map();
    const visibleDays = new Set();
    
    for (const { ts, label } of order) {
      const dayMatch = /\.(\d+)/.exec(label);
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        tsToDate.set(ts, dateStr);
        datesToTs.set(dateStr, ts);
        visibleDays.add(dayNum);
      }
    }

    // Grouper les dates de remplas en "runs" (séquences consécutives non visibles)
    const remplaRuns = [];
    const sortedRemplaDays = Array.from(remplasDuMois.keys())
      .map(dateStr => parseInt(dateStr.split('-')[2], 10))
      .sort((a, b) => a - b);
    
    let currentRun = [];
    for (const day of sortedRemplaDays) {
      if (visibleDays.has(day)) {
        // Jour visible → crée son propre run
        if (currentRun.length > 0) {
          remplaRuns.push(currentRun);
          currentRun = [];
        }
        remplaRuns.push([day]);
      } else {
        // Jour non visible
        if (currentRun.length === 0) {
          currentRun = [day];
        } else {
          const lastDay = currentRun[currentRun.length - 1];
          // Vérifier s'il y a des jours visibles entre lastDay et day
          let hasVisibleBetween = false;
          for (let d = lastDay + 1; d < day; d++) {
            if (visibleDays.has(d)) {
              hasVisibleBetween = true;
              break;
            }
          }
          
          if (hasVisibleBetween) {
            // Nouveau run
            remplaRuns.push(currentRun);
            currentRun = [day];
          } else {
            // Même run
            currentRun.push(day);
          }
        }
      }
    }
    if (currentRun.length > 0) {
      remplaRuns.push(currentRun);
    }

    console.log('[REMPLA-DISPLAY] Runs de remplas:', remplaRuns);

    // Pour chaque run, afficher une seule étoile
    for (const run of remplaRuns) {
      const firstDay = run[0];
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(firstDay).padStart(2, '0')}`;
      
      // Chercher si cette date a une colonne
      const ts = datesToTs.get(dateStr);
      
      if (ts) {
        // CAS 1 : Première date du run a une colonne → astérisque au-dessus
        this.addAsteriskAboveColumn(table, ts);
      } else {
        // CAS 2 : Chercher la colonne précédente au run
        this.addAsteriskAfterPreviousColumn(table, firstDay, datesToTs, order, year, month);
      }
    }
  }

  /**
   * Ajoute un astérisque au-dessus d'une colonne existante
   */
  addAsteriskAboveColumn(table, ts) {
    // Trouver la cellule header avec ce timestamp
    const headerRow = table.querySelector('thead tr.h1');
    if (!headerRow) return;

    // Chercher le <a> avec href contenant ce ts
    const link = headerRow.querySelector(`a[href*="ts=${ts}"]`);
    if (!link) {
      console.warn(`[REMPLA-DISPLAY] Lien introuvable pour ts=${ts}`);
      return;
    }

    const cell = link.closest('td');
    if (!cell) return;

    // Positionner l'astérisque au-dessus
    const rect = cell.getBoundingClientRect();
    const asterisk = this.createAsterisk();
    
    asterisk.style.position = 'fixed';
    asterisk.style.left = `${rect.left + rect.width / 2 - 10}px`;
    asterisk.style.top = `${rect.top - 25}px`;
    
    document.body.appendChild(asterisk);
    this.asterisks.push(asterisk);
    
    console.log(`[REMPLA-DISPLAY] ✅ Astérisque ajouté au-dessus ts=${ts}`);
  }

  /**
   * Ajoute un astérisque sur le bord droit de la colonne précédente
   */
  addAsteriskAfterPreviousColumn(table, dayNum, datesToTs, order, year, month) {
    // Chercher la colonne précédente la plus proche
    let previousTs = null;
    let previousDay = null;
    
    for (let d = dayNum - 1; d >= 1; d--) {
      const testDate = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const testTs = datesToTs.get(testDate);
      
      if (testTs) {
        previousTs = testTs;
        previousDay = d;
        break;
      }
    }
    
    if (!previousTs) {
      console.warn(`[REMPLA-DISPLAY] Pas de colonne précédente pour jour ${dayNum}`);
      return;
    }

    const headerRow = table.querySelector('thead tr.h1');
    if (!headerRow) return;

    const link = headerRow.querySelector(`a[href*="ts=${previousTs}"]`);
    if (!link) return;

    const cell = link.closest('td');
    if (!cell) return;

    // Positionner l'astérisque sur le bord droit de la cellule
    const rect = cell.getBoundingClientRect();
    const asterisk = this.createAsterisk();
    
    asterisk.style.position = 'fixed';
    asterisk.style.left = `${rect.right - 5}px`;
    asterisk.style.top = `${rect.top - 25}px`;
    
    document.body.appendChild(asterisk);
    this.asterisks.push(asterisk);
    
    console.log(`[REMPLA-DISPLAY] ✅ Astérisque ajouté après jour ${previousDay} pour rempla du ${dayNum}`);
  }
}

window.ICN_REMPLA_DISPLAY = new RemplacementDisplay();
console.log('[ICN-REMPLA-DISPLAY] Remplacement display module loaded');

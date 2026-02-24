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
    asterisk.setAttribute('data-icn-ignore', '1'); // Ignorer par l'observer
    asterisk.style.cssText = `
      position: absolute;
      top: -15px;
      left: 50%;
      transform: translateX(-50%);
      color: #ef4444;
      font-size: 16px;
      font-weight: bold;
      z-index: 100;
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

    // Récupérer les demandes de remplacement
    const remplaResult = await window.ICN_REMPLA.getRemplacements();
    
    if (!remplaResult.ok) {
      console.error('[REMPLA-DISPLAY] Erreur chargement remplacements:', remplaResult.error);
      return;
    }

    const remplasByDate = remplaResult.demandes;
    
    if (remplasByDate.size === 0) {
      console.log('[REMPLA-DISPLAY] Aucune demande de remplacement');
      return;
    }

    // Récupérer le mois affiché dans CIEL
    const monthLabel = window.ICN_DOM.getMonthLabel();
    const parser = new CielParser();
    const parsed = parser.parseMonthLabel(monthLabel);
    
    if (!parsed) {
      console.error('[REMPLA-DISPLAY] Impossible de parser le mois');
      return;
    }

    const { year, month } = parsed;
    
    // Filtrer les remplas du mois en cours
    const remplasDuMois = new Map();
    for (const [dateStr, demandes] of remplasByDate.entries()) {
      const [y, m] = dateStr.split('-').map(Number);
      if (y === year && m === month) {
        remplasDuMois.set(dateStr, demandes);
      }
    }

    console.log(`[REMPLA-DISPLAY] ${remplasDuMois.size} dates avec remplas en ${monthLabel}`);

    if (remplasDuMois.size === 0) return;

    // Récupérer l'ordre des colonnes du tableau CIEL
    const order = window.ICN_DOM.getTsOrderAndLabels();
    
    if (!order || order.length === 0) {
      console.error('[REMPLA-DISPLAY] Impossible de récupérer les colonnes');
      return;
    }

    // Extraire les dates des colonnes visibles
    const visibleDates = new Set();
    const tsToDate = new Map();
    
    for (const { ts, label } of order) {
      const dayMatch = /\.(\d+)/.exec(label);
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1], 10);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        visibleDates.add(dateStr);
        tsToDate.set(ts, dateStr);
      }
    }

    // Pour chaque date avec remplas
    for (const [dateStr] of remplasDuMois.entries()) {
      if (visibleDates.has(dateStr)) {
        // CAS 1 : Date visible dans le tableau
        this.addAsteriskOnColumn(dateStr, order, tsToDate);
      }
    }

    // Gérer les "trous" (dates non visibles)
    this.addAsterisksForGaps(remplasDuMois, order, tsToDate, year, month);
  }

  /**
   * Ajoute un astérisque au-dessus d'une colonne
   */
  addAsteriskOnColumn(dateStr, order, tsToDate) {
    console.log(`[REMPLA-DISPLAY] Tentative d'ajout astérisque pour ${dateStr}`);
    
    // Trouver l'index de la colonne correspondante
    let columnIndex = -1;
    for (let i = 0; i < order.length; i++) {
      if (tsToDate.get(order[i].ts) === dateStr) {
        columnIndex = i;
        console.log(`[REMPLA-DISPLAY] Colonne trouvée pour ${dateStr}, index=${columnIndex}, ts=${order[i].ts}`);
        break;
      }
    }
    
    if (columnIndex === -1) {
      console.error(`[REMPLA-DISPLAY] Colonne introuvable pour ${dateStr}`);
      return;
    }
    
    const table = window.ICN_DOM.getCielTable();
    if (!table) {
      console.error('[REMPLA-DISPLAY] Table introuvable');
      return;
    }

    console.log('[REMPLA-DISPLAY] Table trouvée:', table);
    console.log('[REMPLA-DISPLAY] Table.tagName:', table.tagName);
    console.log('[REMPLA-DISPLAY] Table a un thead?', !!table.querySelector('thead'));
    console.log('[REMPLA-DISPLAY] Structure thead:', table.querySelector('thead')?.outerHTML?.substring(0, 200));

    // Sélectionner tous les td du header (CIEL utilise des td, pas des th)
    const headerCells = table.querySelectorAll('thead tr.h1 td');
    console.log(`[REMPLA-DISPLAY] Total header cells (td): ${headerCells.length}`);
    
    // Les premières colonnes sont fixes (nom, etc.), les colonnes de dates commencent après
    // On doit trouver le bon offset
    const headerCell = headerCells[columnIndex];
    
    console.log(`[REMPLA-DISPLAY] Header cell à l'index ${columnIndex}:`, headerCell);
    
    if (headerCell) {
      headerCell.style.position = 'relative';
      const asterisk = this.createAsterisk();
      headerCell.appendChild(asterisk);
      this.asterisks.push(asterisk);
      console.log(`[REMPLA-DISPLAY] ✅ Astérisque ajouté sur ${dateStr}`);
    } else {
      console.error(`[REMPLA-DISPLAY] Header cell introuvable à l'index ${columnIndex}`);
    }
  }

  /**
   * Ajoute des astérisques pour les dates non visibles (entre deux colonnes)
   */
  addAsterisksForGaps(remplasDuMois, order, tsToDate, year, month) {
    // Trier les dates visibles
    const sortedVisibleDates = Array.from(tsToDate.values()).sort();
    
    // Pour chaque paire de dates consécutives
    for (let i = 0; i < sortedVisibleDates.length - 1; i++) {
      const dateA = sortedVisibleDates[i];
      const dateB = sortedVisibleDates[i + 1];
      
      // Vérifier s'il y a des remplas entre dateA et dateB
      const hasRemplaInGap = Array.from(remplasDuMois.keys()).some(remplaDate => {
        return remplaDate > dateA && remplaDate < dateB;
      });

      if (hasRemplaInGap) {
        // Trouver les timestamps des deux colonnes
        let tsA = null;
        let tsB = null;
        
        for (const { ts } of order) {
          if (tsToDate.get(ts) === dateA) tsA = ts;
          if (tsToDate.get(ts) === dateB) tsB = ts;
        }

        if (tsA && tsB) {
          this.addAsteriskBetweenColumns(tsA, tsB);
        }
      }
    }
  }

  /**
   * Ajoute un astérisque entre deux colonnes
   */
  addAsteriskBetweenColumns(tsA, tsB) {
    const table = window.ICN_DOM.getCielTable();
    if (!table) return;

    const headerA = table.querySelector(`thead th[data-ts="${tsA}"]`);
    const headerB = table.querySelector(`thead th[data-ts="${tsB}"]`);

    if (!headerA || !headerB) return;

    // Créer un conteneur entre les deux colonnes
    const rectA = headerA.getBoundingClientRect();
    const rectB = headerB.getBoundingClientRect();
    
    const middleX = (rectA.right + rectB.left) / 2;
    
    // Positionner l'astérisque
    const asterisk = this.createAsterisk();
    asterisk.style.position = 'fixed';
    asterisk.style.left = `${middleX}px`;
    asterisk.style.top = `${rectA.top - 15}px`;
    asterisk.style.transform = 'translateX(-50%)';
    
    document.body.appendChild(asterisk);
    this.asterisks.push(asterisk);
    
    console.log(`[REMPLA-DISPLAY] Astérisque ajouté entre ${tsA} et ${tsB}`);
  }
}

window.ICN_REMPLA_DISPLAY = new RemplacementDisplay();
console.log('[ICN-REMPLA-DISPLAY] Remplacement display module loaded');

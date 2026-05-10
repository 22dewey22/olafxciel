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
  createAsterisk(days, remplasByDate) {
    const asterisk = document.createElement('div');
    asterisk.className = 'icn-rempla-asterisk';
    asterisk.setAttribute('data-icn-ignore', '1');
    asterisk.style.cssText = `
      position: absolute;
      color: #cc0000;
      font-size: 16px;
      font-weight: bold;
      z-index: 1002;
      cursor: pointer;
      line-height: 1;
      text-shadow:
        -2px -2px 0 #fff,
         2px -2px 0 #fff,
        -2px  2px 0 #fff,
         2px  2px 0 #fff,
         0    0   3px rgba(0,0,0,0.4);
      pointer-events: auto;
    `;
    asterisk.textContent = '★';
    
    // Créer le tooltip si on a des données
    if (days && remplasByDate) {
      const tooltip = this.createTooltip(days, remplasByDate);
      
      // Événements pour afficher/masquer le tooltip
      asterisk.addEventListener('mouseenter', (e) => {
        tooltip.style.display = 'block';
        this.updateTooltipPosition(tooltip, e);
      });
      
      asterisk.addEventListener('mousemove', (e) => {
        this.updateTooltipPosition(tooltip, e);
      });
      
      asterisk.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
      
      document.body.appendChild(tooltip);
      this.asterisks.push(tooltip);
    }
    
    return asterisk;
  }

  /**
   * Crée le tooltip avec la liste des remplacements
   */
  createTooltip(days, remplasByDate) {
    const tooltip = document.createElement('div');
    tooltip.className = 'icn-rempla-tooltip';
    tooltip.setAttribute('data-icn-ignore', '1');
    tooltip.style.cssText = `
      position: fixed;
      display: none;
      background: rgba(20, 20, 20, 0.95);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-width: 300px;
      border: 1px solid #ef4444;
    `;
    
    // Construire le contenu
    let content = '<div style="font-weight: bold; margin-bottom: 6px; color: #ef4444;">📋 Demandes de remplacement</div>';
    
    for (const day of days) {
      const year = Math.floor(day / 10000);
      const month = Math.floor((day % 10000) / 100);
      const dayNum = day % 100;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const demandes = remplasByDate.get(dateStr);
      
      if (demandes && demandes.length > 0) {
        content += `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(239, 68, 68, 0.3);">`;
        content += `<div style="font-weight: 600; color: #fca5a5;">${demandes[0].dateFull}</div>`;
        
        for (const d of demandes) {
          content += `<div style="margin-left: 8px; margin-top: 2px; font-size: 11px;">`;
          content += `• ${d.prenom} ${d.nom} - ${d.vacation} (${d.equipe})`;
          content += `</div>`;
        }
        content += `</div>`;
      }
    }
    
    tooltip.innerHTML = content;
    return tooltip;
  }

  /**
   * Met à jour la position du tooltip près de la souris
   */
  updateTooltipPosition(tooltip, event) {
    const offsetX = 15;
    const offsetY = 15;
    
    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;
    
    // Éviter que le tooltip sorte de l'écran
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      x = event.clientX - rect.width - offsetX;
    }
    if (y + rect.height > window.innerHeight) {
      y = event.clientY - rect.height - offsetY;
    }
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  /**
   * Affiche les astérisques pour les demandes de remplacement
   */
  async apply() {
    this.clearAll();

    // Récupérer les demandes
    const remplaResult = await window.ICN_REMPLA.getRemplacements();
    
    if (!remplaResult.ok) {
      window.ICN_DEBUG.error('[REMPLA-DISPLAY] Erreur chargement:', remplaResult.error);
      return;
    }

    const remplasByDate = remplaResult.demandes;
    
    if (remplasByDate.size === 0) {
      window.ICN_DEBUG.log('[REMPLA-DISPLAY] Aucune demande de remplacement');
      return;
    }

    // Récupérer le mois affiché
    const monthLabel = window.ICN_DOM.getMonthLabel();
    const parser = new CielParser();
    const parsed = parser.parseMonthLabel(monthLabel);
    
    if (!parsed) {
      window.ICN_DEBUG.error('[REMPLA-DISPLAY] Impossible de parser le mois');
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

    window.ICN_DEBUG.log(`[REMPLA-DISPLAY] ${remplasDuMois.size} dates avec remplas en ${monthLabel}`);

    if (remplasDuMois.size === 0) return;

    // Récupérer l'ordre des colonnes
    const order = window.ICN_DOM.getTsOrderAndLabels();
    
    if (!order || order.length === 0) {
      window.ICN_DEBUG.error('[REMPLA-DISPLAY] Impossible de récupérer les colonnes');
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

    window.ICN_DEBUG.log('[REMPLA-DISPLAY] Runs de remplas:', remplaRuns);

    // Récupérer la config du cycle pour déterminer les jours travaillés
    const cycleConfig = await window.ICN_CONST.getCycleConfig();
    const hasCycleConfig = cycleConfig && 
                           cycleConfig.cycleStartDate &&
                           cycleConfig.cycleLength > 0;

    // Pour chaque run, afficher une seule étoile
    for (const run of remplaRuns) {
      const firstDay = run[0];
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(firstDay).padStart(2, '0')}`;
      
      // Vérifier si c'est un jour travaillé selon le cycle configuré
      if (hasCycleConfig) {
        const isJourTravaille = this.isWorkingDay(dateStr, cycleConfig);
        
        if (isJourTravaille) {
          continue;
        }
      }
      
      // Chercher si cette date a une colonne
      const ts = datesToTs.get(dateStr);
      
      if (ts) {
        // CAS 1 : Première date du run a une colonne → astérisque au-dessus
        this.addAsteriskAboveColumn(table, ts, run, year, month, remplasDuMois);
      } else {
        // CAS 2 : Chercher la colonne précédente au run
        this.addAsteriskAfterPreviousColumn(table, firstDay, datesToTs, order, year, month, run, remplasDuMois);
      }
    }
  }

  /**
   * Détermine si un jour est un jour travaillé selon le cycle configuré
   */
  isWorkingDay(dateStr, cycleConfig) {
    const { cycleStartDate, cycleLength, workingDays } = cycleConfig;
    
    if (!cycleStartDate || !cycleLength || !workingDays || workingDays.length === 0) {
      return false;
    }
    
    // Calculer le nombre de jours depuis le début du cycle
    const targetDate = new Date(dateStr);
    const startDate = new Date(cycleStartDate);
    const diffTime = targetDate - startDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Position dans le cycle (0-indexed)
    const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;
    
    // Vérifier si ce jour est dans workingDays (qui sont 1-indexed)
    return workingDays.includes(dayInCycle + 1);
  }

  /**
   * Trouve parmi les tr.h1 du thead celle qui contient les liens historique.php?ts=
   * (robuste face à la ciel-mini-filtre-row ajoutée en 2026)
   */
  _findDatesRow(table) {
    const rows = table.querySelectorAll('thead tr.h1');
    for (const row of rows) {
      if (row.querySelector("a[href*='ts=']")) return row;
    }
    return null;
  }

  /**
   * Ajoute un astérisque dans la cellule de la ligne cycles (J1/J2/JE...)
   * pour un jour visible dans le cahier
   */
  addAsteriskAboveColumn(table, ts, run, year, month, remplasByDate) {
    // La ligne cycles a data-ts directement sur la td (pas la ligne dates)
    const cycleCell = window.ICN_DOM.getCycleCellForTs(ts);
    if (!cycleCell) {
      window.ICN_DEBUG.warn(`[REMPLA-DISPLAY] Cellule cycles introuvable pour ts=${ts}`);
      return;
    }

    const daysForTooltip = run.map(day => year * 10000 + month * 100 + day);
    const asterisk = this.createAsterisk(daysForTooltip, remplasByDate);

    cycleCell.style.position = 'relative';
    cycleCell.style.overflow = 'visible';
    cycleCell.style.zIndex = '100';
    asterisk.style.position = 'absolute';
    asterisk.style.top = '50%';
    asterisk.style.left = '50%';
    asterisk.style.transform = 'translate(-50%, -50%)';
    asterisk.style.fontSize = '14px';
    asterisk.style.lineHeight = '1';
    asterisk.style.zIndex = '1001';

    cycleCell.appendChild(asterisk);
    this.asterisks.push(asterisk);

    window.ICN_DEBUG.log(`[REMPLA-DISPLAY] ✅ Astérisque (centré) dans cellule cycles ts=${ts}`);
  }

  /**
   * Ajoute un astérisque sur le bord droit de la cellule cycles du jour précédent,
   * pour un jour non affiché dans le cahier (entre deux colonnes consécutives)
   */
  addAsteriskAfterPreviousColumn(table, dayNum, datesToTs, order, year, month, run, remplasByDate) {
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

    // Si pas de colonne précédente, utiliser la première colonne du tableau
    if (!previousTs && order.length > 0) {
      previousTs = order[0].ts;
      window.ICN_DEBUG.log(`[REMPLA-DISPLAY] Pas de colonne précédente pour jour ${dayNum}, utilisation de la première colonne`);
    }

    if (!previousTs) {
      window.ICN_DEBUG.warn(`[REMPLA-DISPLAY] Pas de colonne disponible pour jour ${dayNum}`);
      return;
    }

    // Cellule cycles du jour précédent
    const cycleCell = window.ICN_DOM.getCycleCellForTs(previousTs);
    if (!cycleCell) return;

    const daysForTooltip = run.map(day => year * 10000 + month * 100 + day);
    const asterisk = this.createAsterisk(daysForTooltip, remplasByDate);

    cycleCell.style.position = 'relative';
    cycleCell.style.overflow = 'visible';
    cycleCell.style.zIndex = '100';
    asterisk.style.position = 'absolute';
    asterisk.style.top = '50%';
    asterisk.style.lineHeight = '1';
    asterisk.style.transform = 'translateY(-50%)';

    if (previousDay) {
      // Bord droit de la colonne précédente → visuellement entre les deux jours
      asterisk.style.right = '-9px';
    } else {
      // Avant la première colonne → bord gauche
      asterisk.style.left = '-9px';
    }

    cycleCell.appendChild(asterisk);
    this.asterisks.push(asterisk);

    if (previousDay) {
      window.ICN_DEBUG.log(`[REMPLA-DISPLAY] ✅ Astérisque (bord droit) jour ${previousDay} pour rempla du ${dayNum}`);
    } else {
      window.ICN_DEBUG.log(`[REMPLA-DISPLAY] ✅ Astérisque (bord gauche) première colonne pour rempla du ${dayNum}`);
    }
  }
}

window.ICN_REMPLA_DISPLAY = new RemplacementDisplay();
window.ICN_DEBUG.log('[ICN-REMPLA-DISPLAY] Remplacement display module loaded');

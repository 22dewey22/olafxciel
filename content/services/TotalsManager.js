// src/content/totals.js
// Ajoute deux lignes de totaux entre "Effectif absent" et "Vacances zone A"

(function () {
  let totalsAlphaRow = null;
  let totalsBetaRow = null;

  /**
   * Crée ou met à jour les deux lignes de totaux
   */
  async function updateTotalsRow() {
    // Désactiver l'observer pour éviter la boucle infinie
    if (window.ICN_MAIN) {
      window.ICN_MAIN.disconnectObserver();
    }
    
    const table = window.ICN_DOM.getCielTable();
    if (!table) {
      if (window.ICN_MAIN) {
        window.ICN_MAIN.reconnectObserver();
      }
      return;
    }

    // Chercher dans le tfoot (où sont Effectif absent et Vacances)
    const tfoot = table.querySelector('tfoot');
    if (!tfoot) {
      window.ICN_DEBUG.warn('[ICN] tfoot not found');
      if (window.ICN_MAIN) {
        window.ICN_MAIN.reconnectObserver();
      }
      return;
    }

    // Trouver la ligne "Effectif absent"
    const rows = Array.from(tfoot.querySelectorAll('tr.h3'));
    let effectifAbsentRow = null;
    
    for (const row of rows) {
      const text = row.textContent.toLowerCase();
      if (text.includes('effectif absent')) {
        effectifAbsentRow = row;
        break;
      }
    }
    
    if (!effectifAbsentRow) {
      window.ICN_DEBUG.warn('[ICN] Effectif absent row not found');
      if (window.ICN_MAIN) {
        window.ICN_MAIN.reconnectObserver();
      }
      return;
    }
    
    // Si pas de lignes de totaux, les créer
    if (!totalsAlphaRow) {
      totalsAlphaRow = document.createElement('tr');
      totalsAlphaRow.id = 'icn-totals-alpha-row';
      totalsAlphaRow.className = 'h3'; // Même classe que Effectif absent
      
      // Insérer juste après la ligne Effectif absent
      effectifAbsentRow.parentNode.insertBefore(totalsAlphaRow, effectifAbsentRow.nextSibling);
    }
    
    if (!totalsBetaRow) {
      totalsBetaRow = document.createElement('tr');
      totalsBetaRow.id = 'icn-totals-beta-row';
      totalsBetaRow.className = 'h3';
      
      // Insérer après la ligne alpha
      totalsAlphaRow.parentNode.insertBefore(totalsBetaRow, totalsAlphaRow.nextSibling);
    }

    // Récupérer l'ordre des jours
    const daysOrder = window.ICN_DOM.getTsOrderAndLabels();
    
    // Charger la config du cycle
    const cycleConfig = await window.ICN_CONST.getCycleConfig();
    
    // Calculer les totaux par jour
    const totalsByTs = {};
    
    for (const day of daysOrder) {
      totalsByTs[day.ts] = { alpha: 0, beta: 0 };
    }

    // Parcourir toutes les lignes agents
    const agentRows = window.ICN_DOM.getAgentRows();
    
    for (const row of agentRows) {
      for (const day of daysOrder) {
        const cell = window.ICN_DOM.getCellFor(row, day.ts);
        if (!cell) continue;

        // Utiliser la même logique que classify.js
        const classification = window.ICN_CLASSIFY ? await window.ICN_CLASSIFY.classifyCell(cell) : null;
        
        if (classification === 'alpha') {
          totalsByTs[day.ts].alpha++;
        } else if (classification === 'beta') {
          totalsByTs[day.ts].beta++;
        }
      }
    }

    // Construire le HTML de la ligne ALPHA (style des lignes Vacances)
    let htmlAlpha = '<td class="colsup"></td>';
    htmlAlpha += '<td colspan="1"><a title="Total agents ALPHA">Total ALPHA</a></td>';

    for (const day of daysOrder) {
      const totals = totalsByTs[day.ts] || { alpha: 0, beta: 0 };
      
      // Convertir timestamp en date YYYY-MM-DD
      const date = new Date(parseInt(day.ts) * 1000);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      // Vérifier si c'est un jour travaillé selon la config
      const isWorking = window.ICN_CONST.isWorkingDay(dateStr, cycleConfig);
      
      // Si pas un jour travaillé, fond gris et case vide
      if (!isWorking) {
        htmlAlpha += `<td class="l3 jour" style="text-align: center; background-color: #e5e7eb;"></td>`;
      } else {
        htmlAlpha += `<td class="l3 jour fondclasse0" style="text-align: center; font-weight: 600;">${totals.alpha}</td>`;
      }
    }

    totalsAlphaRow.innerHTML = htmlAlpha;

    // Construire le HTML de la ligne BETA (style des lignes Vacances)
    let htmlBeta = '<td class="colsup"></td>';
    htmlBeta += '<td colspan="1"><a title="Total agents BETA">Total BETA</a></td>';

    for (const day of daysOrder) {
      const totals = totalsByTs[day.ts] || { alpha: 0, beta: 0 };
      
      // Convertir timestamp en date YYYY-MM-DD
      const date = new Date(parseInt(day.ts) * 1000);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      // Vérifier si c'est un jour travaillé selon la config
      const isWorking = window.ICN_CONST.isWorkingDay(dateStr, cycleConfig);
      
      // Si pas un jour travaillé, fond gris et case vide
      if (!isWorking) {
        htmlBeta += `<td class="l3 jour" style="text-align: center; background-color: #e5e7eb;"></td>`;
      } else {
        htmlBeta += `<td class="l3 jour fondclasse0" style="text-align: center; font-weight: 600;">${totals.beta}</td>`;
      }
    }

    totalsBetaRow.innerHTML = htmlBeta;
    
    window.ICN_DEBUG.log('[ICN] Totals rows updated');
    
    // Réactiver l'observer
    if (window.ICN_MAIN) {
      window.ICN_MAIN.reconnectObserver();
    }
  }

  /**
   * Supprime les lignes de totaux
   */
  function removeTotalsRow() {
    if (totalsAlphaRow && totalsAlphaRow.parentNode) {
      totalsAlphaRow.parentNode.removeChild(totalsAlphaRow);
      totalsAlphaRow = null;
    }
    if (totalsBetaRow && totalsBetaRow.parentNode) {
      totalsBetaRow.parentNode.removeChild(totalsBetaRow);
      totalsBetaRow = null;
    }
    window.ICN_DEBUG.log('[ICN] Totals rows removed');
  }

  /**
   * Active ou désactive l'affichage des totaux
   */
  async function toggleTotals(enabled) {
    if (enabled) {
      await updateTotalsRow();
    } else {
      removeTotalsRow();
    }
  }

  // Export
  window.ICN_TOTALS = {
    update: updateTotalsRow,
    remove: removeTotalsRow,
    toggle: toggleTotals
  };
})();

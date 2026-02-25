/**
 * Gestion des contours colorés
 */
class OutlineManager {
  /**
   * Crée une pastille colorée dans le coin d'une cellule
   */
  createBadge(color) {
    const badge = document.createElement('div');
    badge.className = 'icn-status-badge';
    badge.setAttribute('data-icn-ignore', '1'); // Marquer pour ignorer par l'observer
    badge.style.cssText = `
      position: absolute;
      top: 2px;
      right: 2px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${color};
      box-shadow: 0 0 4px ${color};
      pointer-events: none;
      z-index: 10;
    `;
    return badge;
  }

  /**
   * Supprime les badges existants d'une cellule
   */
  removeBadge(cell) {
    const existingBadge = cell.querySelector('.icn-status-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
  }

  async clearAll() {
    const table = window.ICN_DOM.getCielTable();
    if (!table) return;
    
    table.querySelectorAll("td[data-icn-outline='1']").forEach(td => {
      td.style.outline = "";
      td.style.outlineOffset = "";
      td.style.boxShadow = "";
      td.removeAttribute("data-icn-outline");
      this.removeBadge(td); // Supprimer les badges
    });
  }

  async getOlafData() {
    try {
      const result = await window.ICN_STORAGE.get("icn_olaf_data");
      return result.icn_olaf_data || null;
    } catch (e) {
      return null;
    }
  }

  async apply() {
    await this.clearAll();

    // Charger la config du cycle
    const cycleConfig = await window.ICN_CONST.getCycleConfig();

    const order = window.ICN_DOM.getTsOrderAndLabels();
    const agentRows = window.ICN_DOM.getAgentRows();

    let agentsList = null;
    if (window.ICN_AGENTS) {
      agentsList = await window.ICN_AGENTS.getAgentsList();
    }

    const olafDataRaw = await this.getOlafData();
    const olafData = new Map();
    
    if (olafDataRaw) {
      for (const [dayStr, data] of Object.entries(olafDataRaw)) {
        // data.alpha et data.beta sont maintenant des objets {nom: statut}
        olafData.set(dayStr, {
          alpha: data.alpha || {},
          beta: data.beta || {}
        });
      }
    }

    const monthLabel = window.ICN_DOM.getMonthLabel();
    const parser = new CielParser();
    const parsed = parser.parseMonthLabel(monthLabel);
    if (!parsed) return;

    const { year, month } = parsed;
    let alphaCount = 0;
    let betaCount = 0;

    for (const { ts, label } of order) {
      // Extraire le numéro du jour depuis le label
      const dayMatch = /\.(\d+)/.exec(label);
      if (!dayMatch) continue;
      
      const dayNum = parseInt(dayMatch[1], 10);
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      
      // Vérifier si c'est un jour travaillé (nouveau système)
      if (!window.ICN_CONST.isWorkingDay(dayStr, cycleConfig)) continue;
      
      const olafDay = olafData.get(dayStr);

      for (const tr of agentRows) {
        const cell = window.ICN_DOM.getCellFor(tr, ts);
        const cls = await window.ICN_CLASSIFY.classifyCell(cell);
        if (!cls || !cell) continue;

        if (cls === "beta") {
          let outlineColor = window.ICN_CONST.OUTLINE_BETA_DEFAULT;
          let shadowEffect = window.ICN_CONST.SHADOW_BETA_DEFAULT;
          
          // Vérifier si présent dans OLAF
          if (olafDay) {
            const agentId = tr.id.match(/ligneeff(\d+)/)?.[1];
            let cielFullName = null;
            
            if (agentsList && agentId && agentsList[agentId]) {
              cielFullName = agentsList[agentId].fullName;
            } else {
              cielFullName = window.ICN_DOM.getAgentNameFromRow(tr);
            }

            if (cielFullName) {
              const inOlafBeta = cielFullName in olafDay.beta;
              const inOlafAlpha = cielFullName in olafDay.alpha;
              
              if (inOlafBeta) {
                // Beta présent dans OLAF beta → vert clair + badge
                outlineColor = window.ICN_CONST.OUTLINE_BETA_VALID;
                shadowEffect = window.ICN_CONST.SHADOW_BETA_VALID;
                cell.style.position = 'relative';
                this.removeBadge(cell);
                cell.appendChild(this.createBadge('#15803d'));
              } else if (inOlafAlpha) {
                // Beta présent dans OLAF alpha (inversé) → violet + badge
                outlineColor = window.ICN_CONST.OUTLINE_TYPE_MISMATCH;
                shadowEffect = window.ICN_CONST.SHADOW_TYPE_MISMATCH;
                cell.style.position = 'relative';
                this.removeBadge(cell);
                cell.appendChild(this.createBadge('#a855f7'));
              } else {
                // Beta absent dans OLAF → rouge + badge
                outlineColor = window.ICN_CONST.OUTLINE_BETA_INVALID;
                shadowEffect = window.ICN_CONST.SHADOW_BETA_INVALID;
                cell.style.position = 'relative';
                this.removeBadge(cell);
                cell.appendChild(this.createBadge('#ef4444'));
              }
            }
          } else {
            // Pas de données OLAF → bleu par défaut + badge
            cell.style.position = 'relative';
            this.removeBadge(cell);
            cell.appendChild(this.createBadge('#2563eb'));
          }
          
          cell.style.outline = outlineColor;
          cell.style.outlineOffset = "-2px";
          cell.style.boxShadow = shadowEffect;
          cell.setAttribute("data-icn-outline", "1");
          betaCount++;
          continue;
        }

        if (cls === "alpha") {
          let outlineColor = window.ICN_CONST.OUTLINE_ALPHA_DEFAULT;
          let shadowEffect = window.ICN_CONST.SHADOW_ALPHA_DEFAULT;

          if (olafDay) {
            const agentId = tr.id.match(/ligneeff(\d+)/)?.[1];
            let cielFullName = null;
            
            if (agentsList && agentId && agentsList[agentId]) {
              cielFullName = agentsList[agentId].fullName;
            } else {
              cielFullName = window.ICN_DOM.getAgentNameFromRow(tr);
            }

            if (cielFullName) {
              const alphaStatus = olafDay.alpha[cielFullName]; // null, 'validated', ou 'pending'
              const inOlafBeta = cielFullName in olafDay.beta;
              
              if (alphaStatus !== undefined) {
                // Alpha présent dans OLAF alpha
                if (alphaStatus === 'validated') {
                  // Congé validé (statut_18) → vert foncé + badge
                  outlineColor = window.ICN_CONST.OUTLINE_ALPHA_VALIDATED;
                  shadowEffect = window.ICN_CONST.SHADOW_ALPHA_VALIDATED;
                  cell.style.position = 'relative';
                  this.removeBadge(cell);
                  cell.appendChild(this.createBadge('#15803d'));
                } else if (alphaStatus === 'pending') {
                  // Congé en attente (statut_17) → vert clair/lime + badge
                  outlineColor = window.ICN_CONST.OUTLINE_ALPHA_PENDING;
                  shadowEffect = window.ICN_CONST.SHADOW_ALPHA_PENDING;
                  cell.style.position = 'relative';
                  this.removeBadge(cell);
                  cell.appendChild(this.createBadge('#faa92e'));
                } else {
                  // Congé sans statut → jaune + badge jaune
                  outlineColor = window.ICN_CONST.OUTLINE_ALPHA_DEFAULT;
                  shadowEffect = window.ICN_CONST.SHADOW_ALPHA_DEFAULT;
                  cell.style.position = 'relative';
                  this.removeBadge(cell);
                  cell.appendChild(this.createBadge('#25b6eb'));
                }
              } else if (inOlafBeta) {
                // Alpha présent dans OLAF beta (inversé) → violet + badge
                outlineColor = window.ICN_CONST.OUTLINE_TYPE_MISMATCH;
                shadowEffect = window.ICN_CONST.SHADOW_TYPE_MISMATCH;
                cell.style.position = 'relative';
                this.removeBadge(cell);
                cell.appendChild(this.createBadge('#a855f7'));
              } else {
                // Alpha absent dans OLAF → rouge + badge
                outlineColor = window.ICN_CONST.OUTLINE_ALPHA_INVALID;
                shadowEffect = window.ICN_CONST.SHADOW_ALPHA_INVALID;
                cell.style.position = 'relative';
                this.removeBadge(cell);
                cell.appendChild(this.createBadge('#ef4444'));
              }
            }
          } else {
            // Pas de données OLAF → bleu par défaut + badge
            cell.style.position = 'relative';
            this.removeBadge(cell);
            cell.appendChild(this.createBadge('#2563eb'));
          }
          cell.style.outline = outlineColor;
          cell.style.outlineOffset = "-2px";
          cell.style.boxShadow = shadowEffect;
          cell.setAttribute("data-icn-outline", "1");
          alphaCount++;
        }
      }
    }

    // Deuxième passe : signaler les agents présents dans OLAF mais ABSENTS de CIEL
    if (olafData.size > 0) {
      for (const [dayStr, olafDay] of olafData.entries()) {
        // Trouver la colonne correspondante
        const dateParts = dayStr.split('-');
        const dayNum = parseInt(dateParts[2], 10);
        const columnTs = order.find(col => {
          const dayMatch = /\.(\d+)/.exec(col.label);
          return dayMatch && parseInt(dayMatch[1], 10) === dayNum;
        });
        
        if (!columnTs) continue;
        
        // Pour chaque agent dans OLAF alpha (parcourir les clés de l'objet)
        for (const agentName of Object.keys(olafDay.alpha)) {
          // Trouver la ligne de cet agent
          const agentRow = agentRows.find(tr => {
            const agentId = tr.id.match(/ligneeff(\d+)/)?.[1];
            let cielFullName = null;
            
            if (agentsList && agentId && agentsList[agentId]) {
              cielFullName = agentsList[agentId].fullName;
            } else {
              cielFullName = window.ICN_DOM.getAgentNameFromRow(tr);
            }
            
            return cielFullName === agentName;
          });
          
          if (!agentRow) continue;
          
          // Vérifier si la cellule est déjà alpha ou beta dans CIEL
          const cell = window.ICN_DOM.getCellFor(agentRow, columnTs.ts);
          if (!cell) continue;
          
          const cls = await window.ICN_CLASSIFY.classifyCell(cell);
          
          // Si la cellule n'est ni alpha ni beta → signaler en jaune (missing alpha) + badge
          if (!cls || (cls !== 'alpha' && cls !== 'beta')) {
            cell.style.outline = window.ICN_CONST.OUTLINE_ALPHA_DEFAULT;
            cell.style.outlineOffset = "-2px";
            cell.style.boxShadow = window.ICN_CONST.SHADOW_ALPHA_DEFAULT;
            cell.setAttribute("data-icn-outline", "1");
            cell.setAttribute("data-icn-missing", "alpha");
            cell.style.position = 'relative';
            this.removeBadge(cell);
            cell.appendChild(this.createBadge('#25b6eb'));
          }
        }
        
        // Pour chaque agent dans OLAF beta (parcourir les clés de l'objet)
        for (const agentName of Object.keys(olafDay.beta)) {
          // Trouver la ligne de cet agent
          const agentRow = agentRows.find(tr => {
            const agentId = tr.id.match(/ligneeff(\d+)/)?.[1];
            let cielFullName = null;
            
            if (agentsList && agentId && agentsList[agentId]) {
              cielFullName = agentsList[agentId].fullName;
            } else {
              cielFullName = window.ICN_DOM.getAgentNameFromRow(tr);
            }
            
            return cielFullName === agentName;
          });
          
          if (!agentRow) continue;
          
          // Vérifier si la cellule est déjà alpha ou beta dans CIEL
          const cell = window.ICN_DOM.getCellFor(agentRow, columnTs.ts);
          if (!cell) continue;
          
          const cls = await window.ICN_CLASSIFY.classifyCell(cell);
          
          // Si la cellule n'est ni alpha ni beta → signaler en bleu (missing beta) + badge
          if (!cls || (cls !== 'alpha' && cls !== 'beta')) {
            cell.style.outline = window.ICN_CONST.OUTLINE_BETA_DEFAULT;
            cell.style.outlineOffset = "-2px";
            cell.style.boxShadow = window.ICN_CONST.SHADOW_BETA_DEFAULT;
            cell.setAttribute("data-icn-outline", "1");
            cell.setAttribute("data-icn-missing", "beta");
            cell.style.position = 'relative';
            this.removeBadge(cell);
            cell.appendChild(this.createBadge('#2563eb'));
          }
        }
      }
    }

    if (window.ICN_TOTALS) {
      window.ICN_TOTALS.update();
    }
  }
}

window.ICN_OUTLINE = new OutlineManager();

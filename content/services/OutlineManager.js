/**
 * Contours colorés CIEL ↔ OLAF.
 *
 * Pour chaque jour travaillé affiché et chaque agent, la case CIEL est
 * classée alpha (congé) / beta (stage) via les fondclasses apprises, puis
 * comparée aux données OLAF du même jour.
 *
 * Les cases reçoivent data-icn-outline="1" et data-icn-outline-kind="…" :
 * ECLAIR lit ces attributs pour ne pas refusionner des cases d'état différent.
 */
class OutlineManager {
  constructor() {
    this._olafData = null;   // { dateStr: { alpha:{name:status}, beta:{name:status} } }
    this._applying = false;
  }

  setOlafData(data) { this._olafData = data || null; }
  getOlafData()     { return this._olafData; }
  hasOlafData()     { return !!this._olafData && Object.keys(this._olafData).length > 0; }

  async refresh() { await this.apply(); }

  // ── Pastilles ───────────────────────────────────────────────────────────

  createBadge(color) {
    const badge = document.createElement('span');
    badge.className = 'icn-status-badge';
    badge.setAttribute('data-icn-ignore', '1');
    badge.style.cssText = `position:absolute;top:2px;right:2px;width:7px;height:7px;border-radius:50%;background:${color};box-shadow:0 0 3px ${color};pointer-events:none;z-index:10;`;
    return badge;
  }

  removeBadge(cell) {
    cell.querySelectorAll('.icn-status-badge').forEach(b => b.remove());
  }

  paint(cell, { outline, shadow, badge, kind, title }) {
    cell.style.position = 'relative';
    cell.style.outline = outline;
    cell.style.outlineOffset = '-2px';
    cell.style.boxShadow = shadow;
    cell.setAttribute('data-icn-outline', '1');
    cell.setAttribute('data-icn-outline-kind', kind);
    if (title) cell.setAttribute('data-icn-title', title);
    this.removeBadge(cell);
    cell.appendChild(this.createBadge(badge));
  }

  async clearAll() {
    const table = window.ICN_DOM.getCielTable();
    if (!table) return;
    table.querySelectorAll("td[data-icn-outline='1']").forEach(td => {
      td.style.outline = '';
      td.style.outlineOffset = '';
      td.style.boxShadow = '';
      td.removeAttribute('data-icn-outline');
      td.removeAttribute('data-icn-outline-kind');
      td.removeAttribute('data-icn-missing');
      td.removeAttribute('data-icn-title');
      this.removeBadge(td);
    });
  }

  // ── Styles par état ─────────────────────────────────────────────────────

  _style(kind) {
    const C = window.ICN_CONST;
    switch (kind) {
      case 'alpha-validated': return { outline: C.OUTLINE_ALPHA_VALIDATED, shadow: C.SHADOW_ALPHA_VALIDATED, badge: '#15803d', kind, title: 'Congé validé dans OLAF' };
      case 'alpha-pending':   return { outline: C.OUTLINE_ALPHA_PENDING,   shadow: C.SHADOW_ALPHA_PENDING,   badge: '#faa92e', kind, title: 'Congé en attente dans OLAF' };
      case 'alpha-nostatus':  return { outline: C.OUTLINE_ALPHA_DEFAULT,   shadow: C.SHADOW_ALPHA_DEFAULT,   badge: '#25b6eb', kind, title: 'Congé présent dans OLAF (sans statut)' };
      case 'alpha-missing':   return { outline: C.OUTLINE_ALPHA_INVALID,   shadow: C.SHADOW_ALPHA_INVALID,   badge: '#ef4444', kind, title: 'Congé absent d’OLAF' };
      case 'alpha-mismatch':  return { outline: C.OUTLINE_TYPE_MISMATCH,   shadow: C.SHADOW_TYPE_MISMATCH,   badge: '#a855f7', kind, title: 'Congé CIEL mais stage dans OLAF' };
      case 'alpha-noolaf':    return { outline: C.OUTLINE_ALPHA_DEFAULT,   shadow: C.SHADOW_ALPHA_DEFAULT,   badge: '#2563eb', kind, title: 'Congé CIEL (OLAF non chargé)' };
      case 'beta-valid':      return { outline: C.OUTLINE_BETA_VALID,      shadow: C.SHADOW_BETA_VALID,      badge: '#15803d', kind, title: 'Stage présent dans OLAF' };
      case 'beta-missing':    return { outline: C.OUTLINE_BETA_INVALID,    shadow: C.SHADOW_BETA_INVALID,    badge: '#ef4444', kind, title: 'Stage absent d’OLAF' };
      case 'beta-mismatch':   return { outline: C.OUTLINE_TYPE_MISMATCH,   shadow: C.SHADOW_TYPE_MISMATCH,   badge: '#a855f7', kind, title: 'Stage CIEL mais congé dans OLAF' };
      case 'beta-noolaf':     return { outline: C.OUTLINE_BETA_DEFAULT,    shadow: C.SHADOW_BETA_DEFAULT,    badge: '#2563eb', kind, title: 'Stage CIEL (OLAF non chargé)' };
      case 'missing-alpha':   return { outline: C.OUTLINE_ALPHA_DEFAULT,   shadow: C.SHADOW_ALPHA_DEFAULT,   badge: '#25b6eb', kind, title: 'Congé dans OLAF, rien dans CIEL' };
      case 'missing-beta':    return { outline: C.OUTLINE_BETA_DEFAULT,    shadow: C.SHADOW_BETA_DEFAULT,    badge: '#2563eb', kind, title: 'Stage dans OLAF, rien dans CIEL' };
      default:                return { outline: C.OUTLINE_ALPHA_DEFAULT,   shadow: C.SHADOW_ALPHA_DEFAULT,   badge: '#25b6eb', kind };
    }
  }

  _agentName(tr, agentsList) {
    const id = window.ICN_DOM.getAgentIdFromRow(tr);
    if (agentsList && id && agentsList[id]) return agentsList[id].fullName;
    return window.ICN_DOM.getAgentNameFromRow(tr);
  }

  // ── Application ─────────────────────────────────────────────────────────

  async apply() {
    if (this._applying) return;
    this._applying = true;
    try {
      // Les cases fusionnées par ECLAIR (colspan) n'ont pas d'id par jour :
      // on défusionne, on peint, ECLAIR refusionne ce qui reste compatible.
      window.ICN_DOM.eclairUnmergeAll();
      await this.clearAll();
      await this._applyInner();
    } finally {
      window.ICN_DOM.eclairRemerge();
      this._applying = false;
    }
  }

  async _applyInner() {
    const cycleConfig = await window.ICN_CONST.getCycleConfig();
    const columns = window.ICN_DOM.getColumns();
    const agentRows = window.ICN_DOM.getAgentRows();
    if (!columns.length || !agentRows.length) return;

    const agentsList = window.ICN_AGENTS ? await window.ICN_AGENTS.getAgentsList() : null;
    const olaf = this._olafData || null;
    const hasOlaf = this.hasOlafData();

    const nameByRow = new Map();
    for (const tr of agentRows) nameByRow.set(tr, this._agentName(tr, agentsList));

    // Première passe : cases alpha/beta de CIEL
    for (const { ts, date } of columns) {
      if (!window.ICN_CONST.isWorkingDay(date, cycleConfig)) continue;
      const olafDay = hasOlaf ? olaf[date] : null;

      for (const tr of agentRows) {
        const cell = window.ICN_DOM.getCellFor(tr, ts);
        if (!cell) continue;
        const cls = await window.ICN_CLASSIFY.classifyCell(cell);
        if (!cls) continue;

        const name = nameByRow.get(tr);
        let kind;
        if (!hasOlaf) {
          kind = cls === 'alpha' ? 'alpha-noolaf' : 'beta-noolaf';
        } else if (!olafDay) {
          kind = cls === 'alpha' ? 'alpha-missing' : 'beta-missing';
        } else if (cls === 'alpha') {
          if (name in olafDay.alpha) {
            const st = olafDay.alpha[name];
            kind = st === 'validated' ? 'alpha-validated' : st === 'pending' ? 'alpha-pending' : 'alpha-nostatus';
          } else if (name in olafDay.beta) kind = 'alpha-mismatch';
          else kind = 'alpha-missing';
        } else {
          if (name in olafDay.beta) kind = 'beta-valid';
          else if (name in olafDay.alpha) kind = 'beta-mismatch';
          else kind = 'beta-missing';
        }
        this.paint(cell, this._style(kind));
      }
    }

    // Seconde passe : présents dans OLAF mais sans case alpha/beta dans CIEL
    if (!hasOlaf) return;
    const rowByName = new Map();
    for (const [tr, name] of nameByRow.entries()) rowByName.set(name, tr);

    for (const { ts, date } of columns) {
      const olafDay = olaf[date];
      if (!olafDay) continue;
      const check = async (names, kind) => {
        for (const name of names) {
          const tr = rowByName.get(name);
          if (!tr) continue;
          const cell = window.ICN_DOM.getCellFor(tr, ts);
          if (!cell || cell.getAttribute('data-icn-outline') === '1') continue;
          const cls = await window.ICN_CLASSIFY.classifyCell(cell);
          if (cls) continue;
          this.paint(cell, this._style(kind));
          cell.setAttribute('data-icn-missing', kind === 'missing-alpha' ? 'alpha' : 'beta');
        }
      };
      await check(Object.keys(olafDay.alpha), 'missing-alpha');
      await check(Object.keys(olafDay.beta), 'missing-beta');
    }
  }
}

window.ICN_OUTLINE = new OutlineManager();

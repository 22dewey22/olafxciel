/**
 * Astérisques ★ sur les jours de repos ayant des demandes de remplacement.
 * Une étoile par « run » de jours consécutifs ; tooltip au survol.
 */
class RemplacementDisplay {
  constructor() {
    this.nodes = [];
  }

  clearAll() {
    this.nodes.forEach(el => el.remove());
    this.nodes = [];
  }

  // ── Dates utilitaires ───────────────────────────────────────────────────

  static dayIndex(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  }

  static dateFromIndex(idx) {
    const d = new Date(idx * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  // ── Éléments ────────────────────────────────────────────────────────────

  createTooltip(dates, remplasByDate) {
    const tooltip = document.createElement('div');
    tooltip.className = 'icn-rempla-tooltip';
    tooltip.setAttribute('data-icn-ignore', '1');
    let html = '<div class="icn-rempla-tooltip-title">Demandes de remplacement</div>';
    for (const dateStr of dates) {
      const demandes = remplasByDate.get(dateStr);
      if (!demandes || !demandes.length) continue;
      html += `<div class="icn-rempla-day"><div class="icn-rempla-date">${demandes[0].dateFull}</div>`;
      for (const d of demandes) {
        html += `<div class="icn-rempla-item">${d.prenom} ${d.nom} — ${d.vacation} (${d.equipe})</div>`;
      }
      html += '</div>';
    }
    tooltip.innerHTML = html;
    return tooltip;
  }

  createAsterisk(dates, remplasByDate, { edge = false } = {}) {
    const star = document.createElement('div');
    star.className = 'icn-rempla-asterisk' + (edge ? ' icn-rempla-asterisk--edge' : '');
    star.setAttribute('data-icn-ignore', '1');
    star.textContent = '★';

    const tooltip = this.createTooltip(dates, remplasByDate);
    document.body.appendChild(tooltip);
    this.nodes.push(tooltip);

    const place = (e) => {
      const r = tooltip.getBoundingClientRect();
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + r.width > window.innerWidth) x = e.clientX - r.width - 14;
      if (y + r.height > window.innerHeight) y = e.clientY - r.height - 14;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    };
    star.addEventListener('mouseenter', (e) => { tooltip.style.display = 'block'; place(e); });
    star.addEventListener('mousemove', place);
    star.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    return star;
  }

  attachToCycleCell(ts, star) {
    const cell = window.ICN_DOM.getCycleCellForTs(ts);
    if (!cell) return false;
    cell.style.position = 'relative';
    cell.style.overflow = 'visible';
    cell.appendChild(star);
    this.nodes.push(star);
    return true;
  }

  // ── Application ─────────────────────────────────────────────────────────

  async apply() {
    this.clearAll();
    const period = window.ICN_DOM.getPeriod();
    if (!period) return;

    const result = await window.ICN_REMPLA.getRemplacements();
    if (!result.ok) {
      window.ICN_DEBUG.warn('[REMPLA] chargement KO :', result.error);
      return;
    }

    // Remplas dans la période affichée
    const inPeriod = new Map();
    for (const [dateStr, demandes] of result.demandes.entries()) {
      if (dateStr >= period.start && dateStr <= period.end) inPeriod.set(dateStr, demandes);
    }
    if (!inPeriod.size) return;

    const cycleConfig = await window.ICN_CONST.getCycleConfig();
    const columns = window.ICN_DOM.getColumns();
    const tsByDate = new Map(columns.map(c => [c.date, c.ts]));

    // Runs de dates consécutives (uniquement jours de repos)
    const restDates = [...inPeriod.keys()]
      .filter(d => !window.ICN_CONST.isWorkingDay(d, cycleConfig))
      .sort();
    const runs = [];
    for (const d of restDates) {
      const idx = RemplacementDisplay.dayIndex(d);
      const last = runs.length ? runs[runs.length - 1] : null;
      if (last && idx === last.endIdx + 1 && !tsByDate.has(d)) {
        last.dates.push(d);
        last.endIdx = idx;
      } else {
        runs.push({ dates: [d], startIdx: idx, endIdx: idx });
      }
    }

    for (const run of runs) {
      const first = run.dates[0];
      const star = this.createAsterisk(run.dates, inPeriod, { edge: !tsByDate.has(first) });
      let ts = tsByDate.get(first);
      if (!ts) {
        // Jour masqué par un filtre : étoile sur la colonne précédente la plus proche
        for (let i = run.startIdx - 1; i >= RemplacementDisplay.dayIndex(period.start); i--) {
          ts = tsByDate.get(RemplacementDisplay.dateFromIndex(i));
          if (ts) break;
        }
        if (!ts && columns.length) ts = columns[0].ts;
      }
      if (!ts || !this.attachToCycleCell(ts, star)) star.remove();
    }
  }
}

window.ICN_REMPLA_DISPLAY = new RemplacementDisplay();

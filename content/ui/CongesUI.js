/**
 * CongesUI — Calendrier + formulaire d'envoi de congé
 *
 * Usage :
 *   window.ICN_CONGES_UI.toggle(containerEl)
 */
class CongesUI {
  constructor() {
    this._congesData  = null;
    this._cycleData   = null;
    this._leaveMap    = {};
    this._leaveTypes  = [];
    this._navDate     = new Date();   // mois affiché
    this._selStart    = null;         // "YYYY-MM-DD"
    this._selEnd      = null;
    this._pendingPayload = null;      // payload en attente de confirmation collision
    this._open        = false;
    this._container   = null;
  }

  // ── API publique ──────────────────────────────────────────────────────────

  async toggle(container) {
    this._container = container;
    if (this._open) {
      this._close();
    } else {
      await this._load();
    }
  }

  // ── Chargement ────────────────────────────────────────────────────────────

  async _load() {
    this._container.innerHTML = '<div class="icn-cg-loading">⏳ Chargement…</div>';
    this._open = true;

    try {
      // Agent ID depuis le storage ou découverte via session
      const stored = await window.ICN_STORAGE.get('icn_olaf_agent_id');
      let agentId = stored.icn_olaf_agent_id || '';

      // Fetch en parallèle
      [this._cycleData, this._congesData] = await Promise.all([
        window.ICN_CYCLE.fetchCycleData(),
        window.ICN_CONGES.loadCongesData(agentId)
      ]);

      // Stocker l'id si découvert
      if (this._congesData?.id && !agentId) {
        await window.ICN_STORAGE.set({ icn_olaf_agent_id: this._congesData.id });
      }

      this._leaveTypes = window.ICN_CONGES.getAvailableLeaveTypes(this._congesData);
      this._leaveMap   = window.ICN_CONGES.getLeaveMap(this._congesData);
      this._navDate    = new Date();
      this._selStart   = null;
      this._selEnd     = null;

      this._render();
    } catch (e) {
      window.ICN_DEBUG.error('[ICN-CG] Erreur chargement:', e);
      this._container.innerHTML = `<div class="icn-cg-err">Erreur : ${e.message}</div>`;
    }
  }

  _close() {
    this._container.innerHTML = '';
    this._open = false;
  }

  // ── Rendu principal ───────────────────────────────────────────────────────

  _render() {
    this._container.innerHTML = `
      <!-- Sélecteur de type -->
      <div class="icn-cg-row">
        <select id="icn-cg-type" class="icn-input" style="margin-bottom:0">
          <option value="">— Type de congé —</option>
          ${this._leaveTypes.map(t =>
            `<option value="${t.id}" data-enddate="${t.enddate}" data-justif="${t.requiredJustification}"
               data-dmin="${t.dureemin||''}" data-dmax="${t.dureemax||''}" data-preavis="${t.priornoticemin}">
               ${t.sigle} — ${t.name}
             </option>`
          ).join('')}
        </select>
      </div>

      <!-- Solde -->
      <div id="icn-cg-provision" class="icn-cg-provision"></div>

      <!-- Calendrier -->
      <div class="icn-cg-cal-wrap">
        <div class="icn-cg-cal-header">
          <button id="icn-cg-prev" class="icn-cg-nav">‹</button>
          <span id="icn-cg-month"></span>
          <button id="icn-cg-next" class="icn-cg-nav">›</button>
        </div>
        <div id="icn-cg-grid" class="icn-cg-grid">
          <div class="icn-cg-head">L</div>
          <div class="icn-cg-head">M</div>
          <div class="icn-cg-head">M</div>
          <div class="icn-cg-head">J</div>
          <div class="icn-cg-head">V</div>
          <div class="icn-cg-head">S</div>
          <div class="icn-cg-head">D</div>
        </div>
      </div>

      <!-- Récap dates sélectionnées -->
      <div id="icn-cg-dates" class="icn-cg-dates"></div>

      <!-- Justification (affichée si requis) -->
      <div id="icn-cg-justif-wrap" style="display:none">
        <textarea id="icn-cg-justif" class="icn-input" placeholder="Justification…" rows="2"
          style="resize:none;margin-top:4px;margin-bottom:0"></textarea>
      </div>

      <!-- Bouton envoi -->
      <button id="icn-cg-submit" class="icn-btn icn-btn-primary" disabled style="margin-top:6px">
        Envoyer
      </button>
      <div id="icn-cg-status" class="icn-feedback"></div>

      <!-- Popup collision équipe -->
      <div id="icn-cg-collision" class="icn-cg-collision" style="display:none">
        <div id="icn-cg-col-header" class="icn-cg-col-header"></div>
        <div id="icn-cg-col-content" class="icn-cg-col-content"></div>
        <div class="icn-cg-col-btns">
          <button id="icn-cg-col-cancel"  class="icn-btn icn-btn-secondary" style="width:48%">Annuler</button>
          <button id="icn-cg-col-confirm" class="icn-btn icn-btn-primary"   style="width:48%">Confirmer</button>
        </div>
      </div>
    `;

    this._renderDays();
    this._updateMonthLabel();
    this._bindEvents();
  }

  // ── Calendrier ────────────────────────────────────────────────────────────

  _renderDays() {
    const grid = document.getElementById('icn-cg-grid');
    if (!grid) return;

    // Vider (garder les heads)
    const heads = Array.from(grid.querySelectorAll('.icn-cg-head'));
    grid.innerHTML = '';
    heads.forEach(h => grid.appendChild(h));

    const year  = this._navDate.getFullYear();
    const month = this._navDate.getMonth();       // 0-based

    const today      = new Date(); today.setHours(0,0,0,0);
    const firstDay   = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Offset lundi = 0
    let offset = firstDay.getDay() - 1;
    if (offset < 0) offset = 6;
    for (let i = 0; i < offset; i++) {
      const e = document.createElement('div');
      e.className = 'icn-cg-cell icn-cg-empty';
      grid.appendChild(e);
    }

    // Type sélectionné → preavis minimum
    const typeId  = document.getElementById('icn-cg-type')?.value;
    const typeObj = this._leaveTypes.find(t => String(t.id) === typeId);
    const preavis = typeObj?.priornoticemin || 0;
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + preavis);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dateObj  = new Date(year, month, d);
      const cycle    = window.ICN_CYCLE.getDayInfo(this._cycleData, dateStr);
      const leaves   = this._leaveMap[dateStr] || [];
      const isPast   = dateObj < today;
      const tooClose = preavis > 0 && dateObj < minDate;
      const inRange  = this._inRange(dateStr);
      const isStart  = dateStr === this._selStart;
      const isEnd    = dateStr === this._selEnd;

      const cell = document.createElement('div');
      cell.className = 'icn-cg-cell';
      cell.dataset.date = dateStr;

      if (cycle.isRest)        cell.classList.add('icn-cg-rest');
      if (isPast || tooClose)  cell.classList.add('icn-cg-disabled');
      if (leaves.length)       cell.classList.add('icn-cg-has-leave');
      if (inRange)             cell.classList.add('icn-cg-range');
      if (isStart)             cell.classList.add('icn-cg-start');
      if (isEnd)               cell.classList.add('icn-cg-end');

      // Horaire du jour (première tranche)
      const hLabel = cycle.horaires && cycle.horaires[0] ? cycle.horaires[0] : '';

      cell.innerHTML = `
        <span class="icn-cg-jlabel">${cycle.label}</span>
        <span class="icn-cg-dnum">${d}</span>
        ${hLabel ? `<span class="icn-cg-hours">${hLabel}</span>` : ''}
        ${leaves.length ? `<span class="icn-cg-dot" title="${leaves.map(l=>l.sigle).join(', ')}"></span>` : ''}
      `;

      grid.appendChild(cell);
    }
  }

  _inRange(dateStr) {
    if (!this._selStart) return false;
    const end = this._selEnd || this._selStart;
    return dateStr >= this._selStart && dateStr <= end;
  }

  _updateMonthLabel() {
    const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const el = document.getElementById('icn-cg-month');
    if (el) el.textContent = `${MONTHS[this._navDate.getMonth()]} ${this._navDate.getFullYear()}`;
  }

  _updateDatesDisplay() {
    const el = document.getElementById('icn-cg-dates');
    if (!el) return;
    if (!this._selStart) { el.textContent = ''; return; }
    const fmt = s => s.split('-').reverse().join('/');
    if (!this._selEnd || this._selEnd === this._selStart) {
      el.textContent = `📅 ${fmt(this._selStart)}`;
    } else {
      el.textContent = `📅 ${fmt(this._selStart)} → ${fmt(this._selEnd)}`;
    }
  }

  _updateProvision() {
    const el     = document.getElementById('icn-cg-provision');
    if (!el) return;
    const typeId = document.getElementById('icn-cg-type')?.value;
    if (!typeId) { el.innerHTML = ''; return; }
    const type  = this._leaveTypes.find(t => String(t.id) === typeId);
    const provs = window.ICN_CONGES.getProvisions(this._congesData);
    const prov  = provs.find(p => p.abbr === type?.sigle);
    el.innerHTML = prov?.amount !== undefined
      ? `<span class="icn-cg-prov">Solde : <b>${prov.amount}</b> j</span>`
      : '';
  }

  _updateSubmit() {
    const btn = document.getElementById('icn-cg-submit');
    if (btn) btn.disabled = !(this._selStart && document.getElementById('icn-cg-type')?.value);
  }

  // ── Événements ────────────────────────────────────────────────────────────

  _bindEvents() {
    document.getElementById('icn-cg-prev')?.addEventListener('click', () => {
      this._navDate.setMonth(this._navDate.getMonth() - 1);
      this._renderDays();
      this._updateMonthLabel();
    });

    document.getElementById('icn-cg-next')?.addEventListener('click', () => {
      this._navDate.setMonth(this._navDate.getMonth() + 1);
      this._renderDays();
      this._updateMonthLabel();
    });

    document.getElementById('icn-cg-type')?.addEventListener('change', e => {
      this._selStart = null;
      this._selEnd   = null;
      this._renderDays();
      this._updateDatesDisplay();
      this._updateProvision();
      this._updateSubmit();

      const typeObj = this._leaveTypes.find(t => String(t.id) === e.target.value);
      const wrap = document.getElementById('icn-cg-justif-wrap');
      if (wrap) wrap.style.display = typeObj?.justification ? 'block' : 'none';
    });

    // Clic sur une cellule — délégation
    document.getElementById('icn-cg-grid')?.addEventListener('click', e => {
      const cell = e.target.closest('.icn-cg-cell[data-date]');
      if (!cell || cell.classList.contains('icn-cg-disabled')) return;

      const typeId = document.getElementById('icn-cg-type')?.value;
      if (!typeId) {
        this._status('Choisissez d\'abord un type de congé.', 'err');
        return;
      }

      const date    = cell.dataset.date;
      const typeObj = this._leaveTypes.find(t => String(t.id) === typeId);
      const needEnd = typeObj?.enddate !== false;   // true = plage possible

      if (!this._selStart || (this._selStart && this._selEnd)) {
        // Début d'une nouvelle sélection
        this._selStart = date;
        this._selEnd   = needEnd ? null : date;
      } else {
        // Fin de sélection
        if (date < this._selStart) {
          this._selEnd   = this._selStart;
          this._selStart = date;
        } else {
          this._selEnd = date;
        }
        if (!needEnd) this._selEnd = this._selStart; // mono-jour forcé

        // Vérifier durée max
        if (typeObj?.dureemax) {
          const diff = (new Date(this._selEnd) - new Date(this._selStart)) / 86400000 + 1;
          if (diff > typeObj.dureemax) {
            this._selEnd = this._selStart; // forcer au mono-jour
            this._status(`Durée max : ${typeObj.dureemax} j.`, 'err');
          }
        }
      }

      this._renderDays();
      this._updateDatesDisplay();
      this._updateSubmit();
    });

    document.getElementById('icn-cg-submit')?.addEventListener('click', () => this._handleSubmit());

    document.getElementById('icn-cg-col-cancel')?.addEventListener('click', () => {
      document.getElementById('icn-cg-collision').style.display = 'none';
      this._pendingPayload = null;
      const btn = document.getElementById('icn-cg-submit');
      if (btn) { btn.disabled = false; btn.textContent = 'Envoyer'; }
    });

    document.getElementById('icn-cg-col-confirm')?.addEventListener('click', () => {
      document.getElementById('icn-cg-collision').style.display = 'none';
      if (this._pendingPayload) this._submitLeave(true);
    });
  }

  // ── Soumission ────────────────────────────────────────────────────────────

  async _handleSubmit() {
    const typeId = document.getElementById('icn-cg-type')?.value;
    if (!typeId || !this._selStart) return;

    const btn = document.getElementById('icn-cg-submit');
    btn.disabled = true;
    btn.textContent = '⏳…';

    try {
      const debut = this._toFR(this._selStart);
      const fin   = this._toFR(this._selEnd || this._selStart);

      // Étape 1 : validation planning
      await window.ICN_CONGES.scheduleCheck(typeId, debut, fin);

      // Étape 2 : première tentative
      await this._submitLeave(false);
    } catch (e) {
      window.ICN_DEBUG.error('[ICN-CG] handleSubmit:', e);
      this._status(`Erreur : ${e.message}`, 'err');
      btn.disabled = false;
      btn.textContent = 'Envoyer';
    }
  }

  async _submitLeave(forceCollision) {
    const typeId = document.getElementById('icn-cg-type')?.value;
    const justif = document.getElementById('icn-cg-justif')?.value || '';
    const aff    = window.ICN_CONGES.getCurrentAffectation(this._congesData);
    const btn    = document.getElementById('icn-cg-submit');

    const payload = window.ICN_CONGES.buildPayload({
      idagent:       this._congesData.id,
      idAffectation: aff.ind,
      congeType:     typeId,
      dateDebut:     this._toFR(this._selStart),
      dateFin:       this._toFR(this._selEnd || this._selStart),
      justification: justif
    }, forceCollision);

    try {
      const result = await window.ICN_CONGES.upsertLeave(payload);

      if (result.error && result.button) {
        // Collision équipe → afficher popup de confirmation
        this._pendingPayload = payload;
        document.getElementById('icn-cg-col-header').innerHTML  = result.popup?.header  || '';
        document.getElementById('icn-cg-col-content').innerHTML = result.popup?.content || '';
        document.getElementById('icn-cg-collision').style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = 'Envoyer'; }
        return;
      }

      if (result.error) {
        this._status(result.message || 'Erreur serveur.', 'err');
        if (btn) { btn.disabled = false; btn.textContent = 'Envoyer'; }
        return;
      }

      // ✅ Succès
      this._status('✅ Congé envoyé !', 'ok');
      this._selStart = null;
      this._selEnd   = null;

      // Recharger les données pour mettre à jour les pastilles
      const stored = await window.ICN_STORAGE.get('icn_olaf_agent_id');
      this._congesData = await window.ICN_CONGES.loadCongesData(stored.icn_olaf_agent_id || '');
      this._leaveMap   = window.ICN_CONGES.getLeaveMap(this._congesData);
      this._renderDays();
      this._updateDatesDisplay();

      if (btn) { btn.disabled = true; btn.textContent = 'Envoyer'; }

      // Informer le reste de l'extension
      if (window.ICN_MAIN) window.ICN_MAIN.applyAll();

    } catch (e) {
      window.ICN_DEBUG.error('[ICN-CG] submitLeave:', e);
      this._status(`Erreur : ${e.message}`, 'err');
      if (btn) { btn.disabled = false; btn.textContent = 'Envoyer'; }
    }
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  _toFR(dateStr) {
    if (!dateStr) return '';
    return dateStr.split('-').reverse().join('/');
  }

  _status(msg, type) {
    const el = document.getElementById('icn-cg-status');
    if (!el) return;
    el.textContent = msg;
    el.className   = `icn-feedback ${type}`;
    setTimeout(() => { el.className = 'icn-feedback'; el.textContent = ''; }, 5000);
  }
}

window.ICN_CONGES_UI = new CongesUI();

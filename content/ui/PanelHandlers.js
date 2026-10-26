/**
 * Événements du panneau.
 */
class PanelHandlers {
  constructor(panelUI) {
    this.ui = panelUI;
    this.learningMode = 'normal';
    this.learningClickHandler = null;
  }

  q(sel) { return this.ui.panel.querySelector(sel); }

  async attach() {
    const panel = this.ui.panel;
    const settingsPanel = this.ui.settingsPanel;

    // Volet paramètres
    this.q('#icn-settings-tab')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.classList.contains('minimized')) panel.classList.remove('minimized');
      const opening = !settingsPanel.classList.contains('open');
      settingsPanel.classList.toggle('open', opening);
      window.ICN_STORAGE.set({ icn_panel_state: { minimized: false, settingsOpen: opening } });
      if (!opening && this.learningMode !== 'normal') this.setLearningMode('normal');
    });

    // Réduire / agrandir
    this.q('#icn-minimize')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const minimized = !panel.classList.contains('minimized');
      panel.classList.toggle('minimized', minimized);
      if (minimized) settingsPanel.classList.remove('open');
      window.ICN_STORAGE.set({ icn_panel_state: { minimized, settingsOpen: false } });
    });

    // Contours on/off
    this.q('#icn-contours-toggle')?.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await window.ICN_STORAGE.set({ icn_enabled: enabled });
      this.ui.setEnabled(enabled, false);
      if (enabled) await window.ICN_MAIN.applyAll();
      else await window.ICN_MAIN.clearAll();
    });

    // Auto-chargement
    this.q('#icn-olaf-autoload')?.addEventListener('change', (e) => {
      window.ICN_STORAGE.set({ icn_olaf_autoload: e.target.checked });
    });

    // Mémoriser
    this.q('#icn-olaf-remember')?.addEventListener('change', async (e) => {
      const remember = e.target.checked;
      await window.ICN_STORAGE.set({ olaf_remember: remember });
      if (!remember) await window.ICN_STORAGE.remove('olaf_pass');
    });

    // Œil mot de passe
    const pass = this.q('#icn-olaf-pass');
    this.q('#icn-toggle-password')?.addEventListener('click', () => {
      pass.type = pass.type === 'password' ? 'text' : 'password';
    });

    // Identifiants → proxy dès qu'ils changent
    const syncCreds = () => {
      const c = this.ui.getCredentials();
      window.ICN_OLAF_PROXY.setCredentials(c.login, c.pass);
    };
    this.q('#icn-olaf-login')?.addEventListener('input', syncCreds);
    pass?.addEventListener('input', syncCreds);
    syncCreds();

    this.q('#icn-olaf-check')?.addEventListener('click', () => this.checkConnection(true));
    this.q('#icn-olaf-open')?.addEventListener('click', () => window.ICN_OLAF_PROXY.openOlaf());
    this.q('#icn-olaf-load')?.addEventListener('click', () => this.handleOlafLoad());

    // Apprentissage
    panel.querySelectorAll('input[name="learning-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => this.setLearningMode(e.target.value));
    });

    // Congés
    this.q('#icn-cg-open-btn')?.addEventListener('click', async () => {
      const container = this.q('#icn-cg-container');
      const btn = this.q('#icn-cg-open-btn');
      if (container && window.ICN_CONGES_UI) {
        await window.ICN_CONGES_UI.toggle(container);
        btn.textContent = window.ICN_CONGES_UI.isOpen() ? '✕ Fermer' : '+ Nouveau congé';
      }
    });

    await this.initCycleConfig();
    await this.updateLearningLists();
  }

  // ── Connexion OLAF ──────────────────────────────────────────────────────

  async checkConnection(verbose = false) {
    this.ui.setConnection('busy');
    const creds = this.ui.getCredentials();
    if (creds.login && creds.pass) await this.ui.saveCredentials(creds);
    const status = await window.ICN_OLAF_PROXY.status(true);
    this.ui.setConnection(status);
    if (verbose) {
      if (status.connected) this.ui.showStatus(`Connecté à OLAF (${status.mode === 'creds' ? 'identifiants' : 'session navigateur'})`, 'success');
      else this.ui.showStatus(`OLAF : ${status.reason || 'non connecté'}`, 'error');
    }
    return status;
  }

  async handleOlafLoad() {
    const btn = this.q('#icn-olaf-load');
    const creds = this.ui.getCredentials();
    if (creds.login && creds.pass) await this.ui.saveCredentials(creds);

    btn.disabled = true;
    this.ui.showStatus('Chargement OLAF…', 'info', { timeout: 0 });
    try {
      const r = await window.ICN_MAIN.loadOlaf({ force: true });
      if (r.ok) {
        this.ui.showStatus(`OLAF chargé : ${r.days} jour(s) travaillé(s) sur la période`, 'success');
        this.ui.setConnection(await window.ICN_OLAF_PROXY.status());
      } else {
        this.ui.showStatus(r.error || 'Échec du chargement OLAF', 'error', { timeout: 8000 });
        this.ui.setConnection(await window.ICN_OLAF_PROXY.status(true));
      }
    } finally {
      btn.disabled = false;
    }
  }

  // ── Cycle ───────────────────────────────────────────────────────────────

  async initCycleConfig() {
    this.q('#icn-cycle-reset')?.addEventListener('click', async () => {
      await window.ICN_STORAGE.remove(window.ICN_CONST.KEY_CYCLE_OVERRIDE);
      await this.renderCycle();
      await window.ICN_MAIN.applyAll();
    });
    await this.renderCycle();
  }

  async renderCycle() {
    const cfg = await window.ICN_CONST.getCycleConfig();
    const info = this.q('#icn-cycle-info');
    const grid = this.q('#icn-working-days-container');
    const reset = this.q('#icn-cycle-reset');
    if (info) {
      const src = cfg.source === 'uciel' ? 'lue dans ECLAIR' : 'par défaut (ECLAIR ne la publie pas)';
      info.textContent = `Cycle de ${cfg.cycleLength} jours, config ${src}${cfg.overridden ? ', jours modifiés par vous' : ''}. Cliquez un jour pour le compter ou non comme travaillé.`;
    }
    if (reset) reset.style.display = cfg.overridden ? '' : 'none';
    if (!grid) return;
    grid.innerHTML = '';
    for (let d = 1; d <= cfg.cycleLength; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'icn-day-btn' + (cfg.workingDays.includes(d) ? ' active' : '');
      b.dataset.day = d;
      b.textContent = 'J' + d;
      b.addEventListener('click', async () => {
        b.classList.toggle('active');
        const days = [...grid.querySelectorAll('.icn-day-btn.active')].map(x => parseInt(x.dataset.day, 10)).sort((a, c) => a - c);
        if (!days.length) { b.classList.add('active'); return; }
        await window.ICN_STORAGE.set({ [window.ICN_CONST.KEY_CYCLE_OVERRIDE]: { cycleLength: cfg.cycleLength, workingDays: days } });
        await this.renderCycle();
        await window.ICN_MAIN.applyAll();
      });
      grid.appendChild(b);
    }
  }

  // ── Apprentissage ───────────────────────────────────────────────────────

  setLearningMode(mode) {
    const radio = this.ui.panel.querySelector(`input[name="learning-mode"][value="${mode}"]`);
    if (radio) radio.checked = true;
    if (this.learningMode !== 'normal') this.deactivateLearningMode();
    this.learningMode = mode;
    const hint = this.q('#icn-learning-instructions');
    if (mode !== 'normal') {
      this.activateLearningMode();
      if (hint) hint.style.display = 'block';
    } else if (hint) {
      hint.style.display = 'none';
    }
  }

  activateLearningMode() {
    this.learningClickHandler = (e) => this.handleLearningClick(e);
    const table = window.ICN_DOM.getCielTable();
    if (!table) return;
    table.addEventListener('click', this.learningClickHandler, true);
    table.classList.add('icn-learning');
    table.style.cursor = 'copy';
  }

  deactivateLearningMode() {
    const table = window.ICN_DOM.getCielTable();
    if (table && this.learningClickHandler) {
      table.removeEventListener('click', this.learningClickHandler, true);
      table.classList.remove('icn-learning');
      table.style.cursor = '';
    }
    this.learningClickHandler = null;
  }

  async handleLearningClick(e) {
    const cell = e.target.closest('tbody td');
    if (!cell) return;
    e.stopPropagation();
    e.preventDefault();
    const fcs = window.ICN_RULES.extractFondclassesFromTd(cell);
    if (!fcs.size) { this.ui.showStatus('Cette case n’a pas de classe exploitable', 'error', { element: '#icn-status-message' }); return; }
    const fc = [...fcs][0];
    const R = window.ICN_RULES;
    if (this.learningMode === 'alpha') {
      (await R.loadAlphaFondclasses()).has(fc) ? await R.removeAlphaFondclasse(fc) : await R.addAlphaFondclasse(fc);
    } else if (this.learningMode === 'beta') {
      (await R.loadBetaFondclasses()).has(fc) ? await R.removeBetaFondclasse(fc) : await R.addBetaFondclasse(fc);
    }
    await this.updateLearningLists();
    await window.ICN_MAIN.applyAll();
  }

  async updateLearningLists() {
    const render = async (type, load, remove) => {
      const set = await load();
      const list = this.q(`#icn-${type}-list`);
      const count = this.q(`#icn-${type}-count`);
      if (count) count.textContent = set.size;
      if (!list) return;
      list.innerHTML = '';
      if (!set.size) { list.innerHTML = '<span class="icn-empty">Aucune classe apprise</span>'; return; }
      for (const fc of set) {
        const item = document.createElement('div');
        item.className = 'icn-class-item';
        item.innerHTML = `<code>fondclasse${fc}</code><button class="icn-class-remove" title="Retirer" type="button">×</button>`;
        item.querySelector('button').addEventListener('click', async () => {
          await remove(fc);
          await this.updateLearningLists();
          await window.ICN_MAIN.applyAll();
        });
        list.appendChild(item);
      }
    };
    const R = window.ICN_RULES;
    await render('alpha', R.loadAlphaFondclasses, R.removeAlphaFondclasse);
    await render('beta', R.loadBetaFondclasses, R.removeBetaFondclasse);
  }
}

window.ICN_PANEL_HANDLERS = PanelHandlers;

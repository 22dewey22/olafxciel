/**
 * Gestion des événements du panel
 */
class PanelHandlers {
  constructor(panelUI) {
    this.ui = panelUI;
    this.learningMode = 'normal';
    this.learningClickHandler = null;
  }

  async attach() {
    const panel = this.ui.panel;

    // Settings panel toggle
    const settingsTab = document.getElementById('icn-settings-tab');
    const settingsPanel = document.getElementById('icn-settings-panel');
    
    if (settingsTab && settingsPanel) {
      settingsTab.addEventListener('click', () => {
        const isOpening = !settingsPanel.classList.contains('open');
        settingsPanel.classList.toggle('open');
        
        // Si on ferme le panneau, désactiver le mode apprentissage
        if (!isOpening && this.learningMode !== 'normal') {
          // Réinitialiser au mode normal
          const normalRadio = panel.querySelector('input[name="learning-mode"][value="normal"]');
          if (normalRadio) {
            normalRadio.checked = true;
            this.handleLearningModeChange({ target: normalRadio });
          }
        }
      });
    }

    // Minimize/Close buttons
    const minimizeBtn = panel.querySelector('#icn-minimize');
    const closeBtn = panel.querySelector('#icn-close');
    
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        panel.classList.toggle('minimized');
      });
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        panel.classList.add('hidden');
      });
    }

    // Toggle contours
    const toggleContours = panel.querySelector('#icn-contours-toggle');
    const contoursStatus = panel.querySelector('#icn-contours-status');
    
    if (toggleContours) {
      toggleContours.addEventListener('change', async (e) => {
        try {
          const enabled = e.target.checked;
          await window.ICN_STORAGE.set({ icn_enabled: enabled });
          
          if (contoursStatus) {
            contoursStatus.textContent = enabled ? 'Actif' : 'Inactif';
            contoursStatus.style.color = enabled ? '#10b981' : '#6b7280';
          }

          if (enabled) {
            await window.ICN_OUTLINE.apply();
          } else {
            await window.ICN_OUTLINE.clearAll();
            if (window.ICN_TOTALS) {
              window.ICN_TOTALS.remove();
            }
          }
        } catch (error) {
          window.ICN_DEBUG.error('[ICN-PANEL] Toggle contours error:', error);
        }
      });
    }

    // OLAF auto-load toggle
    const autoloadToggle = panel.querySelector('#icn-olaf-autoload');
    if (autoloadToggle) {
      autoloadToggle.addEventListener('change', async (e) => {
        try {
          await window.ICN_STORAGE.set({ icn_olaf_autoload: e.target.checked });
        } catch (error) {
          window.ICN_DEBUG.error('[ICN-PANEL] Auto-load toggle error:', error);
        }
      });
    }

    // Remember password
    const rememberCheckbox = panel.querySelector('#icn-olaf-remember');
    if (rememberCheckbox) {
      rememberCheckbox.addEventListener('change', async (e) => {
        try {
          const remember = e.target.checked;
          await window.ICN_STORAGE.set({ olaf_remember: remember });
          
          if (!remember) {
            await window.ICN_STORAGE.remove('olaf_pass');
          }
        } catch (error) {
          window.ICN_DEBUG.error('[ICN-PANEL] Remember toggle error:', error);
        }
      });
    }

    // OLAF test button
    const testBtn = panel.querySelector('#icn-olaf-test');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.handleOlafLoad());
    }

    // Copy diff button
    const copyDiffBtn = panel.querySelector('#icn-copy-diff');
    if (copyDiffBtn) {
      copyDiffBtn.addEventListener('click', () => this.handleDiffCopy());
    }

    // Learning mode radio buttons
    const learningModeRadios = panel.querySelectorAll('input[name="learning-mode"]');
    learningModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => this.handleLearningModeChange(e));
    });

    // Cycle configuration
    await this.initCycleConfig();

    // Initial update of learning lists
    this.updateLearningLists();
  }

  async handleOlafLoad() {
    const loginInput = this.ui.panel.querySelector('#icn-olaf-login');
    const passInput = this.ui.panel.querySelector('#icn-olaf-pass');
    const rememberCheckbox = this.ui.panel.querySelector('#icn-olaf-remember');
    const statusEl = this.ui.panel.querySelector('#icn-olaf-status');

    const login = loginInput?.value?.trim() || '';
    const pass = passInput?.value || '';
    const remember = rememberCheckbox?.checked || false;

    if (!login || !pass) {
      this.showStatus(statusEl, 'Login et mot de passe requis', 'error');
      return;
    }

    this.showStatus(statusEl, '⏳ Chargement OLAF...', 'info');

    try {
      // Save credentials
      await window.ICN_STORAGE.set({
        olaf_login: login,
        olaf_pass: remember ? pass : '',
        olaf_remember: remember
      });

      // Detect cible
      let cible = null;
      const storedCible = await window.ICN_STORAGE.get('icn_olaf_cible');
      
      if (storedCible.icn_olaf_cible) {
        cible = storedCible.icn_olaf_cible;
      } else {
        const detection = await window.ICN_OLAF.detectCible(login, pass);
        if (!detection.ok) {
          this.showStatus(statusEl, `❌ ${detection.error}`, 'error');
          return;
        }
        cible = detection.cible;
      }

      // Get CIEL data
      const cielData = await window.ICN_REPORT.buildReport();
      if (!cielData || !cielData.ok) {
        this.showStatus(statusEl, '❌ Erreur lecture CIEL', 'error');
        return;
      }

      // Parse month/year
      const parser = new CielParser();
      const parsed = parser.parseMonthLabel(cielData.month_label);
      if (!parsed) {
        this.showStatus(statusEl, '❌ Impossible de déterminer le mois', 'error');
        return;
      }

      const { year, month } = parsed;

      // Fetch OLAF
      const olafReport = await window.ICN_OLAF.buildReport({
        login,
        pass,
        year,
        month,
        cible
      });

      if (!olafReport.ok) {
        this.showStatus(statusEl, `❌ ${olafReport.error}`, 'error');
        return;
      }

      // Store OLAF data
      const olafDataToStore = {};
      for (const day of olafReport.days || []) {
        olafDataToStore[day.day_str] = {
          alpha: day.alpha,
          beta: day.beta
        };
      }
      await window.ICN_STORAGE.set({ icn_olaf_data: olafDataToStore });

      // Generate diff
      const diffText = this.generateDiff(cielData, olafReport, month);
      await window.ICN_STORAGE.set({ icn_diff_report: diffText });

      // Refresh outlines
      const enabled = await window.ICN_STORAGE.get('icn_enabled');
      if (enabled.icn_enabled) {
        await window.ICN_OUTLINE.apply();
      }

      this.showStatus(statusEl, '✅ Chargement terminé', 'success');
    } catch (err) {
      window.ICN_DEBUG.error('[ICN-PANEL] handleOlafLoad error:', err);
      window.ICN_DEBUG.error('[ICN-PANEL] Error message:', err.message);
      this.showStatus(statusEl, `❌ ${err.message}`, 'error');
    }
  }

  generateDiff(cielData, olafReport, month) {
    const olafByDay = new Map();
    for (const d of olafReport.days || []) {
      // Convertir les noms complets OLAF en TRI (3 premières lettres du nom)
      const alphaTRI = new Set(d.alpha.map(name => {
        const parts = name.split(' ');
        const lastName = parts[parts.length - 1]; // Dernier mot = nom de famille
        return lastName.substring(0, 3).toUpperCase();
      }));
      
      const betaTRI = new Set(d.beta.map(name => {
        const parts = name.split(' ');
        const lastName = parts[parts.length - 1];
        return lastName.substring(0, 3).toUpperCase();
      }));
      
      olafByDay.set(d.day_str, {
        alpha: alphaTRI,
        beta: betaTRI
      });
    }

    const diffLines = [];
    diffLines.push(`Diff Olaf ↔ CIEL • ${cielData.month_label} • ${cielData.days.length} jour(s)`);
    diffLines.push('');

    let hasDiff = false;

    for (const d of cielData.days) {
      // Filter out days not in current month
      const dayDate = new Date(d.day_str);
      if (dayDate.getMonth() + 1 !== month) {
        continue;
      }

      const cielAlpha = new Set((d.alpha_agents || '').split(/\s+/).filter(Boolean));
      const cielBeta = new Set((d.beta_agents || '').split(/\s+/).filter(Boolean));

      const olafDay = olafByDay.get(d.day_str);
      const olafAlpha = olafDay ? olafDay.alpha : new Set();
      const olafBeta = olafDay ? olafDay.beta : new Set();

      const alphaPlus = [...olafAlpha].filter(x => !cielAlpha.has(x)).sort();
      const alphaMinus = [...cielAlpha].filter(x => !olafAlpha.has(x)).sort();
      const betaPlus = [...olafBeta].filter(x => !cielBeta.has(x)).sort();
      const betaMinus = [...cielBeta].filter(x => !olafBeta.has(x)).sort();

      if (alphaPlus.length || alphaMinus.length || betaPlus.length || betaMinus.length) {
        hasDiff = true;
        diffLines.push(`${d.label}  ${d.cycle}`);
        
        if (alphaPlus.length) diffLines.push(`  ALPHA manquant CIEL: ${alphaPlus.join(' ')}`);
        if (alphaMinus.length) diffLines.push(`  ALPHA en trop CIEL: ${alphaMinus.join(' ')}`);
        if (betaPlus.length) diffLines.push(`  BETA manquant CIEL: ${betaPlus.join(' ')}`);
        if (betaMinus.length) diffLines.push(`  BETA en trop CIEL: ${betaMinus.join(' ')}`);
        diffLines.push('---');
      }
    }

    if (!hasDiff) {
      diffLines.push('✅ Aucune différence détectée');
    }

    return diffLines.join('\n');
  }

  async handleDiffCopy() {
    const statusEl = this.ui.panel.querySelector('#icn-copy-status');
    
    try {
      const result = await window.ICN_STORAGE.get('icn_diff_report');
      const diffText = result.icn_diff_report || 'Aucune comparaison disponible';
      
      await navigator.clipboard.writeText(diffText);
      this.showStatus(statusEl, '✅ Copié dans le presse-papier', 'success');
    } catch (err) {
      this.showStatus(statusEl, '❌ Erreur de copie', 'error');
    }
  }

  showStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = `icn-status-message ${type}`;
    setTimeout(() => {
      element.className = 'icn-status-message';
    }, 3000);
  }

  // ========== CONFIGURATION DU CYCLE ==========

  async initCycleConfig() {
    const panel = this.ui.panel;
    
    // Charger la config actuelle
    const config = await window.ICN_CONST.getCycleConfig();
    
    // Remplir la date de début
    const startDateInput = document.getElementById('icn-cycle-start-date');
    if (startDateInput) {
      startDateInput.value = config.cycleStartDate;
      
      // Sauvegarder automatiquement au changement
      startDateInput.addEventListener('change', async () => {
        await this.autoSaveCycleConfig();
      });
    }
    
    // Sélectionner la longueur du cycle
    const cycleLengthRadios = panel.querySelectorAll('input[name="cycle-length"]');
    cycleLengthRadios.forEach(radio => {
      radio.checked = (parseInt(radio.value) === config.cycleLength);
      
      // Sauvegarder automatiquement au changement + régénérer les boutons
      radio.addEventListener('change', async () => {
        this.updateWorkingDaysUI();
        await this.autoSaveCycleConfig();
      });
    });
    
    // Générer les boutons de jours travaillés
    this.updateWorkingDaysUI();
  }

  updateWorkingDaysUI() {
    const panel = this.ui.panel;
    const container = document.getElementById('icn-working-days-container');
    if (!container) return;
    
    // Récupérer la longueur du cycle sélectionnée
    const selectedLength = parseInt(panel.querySelector('input[name="cycle-length"]:checked')?.value || 12);
    
    // Récupérer la config actuelle pour savoir quels jours sont cochés
    window.ICN_CONST.getCycleConfig().then(config => {
      container.innerHTML = '';
      
      for (let day = 1; day <= selectedLength; day++) {
        const btn = document.createElement('label');
        btn.className = 'icn-mode-btn icn-working-day-btn';

        const label = document.createElement('span');
        label.className = 'icn-mode-label';
        label.textContent = day;
        btn.dataset.day = day;
        btn.appendChild(label);
        if (config.workingDays.includes(day)) {
          btn.classList.add('active');
        }
        
        // Sauvegarder automatiquement au clic
        btn.addEventListener('click', async () => {
          btn.classList.toggle('active');
          await this.autoSaveCycleConfig();
        });
        
        container.appendChild(btn);
      }
    });
  }

  async autoSaveCycleConfig() {
    const panel = this.ui.panel;
    
    // Récupérer les valeurs
    const startDate = document.getElementById('icn-cycle-start-date')?.value;
    const cycleLength = parseInt(panel.querySelector('input[name="cycle-length"]:checked')?.value || 12);
    
    // Récupérer les jours travaillés
    const workingDayBtns = document.querySelectorAll('.icn-working-day-btn.active');
    const workingDays = Array.from(workingDayBtns).map(btn => parseInt(btn.dataset.day)).sort((a, b) => a - b);
    
    // Validation silencieuse
    if (!startDate || workingDays.length === 0) {
      return;
    }
    
    // Sauvegarder
    const config = {
      cycleStartDate: startDate,
      cycleLength: cycleLength,
      workingDays: workingDays
    };
    
    await window.ICN_STORAGE.set({ icn_cycle_config: config });
    
    window.ICN_DEBUG.log('[ICN] Config cycle sauvegardée:', config);
    
    // Rafraîchir les contours automatiquement
    const enabled = await window.ICN_STORAGE.get('icn_enabled');
    if (enabled.icn_enabled && window.ICN_OUTLINE) {
      await window.ICN_OUTLINE.apply();
    }
  }

  // ========== MODE D'APPRENTISSAGE ==========

  async handleLearningModeChange(e) {
    const newMode = e.target.value;
    
    // Deactivate old mode
    if (this.learningMode !== 'normal') {
      this.deactivateLearningMode();
    }
    
    this.learningMode = newMode;
    
    // Activate new mode
    const instructionsEl = this.ui.panel.querySelector('#icn-learning-instructions');
    if (this.learningMode !== 'normal') {
      this.activateLearningMode();
      if (instructionsEl) instructionsEl.style.display = 'block';
    } else {
      if (instructionsEl) instructionsEl.style.display = 'none';
    }
  }

  activateLearningMode() {
    this.learningClickHandler = (e) => this.handleLearningClick(e);
    const cells = document.querySelectorAll('tbody td');
    
    cells.forEach(cell => {
      cell.dataset.icnOldOnclick = cell.onclick ? 'true' : 'false';
      cell.onclick = null;
      cell.addEventListener('click', this.learningClickHandler);
      cell.style.cursor = 'copy';
    });
  }

  deactivateLearningMode() {
    if (this.learningClickHandler) {
      const cells = document.querySelectorAll('tbody td');
      cells.forEach(cell => {
        cell.removeEventListener('click', this.learningClickHandler);
        cell.style.cursor = '';
      });
      this.learningClickHandler = null;
    }
  }

  async handleLearningClick(e) {
    e.stopPropagation();
    e.preventDefault();
    
    const cell = e.currentTarget;
    const fondclasses = window.ICN_RULES.extractFondclassesFromTd(cell);
    
    if (fondclasses.size === 0) return;
    
    const fondclasse = Array.from(fondclasses)[0];
    
    if (this.learningMode === 'alpha') {
      const alphaFondclasses = await window.ICN_RULES.loadAlphaFondclasses();
      
      if (alphaFondclasses.has(fondclasse)) {
        await window.ICN_RULES.removeAlphaFondclasse(fondclasse);
      } else {
        await window.ICN_RULES.addAlphaFondclasse(fondclasse);
      }
    } else if (this.learningMode === 'beta') {
      const betaFondclasses = await window.ICN_RULES.loadBetaFondclasses();
      
      if (betaFondclasses.has(fondclasse)) {
        await window.ICN_RULES.removeBetaFondclasse(fondclasse);
      } else {
        await window.ICN_RULES.addBetaFondclasse(fondclasse);
      }
    }
    
    await this.updateLearningLists();
    
    if (window.ICN_OUTLINE) {
      await window.ICN_OUTLINE.apply();
    }
  }

  async updateLearningLists() {
    const alphaFondclasses = await window.ICN_RULES.loadAlphaFondclasses();
    const betaFondclasses = await window.ICN_RULES.loadBetaFondclasses();
    
    // Update ALPHA
    const alphaList = this.ui.panel.querySelector('#icn-alpha-list');
    const alphaCount = this.ui.panel.querySelector('#icn-alpha-count');
    
    if (alphaCount) alphaCount.textContent = alphaFondclasses.size;
    
    if (alphaList) {
      if (alphaFondclasses.size === 0) {
        alphaList.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 8px;">Aucune classe</div>';
      } else {
        alphaList.innerHTML = '';
        for (const fc of alphaFondclasses) {
          const item = document.createElement('div');
          item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; border-bottom: 1px solid #f3f4f6;';
          item.innerHTML = `
            <span style="color: #10b981;">fondclasse${fc}</span>
            <button class="icn-remove-fondclasse" data-type="alpha" data-fc="${fc}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;">×</button>
          `;
          alphaList.appendChild(item);
        }
      }
    }
    
    // Update BETA
    const betaList = this.ui.panel.querySelector('#icn-beta-list');
    const betaCount = this.ui.panel.querySelector('#icn-beta-count');
    
    if (betaCount) betaCount.textContent = betaFondclasses.size;
    
    if (betaList) {
      if (betaFondclasses.size === 0) {
        betaList.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 8px;">Aucune classe</div>';
      } else {
        betaList.innerHTML = '';
        for (const fc of betaFondclasses) {
          const item = document.createElement('div');
          item.style.cssText = 'display: flex; align-items: center; justify-content; space-between; padding: 4px 6px; border-bottom: 1px solid #f3f4f6;';
          item.innerHTML = `
            <span style="color: #3b82f6;">fondclasse${fc}</span>
            <button class="icn-remove-fondclasse" data-type="beta" data-fc="${fc}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px;">×</button>
          `;
          betaList.appendChild(item);
        }
      }
    }

    // Add click handlers for remove buttons
    this.ui.panel.querySelectorAll('.icn-remove-fondclasse').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const type = e.currentTarget.dataset.type;
        const fc = parseInt(e.currentTarget.dataset.fc);
        
        if (type === 'alpha') {
          await window.ICN_RULES.removeAlphaFondclasse(fc);
        } else {
          await window.ICN_RULES.removeBetaFondclasse(fc);
        }
        
        await this.updateLearningLists();
        
        if (window.ICN_OUTLINE) {
          await window.ICN_OUTLINE.apply();
        }
      });
    });
  }
}

window.ICN_PANEL_HANDLERS = PanelHandlers;

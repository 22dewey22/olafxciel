/**
 * Gestion de l'interface du panel
 */
class PanelUI {
  constructor() {
    this.panel = null;
    this.settingsPanel = null;
    this.isOpen = true;
  }

  async loadTemplate(filename) {
    try {
      const url = browser.runtime.getURL(`content/ui/templates/${filename}`);
      const response = await fetch(url);
      return await response.text();
    } catch (error) {
      window.ICN_DEBUG.error('[ICN-PANEL] ❌ Failed to load template:', filename, error);
      throw new Error(`Failed to load template ${filename}: ${error.message}`);
    }
  }

  async create() {
    // Charger HTML et CSS
    const html = await this.loadTemplate('panel.html');
    const css = await this.loadTemplate('panel.css');

    // Injecter CSS
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Injecter HTML panel principal (avec settings panel dedans)
    const container = document.createElement('div');
    container.innerHTML = html;
    this.panel = container.firstElementChild;
    document.body.appendChild(this.panel);

    // Référence au settings panel
    this.settingsPanel = this.panel.querySelector('#icn-settings-panel');

    // Setup drag & drop
    this.setupDrag();

    // Charger les settings depuis storage
    await this.loadSettings();

    return this.panel;
  }

  setupDrag() {
    const header = this.panel.querySelector('#icn-panel-header');
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.icn-btn-icon')) return;
      
      isDragging = true;
      const rect = this.panel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      this.panel.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      let x = e.clientX - dragOffset.x;
      let y = e.clientY - dragOffset.y;

      // Limites
      x = Math.max(0, Math.min(x, window.innerWidth - this.panel.offsetWidth));
      y = Math.max(0, Math.min(y, window.innerHeight - this.panel.offsetHeight));

      this.panel.style.left = x + 'px';
      this.panel.style.top = y + 'px';
      this.panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.panel.style.transition = '';
      }
    });
  }

  async loadSettings() {
    const result = await window.ICN_STORAGE.get([
      'icn_enabled',
      'olaf_login',
      'olaf_pass',
      'olaf_remember',
      'icn_olaf_autoload',
      'icn_diff_report'
    ]);

    // Toggle contours
    const toggleContours = this.panel.querySelector('#icn-contours-toggle');
    const contoursStatus = this.panel.querySelector('#icn-contours-status');
    if (toggleContours) {
      const enabled = Boolean(result.icn_enabled);
      toggleContours.checked = enabled;
      
      // Mettre à jour le texte de statut
      if (contoursStatus) {
        contoursStatus.textContent = enabled ? 'Actif' : 'Inactif';
        contoursStatus.style.color = enabled ? '#10b981' : '#6b7280';
      }
    }

    // OLAF credentials
    const loginInput = this.panel.querySelector('#icn-olaf-login');
    const passInput = this.panel.querySelector('#icn-olaf-pass');
    const rememberCheckbox = this.panel.querySelector('#icn-olaf-remember');
    
    if (loginInput) loginInput.value = result.olaf_login || '';
    if (passInput && result.olaf_remember) passInput.value = result.olaf_pass || '';
    if (rememberCheckbox) rememberCheckbox.checked = Boolean(result.olaf_remember);

    // Auto-load
    const autoloadCheckbox = this.panel.querySelector('#icn-olaf-autoload');
    if (autoloadCheckbox) autoloadCheckbox.checked = Boolean(result.icn_olaf_autoload);

    // Diff report
    const diffReport = this.panel.querySelector('#diff-report');
    if (diffReport && result.icn_diff_report) {
      diffReport.textContent = result.icn_diff_report;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.panel.classList.toggle('icn-hidden', !this.isOpen);
  }

  showStatus(message, type = 'info') {
    const statusEl = this.panel.querySelector('#icn-status-message');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `p-3 rounded-lg text-sm font-medium status-${type}`;
    statusEl.classList.remove('hidden');

    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }

  updateDiffReport(text) {
    const diffReport = this.panel.querySelector('#diff-report');
    if (diffReport) {
      diffReport.textContent = text;
    }
  }

  getCredentials() {
    const loginInput = this.panel.querySelector('#olaf-login');
    const passInput = this.panel.querySelector('#olaf-pass');
    const rememberCheckbox = this.panel.querySelector('#olaf-remember');

    return {
      login: loginInput?.value?.trim() || '',
      pass: passInput?.value || '',
      remember: rememberCheckbox?.checked || false
    };
  }

  async saveCredentials(login, pass, remember) {
    await window.ICN_STORAGE.set({
      olaf_login: login,
      olaf_pass: remember ? pass : '',
      olaf_remember: remember
    });
  }
}

window.ICN_PANEL_UI = new PanelUI();

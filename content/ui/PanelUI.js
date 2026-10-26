/**
 * Panneau flottant : création, drag, chargement des réglages, affichage d'état.
 */
class PanelUI {
  constructor() {
    this.panel = null;
    this.settingsPanel = null;
  }

  async loadTemplate(filename) {
    const url = browser.runtime.getURL(`content/ui/templates/${filename}`);
    const response = await fetch(url);
    return await response.text();
  }

  async create() {
    const [html, css] = await Promise.all([this.loadTemplate('panel.html'), this.loadTemplate('panel.css')]);

    const style = document.createElement('style');
    style.id = 'icn-panel-styles';
    style.setAttribute('data-icn-ignore', '1');
    style.textContent = css;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.innerHTML = html;
    this.panel = container.firstElementChild;
    this.panel.setAttribute('data-icn-ignore', '1');
    document.body.appendChild(this.panel);

    this.settingsPanel = this.panel.querySelector('#icn-settings-panel');
    this.panel.querySelectorAll('details').forEach(d => { d.open = false; });

    try {
      const v = browser.runtime.getManifest().version;
      const el = this.panel.querySelector('#icn-version');
      if (el) el.textContent = 'v' + v;
    } catch (e) { /* ignore */ }

    this.setupDrag();
    await this.loadSettings();
    return this.panel;
  }

  setupDrag() {
    const header = this.panel.querySelector('#icn-panel-header');
    let dragging = false;
    let off = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      const r = this.panel.getBoundingClientRect();
      off = { x: e.clientX - r.left, y: e.clientY - r.top };
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(e.clientX - off.x, window.innerWidth - this.panel.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - off.y, window.innerHeight - 40));
      this.panel.style.left = x + 'px';
      this.panel.style.top = y + 'px';
      this.panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const r = this.panel.getBoundingClientRect();
      window.ICN_STORAGE.set({ icn_panel_position: { x: r.left, y: r.top } });
    });
  }

  async loadSettings() {
    const r = await window.ICN_STORAGE.get([
      'icn_enabled', 'olaf_login', 'olaf_pass', 'olaf_remember',
      'icn_olaf_autoload', 'icn_panel_position', 'icn_panel_state'
    ]);
    const q = (s) => this.panel.querySelector(s);

    this.setEnabled(r.icn_enabled === undefined ? true : Boolean(r.icn_enabled), false);

    if (q('#icn-olaf-login')) q('#icn-olaf-login').value = r.olaf_login || '';
    if (q('#icn-olaf-pass')) q('#icn-olaf-pass').value = r.olaf_remember ? (r.olaf_pass || '') : '';
    if (q('#icn-olaf-remember')) q('#icn-olaf-remember').checked = Boolean(r.olaf_remember);
    if (q('#icn-olaf-autoload')) q('#icn-olaf-autoload').checked = r.icn_olaf_autoload === undefined ? true : Boolean(r.icn_olaf_autoload);

    const pos = r.icn_panel_position;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      this.panel.style.left = Math.min(pos.x, window.innerWidth - 60) + 'px';
      this.panel.style.top = Math.min(pos.y, window.innerHeight - 60) + 'px';
      this.panel.style.right = 'auto';
    }
    const state = r.icn_panel_state || {};
    this.panel.classList.toggle('minimized', !!state.minimized);
    if (this.settingsPanel) this.settingsPanel.classList.toggle('open', !!state.settingsOpen && !state.minimized);
  }

  /** Reflète l'état du toggle contours (sans déclencher l'apply). */
  setEnabled(enabled, updateInput = true) {
    const toggle = this.panel.querySelector('#icn-contours-toggle');
    const chip = this.panel.querySelector('#icn-contours-status');
    if (toggle && updateInput) toggle.checked = enabled;
    if (toggle && !updateInput) toggle.checked = enabled;
    if (chip) {
      chip.textContent = enabled ? 'Actif' : 'Inactif';
      chip.classList.toggle('on', enabled);
    }
  }

  /** État de connexion OLAF : { connected, prenom, nom, reason, mode } | 'busy' */
  setConnection(status) {
    const wrap = this.panel.querySelector('#icn-olaf-conn');
    const text = this.panel.querySelector('#icn-olaf-conn-text');
    if (!wrap || !text) return;
    wrap.classList.remove('ok', 'ko', 'busy');
    if (status === 'busy') {
      wrap.classList.add('busy');
      text.textContent = 'vérification…';
      return;
    }
    if (status && status.connected) {
      wrap.classList.add('ok');
      const who = [status.prenom, status.nom].filter(Boolean).join(' ');
      text.textContent = who ? `connecté · ${who}` : 'connecté';
      wrap.title = status.mode === 'creds' ? 'Connecté avec les identifiants du panneau' : 'Connecté via votre session OLAF';
    } else {
      wrap.classList.add('ko');
      text.textContent = 'non connecté';
      wrap.title = (status && status.reason) || 'Ouvrez OLAF et connectez-vous, ou saisissez vos identifiants';
    }
  }

  showStatus(message, type = 'info', { element = '#icn-olaf-status', timeout = 4000 } = {}) {
    const el = this.panel.querySelector(element);
    if (!el) return;
    el.textContent = message;
    el.className = `icn-feedback ${type}`;
    clearTimeout(el._icnTimer);
    if (timeout) el._icnTimer = setTimeout(() => { el.className = 'icn-feedback'; }, timeout);
  }

  getCredentials() {
    const login = this.panel.querySelector('#icn-olaf-login')?.value?.trim() || '';
    const pass = this.panel.querySelector('#icn-olaf-pass')?.value || '';
    const remember = this.panel.querySelector('#icn-olaf-remember')?.checked || false;
    return { login, pass, remember };
  }

  async saveCredentials({ login, pass, remember }) {
    await window.ICN_STORAGE.set({
      olaf_login: login,
      olaf_pass: remember ? pass : '',
      olaf_remember: remember
    });
  }
}

window.ICN_PANEL_UI = new PanelUI();

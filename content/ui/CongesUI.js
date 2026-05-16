(function () {

  // ── État interne ───────────────────────────────────────────────────────────

  let _open           = false;
  let _container      = null;
  let _agentId        = null;
  let _types          = [];
  let _pendingPayload = null; // { agentId, congeType, debut, fin }

  // ── Helpers DOM ────────────────────────────────────────────────────────────

  function _el(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v);
    }
    for (const child of children) {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child) el.appendChild(child);
    }
    return el;
  }

  function _creds() {
    const panel = window.ICN_PANEL_UI?.panel;
    if (!panel) return null;
    const login = panel.querySelector('#icn-olaf-login')?.value?.trim() || '';
    const pass  = panel.querySelector('#icn-olaf-pass')?.value || '';
    if (!login || !pass) return null;
    return { login, pass };
  }

  function _fmtDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  // ── Rendu formulaire ───────────────────────────────────────────────────────

  function _renderForm() {
    _container.innerHTML = '';

    const select = _el('select', { class: 'icn-cg-select', id: 'icn-cg-type' });
    for (const t of _types) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.sigle} — ${t.label}`;
      select.appendChild(opt);
    }

    const today      = new Date().toISOString().split('T')[0];
    const inputDebut = _el('input', { type: 'date', class: 'icn-cg-date', id: 'icn-cg-debut', value: today });
    const inputFin   = _el('input', { type: 'date', class: 'icn-cg-date', id: 'icn-cg-fin',   value: today });
    const btn        = _el('button', { class: 'icn-cg-btn', id: 'icn-cg-submit' }, '✉ Envoyer');

    _container.appendChild(_el('div', { class: 'icn-cg-form' },
      _el('label', { class: 'icn-cg-label' }, 'Type de congé'), select,
      _el('label', { class: 'icn-cg-label' }, 'Du'),            inputDebut,
      _el('label', { class: 'icn-cg-label' }, 'Au'),            inputFin,
      btn
    ));

    btn.addEventListener('click', _handleSubmit);
  }

  // ── Rendu popup confirmation ───────────────────────────────────────────────

  function _renderPopup(result) {
    _container.innerHTML = '';

    _container.appendChild(_el('div', { class: 'icn-cg-popup-header' },
      result.popup?.header || 'Confirmation'));

    const body = _el('div', { class: 'icn-cg-popup-body' });

    if (result.collision) {
      for (const c of (result.popup?.data || [])) {
        body.appendChild(_el('div', { class: 'icn-cg-conflict' },
          _el('span', { class: 'icn-cg-conflict-date' }, c.datefr   || ''),
          _el('span', { class: 'icn-cg-conflict-type' }, c.activity || '')
        ));
      }
    }

    if (result.decompte) {
      const d = result.popup?.data?.decompte;
      if (d) {
        body.appendChild(_el('div', { class: 'icn-cg-decompte' },
          _el('div', {}, `Type : ${d.type || '?'}`),
          _el('div', {}, `Durée : ${d.duree || '?'} jour(s)`),
          _el('div', {}, `Du ${d.debut || ''} au ${d.fin || ''}`)
        ));
      }
      if (result.popup?.data?.suficientProvisions === false) {
        body.appendChild(_el('div', { class: 'icn-cg-warning' }, '⚠ Provisions insuffisantes'));
      }
    }

    _container.appendChild(body);

    const btnCancel  = _el('button', { class: 'icn-cg-btn icn-cg-btn--cancel'  }, '✕ Annuler');
    const btnConfirm = _el('button', { class: 'icn-cg-btn icn-cg-btn--confirm' }, '✓ Confirmer');

    btnCancel.addEventListener('click',  () => _renderForm());
    btnConfirm.addEventListener('click', () => _handleRetry(result));

    _container.appendChild(_el('div', { class: 'icn-cg-popup-actions' }, btnCancel, btnConfirm));
  }

  function _renderError(msg, showBack = true) {
    _container.innerHTML = '';
    _container.appendChild(_el('div', { class: 'icn-cg-error' }, msg));
    if (showBack) {
      const btnBack = _el('button', { class: 'icn-cg-btn icn-cg-btn--cancel' }, '← Retour');
      btnBack.addEventListener('click', () => _renderForm());
      _container.appendChild(btnBack);
    }
  }

  // ── Soumission ─────────────────────────────────────────────────────────────

  async function _handleSubmit() {
    const creds = _creds();
    if (!creds) { _renderError('Login/mot de passe manquants dans le panel', false); return; }

    const debut = _container.querySelector('#icn-cg-debut')?.value;
    const fin   = _container.querySelector('#icn-cg-fin')?.value;
    if (!debut || !fin) { return; }
    if (debut > fin) {
      const errEl = _container.querySelector('.icn-cg-date-error') || _el('div', { class: 'icn-cg-date-error' });
      errEl.textContent = 'Date début > date fin';
      _container.querySelector('.icn-cg-form')?.appendChild(errEl);
      return;
    }

    _pendingPayload = {
      agentId:    _agentId,
      congeType:  _container.querySelector('#icn-cg-type')?.value,
      debut:      _fmtDate(debut),
      fin:        _fmtDate(fin),
    };

    const btn = _container.querySelector('#icn-cg-submit');
    if (btn) btn.disabled = true;

    const result = await window.ICN_CONGES_CLIENT.submitLeave(
      creds.login, creds.pass, _pendingPayload);
    _handleResult(result);
  }

  async function _handleRetry(prevResult) {
    const creds = _creds();
    if (!creds || !_pendingPayload) return;

    const flags = {};
    if (prevResult.collision) {
      flags.passCheckSelfCollision = true;
      flags.passCheckTeamCollision = true;
    }
    if (prevResult.decompte) {
      flags.passCountProposal = true;
    }

    const result = await window.ICN_CONGES_CLIENT.submitLeave(
      creds.login, creds.pass,
      { ..._pendingPayload, passFlags: flags }
    );
    _handleResult(result);
  }

  function _handleResult(result) {
    if (result.ok) {
      _container.innerHTML = '';
      _container.appendChild(_el('div', { class: 'icn-cg-success' },
        `✅ Congé envoyé (id : ${result.id})`));
      if (window.ICN_OUTLINE) window.ICN_OUTLINE.refresh();
      return;
    }
    if (result.http) { _renderError(`Erreur serveur HTTP ${result.http}`); return; }
    if (result.collision || result.decompte) { _renderPopup(result); return; }
    if (result.hard) { _renderError(result.popup?.header || 'Erreur'); return; }
  }

  // ── Init / close ──────────────────────────────────────────────────────────

  async function _load(container) {
    _container = container;
    _open      = true;
    _container.innerHTML = '';
    _container.appendChild(_el('div', { class: 'icn-cg-loading' }, '⏳ Chargement…'));

    const creds = _creds();
    if (!creds) {
      _container.innerHTML = '';
      _container.appendChild(_el('div', { class: 'icn-cg-error' },
        'Login/mot de passe requis dans le panel OLAF'));
      return;
    }

    const idResult = await window.ICN_CONGES_CLIENT.fetchAgentId(creds.login, creds.pass);
    if (!idResult.ok) {
      _container.innerHTML = '';
      _container.appendChild(_el('div', { class: 'icn-cg-error' },
        `Impossible de récupérer l'ID agent : ${idResult.error}`));
      return;
    }
    _agentId = idResult.agentId;

    const typesResult = await window.ICN_CONGES_CLIENT.fetchLeaveTypes(
      creds.login, creds.pass, _agentId);
    if (!typesResult.ok) {
      _container.innerHTML = '';
      _container.appendChild(_el('div', { class: 'icn-cg-error' },
        `Erreur chargement types : ${typesResult.error}`));
      return;
    }
    if (typesResult.types.length === 0) {
      _container.innerHTML = '';
      _container.appendChild(_el('div', { class: 'icn-cg-error' },
        'Module non disponible pour ce profil'));
      return;
    }

    _types = typesResult.types;
    _renderForm();
  }

  function _close() {
    _open           = false;
    _agentId        = null;
    _types          = [];
    _pendingPayload = null;
    if (_container) _container.innerHTML = '';
  }

  // ── API publique ───────────────────────────────────────────────────────────

  async function toggle(container) {
    if (_open) { _close(); } else { await _load(container); }
    return _open;
  }

  window.ICN_CONGES_UI = {
    toggle,
    get _open() { return _open; }
  };

})();

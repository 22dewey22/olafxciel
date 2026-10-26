/**
 * Module d'envoi de congés OLAF depuis le panneau.
 */
(function () {
  let _open = false;
  let _container = null;
  let _agentId = null;
  let _types = [];
  let _pending = null;

  function _el(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    }
    for (const c of children) {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else if (c) el.appendChild(c);
    }
    return el;
  }

  function _fmtDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function _renderForm() {
    _container.innerHTML = '';
    const select = _el('select', { class: 'icn-cg-select', id: 'icn-cg-type' });
    for (const t of _types) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.sigle} — ${t.label}`;
      select.appendChild(opt);
    }
    const today = new Date().toISOString().split('T')[0];
    const debut = _el('input', { type: 'date', class: 'icn-cg-date', id: 'icn-cg-debut', value: today });
    const fin = _el('input', { type: 'date', class: 'icn-cg-date', id: 'icn-cg-fin', value: today });
    const btn = _el('button', { class: 'icn-btn icn-btn-primary icn-btn-block icn-cg-btn', id: 'icn-cg-submit', type: 'button' }, 'Envoyer la demande');

    debut.addEventListener('change', () => { if (fin.value < debut.value) fin.value = debut.value; });

    _container.appendChild(_el('div', { class: 'icn-cg-form' },
      _el('label', { class: 'icn-cg-label' }, 'Type de congé'), select,
      _el('label', { class: 'icn-cg-label' }, 'Du'), debut,
      _el('label', { class: 'icn-cg-label' }, 'Au'), fin,
      btn
    ));
    btn.addEventListener('click', _handleSubmit);
  }

  function _renderPopup(result) {
    _container.innerHTML = '';
    _container.appendChild(_el('div', { class: 'icn-cg-popup-header' }, result.popup?.header || 'Confirmation'));
    const body = _el('div', { class: 'icn-cg-popup-body' });

    if (result.collision) {
      for (const c of (result.popup?.data || [])) {
        body.appendChild(_el('div', { class: 'icn-cg-conflict' },
          _el('span', { class: 'icn-cg-conflict-date' }, c.datefr || ''),
          _el('span', { class: 'icn-cg-conflict-type' }, c.activity || '')));
      }
    }
    if (result.decompte) {
      const d = result.popup?.data?.decompte;
      if (d) {
        body.appendChild(_el('div', { class: 'icn-cg-decompte' },
          _el('div', {}, `Type : ${d.type || '?'}`),
          _el('div', {}, `Durée : ${d.duree || '?'} jour(s)`),
          _el('div', {}, `Du ${d.debut || ''} au ${d.fin || ''}`)));
      }
      if (result.popup?.data?.suficientProvisions === false) {
        body.appendChild(_el('div', { class: 'icn-cg-warning' }, '⚠ Provisions insuffisantes'));
      }
    }
    _container.appendChild(body);

    const cancel = _el('button', { class: 'icn-btn', type: 'button' }, 'Annuler');
    const confirm = _el('button', { class: 'icn-btn icn-cg-btn--confirm', type: 'button' }, 'Confirmer');
    cancel.addEventListener('click', _renderForm);
    confirm.addEventListener('click', () => _handleRetry(result));
    _container.appendChild(_el('div', { class: 'icn-cg-popup-actions' }, cancel, confirm));
  }

  function _renderError(msg, back = true) {
    _container.innerHTML = '';
    _container.appendChild(_el('div', { class: 'icn-cg-error' }, msg));
    if (back) {
      const b = _el('button', { class: 'icn-btn icn-btn-sm icn-cg-btn', type: 'button' }, '← Retour');
      b.addEventListener('click', _renderForm);
      _container.appendChild(b);
    }
  }

  async function _handleSubmit() {
    const debut = _container.querySelector('#icn-cg-debut')?.value;
    const fin = _container.querySelector('#icn-cg-fin')?.value;
    if (!debut || !fin) return;
    if (debut > fin) {
      _container.querySelector('.icn-cg-date-error')?.remove();
      _container.querySelector('.icn-cg-form')?.appendChild(_el('div', { class: 'icn-cg-date-error' }, 'La date de début est après la date de fin'));
      return;
    }
    _pending = {
      agentId: _agentId,
      congeType: _container.querySelector('#icn-cg-type')?.value,
      debut: _fmtDate(debut),
      fin: _fmtDate(fin)
    };
    const btn = _container.querySelector('#icn-cg-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
    _handleResult(await window.ICN_CONGES_CLIENT.submitLeave(_pending));
  }

  async function _handleRetry(prev) {
    if (!_pending) return;
    const flags = {};
    if (prev.collision) { flags.passCheckSelfCollision = true; flags.passCheckTeamCollision = true; }
    if (prev.decompte) flags.passCountProposal = true;
    _handleResult(await window.ICN_CONGES_CLIENT.submitLeave({ ..._pending, passFlags: flags }));
  }

  function _handleResult(result) {
    if (result.ok) {
      _container.innerHTML = '';
      _container.appendChild(_el('div', { class: 'icn-cg-success' }, `Congé envoyé à OLAF (n° ${result.id}). Rechargez OLAF pour voir les contours à jour.`));
      const again = _el('button', { class: 'icn-btn icn-btn-sm icn-cg-btn', type: 'button' }, 'Nouvelle demande');
      again.addEventListener('click', _renderForm);
      _container.appendChild(again);
      return;
    }
    if (result.http === 401) { _renderError('OLAF non connecté'); return; }
    if (result.http) { _renderError(`Erreur serveur HTTP ${result.http}`); return; }
    if (result.collision || result.decompte) { _renderPopup(result); return; }
    _renderError(result.popup?.header || 'Erreur OLAF');
  }

  async function _load(container) {
    _container = container;
    _open = true;
    _container.innerHTML = '';
    _container.appendChild(_el('div', { class: 'icn-cg-loading' }, 'Chargement du profil OLAF…'));

    const idR = await window.ICN_CONGES_CLIENT.fetchAgentId();
    if (!idR.ok) { _renderError(`Impossible de lire votre profil OLAF : ${idR.error}`, false); return; }
    _agentId = idR.agentId;

    const typesR = await window.ICN_CONGES_CLIENT.fetchLeaveTypes(_agentId);
    if (!typesR.ok) { _renderError(`Types de congés indisponibles : ${typesR.error}`, false); return; }
    if (!typesR.types.length) { _renderError('Aucun type de congé auto-posable pour votre profil. Passez par OLAF.', false); return; }
    _types = typesR.types;
    _renderForm();
  }

  function _close() {
    _open = false;
    _agentId = null;
    _types = [];
    _pending = null;
    if (_container) _container.innerHTML = '';
  }

  async function toggle(container) {
    if (_open) _close(); else await _load(container);
    return _open;
  }

  window.ICN_CONGES_UI = { toggle, isOpen: () => _open };
})();

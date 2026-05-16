(function () {
  const BASE = 'https://olafatco.dsna.aviation-civile.gouv.fr';
  const EXCLUDED_TYPES = new Set(['RPL', 'PER']);

  function _auth(login, pass) {
    return 'Basic ' + btoa(`${login}:${pass}`);
  }

  // ── Agent ID ───────────────────────────────────────────────────────────────

  async function fetchAgentId(login, pass) {
    try {
      const r = await fetch(`${BASE}/dist/ajax/index/pageData.php`, {
        method: 'POST',
        headers: {
          'Authorization': _auth(login, pass),
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: 'search=&isCape=false'
      });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const data = await r.json();
      const id = data?.session?.id;
      if (!id) return { ok: false, error: 'ID agent introuvable dans la session' };
      return { ok: true, agentId: id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Types de congés ────────────────────────────────────────────────────────

  async function fetchLeaveTypes(login, pass, agentId) {
    try {
      const url = new URL(`${BASE}/dist/ajax/conges/agentCongesCharger.php`);
      url.searchParams.set('id', agentId);
      url.searchParams.set('type', 'json');
      const r = await fetch(url, {
        headers: {
          'Authorization': _auth(login, pass),
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/plain, */*',
        }
      });
      if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
      const data = await r.json();
      const affectations = data?.datafortemplate?.affectation || [];
      const today = new Date().toISOString().split('T')[0];
      const types = new Map();
      for (const aff of affectations) {
        const debut = aff.dateDebut || '';
        const fin   = aff.dateFin   || '9999-12-31';
        if (today < debut || today > fin) continue;
        for (const lc of (aff.liconge || [])) {
          if (!lc) continue;
          for (const tc of (lc.typeConge || [])) {
            if (!tc || tc.type == null) continue;
            if (EXCLUDED_TYPES.has(tc.detail?.type || '')) continue;
            types.set(tc.type, { id: tc.type, sigle: tc.sigle || '?', label: tc.name || '?' });
          }
        }
      }
      const list = [...types.values()].sort((a, b) => a.id - b.id);
      return { ok: true, types: list };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ── Envoi congé ────────────────────────────────────────────────────────────

  async function submitLeave(login, pass, { agentId, congeType, debut, fin, passFlags = {} }) {
    const fields = [
      ['idagent',                agentId],
      ['conge-debut',            debut],
      ['conge-fin',              fin],
      ['formType',               'false'],
      ['idagentsubstitute',      ''],
      ['idleavestatus',          '17'],
      ['passCheckLeaveValidity', String(passFlags.passCheckLeaveValidity ?? false)],
      ['passCheckSelfCollision', String(passFlags.passCheckSelfCollision ?? false)],
      ['passCheckTeamCollision', String(passFlags.passCheckTeamCollision ?? false)],
      ['recurrentid',            'null'],
      ['passCountProposal',      String(passFlags.passCountProposal ?? false)],
      ['conge-type',             congeType],
      ['ishalfdaybegin',         'false'],
      ['ishalfdayend',           'false'],
      ['justification',          ''],
    ];

    const boundary = '----OLAFxCIELboundary';
    let body = '';
    for (const [name, value] of fields) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    }
    body += `--${boundary}--\r\n`;

    try {
      const r = await fetch(`${BASE}/dist/ajax/conges/leaveUpsert.php`, {
        method: 'POST',
        headers: {
          'Authorization': _auth(login, pass),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/plain, */*',
        },
        body
      });
      if (!r.ok) return { ok: false, http: r.status };
      const data = await r.json();

      if (!data.error && !data.countCheck && data.id) {
        return { ok: true, id: data.id };
      }
      if (data.error && data.button) {
        return { ok: false, collision: true, popup: data.popup, inputs: data.inputs };
      }
      if (data.countCheck) {
        return { ok: false, decompte: true, popup: data.popup, inputs: data.inputs };
      }
      if (data.error) {
        return { ok: false, hard: true, popup: data.popup };
      }
      return { ok: false, hard: true, popup: { header: 'Erreur inconnue' } };
    } catch (e) {
      return { ok: false, hard: true, popup: { header: e.message } };
    }
  }

  window.ICN_CONGES_CLIENT = { fetchAgentId, fetchLeaveTypes, submitLeave };
})();

/**
 * Client congés OLAF (via proxy background).
 */
(function () {
  const EXCLUDED_TYPES = new Set(['RPL', 'PER']);

  async function fetchAgentId() {
    const r = await window.ICN_OLAF_PROXY.json({
      path: '/dist/ajax/index/pageData.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: 'search=&isCape=false'
    });
    if (!r.ok) return { ok: false, error: r.status === 401 ? 'OLAF non connecté' : r.error };
    const id = r.data?.session?.id;
    if (!id) return { ok: false, error: 'ID agent introuvable dans la session OLAF' };
    return { ok: true, agentId: id, prenom: r.data.session.prenom, nom: r.data.session.nom };
  }

  async function fetchLeaveTypes(agentId) {
    const r = await window.ICN_OLAF_PROXY.json({
      path: `/dist/ajax/conges/agentCongesCharger.php?id=${encodeURIComponent(agentId)}&type=json`,
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/plain, */*' }
    });
    if (!r.ok) return { ok: false, error: r.error };
    const affectations = r.data?.datafortemplate?.affectation || [];
    const today = new Date().toISOString().split('T')[0];
    const types = new Map();
    for (const aff of affectations) {
      const debut = aff.dateDebut || '';
      const fin = aff.dateFin || '9999-12-31';
      if (today < debut || today > fin) continue;
      for (const lc of (aff.liconge || [])) {
        for (const tc of (lc?.typeConge || [])) {
          if (!tc || tc.type == null) continue;
          if (EXCLUDED_TYPES.has(tc.detail?.type || '')) continue;
          types.set(tc.type, { id: tc.type, sigle: tc.sigle || '?', label: tc.name || '?' });
        }
      }
    }
    return { ok: true, types: [...types.values()].sort((a, b) => a.id - b.id) };
  }

  async function submitLeave({ agentId, congeType, debut, fin, passFlags = {} }) {
    const fields = [
      ['idagent', agentId],
      ['conge-debut', debut],
      ['conge-fin', fin],
      ['formType', 'false'],
      ['idagentsubstitute', ''],
      ['idleavestatus', '17'],
      ['passCheckLeaveValidity', String(passFlags.passCheckLeaveValidity ?? false)],
      ['passCheckSelfCollision', String(passFlags.passCheckSelfCollision ?? false)],
      ['passCheckTeamCollision', String(passFlags.passCheckTeamCollision ?? false)],
      ['recurrentid', 'null'],
      ['passCountProposal', String(passFlags.passCountProposal ?? false)],
      ['conge-type', congeType],
      ['ishalfdaybegin', 'false'],
      ['ishalfdayend', 'false'],
      ['justification', '']
    ];
    const { body, contentType } = window.ICN_OLAF_PROXY.multipart(fields);
    const r = await window.ICN_OLAF_PROXY.request({
      path: '/dist/ajax/conges/leaveUpsert.php',
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*'
      },
      body
    });
    if (!r.ok) return { ok: false, http: r.status || 0, error: r.error };
    let data;
    try { data = JSON.parse(r.text); } catch (e) { return { ok: false, hard: true, popup: { header: 'Réponse OLAF illisible' } }; }

    if (!data.error && !data.countCheck && data.id) return { ok: true, id: data.id };
    if (data.error && data.button) return { ok: false, collision: true, popup: data.popup, inputs: data.inputs };
    if (data.countCheck) return { ok: false, decompte: true, popup: data.popup, inputs: data.inputs };
    if (data.error) return { ok: false, hard: true, popup: data.popup };
    return { ok: false, hard: true, popup: { header: 'Erreur inconnue' } };
  }

  window.ICN_CONGES_CLIENT = { fetchAgentId, fetchLeaveTypes, submitLeave };
})();

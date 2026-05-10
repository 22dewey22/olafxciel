/**
 * CongesClient — Gestion des congés OLAF
 *
 * Endpoints :
 *   GET  /dist/ajax/conges/agentCongesCharger.php   chargement de la page congés
 *   POST /dist/ajax/conges/leaveScheduleUpsert.php  validation des dates planning
 *   POST /dist/ajax/conges/leaveUpsert.php          création / confirmation du congé
 */
class CongesClient {
  constructor() {
    this._BASE = 'https://olafatco.dsna.aviation-civile.gouv.fr/dist/ajax/conges';
  }

  // ── GET ──────────────────────────────────────────────────────────────────

  /**
   * Charge les données congés de l'agent.
   * Sans agentId → OLAF utilise la session (comme getCycle.php).
   * La réponse contient data.id = l'idpersonnels qu'on stocke ensuite.
   */
  async loadCongesData(agentId) {
    const params = new URLSearchParams({ type: 'json' });
    if (agentId) params.set('id', agentId);

    const resp = await fetch(`${this._BASE}/agentCongesCharger.php?${params}`, {
      credentials: 'include'
    });
    if (!resp.ok) throw new Error(`agentCongesCharger HTTP ${resp.status}`);
    return await resp.json();
  }

  // ── POST ─────────────────────────────────────────────────────────────────

  async scheduleCheck(congeType, dateDebut, dateFin) {
    const body = new URLSearchParams({
      'conge-type':  congeType,
      'conge-debut': dateDebut,
      'conge-fin':   dateFin
    });
    const resp = await fetch(`${this._BASE}/leaveScheduleUpsert.php`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!resp.ok) throw new Error(`leaveScheduleUpsert HTTP ${resp.status}`);
    return await resp.json();
  }

  async upsertLeave(payload) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      body.set(k, v === null || v === undefined ? '' : String(v));
    }
    const resp = await fetch(`${this._BASE}/leaveUpsert.php`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!resp.ok) throw new Error(`leaveUpsert HTTP ${resp.status}`);
    return await resp.json();
  }

  // ── Helpers payload ───────────────────────────────────────────────────────

  buildPayload(p, passCheckTeamCollision = false) {
    return {
      idagent:                 p.idagent,
      idAffectation:           p.idAffectation,
      idagentsubstitute:       false,
      idleavestatus:           17,            // ENVOYER
      recurrentid:             'null',
      idactivitytype:          '',
      idactivity:              '',
      nb_recup:                '',
      dateLeave:               '',
      content:                 '',
      idActivityAgentList:     '',
      'conge-type':            p.congeType,
      'conge-debut':           p.dateDebut,  // dd/mm/yyyy
      'conge-fin':             p.dateFin,    // dd/mm/yyyy
      date:                    '',
      justification:           p.justification || '',
      date_debut:              '',
      date_fin:                '',
      ishalfdaybegin:          false,
      ishalfdayend:            false,
      passCheckLeaveValidity:  true,
      passCheckSelfCollision:  true,
      passCheckTeamCollision,
      passCountProposal:       false,
      RPL:                     ''
    };
  }

  // ── Extraction depuis congesData ──────────────────────────────────────────

  getCurrentAffectation(congesData) {
    return congesData?.datafortemplate?.affectation?.find(a => a.current) || null;
  }

  getAvailableLeaveTypes(congesData) {
    const aff = this.getCurrentAffectation(congesData);
    if (!aff) return [];

    const seen = new Set();
    const types = [];
    for (const cat of aff.liconge || []) {
      for (const t of cat.typeConge || []) {
        if (seen.has(t.type)) continue;
        seen.add(t.type);
        types.push({
          id:                   t.type,
          name:                 t.name,
          sigle:                t.sigle,
          category:             cat.nomCat,
          enddate:              t.enddate,
          justification:        t.justification,
          requiredJustification:t.requiredJustification,
          dureemin:             t.dureemin,
          dureemax:             t.dureemax,
          priornoticemin:       parseInt(t.priornoticemin) || 0,
          replacement:          t.replacement
        });
      }
    }
    return types;
  }

  getProvisions(congesData) {
    return congesData?.provisions || [];
  }

  /**
   * Retourne une map { "YYYY-MM-DD": [{sigle, statut, theme}] }
   * pour tous les congés de l'affectation courante.
   */
  getLeaveMap(congesData) {
    const map = {};
    const aff = this.getCurrentAffectation(congesData);
    if (!aff?.conge) return map;

    for (const c of aff.conge) {
      const start = new Date(c.datestart);
      const end   = c.dateend ? new Date(c.dateend) : new Date(c.datestart);
      let d = new Date(start);
      while (d <= end) {
        const key = d.toISOString().split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push({
          sigle:  c.leavetypesigle,
          statut: c.idleavestatus,
          theme:  c.leavestatustheme
        });
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }
}

window.ICN_CONGES = new CongesClient();

/**
 * Proxy OLAF côté content script : toutes les requêtes passent par le
 * background (CORS). Gère le mode d'authentification :
 *  - session navigateur (onglet OLAF connecté) par défaut ;
 *  - identifiants du panneau si renseignés.
 */
(function () {
  let _creds = null; // { login, pass } | null

  function setCredentials(login, pass) {
    _creds = (login && pass) ? { login, pass } : null;
  }

  function getCredentials() {
    return _creds;
  }

  async function request({ path, method = 'GET', headers = {}, body = null }) {
    const resp = await browser.runtime.sendMessage({
      type: 'olaf-fetch', path, method, headers, body, creds: _creds
    });
    if (!resp) return { ok: false, status: 0, error: 'Background injoignable' };
    return resp;
  }

  async function json(opts) {
    const r = await request(opts);
    if (!r.ok) return { ok: false, status: r.status, error: r.error || `HTTP ${r.status}` };
    try {
      return { ok: true, status: r.status, data: JSON.parse(r.text) };
    } catch (e) {
      return { ok: false, status: r.status, error: 'Réponse OLAF non JSON (session expirée ?)' };
    }
  }

  async function status(force = false) {
    try {
      const r = await browser.runtime.sendMessage({ type: 'olaf-status', creds: _creds, force });
      return r || { connected: false, reason: 'Background injoignable' };
    } catch (e) {
      return { connected: false, reason: e.message };
    }
  }

  async function openOlaf(url) {
    try { await browser.runtime.sendMessage({ type: 'olaf-open', url }); }
    catch (e) { window.open(url || 'https://olafatco.dsna.aviation-civile.gouv.fr/', '_blank'); }
  }

  // Encodage multipart simple (leaveUpsert.php)
  function multipart(fields) {
    const boundary = '----OLAFxCIEL' + Math.random().toString(16).slice(2);
    let body = '';
    for (const [name, value] of fields) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    }
    body += `--${boundary}--\r\n`;
    return { body, contentType: `multipart/form-data; boundary=${boundary}` };
  }

  window.ICN_OLAF_PROXY = { setCredentials, getCredentials, request, json, status, openOlaf, multipart };
})();

/**
 * Background (MV3) — proxy HTTP vers OLAF + statut de connexion.
 *
 * Les content scripts tournent dans l'origine CIEL et ne peuvent pas appeler
 * OLAF (CORS). Le background dispose des host_permissions et relaie les
 * requêtes. Deux modes d'authentification, cumulables :
 *  - session navigateur : l'utilisateur est connecté sur un onglet OLAF, le
 *    navigateur rejoue l'auth Basic en cache (credentials: 'include') ;
 *  - identifiants saisis dans le panneau : en-tête Authorization explicite.
 *
 * Chrome utilise `service_worker`, Firefox `scripts` (même fichier).
 */
if (typeof browser === 'undefined') {
  // eslint-disable-next-line no-var
  var browser = chrome;
}

const OLAF_ORIGIN = 'https://olafatco.dsna.aviation-civile.gouv.fr';
const STATUS_CACHE_MS = 15000;

let statusCache = { at: 0, result: null };

function basicHeader(login, pass) {
  const bytes = new TextEncoder().encode(`${login}:${pass}`);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'Basic ' + btoa(bin);
}

async function olafFetch(req) {
  const path = String(req.path || '/');
  if (!path.startsWith('/')) {
    return { ok: false, status: 0, error: 'Chemin OLAF invalide' };
  }
  const headers = Object.assign({}, req.headers || {});
  if (req.creds && req.creds.login && req.creds.pass) {
    headers['Authorization'] = basicHeader(req.creds.login, req.creds.pass);
  }
  const init = {
    method: req.method || 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
    redirect: 'follow'
  };
  if (req.body != null && init.method !== 'GET' && init.method !== 'HEAD') {
    init.body = req.body;
  }
  try {
    const r = await fetch(OLAF_ORIGIN + path, init);
    const text = await r.text();
    return {
      ok: r.ok,
      status: r.status,
      contentType: r.headers.get('content-type') || '',
      text
    };
  } catch (e) {
    return { ok: false, status: 0, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * Sonde de session : pageData.php renvoie l'identité de l'agent connecté.
 */
async function olafStatus(creds, force) {
  const now = Date.now();
  if (!force && !creds && statusCache.result && now - statusCache.at < STATUS_CACHE_MS) {
    return statusCache.result;
  }
  const r = await olafFetch({
    path: '/dist/ajax/index/pageData.php',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: 'search=&isCape=false',
    creds: creds || null
  });
  let result;
  if (r.status === 401) {
    result = { connected: false, status: 401, reason: creds ? 'Identifiants refusés' : 'Session OLAF absente' };
  } else if (!r.ok) {
    result = { connected: false, status: r.status, reason: r.error || `HTTP ${r.status}` };
  } else {
    try {
      const data = JSON.parse(r.text);
      const s = data && data.session ? data.session : null;
      result = {
        connected: !!(s && s.id),
        status: r.status,
        agentId: s ? s.id : null,
        prenom: s ? s.prenom : '',
        nom: s ? s.nom : '',
        mode: creds ? 'creds' : 'session'
      };
      if (!result.connected) result.reason = 'Réponse OLAF sans session';
    } catch (e) {
      result = { connected: false, status: r.status, reason: 'Réponse OLAF illisible (page de login ?)' };
    }
  }
  if (!creds) statusCache = { at: now, result };
  return result;
}

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return false;

  if (msg.type === 'olaf-fetch') {
    olafFetch(msg).then(sendResponse);
    return true;
  }
  if (msg.type === 'olaf-status') {
    olafStatus(msg.creds || null, !!msg.force).then(sendResponse);
    return true;
  }
  if (msg.type === 'olaf-open') {
    const url = msg.url && String(msg.url).startsWith(OLAF_ORIGIN) ? msg.url : OLAF_ORIGIN + '/';
    browser.tabs.create({ url }).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  return false;
});

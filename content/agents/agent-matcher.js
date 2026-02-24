/**
 * Module de matching simple entre agents CIEL et OLAF
 * Utilise la liste CIEL comme référence
 */

(function () {
  /**
   * Normalise un nom (retire accents, met en majuscules)
   */
  function normalizeName(name) {
    return name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Retire accents
      .replace(/\s*-\s*/g, '-'); // Normalise les tirets (retire espaces autour)

  }

  /**
   * Extrait prénom et nom depuis CIEL
   */
  function parseCielName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    
    if (parts.length >= 2) {
      // Dernier élément = nom de famille
      const lastName = parts[parts.length - 1];
      // Tout le reste = prénom(s)
      const firstName = parts.slice(0, -1).join(' ');
      return { firstName, lastName };
    }
    
    // Juste un nom
    return { firstName: null, lastName: parts[0] };
  }

  /**
   * Vérifie si un prénom CIEL match une forme OLAF
   * Si aucun pattern trouvé dans OLAF → accepter (optionnel)
   */
  function firstNameMatches(cielFirstName, olafText) {
    window.ICN_DEBUG.log(`[MATCHER] firstNameMatches("${cielFirstName}", "${olafText}")`);
    
    if (!cielFirstName) {
      window.ICN_DEBUG.log(`[MATCHER]   → Pas de prénom CIEL, match = true`);
      return true; // Pas de prénom → match
    }
    
    const normalized = normalizeName(cielFirstName);
    const olafNorm = normalizeName(olafText);
    
    window.ICN_DEBUG.log(`[MATCHER]   Normalized: "${normalized}" vs "${olafNorm}"`);
    
    // Chercher les patterns "X." dans le texte OLAF
    const patterns = olafNorm.match(/([A-Z]+)\./g);
    window.ICN_DEBUG.log(`[MATCHER]   Patterns trouvés:`, patterns);
    
    if (!patterns) {
      window.ICN_DEBUG.log(`[MATCHER]   → Aucun pattern trouvé dans OLAF, prénom optionnel = true`);
      return true; // Pas de prénom dans OLAF → accepter
    }
    
    // Vérifier si l'un des patterns matche le début du prénom
    for (const pattern of patterns) {
      const letters = pattern.replace('.', '');
      window.ICN_DEBUG.log(`[MATCHER]   Test pattern "${letters}" vs début de "${normalized}"`);
      
      if (normalized.startsWith(letters)) {
        window.ICN_DEBUG.log(`[MATCHER]   → MATCH! "${normalized}" commence par "${letters}"`);
        return true;
      }
    }
    
    window.ICN_DEBUG.log(`[MATCHER]   → Aucun pattern ne matche, match = false`);
    return false;
  }

  /**
   * Vérifie si un nom CIEL match un nom OLAF
   * Gère les noms composés (mariages)
   */
  function lastNameMatches(cielLastName, olafText) {
    window.ICN_DEBUG.log(`[MATCHER] lastNameMatches("${cielLastName}", "${olafText}")`);
    
    const cielNorm = normalizeName(cielLastName);
    const olafNorm = normalizeName(olafText);
    
    window.ICN_DEBUG.log(`[MATCHER]   Normalized: "${cielNorm}" vs "${olafNorm}"`);
    
    // Match exact
    if (cielNorm === olafNorm) {
      window.ICN_DEBUG.log(`[MATCHER]   → Match exact!`);
      return true;
    }
    
    // CIEL inclus dans OLAF avec un tiret après
    const regex = new RegExp(`\\b${cielNorm}(?:-|\\s|$)`, 'i');
    const regexMatch = regex.test(olafNorm);
    
    window.ICN_DEBUG.log(`[MATCHER]   Test regex \\b${cielNorm}(?:-|\\s|$): ${regexMatch}`);
    
    if (regexMatch) {
      window.ICN_DEBUG.log(`[MATCHER]   → Match avec tiret/espace!`);
      return true;
    }
    
    window.ICN_DEBUG.log(`[MATCHER]   → Pas de match`);
    return false;
  }

  /**
   * Vérifie si une personne CIEL match un texte OLAF
   * @param {string} cielFullName - Ex: "Kevin RICHARD"
   * @param {string} olafText - Ex: "RICHARD K."
   * @returns {boolean}
   */
  function agentMatches(cielFullName, olafText) {
    window.ICN_DEBUG.log(`[MATCHER] ==== agentMatches ====`);
    window.ICN_DEBUG.log(`[MATCHER] CIEL: "${cielFullName}"`);
    window.ICN_DEBUG.log(`[MATCHER] OLAF: "${olafText}"`);
    
    const parsed = parseCielName(cielFullName);
    window.ICN_DEBUG.log(`[MATCHER] Parsed CIEL:`, parsed);
    
    // Vérifier le nom de famille
    const lastNameMatch = lastNameMatches(parsed.lastName, olafText);
    if (!lastNameMatch) {
      window.ICN_DEBUG.log(`[MATCHER] ❌ Nom de famille ne matche pas`);
      return false;
    }
    
    window.ICN_DEBUG.log(`[MATCHER] ✅ Nom de famille matche`);
    
    // Vérifier le prénom si disponible
    if (parsed.firstName) {
      const firstNameMatch = firstNameMatches(parsed.firstName, olafText);
      if (!firstNameMatch) {
        window.ICN_DEBUG.log(`[MATCHER] ❌ Prénom ne matche pas`);
        return false;
      }
      window.ICN_DEBUG.log(`[MATCHER] ✅ Prénom matche`);
    } else {
      window.ICN_DEBUG.log(`[MATCHER] ℹ️ Pas de prénom à vérifier`);
    }
    
    window.ICN_DEBUG.log(`[MATCHER] ✅✅ MATCH FINAL!`);
    return true;
  }

  /**
   * Trouve la correspondance CIEL pour un texte OLAF
   * @param {string} olafText 
   * @param {Array<string>} cielAgentsList 
   * @returns {string|null} Le nom CIEL correspondant ou null
   */
  function findCielMatch(olafText, cielAgentsList) {
    window.ICN_DEBUG.log(`[MATCHER] ======== findCielMatch ========`);
    window.ICN_DEBUG.log(`[MATCHER] Recherche match pour OLAF: "${olafText}"`);
    window.ICN_DEBUG.log(`[MATCHER] Liste CIEL (${cielAgentsList.length} agents):`, cielAgentsList);
    
    for (const cielName of cielAgentsList) {
      const matches = agentMatches(cielName, olafText);
      if (matches) {
        window.ICN_DEBUG.log(`[MATCHER] 🎯 TROUVÉ! "${olafText}" → "${cielName}"`);
        return cielName;
      }
    }
    
    window.ICN_DEBUG.log(`[MATCHER] ❌ Aucune correspondance trouvée pour "${olafText}"`);
    return null;
  }

  // Export des fonctions
  window.ICN_AGENT_MATCHER = {
    normalizeName,
    parseCielName,
    firstNameMatches,
    lastNameMatches,
    agentMatches,
    findCielMatch
  };

  window.ICN_DEBUG.log('[ICN-MATCHER] Agent matcher module loaded');
})();

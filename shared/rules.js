(function () {
  // Clés de storage pour les fondclasses dynamiques
  const STORAGE_KEY_ALPHA = 'icn_alpha_fondclasses';
  const STORAGE_KEY_BETA = 'icn_beta_fondclasses';
  
  // Valeurs par défaut (anciennes valeurs hardcodées)
  const DEFAULT_ALPHA = [];
  const DEFAULT_BETA = [];
  
  const PRIORITY_IF_BOTH = "alpha";
  const TPA_EXCLUDE_PATTERNS = [/\btpa\b/i, /\bdispo\b/i];
  const FONDCLASSE_RE = /^fondclasse(\d+)$/;

  // Cache des fondclasses chargées
  let cachedAlphaFondclasses = null;
  let cachedBetaFondclasses = null;

  /**
   * Charge les fondclasses ALPHA depuis le storage
   */
  async function loadAlphaFondclasses() {
    if (cachedAlphaFondclasses !== null) {
      return cachedAlphaFondclasses;
    }
    
    try {
      const result = await window.ICN_STORAGE.get(STORAGE_KEY_ALPHA);
      const fondclasses = result[STORAGE_KEY_ALPHA] || DEFAULT_ALPHA;
      cachedAlphaFondclasses = new Set(fondclasses);
      window.ICN_DEBUG.log('[ICN-RULES] Loaded ALPHA fondclasses:', Array.from(cachedAlphaFondclasses));
      return cachedAlphaFondclasses;
    } catch (err) {
      window.ICN_DEBUG.error('[ICN-RULES] Failed to load ALPHA fondclasses:', err);
      cachedAlphaFondclasses = new Set(DEFAULT_ALPHA);
      return cachedAlphaFondclasses;
    }
  }

  /**
   * Charge les fondclasses BETA depuis le storage
   */
  async function loadBetaFondclasses() {
    if (cachedBetaFondclasses !== null) {
      return cachedBetaFondclasses;
    }
    
    try {
      const result = await window.ICN_STORAGE.get(STORAGE_KEY_BETA);
      const fondclasses = result[STORAGE_KEY_BETA] || DEFAULT_BETA;
      cachedBetaFondclasses = new Set(fondclasses);
      window.ICN_DEBUG.log('[ICN-RULES] Loaded BETA fondclasses:', Array.from(cachedBetaFondclasses));
      return cachedBetaFondclasses;
    } catch (err) {
      window.ICN_DEBUG.error('[ICN-RULES] Failed to load BETA fondclasses:', err);
      cachedBetaFondclasses = new Set(DEFAULT_BETA);
      return cachedBetaFondclasses;
    }
  }

  /**
   * Sauvegarde les fondclasses ALPHA
   */
  async function saveAlphaFondclasses(fondclasses) {
    const array = Array.from(fondclasses);
    await window.ICN_STORAGE.set({ [STORAGE_KEY_ALPHA]: array });
    cachedAlphaFondclasses = new Set(array);
    window.ICN_DEBUG.log('[ICN-RULES] Saved ALPHA fondclasses:', array);
  }

  /**
   * Sauvegarde les fondclasses BETA
   */
  async function saveBetaFondclasses(fondclasses) {
    const array = Array.from(fondclasses);
    await window.ICN_STORAGE.set({ [STORAGE_KEY_BETA]: array });
    cachedBetaFondclasses = new Set(array);
    window.ICN_DEBUG.log('[ICN-RULES] Saved BETA fondclasses:', array);
  }

  /**
   * Ajoute une fondclasse à ALPHA
   */
  async function addAlphaFondclasse(fondclasse) {
    const alphaFondclasses = await loadAlphaFondclasses();
    alphaFondclasses.add(fondclasse);
    await saveAlphaFondclasses(alphaFondclasses);
    
    // Retirer de beta si présent
    const betaFondclasses = await loadBetaFondclasses();
    if (betaFondclasses.has(fondclasse)) {
      betaFondclasses.delete(fondclasse);
      await saveBetaFondclasses(betaFondclasses);
      window.ICN_DEBUG.log('[ICN-RULES] Removed from BETA (moved to ALPHA):', fondclasse);
    }
    
    window.ICN_DEBUG.log('[ICN-RULES] Added ALPHA fondclasse:', fondclasse);
  }

  /**
   * Retire une fondclasse de ALPHA
   */
  async function removeAlphaFondclasse(fondclasse) {
    const fondclasses = await loadAlphaFondclasses();
    fondclasses.delete(fondclasse);
    await saveAlphaFondclasses(fondclasses);
    window.ICN_DEBUG.log('[ICN-RULES] Removed ALPHA fondclasse:', fondclasse);
  }

  /**
   * Ajoute une fondclasse à BETA
   */
  async function addBetaFondclasse(fondclasse) {
    const betaFondclasses = await loadBetaFondclasses();
    betaFondclasses.add(fondclasse);
    await saveBetaFondclasses(betaFondclasses);
    
    // Retirer d'alpha si présent
    const alphaFondclasses = await loadAlphaFondclasses();
    if (alphaFondclasses.has(fondclasse)) {
      alphaFondclasses.delete(fondclasse);
      await saveAlphaFondclasses(alphaFondclasses);
      window.ICN_DEBUG.log('[ICN-RULES] Removed from ALPHA (moved to BETA):', fondclasse);
    }
    
    window.ICN_DEBUG.log('[ICN-RULES] Added BETA fondclasse:', fondclasse);
  }

  /**
   * Retire une fondclasse de BETA
   */
  async function removeBetaFondclasse(fondclasse) {
    const fondclasses = await loadBetaFondclasses();
    fondclasses.delete(fondclasse);
    await saveBetaFondclasses(fondclasses);
    window.ICN_DEBUG.log('[ICN-RULES] Removed BETA fondclasse:', fondclasse);
  }

  function stripAccents(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function extractFondclassesFromTd(td) {
    const out = new Set();
    if (!td) return out;
    const classes = td.getAttribute("class") || "";
    for (const cls of classes.split(/\s+/).filter(Boolean)) {
      const m = cls.match(FONDCLASSE_RE);
      if (m) out.add(parseInt(m[1], 10));
    }
    return out;
  }

  /**
   * Classifie une absence - VERSION ASYNC avec fondclasses dynamiques
   */
  async function classifyAbsenceByFondclasse(fondclasses, text = "", title = "") {
    const blob = stripAccents(`${text}\n${title}`.toLowerCase());
    
    // Exclure TPA
    for (const re of TPA_EXCLUDE_PATTERNS) {
      if (re.test(blob)) return null;
    }
    
    // Charger les fondclasses dynamiques
    const alphaFondclasses = await loadAlphaFondclasses();
    const betaFondclasses = await loadBetaFondclasses();
    
    let isAlpha = false;
    let isBeta = false;
    
    for (const fc of fondclasses || []) {
      if (alphaFondclasses.has(fc)) isAlpha = true;
      if (betaFondclasses.has(fc)) isBeta = true;
    }
    
    if (isAlpha && isBeta) return PRIORITY_IF_BOTH;
    if (isAlpha) return "alpha";
    if (isBeta) return "beta";
    return null;
  }

  window.ICN_RULES = {
    // Anciens exports (deprecated mais gardés pour compatibilité)
    ABS_ALPHA_FONDCLASSES: new Set(DEFAULT_ALPHA),
    ABS_BETA_FONDCLASSES: new Set(DEFAULT_BETA),
    PRIORITY_IF_BOTH,
    TPA_EXCLUDE_PATTERNS,
    
    // Nouvelles fonctions
    loadAlphaFondclasses,
    loadBetaFondclasses,
    saveAlphaFondclasses,
    saveBetaFondclasses,
    addAlphaFondclasse,
    removeAlphaFondclasse,
    addBetaFondclasse,
    removeBetaFondclasse,
    
    extractFondclassesFromTd,
    classifyAbsenceByFondclasse,
  };
  
  window.ICN_DEBUG.log('[ICN-RULES] Module loaded with dynamic fondclasses support');
})();

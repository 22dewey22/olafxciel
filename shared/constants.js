/**
 * Polyfill pour Chrome : chrome → browser
 * Chrome utilise 'chrome' au lieu de 'browser'
 */
if (typeof browser === 'undefined') {
  var browser = chrome;
}

/**
 * Système de debug global
 * IMPORTANT: Doit être défini EN PREMIER avant tout le reste
 */
window.ICN_DEBUG = {
  enabled: false, // Mettre à true pour activer les logs de debug
  forceLocalStorage: false, // Mettre à true pour forcer localStorage (contourner browser.storage bloqué)
  
  log(...args) {
    if (this.enabled) {
      console.log(...args);
    }
  },
  
  warn(...args) {
    if (this.enabled) {
      console.warn(...args);
    }
  },
  
  error(...args) {
    // Les erreurs sont toujours affichées
    console.error(...args);
  },
  
  info(...args) {
    if (this.enabled) {
      console.info(...args);
    }
  }
};

/**
 * Système de storage avec fallback automatique
 * Gère les cas où browser.storage est bloqué (réseau entreprise, etc.)
 */
(function() {
  // Storage en mémoire comme dernier recours
  const memoryStorage = {};
  
  // Wrapper de storage avec fallback automatique
  const StorageManager = {
    async get(keys) {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      
      // Si forceLocalStorage activé, sauter browser.storage
      if (!window.ICN_DEBUG.forceLocalStorage) {
        // Tentative 1 : browser.storage
        try {
          const result = await browser.storage.local.get(keys);
          window.ICN_DEBUG.log('[ICN-STORAGE] ✓ browser.storage.get:', keys, '→', result);
          return result;
        } catch (browserError) {
          console.warn('[ICN-STORAGE] ⚠️ browser.storage failed:', browserError.message);
        }
      }
      
      // Tentative 2 : localStorage
      try {
        const result = {};
        for (const key of keyArray) {
          const value = localStorage.getItem('icn_' + key);
          if (value !== null) {
            try {
              result[key] = JSON.parse(value);
            } catch (e) {
              result[key] = value;
            }
          }
        }
        window.ICN_DEBUG.log('[ICN-STORAGE] ✓ localStorage.get:', keys, '→', result);
        return result;
      } catch (localError) {
        console.warn('[ICN-STORAGE] ⚠️ localStorage failed:', localError.message);
      }
      
      // Tentative 3 : mémoire
      const result = {};
      for (const key of keyArray) {
        if (key in memoryStorage) {
          result[key] = memoryStorage[key];
        }
      }
      console.log('[ICN-STORAGE] ⚠️ Using memory storage:', keys, '→', result);
      return result;
    },
    
    async set(items) {
      // Si forceLocalStorage activé, sauter browser.storage
      if (!window.ICN_DEBUG.forceLocalStorage) {
        // Tentative 1 : browser.storage
        try {
          await browser.storage.local.set(items);
          window.ICN_DEBUG.log('[ICN-STORAGE] ✓ browser.storage.set:', items);
          return;
        } catch (browserError) {
          console.warn('[ICN-STORAGE] ⚠️ browser.storage.set failed:', browserError.message);
        }
      }
      
      // Tentative 2 : localStorage
      try {
        for (const key in items) {
          if (items.hasOwnProperty(key)) {
            try {
              localStorage.setItem('icn_' + key, JSON.stringify(items[key]));
            } catch (e) {
              localStorage.setItem('icn_' + key, items[key]);
            }
          }
        }
        window.ICN_DEBUG.log('[ICN-STORAGE] ✓ localStorage.set:', items);
        return;
      } catch (localError) {
        console.warn('[ICN-STORAGE] ⚠️ localStorage.set failed:', localError.message);
      }
      
      // Tentative 3 : mémoire
      for (const key in items) {
        if (items.hasOwnProperty(key)) {
          memoryStorage[key] = items[key];
        }
      }
      console.log('[ICN-STORAGE] ⚠️ Using memory storage.set:', items);
    },
    
    async remove(keys) {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      
      // Si forceLocalStorage activé, sauter browser.storage
      if (!window.ICN_DEBUG.forceLocalStorage) {
        // Tentative 1 : browser.storage
        try {
          await browser.storage.local.remove(keys);
          window.ICN_DEBUG.log('[ICN-STORAGE] ✓ browser.storage.remove:', keys);
        } catch (e) {
          console.warn('[ICN-STORAGE] ⚠️ browser.storage.remove failed:', e.message);
        }
      }
      
      // Tentative 2 : localStorage
      try {
        for (const key of keyArray) {
          localStorage.removeItem('icn_' + key);
        }
      } catch (e) {
        console.warn('[ICN-STORAGE] ⚠️ localStorage.remove failed:', e.message);
      }
      
      // Tentative 3 : mémoire
      for (const key of keyArray) {
        delete memoryStorage[key];
      }
    }
  };
  
  // Exposer le StorageManager globalement
  window.ICN_STORAGE = StorageManager;
  window.ICN_DEBUG.log('[ICN-STORAGE] ✓ Storage manager initialized with fallback support');
})();

window.ICN_CONST = {
  KEY_ENABLED: "icn_enabled",
  KEY_OLAF_DATA: "icn_olaf_data", // ✅ Stockage des données OLAF
  KEY_CYCLE_CONFIG: "icn_cycle_config", // ✅ Configuration du cycle

  // Configuration par défaut du cycle
  DEFAULT_CYCLE_CONFIG: {
    cycleStartDate: "2026-02-09",  // Premier jour du cycle (J1)
    cycleLength: 12,                // Longueur du cycle en jours
    workingDays: [1, 2, 3, 6, 7, 8] // Quels jours du cycle sont travaillés
  },

  // Récupérer la configuration du cycle depuis le storage
  async getCycleConfig() {
    try {
      const result = await window.ICN_STORAGE.get(this.KEY_CYCLE_CONFIG);
      return result[this.KEY_CYCLE_CONFIG] || this.DEFAULT_CYCLE_CONFIG;
    } catch (e) {
      console.warn('[ICN] getCycleConfig fallback to default:', e);
      return this.DEFAULT_CYCLE_CONFIG;
    }
  },

  // Calculer le jour dans le cycle à partir d'une date
  getDayInCycle(dateStr, cycleStartDate, cycleLength) {
    const start = new Date(cycleStartDate);
    const current = new Date(dateStr);
    
    // Nombre de jours depuis le début du cycle
    const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
    
    // Position dans le cycle (1 à cycleLength)
    // Gérer les cycles négatifs (dates avant cycleStartDate)
    let dayInCycle = (diffDays % cycleLength) + 1;
    if (dayInCycle <= 0) {
      dayInCycle += cycleLength;
    }
    
    return dayInCycle;
  },

  // Vérifier si une date est un jour travaillé
  isWorkingDay(dateStr, config) {
    const dayInCycle = this.getDayInCycle(dateStr, config.cycleStartDate, config.cycleLength);
    return config.workingDays.includes(dayInCycle);
  },

  // Styles contours avec effet néon
  OUTLINE_ALPHA_DEFAULT: "2px solid #25b6eb",       // 🟡 Jaune par défaut
  OUTLINE_ALPHA_VALIDATED: "2px solid #15803d",     // 🟢 Vert foncé (validé statut_18)
  OUTLINE_ALPHA_PENDING: "2px solid #faa92e",       // 🟢 Vert clair/Lime (en attente statut_17)
  OUTLINE_ALPHA_INVALID: "2px solid #ef4444",       // 🔴 Rouge si manquant dans OLAF
  OUTLINE_BETA_DEFAULT: "2px solid #25b6eb",        // 🔵 Bleu par défaut
  OUTLINE_BETA_VALID: "2px solid #15803d",          // 🟢 Vert légèrement différent pour beta valide
  OUTLINE_BETA_INVALID: "2px solid #ef4444",        // 🔴 Rouge si manquant dans OLAF
  OUTLINE_TYPE_MISMATCH: "2px solid #a855f7",       // 🟣 Violet si alpha/beta inversé
  
  // Box-shadow pour effet néon
  SHADOW_ALPHA_DEFAULT: "0 0 8px rgba(234, 179, 8, 0.6), 0 0 12px rgba(234, 179, 8, 0.3)",
  SHADOW_ALPHA_VALIDATED: "0 0 8px rgba(21, 128, 61, 0.6), 0 0 12px rgba(21, 128, 61, 0.3)",
  SHADOW_ALPHA_PENDING: "0 0 8px rgba(132, 204, 22, 0.6), 0 0 12px rgba(132, 204, 22, 0.3)",
  SHADOW_ALPHA_INVALID: "0 0 8px rgba(239, 68, 68, 0.6), 0 0 12px rgba(239, 68, 68, 0.3)",
  SHADOW_BETA_DEFAULT: "0 0 8px rgba(37, 99, 235, 0.6), 0 0 12px rgba(37, 99, 235, 0.3)",
  SHADOW_BETA_VALID: "0 0 8px rgba(16, 185, 129, 0.6), 0 0 12px rgba(16, 185, 129, 0.3)",
  SHADOW_BETA_INVALID: "0 0 8px rgba(239, 68, 68, 0.6), 0 0 12px rgba(239, 68, 68, 0.3)",
  SHADOW_TYPE_MISMATCH: "0 0 8px rgba(168, 85, 247, 0.6), 0 0 12px rgba(168, 85, 247, 0.3)"
  // GLOW PUISSANT 💫
  // SHADOW_ALPHA_DEFAULT: "0 0 15px rgba(234, 179, 8, 1), 0 0 25px rgba(234, 179, 8, 0.7), 0 0 40px rgba(234, 179, 8, 0.5)",
  // SHADOW_ALPHA_VALID: "0 0 15px rgba(34, 197, 94, 1), 0 0 25px rgba(34, 197, 94, 0.7), 0 0 40px rgba(34, 197, 94, 0.5)",
  // SHADOW_ALPHA_INVALID: "0 0 15px rgba(239, 68, 68, 1), 0 0 25px rgba(239, 68, 68, 0.7), 0 0 40px rgba(239, 68, 68, 0.5)",
  // SHADOW_BETA: "0 0 15px rgba(37, 99, 235, 1), 0 0 25px rgba(37, 99, 235, 0.7), 0 0 40px rgba(37, 99, 235, 0.5)"
};

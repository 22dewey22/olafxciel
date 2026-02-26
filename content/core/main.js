/**
 * Orchestrateur principal
 */
(async function() {
  let tableObserver = null;

  async function getEnabled() {
    const r = await window.ICN_STORAGE.get('icn_enabled');
    return Boolean(r.icn_enabled);
  }

  function installObservers() {
    const table = window.ICN_DOM.getCielTable();
    if (!table) return;

    let lastMonthLabel = window.ICN_DOM.getMonthLabel();

    tableObserver = new MutationObserver(async (mutations) => {
      // Ignorer les mutations causées par nos propres badges
      const isOnlyBadgeChange = mutations.every(mutation => {
        return Array.from(mutation.addedNodes).every(node => 
          node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-icn-ignore')
        ) && Array.from(mutation.removedNodes).every(node =>
          node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-icn-ignore')
        );
      });
      
      if (isOnlyBadgeChange) return; // Ignorer si ce sont juste des badges
      
      const currentMonthLabel = window.ICN_DOM.getMonthLabel();
      
      // Détecter changement de mois
      if (currentMonthLabel !== lastMonthLabel) {
        console.log("[ICN] Month changed:", lastMonthLabel, "→", currentMonthLabel);
        lastMonthLabel = currentMonthLabel;
        
        // Recharger les settings du panel
        if (window.ICN_PANEL_UI && window.ICN_PANEL_UI.panel) {
          await window.ICN_PANEL_UI.loadSettings();
        }
        
        // Auto-chargement OLAF si activé
        const settings = await window.ICN_STORAGE.get(['icn_olaf_autoload', 'olaf_login', 'olaf_pass', 'icn_olaf_cible']);
        console.log("[ICN] Settings auto-load:", {
          autoload: settings.icn_olaf_autoload,
          hasLogin: !!settings.olaf_login,
          hasPass: !!settings.olaf_pass,
          hasCible: !!settings.icn_olaf_cible
        });
        
        if (settings.icn_olaf_autoload && settings.olaf_login && settings.olaf_pass) {
          console.log("[ICN] Auto-chargement OLAF...");
          
          const parser = new CielParser();
          const parsed = parser.parseMonthLabel(currentMonthLabel);
          
          if (parsed) {
            const { year, month } = parsed;
            
            try {
              const olafReport = await window.ICN_OLAF.buildReport({
                login: settings.olaf_login,
                pass: settings.olaf_pass,
                year,
                month,
                cible: settings.icn_olaf_cible
              });

              if (olafReport.ok) {
                // Stocker les données OLAF
                const olafDataToStore = {};
                for (const day of olafReport.days || []) {
                  olafDataToStore[day.day_str] = {
                    alpha: day.alpha,
                    beta: day.beta
                  };
                }
                await window.ICN_STORAGE.set({ icn_olaf_data: olafDataToStore });
                
                console.log("[ICN] ✅ Auto-chargement OLAF réussi");
              } else {
                console.error("[ICN] ❌ Auto-chargement OLAF échoué:", olafReport.error);
                // Ne pas bloquer l'affichage des outlines si OLAF échoue
              }
            } catch (err) {
              console.error("[ICN] ❌ Erreur auto-chargement OLAF:", err.message || err);
              console.error("[ICN] Type d'erreur:", err.name);
              // Continuer même si OLAF échoue
            }
          }
        }
        
        // Appliquer les contours après changement de mois
        const enabled = await getEnabled();
        if (enabled && window.ICN_OUTLINE) {
          await window.ICN_OUTLINE.apply();
        }
        
        // Afficher les remplacements après changement de mois
        if (enabled && window.ICN_REMPLA_DISPLAY) {
          await window.ICN_REMPLA_DISPLAY.apply();
        }
      }
      
      // Appliquer seulement les contours pour les autres mutations (pas les remplacements)
      const enabled = await getEnabled();
      if (enabled && window.ICN_OUTLINE) {
        await window.ICN_OUTLINE.apply();
      }
    });

    tableObserver.observe(table, { childList: true, subtree: true });
  }

  function disconnectObserver() {
    if (tableObserver) tableObserver.disconnect();
  }

  function reconnectObserver() {
    const table = window.ICN_DOM.getCielTable();
    if (table && tableObserver) {
      tableObserver.observe(table, { childList: true, subtree: true });
    }
  }

  // Message handler
  browser.runtime.onMessage.addListener(async (msg) => {
    if (!msg) return;

    if (msg.type === "ICN_TOGGLE") {
      const enabled = Boolean(msg.enabled);
      await window.ICN_STORAGE.set({ icn_enabled: enabled });
      
      if (enabled) {
        await window.ICN_OUTLINE.apply();
        
        // Afficher les remplacements aussi
        if (window.ICN_REMPLA_DISPLAY) {
          await window.ICN_REMPLA_DISPLAY.apply();
        }
      } else {
        await window.ICN_OUTLINE.clearAll();
        
        // Nettoyer les remplacements aussi
        if (window.ICN_REMPLA_DISPLAY) {
          await window.ICN_REMPLA_DISPLAY.clearAll();
        }
      }
      return;
    }

    if (msg.type === "ICN_GET_ABS_REPORT") {
      try {
        return await window.ICN_REPORT.buildReport();
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    }

    if (msg.type === "ICN_REFRESH_OUTLINES") {
      const enabled = await getEnabled();
      if (enabled && window.ICN_OUTLINE) {
        await window.ICN_OUTLINE.apply();
      }
      if (enabled && window.ICN_REMPLA_DISPLAY) {
        await window.ICN_REMPLA_DISPLAY.apply();
      }
      return;
    }
  });

  // Init
  async function init() {
    try {
      console.log("[ICN] Initializing...");
      
      console.log("[ICN] Step 1: Creating panel UI...");
      await window.ICN_PANEL_UI.create();
      console.log("[ICN] Step 1: ✓ Panel created");
      
      console.log("[ICN] Step 2: Attaching handlers...");
      const handlers = new window.ICN_PANEL_HANDLERS(window.ICN_PANEL_UI);
      await handlers.attach();
      console.log("[ICN] Step 2: ✓ Handlers attached");
      
      console.log("[ICN] Step 3: Checking if contours enabled...");
      const enabled = await getEnabled();
      console.log("[ICN] Step 3: Contours enabled =", enabled);
      
      if (enabled && window.ICN_OUTLINE) {
        console.log("[ICN] Step 4: Applying outlines...");
        await window.ICN_OUTLINE.apply();
        console.log("[ICN] Step 4: ✓ Outlines applied");
      }
      
      if (enabled && window.ICN_REMPLA_DISPLAY) {
        console.log("[ICN] Step 4b: Applying remplacements...");
        await window.ICN_REMPLA_DISPLAY.apply();
        console.log("[ICN] Step 4b: ✓ Remplacements applied");
      }
      
      console.log("[ICN] Step 5: Checking auto-load...");
      const settings = await window.ICN_STORAGE.get(['icn_olaf_autoload', 'olaf_login', 'olaf_pass', 'icn_olaf_cible']);
      console.log("[ICN] Step 5: Auto-load settings:", {
        autoload: settings.icn_olaf_autoload,
        hasLogin: !!settings.olaf_login,
        hasPass: !!settings.olaf_pass,
        hasCible: !!settings.icn_olaf_cible
      });
    
    if (settings.icn_olaf_autoload && settings.olaf_login && settings.olaf_pass) {
      console.log("[ICN] Auto-chargement OLAF à l'init...");
      
      const monthLabel = window.ICN_DOM.getMonthLabel();
      const parser = new CielParser();
      const parsed = parser.parseMonthLabel(monthLabel);
      
      if (parsed) {
        const { year, month } = parsed;
        
        try {
          const olafReport = await window.ICN_OLAF.buildReport({
            login: settings.olaf_login,
            pass: settings.olaf_pass,
            year,
            month,
            cible: settings.icn_olaf_cible
          });

          if (olafReport.ok) {
            // Stocker les données OLAF
            const olafDataToStore = {};
            for (const day of olafReport.days || []) {
              olafDataToStore[day.day_str] = {
                alpha: day.alpha,
                beta: day.beta
              };
            }
            await window.ICN_STORAGE.set({ icn_olaf_data: olafDataToStore });
            
            // Rafraîchir les contours
            if (enabled && window.ICN_OUTLINE) {
              await window.ICN_OUTLINE.apply();
            }
            
            // Rafraîchir les remplacements
            if (enabled && window.ICN_REMPLA_DISPLAY) {
              await window.ICN_REMPLA_DISPLAY.apply();
            }
            
            console.log("[ICN] ✅ Auto-chargement OLAF réussi");
          } else {
            console.error("[ICN] ❌ Auto-chargement OLAF échoué:", olafReport.error);
          }
        } catch (err) {
          console.error("[ICN] ❌ Erreur auto-chargement OLAF:", err);
        }
      }
    }
    
    console.log("[ICN] Step 6: Installing observers...");
    installObservers();
    console.log("[ICN] ✅ Initialization complete!");
    
    } catch (error) {
      console.error("[ICN] ❌ Initialization failed:", error);
      console.error("[ICN] Error message:", error.message);
      console.error("[ICN] Error stack:", error.stack);
      throw error;
    }
  }

  // Détecter changements de page
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log("[ICN] Page changed, reloading...");
      
      setTimeout(async () => {
        // Recharger les settings du panel
        if (window.ICN_PANEL_UI && window.ICN_PANEL_UI.panel) {
          await window.ICN_PANEL_UI.loadSettings();
        }

        const enabled = await getEnabled();
        if (enabled && window.ICN_OUTLINE) {
          await window.ICN_OUTLINE.apply();
        }

        // Auto-chargement OLAF si activé
        const settings = await window.ICN_STORAGE.get(['icn_olaf_autoload', 'olaf_login', 'olaf_pass', 'icn_olaf_cible']);
        console.log("[ICN] Settings auto-load:", {
          autoload: settings.icn_olaf_autoload,
          hasLogin: !!settings.olaf_login,
          hasPass: !!settings.olaf_pass,
          hasCible: !!settings.icn_olaf_cible
        });
        
        if (settings.icn_olaf_autoload && settings.olaf_login && settings.olaf_pass) {
          console.log("[ICN] Auto-chargement OLAF...");
          
          const monthLabel = window.ICN_DOM.getMonthLabel();
          const parser = new CielParser();
          const parsed = parser.parseMonthLabel(monthLabel);
          
          if (parsed) {
            const { year, month } = parsed;
            
            try {
              const olafReport = await window.ICN_OLAF.buildReport({
                login: settings.olaf_login,
                pass: settings.olaf_pass,
                year,
                month,
                cible: settings.icn_olaf_cible
              });

              if (olafReport.ok) {
                // Stocker les données OLAF
                const olafDataToStore = {};
                for (const day of olafReport.days || []) {
                  olafDataToStore[day.day_str] = {
                    alpha: day.alpha,
                    beta: day.beta
                  };
                }
                await window.ICN_STORAGE.set({ icn_olaf_data: olafDataToStore });
                
                // Rafraîchir les contours
                if (enabled && window.ICN_OUTLINE) {
                  await window.ICN_OUTLINE.apply();
                }
                
                console.log("[ICN] ✅ Auto-chargement OLAF réussi");
              } else {
                console.error("[ICN] ❌ Auto-chargement OLAF échoué:", olafReport.error);
              }
            } catch (err) {
              console.error("[ICN] ❌ Erreur auto-chargement OLAF:", err);
            }
          }
        }
      }, 500);
    }
  }).observe(document, { subtree: true, childList: true });

  // Export pour totals
  window.ICN_MAIN = {
    disconnectObserver,
    reconnectObserver
  };

  // Lancer l'init
  await init();
})();

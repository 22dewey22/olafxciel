/**
 * Parser pour les demandes de remplacement CIEL
 */
class RemplacementParser {
  constructor() {
    this.BASE_URL = "https://www.icnagenda.fr/ciel/tousremplas.php";
  }

  /**
   * Fetch la page des remplacements
   */
  async fetchRemplacements() {
    try {
      const response = await fetch(this.BASE_URL);
      
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }

      const html = await response.text();
      return { ok: true, html };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /**
   * Parse la page HTML et extrait les demandes
   * @param {string} html - Le HTML de la page
   * @returns {Map<string, Array>} Map avec date comme clé, array de demandes comme valeur
   */
  parseRemplacements(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Map: dateStr -> [{nom, prenom, vacation, equipe, dateStr, dateFull}]
    const demandesByDate = new Map();
    
    // Sélectionner toutes les lignes du tableau
    const rows = doc.querySelectorAll('tbody tr');
    
    window.ICN_DEBUG.log(`[REMPLA] Trouvé ${rows.length} demandes de remplacement`);
    
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      
      if (cells.length < 5) {
        window.ICN_DEBUG.warn(`[REMPLA] Ligne ${index} ignorée (pas assez de colonnes)`);
        return;
      }
      
      const nom = cells[0].textContent.trim();
      const prenom = cells[1].textContent.trim();
      const vacation = cells[2].textContent.trim(); // J1, J2, J3, etc.
      const equipe = cells[3].textContent.trim(); // ALPHA, DELTA, etc.
      const dateFull = cells[4].textContent.trim(); // "samedi 7 mars 2026"
      
      // Parser la date pour avoir le format YYYY-MM-DD
      const dateStr = this.parseDateString(dateFull);
      
      if (!dateStr) {
        window.ICN_DEBUG.warn(`[REMPLA] Date invalide pour ${nom} ${prenom}: "${dateFull}"`);
        return;
      }
      
      const demande = {
        nom,
        prenom,
        vacation,
        equipe,
        dateStr,
        dateFull
      };
      
      if (!demandesByDate.has(dateStr)) {
        demandesByDate.set(dateStr, []);
      }
      
      demandesByDate.get(dateStr).push(demande);
    });
    
    window.ICN_DEBUG.log(`[REMPLA] Demandes groupées par ${demandesByDate.size} dates distinctes`);
    
    return demandesByDate;
  }

  /**
   * Parse une date française en format YYYY-MM-DD
   * @param {string} dateFull - Ex: "samedi 7 mars 2026"
   * @returns {string|null} - Ex: "2026-03-07"
   */
  parseDateString(dateFull) {
    const mois = {
      'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4,
      'mai': 5, 'juin': 6, 'juillet': 7, 'août': 8,
      'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12
    };
    
    // Pattern: "jour DD mois YYYY" ou "DD mois YYYY"
    const match = dateFull.match(/(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i);
    
    if (!match) return null;
    
    const jour = parseInt(match[1], 10);
    const moisStr = match[2].toLowerCase();
    const annee = parseInt(match[3], 10);
    
    const moisNum = mois[moisStr];
    
    if (!moisNum) {
      window.ICN_DEBUG.warn(`[REMPLA] Mois inconnu: "${moisStr}"`);
      return null;
    }
    
    // Format YYYY-MM-DD
    return `${annee}-${String(moisNum).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
  }

  /**
   * Fetch et parse en une seule opération
   * @returns {Object} { ok: boolean, demandes: Map, error?: string }
   */
  async getRemplacements() {
    const fetchResult = await this.fetchRemplacements();
    
    if (!fetchResult.ok) {
      return { ok: false, error: fetchResult.error };
    }
    
    try {
      const demandes = this.parseRemplacements(fetchResult.html);
      return { ok: true, demandes };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }
}

window.ICN_REMPLA = new RemplacementParser();
window.ICN_DEBUG.log('[ICN-REMPLA] Remplacement parser loaded');
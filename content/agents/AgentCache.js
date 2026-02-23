/**
 * Cache des profils agents avec fetch incrémental
 */
class AgentCache {
  constructor() {
    this.CACHE_KEY = 'icn_agents_cache';
    this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 jours
  }

  async getCache() {
    try {
      const result = await window.ICN_STORAGE.get(this.CACHE_KEY);
      if (result[this.CACHE_KEY]) {
        const { agents, timestamp } = result[this.CACHE_KEY];
        if (Date.now() - timestamp < this.CACHE_DURATION) {
          return agents;
        }
      }
      return {};
    } catch (error) {
      window.ICN_DEBUG.warn('[ICN-AGENTS] getCache failed:', error);
      return {};
    }
  }

  async saveCache(agentsMap) {
    try {
      await window.ICN_STORAGE.set({
        [this.CACHE_KEY]: {
          agents: agentsMap,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      window.ICN_DEBUG.warn('[ICN-AGENTS] saveCache failed:', error);
    }
  }

  async fetchProfile(agentId) {
    const url = `https://www.icnagenda.fr/ciel/profil.php?id=${agentId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const h1 = doc.querySelector('h1');
      if (!h1) return null;
      
      const fullName = h1.textContent.trim();
      if (!fullName) return null;
      
      const parts = fullName.split(/\s+/);
      let firstNameParts = [];
      let lastNameParts = [];
      let foundLastName = false;
      
      for (const part of parts) {
        if (part === part.toUpperCase() && part.length > 2) {
          foundLastName = true;
          lastNameParts.push(part);
        } else if (foundLastName) {
          lastNameParts.push(part);
        } else {
          firstNameParts.push(part);
        }
      }
      
      const firstName = firstNameParts.join(' ');
      const lastName = lastNameParts.length > 0 ? lastNameParts.join(' ') : fullName;
      
      return {
        id: agentId,
        firstName,
        lastName,
        fullName,
        tri: lastName.substring(0, 3).toUpperCase()
      };
    } catch (err) {
      window.ICN_DEBUG.error(`[AgentCache] Error fetching ${agentId}:`, err);
      return null;
    }
  }

  detectPageAgents() {
    const agentIds = new Set();
    const rows = document.querySelectorAll('tbody tr.h2[id^="ligneeff"]');
    
    for (const row of rows) {
      const match = row.id.match(/ligneeff(\d+)/);
      if (match) {
        const agentId = match[1];
        const link = row.querySelector('td.eff a.eff');
        if (link && !link.textContent.includes('RENFORT')) {
          agentIds.add(agentId);
        }
      }
    }
    return Array.from(agentIds);
  }

  async getAgentsList(forceRefresh = false) {
    const pageAgentIds = this.detectPageAgents();
    if (pageAgentIds.length === 0) return {};
    
    let cachedAgents = {};
    if (!forceRefresh) {
      cachedAgents = await this.getCache();
    }
    
    const missingIds = pageAgentIds.filter(id => !cachedAgents[id]);
    if (missingIds.length === 0) return cachedAgents;
    
    const agentsMap = { ...cachedAgents };
    
    for (let i = 0; i < missingIds.length; i++) {
      const id = missingIds[i];
      const profile = await this.fetchProfile(id);
      
      if (profile) {
        agentsMap[id] = profile;
      } else {
        // Fallback
        const row = document.querySelector(`tr[id="ligneeff${id}"]`);
        if (row) {
          const link = row.querySelector('td.eff a.eff');
          if (link) {
            const displayName = link.textContent.trim();
            agentsMap[id] = {
              id,
              firstName: '',
              lastName: displayName,
              fullName: displayName,
              tri: displayName.substring(0, 3).toUpperCase()
            };
          }
        }
      }
      
      if (i < missingIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    await this.saveCache(agentsMap);
    return agentsMap;
  }

  async refreshAll() {
    await window.ICN_STORAGE.remove(this.CACHE_KEY);
    return await this.getAgentsList(true);
  }
}

window.ICN_AGENTS = new AgentCache();

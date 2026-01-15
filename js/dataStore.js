// ============================================
// DATA STORE - CENTRALIZED CACHE & DATA LAYER
// ============================================
// Version: 1.0
// 
// PURPOSE:
// - Cache data in memory to avoid repeated DB queries
// - Single source of truth for all data
// - Persist cache in sessionStorage for page navigation
//
// DOES NOT MODIFY:
// - Database structure
// - Existing save/update functions
// - Only READS are cached, WRITES go directly to DB
// ============================================

const DataStore = (function() {
    'use strict';
    
    // ========== CONFIGURATION ==========
    const CACHE_VERSION = '1.0';
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL
    const STORAGE_KEY = 'joineryDataStore';
    
    // ========== INTERNAL STATE ==========
    let cache = {
        projects: null,
        pipelineProjects: null,
        teamMembers: null,
        customPhases: null,
        clients: null,
        companySettings: null
    };
    
    let cacheTimestamps = {
        projects: 0,
        pipelineProjects: 0,
        teamMembers: 0,
        customPhases: 0,
        clients: 0,
        companySettings: 0
    };
    
    let isInitialized = false;
    let loadingPromises = {};
    
    // ========== HELPER FUNCTIONS ==========
    
    function isCacheValid(key) {
        if (!cache[key]) return false;
        const age = Date.now() - cacheTimestamps[key];
        return age < CACHE_TTL;
    }
    
    function setCacheData(key, data) {
        cache[key] = data;
        cacheTimestamps[key] = Date.now();
        saveToSessionStorage();
    }
    
    function saveToSessionStorage() {
        try {
            const storeData = {
                version: CACHE_VERSION,
                cache: cache,
                timestamps: cacheTimestamps
            };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storeData));
        } catch (e) {
            console.warn('DataStore: Failed to save to sessionStorage', e);
        }
    }
    
    function loadFromSessionStorage() {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (!stored) return false;
            
            const storeData = JSON.parse(stored);
            
            // Check version
            if (storeData.version !== CACHE_VERSION) {
                console.log('DataStore: Cache version mismatch, clearing');
                sessionStorage.removeItem(STORAGE_KEY);
                return false;
            }
            
            cache = storeData.cache || cache;
            cacheTimestamps = storeData.timestamps || cacheTimestamps;
            
            console.log('DataStore: Loaded from sessionStorage');
            return true;
        } catch (e) {
            console.warn('DataStore: Failed to load from sessionStorage', e);
            return false;
        }
    }
    
    // ========== PUBLIC API ==========
    
    /**
     * Initialize the data store
     * Loads from sessionStorage if available
     */
    function init() {
        if (isInitialized) return;
        
        loadFromSessionStorage();
        isInitialized = true;
        console.log('DataStore: Initialized');
    }
    
    /**
     * Get team members (with cache)
     * @param {boolean} forceRefresh - bypass cache
     * @returns {Promise<Array>}
     */
    async function getTeamMembers(forceRefresh = false) {
        if (!forceRefresh && isCacheValid('teamMembers')) {
            console.log('DataStore: teamMembers from cache');
            return cache.teamMembers;
        }
        
        // Prevent duplicate requests
        if (loadingPromises.teamMembers) {
            return loadingPromises.teamMembers;
        }
        
        loadingPromises.teamMembers = (async () => {
            try {
                console.log('DataStore: Loading teamMembers from DB');
                const { data, error } = await supabaseClient
                    .from('team_members')
                    .select('*')
                    .eq('active', true)
                    .order('name');
                
                if (error) throw error;
                
                setCacheData('teamMembers', data || []);
                return cache.teamMembers;
            } catch (e) {
                console.error('DataStore: Failed to load teamMembers', e);
                return cache.teamMembers || [];
            } finally {
                delete loadingPromises.teamMembers;
            }
        })();
        
        return loadingPromises.teamMembers;
    }
    
    /**
     * Get team members filtered by phase (LOCAL FILTER - no DB query!)
     * @param {string} phaseKey
     * @returns {Promise<Array>}
     */
    async function getTeamMembersForPhase(phaseKey) {
        const allMembers = await getTeamMembers();
        
        // Filter locally based on department/phase
        const departmentMap = {
            'timber': ['production'],
            'glazing': ['production'],
            'spray': ['spray'],
            'dispatch': ['drivers', 'installation'],
            'siteSurvey': ['management', 'admin', 'installation'],
            'md': ['production', 'management', 'admin'],
            'order': ['admin', 'management'],
            'orderGlazing': ['admin', 'management'],
            'orderSpray': ['admin', 'management'],
            'qc': ['production', 'spray']
        };
        
        const allowedDepartments = departmentMap[phaseKey];
        
        if (!allowedDepartments) {
            // Return all active members for unknown phases
            return allMembers;
        }
        
        return allMembers.filter(m => 
            allowedDepartments.includes(m.department?.toLowerCase())
        );
    }
    
    /**
     * Get custom phases (with cache)
     * @param {boolean} forceRefresh
     * @returns {Promise<Array>}
     */
    async function getCustomPhases(forceRefresh = false) {
        if (!forceRefresh && isCacheValid('customPhases')) {
            console.log('DataStore: customPhases from cache');
            return cache.customPhases;
        }
        
        if (loadingPromises.customPhases) {
            return loadingPromises.customPhases;
        }
        
        loadingPromises.customPhases = (async () => {
            try {
                console.log('DataStore: Loading customPhases from DB');
                const { data, error } = await supabaseClient
                    .from('custom_phases')
                    .select('*');
                
                if (error) throw error;
                
                setCacheData('customPhases', data || []);
                return cache.customPhases;
            } catch (e) {
                console.error('DataStore: Failed to load customPhases', e);
                return cache.customPhases || [];
            } finally {
                delete loadingPromises.customPhases;
            }
        })();
        
        return loadingPromises.customPhases;
    }
    
    /**
     * Get clients (with cache)
     * @param {boolean} forceRefresh
     * @returns {Promise<Array>}
     */
    async function getClients(forceRefresh = false) {
        if (!forceRefresh && isCacheValid('clients')) {
            console.log('DataStore: clients from cache');
            return cache.clients;
        }
        
        if (loadingPromises.clients) {
            return loadingPromises.clients;
        }
        
        loadingPromises.clients = (async () => {
            try {
                console.log('DataStore: Loading clients from DB');
                const { data, error } = await supabaseClient
                    .from('clients')
                    .select('*')
                    .order('name');
                
                if (error) throw error;
                
                setCacheData('clients', data || []);
                return cache.clients;
            } catch (e) {
                console.error('DataStore: Failed to load clients', e);
                return cache.clients || [];
            } finally {
                delete loadingPromises.clients;
            }
        })();
        
        return loadingPromises.clients;
    }
    
    /**
     * Get company settings (with cache)
     * @param {boolean} forceRefresh
     * @returns {Promise<Object>}
     */
    async function getCompanySettings(forceRefresh = false) {
        if (!forceRefresh && isCacheValid('companySettings')) {
            console.log('DataStore: companySettings from cache');
            return cache.companySettings;
        }
        
        if (loadingPromises.companySettings) {
            return loadingPromises.companySettings;
        }
        
        loadingPromises.companySettings = (async () => {
            try {
                console.log('DataStore: Loading companySettings from DB');
                const { data, error } = await supabaseClient
                    .from('company_settings')
                    .select('*')
                    .single();
                
                if (error && error.code !== 'PGRST116') throw error;
                
                setCacheData('companySettings', data || {});
                return cache.companySettings;
            } catch (e) {
                console.error('DataStore: Failed to load companySettings', e);
                return cache.companySettings || {};
            } finally {
                delete loadingPromises.companySettings;
            }
        })();
        
        return loadingPromises.companySettings;
    }
    
    // ========== CACHE MANAGEMENT ==========
    
    /**
     * Invalidate specific cache
     * @param {string} key - cache key to invalidate
     */
    function invalidate(key) {
        if (cache[key] !== undefined) {
            cacheTimestamps[key] = 0;
            console.log(`DataStore: Invalidated ${key}`);
        }
    }
    
    /**
     * Invalidate all caches
     */
    function invalidateAll() {
        Object.keys(cacheTimestamps).forEach(key => {
            cacheTimestamps[key] = 0;
        });
        console.log('DataStore: Invalidated all caches');
    }
    
    /**
     * Clear all data and storage
     */
    function clear() {
        cache = {
            projects: null,
            pipelineProjects: null,
            teamMembers: null,
            customPhases: null,
            clients: null,
            companySettings: null
        };
        cacheTimestamps = {
            projects: 0,
            pipelineProjects: 0,
            teamMembers: 0,
            customPhases: 0,
            clients: 0,
            companySettings: 0
        };
        sessionStorage.removeItem(STORAGE_KEY);
        console.log('DataStore: Cleared');
    }
    
    // ========== LOCAL DATA UPDATES ==========
    // These update cache WITHOUT hitting DB (for optimistic UI)
    
    /**
     * Update team member in cache
     * @param {string} memberId
     * @param {Object} updates
     */
    function updateTeamMemberLocal(memberId, updates) {
        if (!cache.teamMembers) return;
        
        const index = cache.teamMembers.findIndex(m => m.id === memberId);
        if (index !== -1) {
            cache.teamMembers[index] = { ...cache.teamMembers[index], ...updates };
            saveToSessionStorage();
        }
    }
    
    /**
     * Update custom phase in cache
     * @param {string} phaseKey
     * @param {Object} updates
     */
    function updateCustomPhaseLocal(phaseKey, updates) {
        if (!cache.customPhases) return;
        
        const index = cache.customPhases.findIndex(p => p.phase_key === phaseKey);
        if (index !== -1) {
            cache.customPhases[index] = { ...cache.customPhases[index], ...updates };
            saveToSessionStorage();
        }
    }
    
    // ========== DEBUG ==========
    
    function getStats() {
        return {
            isInitialized,
            cacheKeys: Object.keys(cache),
            cacheStatus: Object.keys(cache).reduce((acc, key) => {
                acc[key] = {
                    hasData: cache[key] !== null,
                    isValid: isCacheValid(key),
                    age: cache[key] ? Math.round((Date.now() - cacheTimestamps[key]) / 1000) + 's' : 'N/A'
                };
                return acc;
            }, {})
        };
    }
    
    // ========== EXPOSE PUBLIC API ==========
    return {
        init,
        
        // Getters with cache
        getTeamMembers,
        getTeamMembersForPhase,
        getCustomPhases,
        getClients,
        getCompanySettings,
        
        // Cache management
        invalidate,
        invalidateAll,
        clear,
        
        // Local updates (optimistic UI)
        updateTeamMemberLocal,
        updateCustomPhaseLocal,
        
        // Debug
        getStats
    };
})();

// Auto-init when loaded
if (typeof window !== 'undefined') {
    DataStore.init();
}

// Make available globally
window.DataStore = DataStore;

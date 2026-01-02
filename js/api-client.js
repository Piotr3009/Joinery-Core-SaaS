/**
 * Joinery Core SaaS - API Client
 * Wrapper emulujący supabaseClient ale komunikujący się przez API
 * Dzięki temu reszta kodu nie wymaga zmian
 */

const API_URL = 'https://joinerycore.com';

// Token storage
let authToken = localStorage.getItem('authToken');
let currentSession = JSON.parse(localStorage.getItem('currentSession') || 'null');
let currentUserData = JSON.parse(localStorage.getItem('currentUser') || 'null');

// Helper - try to refresh token
async function tryRefreshToken() {
    if (!currentSession?.refresh_token) {
        return false;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: currentSession.refresh_token })
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        if (data.session) {
            // Update stored tokens
            authToken = data.session.access_token;
            currentSession = data.session;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentSession', JSON.stringify(currentSession));
            console.log('✅ Token refreshed successfully');
            return true;
        }
        
        return false;
    } catch (err) {
        console.error('Token refresh failed:', err);
        return false;
    }
}

// Helper - fetch z autoryzacją
async function apiFetch(endpoint, options = {}, retryCount = 0) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Auto-refresh on 401 (session expired)
            if (response.status === 401 && retryCount === 0) {
                console.warn('Session expired - trying to refresh...');
                
                // Try to refresh token
                const refreshed = await tryRefreshToken();
                
                if (refreshed) {
                    // Retry the original request with new token
                    return apiFetch(endpoint, options, 1);
                }
                
                // Refresh failed - redirect to login
                console.warn('Token refresh failed - redirecting to login');
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentSession');
                localStorage.removeItem('currentUser');
                authToken = null;
                currentSession = null;
                currentUserData = null;
                
                // Only redirect if not already on login/register page
                const currentPage = window.location.pathname.split('/').pop();
                if (!['login.html', 'register.html', 'set-password.html', 'reset-password.html'].includes(currentPage)) {
                    window.location.href = 'login.html?expired=1';
                }
            }
            return { data: null, error: { message: data.error || 'Request failed', status: response.status, code: data.code } };
        }
        
        return { data, error: null };
    } catch (err) {
        return { data: null, error: { message: err.message || 'Network error' } };
    }
}

// ==================== AUTH ====================
const auth = {
    // Get current session
    async getSession() {
        if (!authToken || !currentSession) {
            return { data: { session: null }, error: null };
        }
        
        // Verify token is still valid
        const { data, error } = await apiFetch('/api/auth/me');
        
        if (error) {
            // Token invalid - clear
            await this.signOut();
            return { data: { session: null }, error: null };
        }
        
        return { data: { session: currentSession }, error: null };
    },
    
    // Get current user
    async getUser() {
        if (!authToken) {
            return { data: { user: null }, error: null };
        }
        
        const { data, error } = await apiFetch('/api/auth/me');
        
        if (error) {
            return { data: { user: null }, error };
        }
        
        return { data: { user: data.user }, error: null };
    },
    
    // Sign in with email/password
    async signInWithPassword({ email, password }) {
        const { data, error } = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (error) {
            return { data: null, error };
        }
        
        // Store token and session
        authToken = data.session.access_token;
        currentSession = data.session;
        currentUserData = data.user;
        
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentSession', JSON.stringify(currentSession));
        localStorage.setItem('currentUser', JSON.stringify(currentUserData));
        
        return { 
            data: { 
                session: data.session, 
                user: data.user 
            }, 
            error: null 
        };
    },
    
    // Sign out
    async signOut() {
        try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        
        authToken = null;
        currentSession = null;
        currentUserData = null;
        
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentSession');
        localStorage.removeItem('currentUser');
        
        return { error: null };
    },
    
    // Reset password
    async resetPasswordForEmail(email, options = {}) {
        const { data, error } = await apiFetch('/api/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email, redirectTo: options.redirectTo })
        });
        
        return { data, error };
    },
    
    // Update user (change password)
    async updateUser({ password, email }) {
        const { data, error } = await apiFetch('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ password, email })
        });
        
        return { data: data?.user ? { user: data.user } : null, error };
    },
    
    // Sign up - redirect to register.html for new companies
    async signUp({ email, password, options }) {
        // W SaaS rejestracja nowych firm jest przez register.html
        // Ta metoda jest tylko dla kompatybilności
        return { 
            data: null, 
            error: { 
                message: 'To register a new company, please use the registration page. For adding team members, use Team Management.' 
            } 
        };
    },
    
    // On auth state change (simplified)
    onAuthStateChange(callback) {
        // Initial call
        if (currentSession) {
            callback('SIGNED_IN', currentSession);
        } else {
            callback('SIGNED_OUT', null);
        }
        
        // Return unsubscribe function
        return {
            data: {
                subscription: {
                    unsubscribe: () => {}
                }
            }
        };
    }
};

// ==================== DATABASE QUERY BUILDER ====================
class QueryBuilder {
    constructor(table) {
        this.table = table;
        this._select = '*';
        this._filters = [];
        this._order = null;
        this._limit = null;
        this._single = false;
        this._maybeSingle = false;
        this._count = null;
        this._data = null;
        this._range = null;
    }
    
    select(columns = '*', options = {}) {
        this._select = columns;
        if (options.count) {
            this._count = options.count;
        }
        return this;
    }
    
    eq(column, value) {
        this._filters.push({ type: 'eq', column, value });
        return this;
    }
    
    neq(column, value) {
        this._filters.push({ type: 'neq', column, value });
        return this;
    }
    
    gt(column, value) {
        this._filters.push({ type: 'gt', column, value });
        return this;
    }
    
    gte(column, value) {
        this._filters.push({ type: 'gte', column, value });
        return this;
    }
    
    lt(column, value) {
        this._filters.push({ type: 'lt', column, value });
        return this;
    }
    
    lte(column, value) {
        this._filters.push({ type: 'lte', column, value });
        return this;
    }
    
    like(column, pattern) {
        this._filters.push({ type: 'like', column, value: pattern });
        return this;
    }
    
    ilike(column, pattern) {
        this._filters.push({ type: 'ilike', column, value: pattern });
        return this;
    }
    
    is(column, value) {
        this._filters.push({ type: 'is', column, value });
        return this;
    }
    
    in(column, values) {
        this._filters.push({ type: 'in', column, value: values });
        return this;
    }
    
    contains(column, value) {
        this._filters.push({ type: 'contains', column, value });
        return this;
    }
    
    or(conditions) {
        this._filters.push({ type: 'or', value: conditions });
        return this;
    }
    
    not(column, operator, value) {
        this._filters.push({ type: 'not', column, operator, value });
        return this;
    }
    
    filter(column, operator, value) {
        this._filters.push({ type: 'filter', column, operator, value });
        return this;
    }
    
    order(column, options = {}) {
        this._order = { column, ascending: options.ascending !== false };
        return this;
    }
    
    limit(count) {
        this._limit = count;
        return this;
    }
    
    range(from, to) {
        this._range = { from, to };
        return this;
    }
    
    single() {
        this._single = true;
        return this;
    }
    
    maybeSingle() {
        this._single = true;
        this._maybeSingle = true;
        return this;
    }
    
    // Execute query
    async _execute(operation) {
        const { data, error } = await apiFetch('/api/db/query', {
            method: 'POST',
            body: JSON.stringify({
                operation,
                table: this.table,
                select: this._select,
                filters: this._filters,
                order: this._order,
                limit: this._limit,
                range: this._range,
                single: this._single,
                count: this._count,
                data: this._data
            })
        });
        
        if (error) {
            return { data: null, error, count: null };
        }
        
        return { data: data.data, error: null, count: data.count };
    }
    
    // Make it thenable for await
    then(resolve, reject) {
        this._execute('select')
            .then(resolve)
            .catch(reject || (err => resolve({ data: null, error: err })));
    }
}

// INSERT builder
class InsertBuilder extends QueryBuilder {
    constructor(table, data) {
        super(table);
        this._data = data;
    }
    
    then(resolve, reject) {
        this._execute('insert')
            .then(resolve)
            .catch(reject || (err => resolve({ data: null, error: err })));
    }
}

// UPDATE builder  
class UpdateBuilder extends QueryBuilder {
    constructor(table, data) {
        super(table);
        this._data = data;
    }
    
    then(resolve, reject) {
        this._execute('update')
            .then(resolve)
            .catch(reject || (err => resolve({ data: null, error: err })));
    }
}

// DELETE builder
class DeleteBuilder extends QueryBuilder {
    constructor(table) {
        super(table);
    }
    
    then(resolve, reject) {
        this._execute('delete')
            .then(resolve)
            .catch(reject || (err => resolve({ data: null, error: err })));
    }
}

// UPSERT builder
class UpsertBuilder extends QueryBuilder {
    constructor(table, data, options = {}) {
        super(table);
        this._data = data;
        this._onConflict = options.onConflict;
    }
    
    then(resolve, reject) {
        this._execute('upsert')
            .then(resolve)
            .catch(reject || (err => resolve({ data: null, error: err })));
    }
}

// Table interface - emuluje supabaseClient.from()
function from(table) {
    return {
        select: function(columns, options) {
            return new QueryBuilder(table).select(columns, options);
        },
        insert: function(data) {
            return new InsertBuilder(table, data);
        },
        update: function(data) {
            return new UpdateBuilder(table, data);
        },
        delete: function() {
            return new DeleteBuilder(table);
        },
        upsert: function(data, options) {
            return new UpsertBuilder(table, data, options);
        }
    };
}

// ==================== STORAGE ====================
const storage = {
    from(bucket) {
        return {
            // Upload file - używa binarnego uploadu zamiast base64
            async upload(path, file, options = {}) {
                try {
                    // Użyj binarnego uploadu (bez konwersji base64)
                    const url = `${API_URL}/api/storage/upload-form?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}&upsert=${options.upsert || false}`;
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': options.contentType || file.type || 'application/octet-stream',
                            'Authorization': authToken ? `Bearer ${authToken}` : ''
                        },
                        body: file  // Wysyłaj plik bezpośrednio jako binary
                    });
                    
                    const data = await response.json();
                    
                    if (!response.ok) {
                        return { data: null, error: { message: data.error || 'Upload failed', status: response.status } };
                    }
                    
                    return { data: data.data, error: null };
                } catch (err) {
                    return { data: null, error: { message: err.message } };
                }
            },
            
            // Download file
            async download(path) {
                try {
                    const response = await fetch(
                        `${API_URL}/api/storage/download?bucket=${bucket}&path=${encodeURIComponent(path)}`,
                        {
                            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
                        }
                    );
                    
                    if (!response.ok) {
                        const error = await response.json();
                        return { data: null, error: { message: error.error } };
                    }
                    
                    const blob = await response.blob();
                    return { data: blob, error: null };
                } catch (err) {
                    return { data: null, error: { message: err.message } };
                }
            },
            
            // Remove files
            async remove(paths) {
                const pathArray = Array.isArray(paths) ? paths : [paths];
                const { data, error } = await apiFetch('/api/storage/remove', {
                    method: 'POST',
                    body: JSON.stringify({ bucket, paths: pathArray })
                });
                
                return { data, error };
            },
            
            // Get public URL
            getPublicUrl(path) {
                // Return URL that redirects to Supabase (no auth needed)
                const publicUrl = `${API_URL}/api/storage/file/${bucket}/${path}`;
                return { data: { publicUrl } };
            },
            
            // List files
            async list(path = '', options = {}) {
                const params = new URLSearchParams({ bucket, path });
                const { data, error } = await apiFetch(`/api/storage/list?${params}`);
                return { data: data?.data, error };
            },
            
            // Create signed URL
            async createSignedUrl(path, expiresIn = 3600) {
                const { data, error } = await apiFetch('/api/storage/signed-url', {
                    method: 'POST',
                    body: JSON.stringify({ bucket, path, expiresIn })
                });
                
                return { data: data?.data, error };
            }
        };
    }
};

// ==================== RPC (Remote Procedure Call) ====================
async function rpc(functionName, params = {}) {
    const { data, error } = await apiFetch('/api/rpc', {
        method: 'POST',
        body: JSON.stringify({ function: functionName, params })
    });
    
    if (error) {
        return { data: null, error };
    }
    
    return { data: data?.data, error: null };
}

// ==================== REALTIME (stub) ====================
function channel(name) {
    return {
        on: () => channel(name),
        subscribe: () => ({ unsubscribe: () => {} })
    };
}

// ==================== EXPORTED CLIENT ====================
// This replaces the Supabase CDN client
const supabaseClient = {
    auth,
    from,
    storage,
    rpc,
    channel
};

// Make it globally available (same as Supabase CDN)
window.supabaseClient = supabaseClient;
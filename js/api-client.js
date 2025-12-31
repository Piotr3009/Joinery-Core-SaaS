/**
 * Joinery Core SaaS - API Client (Supabase-like wrapper via API)
 * Poprawki:
 * - apiFetch: bezpieczne parsowanie (204 / non-JSON)
 * - upsert: wysyła onConflict
 * - maybeSingle: wysyła maybeSingle
 * - getSession: buduje sensowną sesję z exp z JWT
 * - onAuthStateChange: działa (emit na signIn/signOut)
 * - storage.upload: bez stack overflow (FileReader / base64)
 */

const API_URL = 'https://joinerycore.com'.replace(/\/+$/, ''); // bez trailing slash

// Token storage
let authToken = localStorage.getItem('authToken');
let currentSession = JSON.parse(localStorage.getItem('currentSession') || 'null');
let currentUserData = JSON.parse(localStorage.getItem('currentUser') || 'null');

// -------------------- helpers --------------------
function base64UrlDecode(str) {
  // JWT uses base64url
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  try {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    // fallback bez decodeURIComponent
    return atob(str);
  }
}

function parseJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

function buildSessionFromToken(token, user) {
  const payload = parseJwt(token);
  const now = Math.floor(Date.now() / 1000);
  const exp = payload?.exp || null;

  return {
    access_token: token,
    token_type: 'bearer',
    refresh_token: currentSession?.refresh_token || null, // jak masz – zostanie
    expires_at: exp,
    expires_in: exp ? Math.max(0, exp - now) : null,
    user: user || currentUserData || null
  };
}

function saveAuth(session, user) {
  authToken = session?.access_token || null;
  currentSession = session || null;
  currentUserData = user || null;

  if (authToken) localStorage.setItem('authToken', authToken);
  else localStorage.removeItem('authToken');

  if (currentSession) localStorage.setItem('currentSession', JSON.stringify(currentSession));
  else localStorage.removeItem('currentSession');

  if (currentUserData) localStorage.setItem('currentUser', JSON.stringify(currentUserData));
  else localStorage.removeItem('currentUser');
}

// -------------------- auth event emitter --------------------
const _authListeners = new Set();
function _emitAuth(event, session) {
  for (const cb of _authListeners) {
    try { cb(event, session); } catch (_) {}
  }
}

// -------------------- fetch wrapper --------------------
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    // Bezpieczne parsowanie: 204 / non-JSON
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = { raw: text }; }
    }

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: payload?.error || payload?.message || 'Request failed',
          status: response.status,
          code: payload?.code
        }
      };
    }

    return { data: payload, error: null };
  } catch (err) {
    return { data: null, error: { message: err?.message || 'Network error' } };
  }
}

// ==================== AUTH ====================
const auth = {
  async getSession() {
    if (!authToken) return { data: { session: null }, error: null };

    // Verify token
    const { data, error } = await apiFetch('/api/auth/me');

    if (error) {
      await this.signOut();
      return { data: { session: null }, error: null };
    }

    // Zawsze buduj sensowną sesję (nawet jeśli localStorage jest puste)
    const rebuilt = buildSessionFromToken(authToken, data?.user);
    saveAuth(rebuilt, data?.user);

    return { data: { session: currentSession }, error: null };
  },

  async getUser() {
    if (!authToken) return { data: { user: null }, error: null };

    const { data, error } = await apiFetch('/api/auth/me');
    if (error) return { data: { user: null }, error };

    // odśwież local cache
    currentUserData = data.user;
    localStorage.setItem('currentUser', JSON.stringify(currentUserData));

    return { data: { user: data.user }, error: null };
  },

  async signInWithPassword({ email, password }) {
    const { data, error } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (error) return { data: null, error };

    // data: { session, user, organization }
    const session = data?.session;
    const user = data?.user;

    if (!session?.access_token) {
      return { data: null, error: { message: 'Login response missing access_token' } };
    }

    saveAuth(session, user);
    _emitAuth('SIGNED_IN', currentSession);

    return { data: { session: currentSession, user: currentUserData }, error: null };
  },

  async signOut() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}

    saveAuth(null, null);
    _emitAuth('SIGNED_OUT', null);

    return { error: null };
  },

  async resetPasswordForEmail(email, options = {}) {
    const { data, error } = await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo: options.redirectTo })
    });
    return { data, error };
  },

  async updateUser({ password, email }) {
    const { data, error } = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ password, email })
    });
    return { data: data?.user ? { user: data.user } : null, error };
  },

  async signUp() {
    return {
      data: null,
      error: { message: 'Use register.html for new companies. For team members, use Team Management.' }
    };
  },

  onAuthStateChange(callback) {
    // zarejestruj
    _authListeners.add(callback);

    // initial call
    if (currentSession?.access_token) callback('SIGNED_IN', currentSession);
    else callback('SIGNED_OUT', null);

    return {
      data: {
        subscription: {
          unsubscribe: () => _authListeners.delete(callback)
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
    this._onConflict = null;
  }

  select(columns = '*', options = {}) {
    this._select = columns;
    if (options.count) this._count = options.count;
    return this;
  }

  eq(column, value) { this._filters.push({ type: 'eq', column, value }); return this; }
  neq(column, value) { this._filters.push({ type: 'neq', column, value }); return this; }
  gt(column, value) { this._filters.push({ type: 'gt', column, value }); return this; }
  gte(column, value) { this._filters.push({ type: 'gte', column, value }); return this; }
  lt(column, value) { this._filters.push({ type: 'lt', column, value }); return this; }
  lte(column, value) { this._filters.push({ type: 'lte', column, value }); return this; }
  like(column, pattern) { this._filters.push({ type: 'like', column, value: pattern }); return this; }
  ilike(column, pattern) { this._filters.push({ type: 'ilike', column, value: pattern }); return this; }
  is(column, value) { this._filters.push({ type: 'is', column, value }); return this; }
  in(column, values) { this._filters.push({ type: 'in', column, value: values }); return this; }
  contains(column, value) { this._filters.push({ type: 'contains', column, value }); return this; }
  or(conditions) { this._filters.push({ type: 'or', value: conditions }); return this; }
  not(column, operator, value) { this._filters.push({ type: 'not', column, operator, value }); return this; }
  filter(column, operator, value) { this._filters.push({ type: 'filter', column, operator, value }); return this; }

  order(column, options = {}) {
    this._order = { column, ascending: options.ascending !== false };
    return this;
  }

  limit(count) { this._limit = count; return this; }
  range(from, to) { this._range = { from, to }; return this; }

  single() { this._single = true; this._maybeSingle = false; return this; }
  maybeSingle() { this._single = true; this._maybeSingle = true; return this; }

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
        maybeSingle: this._maybeSingle,
        count: this._count,
        data: this._data,
        onConflict: this._onConflict
      })
    });

    if (error) return { data: null, error, count: null };

    // backend zakładam: { data: ..., count: ... }
    return { data: data?.data ?? null, error: null, count: data?.count ?? null };
  }

  then(resolve, reject) {
    this._execute('select')
      .then(resolve)
      .catch(reject || (err => resolve({ data: null, error: err, count: null })));
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }
}

class InsertBuilder extends QueryBuilder {
  constructor(table, data) { super(table); this._data = data; }
  then(resolve, reject) {
    this._execute('insert')
      .then(resolve)
      .catch(reject || (err => resolve({ data: null, error: err, count: null })));
  }
}

class UpdateBuilder extends QueryBuilder {
  constructor(table, data) { super(table); this._data = data; }
  then(resolve, reject) {
    this._execute('update')
      .then(resolve)
      .catch(reject || (err => resolve({ data: null, error: err, count: null })));
  }
}

class DeleteBuilder extends QueryBuilder {
  constructor(table) { super(table); }
  then(resolve, reject) {
    this._execute('delete')
      .then(resolve)
      .catch(reject || (err => resolve({ data: null, error: err, count: null })));
  }
}

class UpsertBuilder extends QueryBuilder {
  constructor(table, data, options = {}) {
    super(table);
    this._data = data;
    this._onConflict = options.onConflict || null;
  }
  then(resolve, reject) {
    this._execute('upsert')
      .then(resolve)
      .catch(reject || (err => resolve({ data: null, error: err, count: null })));
  }
}

function from(table) {
  return {
    select: (columns, options) => new QueryBuilder(table).select(columns, options),
    insert: (data) => new InsertBuilder(table, data),
    update: (data) => new UpdateBuilder(table, data),
    delete: () => new DeleteBuilder(table),
    upsert: (data, options) => new UpsertBuilder(table, data, options)
  };
}

// ==================== STORAGE ====================
function fileToBase64DataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read error'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

const storage = {
  from(bucket) {
    return {
      async upload(path, file, options = {}) {
        try {
          let fileData;
          let contentType = options.contentType || (file && file.type) || 'application/octet-stream';

          if (file instanceof Blob || file instanceof File) {
            const dataUrl = await fileToBase64DataUrl(file);
            // "data:...;base64,XXXX"
            const comma = dataUrl.indexOf(',');
            fileData = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
          } else if (typeof file === 'string') {
            fileData = file; // already base64
          } else {
            return { data: null, error: { message: 'Unsupported file type for upload' } };
          }

          const { data, error } = await apiFetch('/api/storage/upload', {
            method: 'POST',
            body: JSON.stringify({
              bucket,
              path,
              fileData,
              contentType,
              upsert: !!options.upsert
            })
          });

          if (error) return { data: null, error };
          return { data: data?.data ?? null, error: null };
        } catch (err) {
          return { data: null, error: { message: err?.message || 'Upload error' } };
        }
      },

      async download(path) {
        try {
          const response = await fetch(
            `${API_URL}/api/storage/download?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`,
            { headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {} }
          );

          if (!response.ok) {
            // może nie być JSON
            const text = await response.text();
            let payload = null;
            try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
            return { data: null, error: { message: payload?.error || payload?.message || 'Download failed' } };
          }

          const blob = await response.blob();
          return { data: blob, error: null };
        } catch (err) {
          return { data: null, error: { message: err?.message || 'Download error' } };
        }
      },

      async remove(paths) {
        const pathArray = Array.isArray(paths) ? paths : [paths];
        const { data, error } = await apiFetch('/api/storage/remove', {
          method: 'POST',
          body: JSON.stringify({ bucket, paths: pathArray })
        });
        return { data, error };
      },

      getPublicUrl(path) {
        const publicUrl = `${API_URL}/api/storage/public/${encodeURIComponent(bucket)}/${path}`;
        return { data: { publicUrl } };
      },

      async list(path = '', options = {}) {
        const params = new URLSearchParams({ bucket, path, ...options });
        const { data, error } = await apiFetch(`/api/storage/list?${params.toString()}`);
        return { data: data?.data ?? null, error };
      },

      async createSignedUrl(path, expiresIn = 3600) {
        const { data, error } = await apiFetch('/api/storage/signed-url', {
          method: 'POST',
          body: JSON.stringify({ bucket, path, expiresIn })
        });
        return { data: data?.data ?? null, error };
      }
    };
  }
};

// ==================== RPC ====================
async function rpc(functionName, params = {}) {
  const { data, error } = await apiFetch('/api/rpc', {
    method: 'POST',
    body: JSON.stringify({ function: functionName, params })
  });
  if (error) return { data: null, error };
  return { data: data?.data ?? null, error: null };
}

// ==================== REALTIME (stub) ====================
function channel(name) {
  return {
    on: () => channel(name),
    subscribe: () => ({ unsubscribe: () => {} })
  };
}

// ==================== EXPORTED CLIENT ====================
const supabaseClient = { auth, from, storage, rpc, channel };
window.supabaseClient = supabaseClient;
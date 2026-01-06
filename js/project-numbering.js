// ========== UNIFIED PROJECT NUMBERING ==========
// Format: NNN/YYYY (e.g., 001/2026, 042/2026)
// Used by: pipeline_projects + projects + archived_projects

(function() {
    const TABLES = ['pipeline_projects', 'projects', 'archived_projects'];
    const FIELD = 'project_number';

    function pad3(n) {
        return String(n).padStart(3, '0');
    }

    function currentYear() {
        return new Date().getFullYear();
    }

    function extractNumberPart(projectNumber) {
        // expects "NNN/YYYY"
        if (typeof projectNumber !== 'string') return null;
        const m = projectNumber.match(/^(\d{3})\/(\d{4})$/);
        if (!m) return null;
        return { n: parseInt(m[1], 10), y: parseInt(m[2], 10) };
    }

    function getSupabaseClient() {
        return window.supabaseClient || window.supabase || null;
    }

    async function getMaxForYearFromTable(supabase, table, year) {
        const { data, error } = await supabase
            .from(table)
            .select(FIELD)
            .like(FIELD, `%/${year}`)
            .order(FIELD, { ascending: false })
            .limit(1);

        if (error) throw error;
        if (!data || data.length === 0 || !data[0][FIELD]) return 0;

        const parsed = extractNumberPart(data[0][FIELD]);
        return parsed && parsed.y === year ? parsed.n : 0;
    }

    async function existsNumberInTable(supabase, table, projectNumber) {
        const { data, error } = await supabase
            .from(table)
            .select(FIELD)
            .eq(FIELD, projectNumber)
            .limit(1);

        if (error) throw error;
        return Array.isArray(data) && data.length > 0;
    }

    // GŁÓWNA FUNKCJA: pobiera następny numer z DB
    async function getNextUnifiedProjectNumber(opts = {}) {
        const year = opts.year ?? currentYear();
        const supabase = opts.supabase ?? getSupabaseClient();

        if (!supabase) {
            return getNextUnifiedProjectNumberLocal({ year });
        }

        let maxN = 0;
        for (const t of TABLES) {
            try {
                const n = await getMaxForYearFromTable(supabase, t, year);
                if (n > maxN) maxN = n;
            } catch (err) {
                console.error(`Error checking ${t}:`, err);
            }
        }

        let nextN = maxN + 1;

        // Sprawdź czy nie ma kolizji
        while (true) {
            const candidate = `${pad3(nextN)}/${year}`;
            let exists = false;
            
            for (const t of TABLES) {
                try {
                    if (await existsNumberInTable(supabase, t, candidate)) {
                        exists = true;
                        break;
                    }
                } catch (err) {
                    console.error(`Error checking existence in ${t}:`, err);
                }
            }

            if (!exists) {
                console.log('Unified number generated:', { maxN, nextN, candidate });
                return candidate;
            }
            nextN += 1;
        }
    }

    // FALLBACK: bez DB (localStorage)
    function getNextUnifiedProjectNumberLocal(opts = {}) {
        const year = opts.year ?? currentYear();
        const key = `unified_project_seq_${year}`;

        const last = parseInt(localStorage.getItem(key) || '0', 10);
        const next = last + 1;

        localStorage.setItem(key, String(next));
        return `${pad3(next)}/${year}`;
    }

    // WALIDACJA: format + duplikat
    async function validateProjectNumber(projectNumber, opts = {}) {
        const year = opts.year ?? currentYear();
        const supabase = opts.supabase ?? getSupabaseClient();

        const parsed = extractNumberPart(projectNumber);
        if (!parsed) {
            return { ok: false, reason: 'Invalid format. Use NNN/YYYY (e.g. 001/2026).' };
        }

        if (parsed.y !== year) {
            return { ok: false, reason: `Year must be ${year}.` };
        }

        if (!supabase) return { ok: true };

        for (const t of TABLES) {
            try {
                if (await existsNumberInTable(supabase, t, projectNumber)) {
                    return { ok: false, reason: `Number already exists (${t}).` };
                }
            } catch (err) {
                console.error(`Error validating in ${t}:`, err);
            }
        }

        return { ok: true };
    }

    // Export to global scope
    window.getNextUnifiedProjectNumber = getNextUnifiedProjectNumber;
    window.getNextUnifiedProjectNumberLocal = getNextUnifiedProjectNumberLocal;
    window.validateProjectNumber = validateProjectNumber;
})();

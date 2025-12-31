// ========== INITIALIZATION WITH AUTH FIX ==========
let isInitialized = false;

window.addEventListener('DOMContentLoaded', async () => {
  if (isInitialized) return;
  isInitialized = true;

  if (typeof supabaseClient === 'undefined') {
    console.error('supabaseClient not loaded');
    return;
  }

  try {
    // 1) Session check
    const { data, error: sessionError } = await supabaseClient.auth.getSession();
    const session = data?.session;

    if (sessionError || !session?.access_token) {
      if (!sessionStorage.getItem('redirecting')) {
        sessionStorage.setItem('redirecting', 'true');
        window.location.href = 'login.html';
      }
      return;
    }

    // logged in -> clear redirect flag
    sessionStorage.removeItem('redirecting');

    const userId = session.user?.id;
    if (!userId) {
      console.error('Session missing user.id');
      // token jest, ale usera brak -> spróbuj pobrać usera
      const { data: u, error: uErr } = await supabaseClient.auth.getUser();
      if (uErr || !u?.user?.id) return;
    }

    const finalUserId = userId || (await supabaseClient.auth.getUser()).data?.user?.id;

    // 2) Profile (nie zakładaj że istnieje)
    const profRes = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', finalUserId)
      .maybeSingle();

    const profile = profRes?.data || null;
    const profileError = profRes?.error || null;

    if (profileError) {
      console.warn('Profile load error:', profileError);
    }

    // fallback minimalny, żeby UI nie wywaliło
    window.currentUser = profile || { id: finalUserId, full_name: 'User', role: 'worker' };

    // 3) Toolbar dropdown (tylko jeśli funkcja istnieje)
    if (typeof addUserDropdownToToolbar === 'function') {
      addUserDropdownToToolbar(window.currentUser);
    }

    // 4) Load data + render (tylko raz)
    await loadData();

    if (Array.isArray(window.projects)) {
      migratePhaseCategories();
    } else if (Array.isArray(typeof projects !== 'undefined' ? projects : null)) {
      migratePhaseCategories();
    } else {
      console.warn('projects is not an array - skipping migrate');
    }

    if (typeof updatePhasesLegend === 'function') updatePhasesLegend();
    if (typeof render === 'function') render();
  } catch (err) {
    console.error('Init error:', err);
    // nie redirectuj w pętli, tylko stop
    return;
  }
});

// LOGOUT
function logout() {
  if (!confirm('Are you sure you want to logout?')) return;

  supabaseClient.auth.signOut().then(() => {
    sessionStorage.removeItem('redirecting');
    window.location.href = 'login.html';
  });
}

// Close modals on ESC
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  document.querySelectorAll('.modal.active').forEach(modal => {
    modal.classList.remove('active');
  });
});

// MIGRACJA
function migratePhaseCategories() {
  const PRODUCTION_PHASES = ['timber', 'spray', 'glazing', 'qc'];
  const OFFICE_PHASES = ['md', 'siteSurvey', 'order', 'orderGlazing', 'orderSpray', 'dispatch', 'installation'];

  const projList = (typeof projects !== 'undefined' ? projects : window.projects);
  if (!Array.isArray(projList)) return;

  let migrated = 0;

  projList.forEach(project => {
    if (!project?.phases) return;

    project.phases.forEach(phase => {
      if (!phase || phase.category) return;

      if (PRODUCTION_PHASES.includes(phase.key)) phase.category = 'production';
      else if (OFFICE_PHASES.includes(phase.key)) phase.category = 'office';
      else phase.category = 'production';

      migrated++;
    });
  });

  if (migrated > 0) {
    if (typeof saveData === 'function') saveData();
  }
}

// ========== PERMISSIONS: HIDE BUTTONS FOR WORKER ==========
window.addEventListener('permissionsLoaded', function() {
  if (!window.currentUserRole) return;

  if (window.currentUserRole === 'worker' || window.currentUserRole === 'viewer') {
    const selectors = [
      '#addProjectBtn',
      'button[onclick="openMoveToArchiveModal()"]',
      'button[onclick="openPhaseManager()"]'
    ];

    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.style.display = 'none';
    });

    const exportDropdown = document.querySelector('.export-dropdown');
    if (exportDropdown) exportDropdown.style.display = 'none';
  }
});

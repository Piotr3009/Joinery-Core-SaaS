// ========================================
// ACTIVITY LOGGER - Log user actions
// ========================================

/**
 * Log an activity to the database
 * @param {string} action - One of: add, delete, update, upload, order, complete, cancel, move
 * @param {string} department - One of: stock, project, wages, files, accounting, team
 * @param {string} description - Human readable description, e.g. "added stock item MAT-045 Oak Veneer"
 */
async function logActivity(action, department, description) {
    try {
        // Get current user info
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.warn('logActivity: No user logged in');
            return;
        }
        
        // Get user profile for tenant_id and name
        const { data: profile, error: profileError } = await supabaseClient
            .from('user_profiles')
            .select('tenant_id, full_name')
            .eq('id', user.id)
            .single();
        
        if (profileError || !profile) {
            console.warn('logActivity: Could not get user profile', profileError);
            return;
        }
        
        // Insert activity log
        const { error } = await supabaseClient
            .from('activity_log')
            .insert({
                tenant_id: profile.tenant_id,
                user_id: user.id,
                user_name: profile.full_name || user.email || 'Unknown',
                action: action,
                department: department,
                description: description
            });
        
        if (error) {
            console.error('logActivity: Insert failed', error);
        }
    } catch (err) {
        console.error('logActivity: Error', err);
    }
}

// Make function globally available
window.logActivity = logActivity;

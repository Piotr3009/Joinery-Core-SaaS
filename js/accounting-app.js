// ========================================
// ACCOUNTING MODULE - Main Application
// ========================================

let accountingData = [];
let monthlyOverheadsData = [];
let wagesData = [];
let pipelineProjectsData = [];
let productionProjectsData = [];
let archivedProjectsData = [];
let clientsData = [];
let projectMaterialsData = [];
let archivedProjectMaterialsData = [];
let projectPhasesData = [];
let archivedProjectPhasesData = [];
let teamMembersData = [];
// Finance Details - NEW
let projectDepositsData = [];
let projectVariationsData = [];
let expandedProjectId = null; // Track which row is expanded

let currentYear = new Date().getFullYear();
let activeTab = 'finances';
let activeFinancesSubTab = 'live';

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    
    // Set YTD period dynamically
    const ytdPeriodEl = document.getElementById('ytdPeriod');
    if (ytdPeriodEl) {
        ytdPeriodEl.textContent = `Jan - Dec ${new Date().getFullYear()}`;
    }
    
    await loadAllAccountingData();
    populateYearFilter();
    renderDashboard();
    
    // Check if it's 1st day of month - remind about overheads
    checkMonthlyOverheadsReminder();
});

// ========================================
// DATA LOADING
// ========================================

async function loadAllAccountingData() {
    try {
        const { data: clients, error: clientsError } = await supabaseClient
            .from('clients')
            .select('*');
        
        if (!clientsError) clientsData = clients || [];

        const { data: pipeline, error: pipelineError } = await supabaseClient
            .from('pipeline_projects')
            .select('*')
            .eq('status', 'active');
        
        
        if (!pipelineError) {
            pipelineProjectsData = pipeline || [];
        }

        const pipelineIds = pipelineProjectsData.map(p => p.id);
        let pipelinePhases = [];
        if (pipelineIds.length > 0) {
            const { data: phases } = await supabaseClient
                .from('pipeline_phases')
                .select('*')
                .in('pipeline_project_id', pipelineIds);
            pipelinePhases = phases || [];
        }

        pipelineProjectsData = pipelineProjectsData.map(p => {
            const phases = pipelinePhases.filter(ph => ph.pipeline_project_id === p.id);
            const lastPhase = phases.sort((a, b) => 
                new Date(b.end_date || b.start_date) - new Date(a.end_date || a.start_date)
            )[0];
            
            return {
                ...p,
                deadline: lastPhase ? (lastPhase.end_date || lastPhase.start_date) : null
            };
        });

        const { data: production, error: productionError } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('status', 'active');
        
        
        if (!productionError) productionProjectsData = production || [];

        // Load project materials for cost calculation
        const productionIds = productionProjectsData.map(p => p.id);
        if (productionIds.length > 0) {
            const { data: materials, error: materialsError } = await supabaseClient
                .from('project_materials')
                .select('project_id, quantity_needed, unit_cost')
                .in('project_id', productionIds);
            
            if (!materialsError) projectMaterialsData = materials || [];
        }

        const { data: archived, error: archivedError } = await supabaseClient
            .from('archived_projects')
            .select('*');
        
        if (!archivedError) archivedProjectsData = archived || [];

        const { data: overheads, error: overheadsError } = await supabaseClient
            .from('monthly_overheads')
            .select('*')
            .order('month', { ascending: true });
        
        if (!overheadsError) monthlyOverheadsData = overheads || [];

        const { data: wages, error: wagesError } = await supabaseClient
            .from('wages')
            .select('*')
            .order('period_start', { ascending: false });
        
        if (!wagesError) wagesData = wages || [];

        // Load team members for job_type (ALL - including inactive, for historical wages)
        const { data: team, error: teamError } = await supabaseClient
            .from('team_members')
            .select('id, name, job_type, active');
        
        if (!teamError) teamMembersData = team || [];

        // Load project phases with assignments (use existing productionIds)
        if (productionIds.length > 0) {
            const { data: phases, error: phasesError } = await supabaseClient
                .from('project_phases')
                .select('project_id, phase_key, start_date, end_date, work_days, assigned_to')
                .in('project_id', productionIds);
            
            if (!phasesError) projectPhasesData = phases || [];
        }

        // Load archived project phases for labour calculation
        const archivedIds = archivedProjectsData.map(p => p.id);
        if (archivedIds.length > 0) {
            const { data: archivedPhases, error: archivedPhasesError } = await supabaseClient
                .from('archived_project_phases')
                .select('archived_project_id, phase_key, start_date, end_date, work_days, assigned_to')
                .in('archived_project_id', archivedIds);
            
            // Mapuj archived_project_id na project_id dla spójności
            if (!archivedPhasesError && archivedPhases) {
                archivedProjectPhasesData = archivedPhases.map(ph => ({
                    ...ph,
                    project_id: ph.archived_project_id
                }));
            }
            
            // Load archived project materials
            const { data: archivedMaterials, error: archivedMaterialsError } = await supabaseClient
                .from('archived_project_materials')
                .select('archived_project_id, quantity_needed, unit_cost')
                .in('archived_project_id', archivedIds);
            
            // Mapuj archived_project_id na project_id dla spójności
            if (!archivedMaterialsError && archivedMaterials) {
                archivedProjectMaterialsData = archivedMaterials.map(m => ({
                    ...m,
                    project_id: m.archived_project_id
                }));
            }
        }

        // ========================================
        // FINANCE DETAILS - Load deposits & variations
        // ========================================
        
        // Load deposits for production projects
        if (productionIds.length > 0) {
            const { data: deposits, error: depositsError } = await supabaseClient
                .from('project_deposits')
                .select('*')
                .in('project_id', productionIds);
            
            if (!depositsError) projectDepositsData = deposits || [];
            
            const { data: variations, error: variationsError } = await supabaseClient
                .from('project_variations')
                .select('*')
                .in('project_id', productionIds);
            
            if (!variationsError) projectVariationsData = variations || [];
        }
        
        // Archived projects używają tylko actual_value (suma contract_value + variations)
        // Nie ma osobnych tabel archived_deposits / archived_variations


    } catch (error) {
        console.error('Error loading accounting data:', error);
    }
}

async function refreshAccountingData() {
    await loadAllAccountingData();
    renderDashboard();
}

// ========================================
// CALCULATIONS
// ========================================

// Helper: oblicz dni nakładające się między dwoma zakresami dat
function getOverlappingDays(start1, end1, start2, end2) {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);
    
    const overlapStart = new Date(Math.max(s1, s2));
    const overlapEnd = new Date(Math.min(e1, e2));
    
    if (overlapStart > overlapEnd) return 0;
    
    // Policz dni robocze (bez weekendów)
    let days = 0;
    const current = new Date(overlapStart);
    while (current <= overlapEnd) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // nie niedziela i sobota
            days++;
        }
        current.setDate(current.getDate() + 1);
    }
    return days;
}

// Oblicz labour cost dla projektu
function calculateLabourForProject(projectId) {
    let totalLabour = 0;
    
    // Połącz fazy z aktywnych i zarchiwizowanych projektów
    const allPhases = [...projectPhasesData, ...archivedProjectPhasesData];
    
    // Połącz wszystkie projekty (aktywne + archived)
    const allProjects = [...productionProjectsData, ...archivedProjectsData];
    
    // Dla każdej wypłaty
    wagesData.forEach(wage => {
        const worker = teamMembersData.find(tm => tm.id === wage.team_member_id);
        if (!worker) {
            console.warn('⚠️ Worker not found for wage:', wage.team_member_id, 'Amount:', wage.gross_amount);
            return;
        }
        
        const jobType = worker.job_type;
        const wageAmount = parseFloat(wage.gross_amount) || 0;
        const wageStart = wage.period_start;
        const wageEnd = wage.period_end;
        
        if (jobType === 'labour' || jobType === 'driver' || jobType === 'other') {
            // LABOUR/DRIVER/OTHER: dziel proporcjonalnie na projekt-dni (timber + glazing)
            let totalProjectDays = 0;
            let thisProjectDays = 0;
            
            allProjects.forEach(proj => {
                const phases = allPhases.filter(ph => ph.project_id === proj.id);
                phases.forEach(ph => {
                    const isTimberGlazing = ph.phase_key === 'timber' || ph.phase_key === 'glazing';
                    if (isTimberGlazing && ph.start_date && ph.end_date) {
                        const days = getOverlappingDays(ph.start_date, ph.end_date, wageStart, wageEnd);
                        totalProjectDays += days;
                        if (proj.id === projectId) {
                            thisProjectDays += days;
                        }
                    }
                });
            });
            
            if (totalProjectDays > 0 && thisProjectDays > 0) {
                totalLabour += (wageAmount / totalProjectDays) * thisProjectDays;
            }
            
        } else if (jobType === 'joiner') {
            // JOINER: dziel na fazy TIMBER do których przypisany
            const workerTimberPhases = allPhases.filter(ph => 
                ph.assigned_to === worker.id && ph.phase_key === 'timber'
            );
            
            let totalWorkerDays = 0;
            let thisProjectWorkerDays = 0;
            
            workerTimberPhases.forEach(ph => {
                if (ph.start_date && ph.end_date) {
                    const days = getOverlappingDays(ph.start_date, ph.end_date, wageStart, wageEnd);
                    totalWorkerDays += days;
                    if (ph.project_id === projectId) {
                        thisProjectWorkerDays += days;
                    }
                }
            });
            
            if (totalWorkerDays > 0 && thisProjectWorkerDays > 0) {
                totalLabour += (wageAmount / totalWorkerDays) * thisProjectWorkerDays;
            }
            
        } else if (jobType === 'sprayer' || jobType === 'prep') {
            // SPRAYER + PREP: dziel na fazy SPRAY do których przypisany (dla sprayer) lub wszystkie spray (dla prep)
            let sprayPhases;
            
            if (jobType === 'sprayer') {
                // Sprayer - tylko fazy gdzie jest przypisany
                sprayPhases = allPhases.filter(ph => 
                    ph.assigned_to === worker.id && ph.phase_key === 'spray'
                );
            } else {
                // Prep - WSZYSTKIE fazy spray w tym okresie
                sprayPhases = allPhases.filter(ph => ph.phase_key === 'spray');
            }
            
            let totalSprayDays = 0;
            let thisProjectSprayDays = 0;
            
            sprayPhases.forEach(ph => {
                if (ph.start_date && ph.end_date) {
                    const days = getOverlappingDays(ph.start_date, ph.end_date, wageStart, wageEnd);
                    totalSprayDays += days;
                    if (ph.project_id === projectId) {
                        thisProjectSprayDays += days;
                    }
                }
            });
            
            if (totalSprayDays > 0 && thisProjectSprayDays > 0) {
                totalLabour += (wageAmount / totalSprayDays) * thisProjectSprayDays;
            }
        }
        // office - ignorujemy
    });
    
    return totalLabour;
}

function calculateTotalPipelineBudget() {
    pipelineProjectsData.forEach(p => {
    });
    
    const total = pipelineProjectsData.reduce((sum, p) => {
        return sum + (parseFloat(p.estimated_value) || 0);
    }, 0);
    return total;
}

function calculateTotalProductionBudget() {
    productionProjectsData.forEach(p => {
    });
    
    const total = productionProjectsData.reduce((sum, p) => {
        return sum + (parseFloat(p.contract_value) || 0);
    }, 0);
    return total;
}

function calculateYTDTurnover(year = currentYear) {
    
    const filtered = archivedProjectsData.filter(p => {
        if (!p.completed_date && !p.archived_date) return false;
        const date = new Date(p.completed_date || p.archived_date);
        return date.getFullYear() === year && p.archive_reason === 'completed';
    });
    
    filtered.forEach(p => {
        const value = parseFloat(p.actual_value || p.contract_value) || 0;
    });
    
    const ytd = filtered.reduce((sum, p) => sum + (parseFloat(p.actual_value || p.contract_value) || 0), 0);
    return ytd;
}

function calculateBurnRate() {
    
    if (monthlyOverheadsData.length === 0) {
        return 0;
    }
    
    monthlyOverheadsData.forEach(o => {
    });
    
    const avgOverheads = monthlyOverheadsData.reduce((sum, o) => 
        sum + (parseFloat(o.overheads_value) || 0), 0
    ) / monthlyOverheadsData.length;
    
    const burnRate = avgOverheads / 30;
    return burnRate;
}

function getMonthlyBreakdown() {
    const months = {};
    
    // Helper: oblicz materials dla projektu
    const getMaterialsCost = (projectId) => {
        return projectMaterialsData
            .filter(m => m.project_id === projectId)
            .reduce((sum, m) => sum + ((m.quantity_needed || 0) * (m.unit_cost || 0)), 0);
    };
    
    // Helper: oblicz labour per miesiąc (WSZYSTKIE wages z danego miesiąca)
    const getLabourForMonth = (monthKey) => {
        let totalLabour = 0;
        
        wagesData.forEach(wage => {
            // Sprawdź czy wypłata jest w tym miesiącu
            const wageMonth = wage.period_start.substring(0, 7); // "2025-12"
            if (wageMonth !== monthKey) return;
            
            const worker = teamMembersData.find(tm => tm.id === wage.team_member_id);
            if (!worker) return;
            
            const jobType = worker.job_type;
            const wageAmount = parseFloat(wage.gross_amount) || 0;
            
            // Licz wszystkich poza office
            if (jobType !== 'office') {
                totalLabour += wageAmount;
            }
        });
        
        return totalLabour;
    };
    
    // Buduj miesiące z production projects (revenue + materials według deadline)
    productionProjectsData.forEach(p => {
        if (!p.deadline) return;
        
        const deadline = new Date(p.deadline);
        const monthKey = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}`;
        
        if (!months[monthKey]) {
            months[monthKey] = {
                month: monthKey,
                projects: [],
                totalValue: 0,
                totalMaterials: 0,
                totalLabour: 0
            };
        }
        
        const materials = getMaterialsCost(p.id);
        
        months[monthKey].projects.push(p);
        months[monthKey].totalValue += parseFloat(p.contract_value) || 0;
        months[monthKey].totalMaterials += materials;
    });
    
    // Dodaj miesiące z wages (nawet jeśli nie ma projektów z deadline w tym miesiącu)
    wagesData.forEach(wage => {
        const wageMonth = wage.period_start.substring(0, 7);
        if (!months[wageMonth]) {
            months[wageMonth] = {
                month: wageMonth,
                projects: [],
                totalValue: 0,
                totalMaterials: 0,
                totalLabour: 0
            };
        }
    });
    
    // Oblicz labour dla każdego miesiąca (według miesiąca wypłaty)
    Object.keys(months).forEach(monthKey => {
        months[monthKey].totalLabour = getLabourForMonth(monthKey);
        
        const overhead = monthlyOverheadsData.find(o => o.month === monthKey);
        months[monthKey].overheads = parseFloat(overhead?.overheads_value) || 0;
        
        // Real Profit = Value - Materials - Labour - Overheads
        months[monthKey].realProfit = months[monthKey].totalValue 
            - months[monthKey].totalMaterials 
            - months[monthKey].totalLabour 
            - months[monthKey].overheads;
        
        months[monthKey].margin = months[monthKey].totalValue > 0 
            ? (months[monthKey].realProfit / months[monthKey].totalValue * 100) 
            : 0;
    });
    
    return Object.values(months).sort((a, b) => b.month.localeCompare(a.month)); // newest first
}

function getProjectProfits() {
    return archivedProjectsData
        .filter(p => p.archive_reason === 'completed')
        .map(p => {
            const value = parseFloat(p.actual_value || p.contract_value) || 0;
            const cost = parseFloat(p.project_cost) || 0;
            const profit = value - cost;
            const margin = value > 0 ? (profit / value * 100) : 0;
            
            return {
                ...p,
                value,
                cost,
                profit,
                margin
            };
        })
        .sort((a, b) => b.margin - a.margin);
}

function getRevenuePerClient() {
    const clientRevenue = {};
    
    archivedProjectsData
        .filter(p => p.archive_reason === 'completed')
        .forEach(p => {
            const clientId = p.client_id;
            if (!clientId) return;
            
            if (!clientRevenue[clientId]) {
                const client = clientsData.find(c => c.id === clientId);
                clientRevenue[clientId] = {
                    client_id: clientId,
                    client_name: client?.company_name || 'Unknown',
                    projects: [],
                    totalRevenue: 0
                };
            }
            
            const revenue = parseFloat(p.actual_value || p.contract_value) || 0;
            clientRevenue[clientId].projects.push(p);
            clientRevenue[clientId].totalRevenue += revenue;
        });
    
    return Object.values(clientRevenue).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// ========================================
// RENDERING
// ========================================

function renderDashboard() {
    renderSummaryCards();
    renderActiveTab();
}

function renderSummaryCards() {
    const pipelineBudget = calculateTotalPipelineBudget();
    document.getElementById('totalPipelineBudget').textContent = `£${pipelineBudget.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('pipelineProjectCount').textContent = `${pipelineProjectsData.length} projects`;
    
    const productionBudget = calculateTotalProductionBudget();
    document.getElementById('totalProductionBudget').textContent = `£${productionBudget.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('productionProjectCount').textContent = `${productionProjectsData.length} projects`;
    
    const ytd = calculateYTDTurnover();
    document.getElementById('ytdTurnover').textContent = `£${ytd.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    
    const burnRate = calculateBurnRate();
    document.getElementById('burnRate').textContent = `£${burnRate.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
}

function renderActiveTab() {
    switch(activeTab) {
        case 'finances':
            renderFinances();
            break;
        case 'monthly':
            renderMonthlyBreakdown();
            break;
        case 'clients':
            renderRevenuePerClient();
            break;
    }
}

// ========== PROJECT FINANCES ==========

function switchFinancesSubTab(subTab) {
    activeFinancesSubTab = subTab;
    
    // Update sub-tab buttons
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        if (btn.dataset.subtab === subTab) {
            btn.style.background = '#3b82f6';
            btn.style.border = 'none';
            btn.style.color = 'white';
            btn.classList.add('active');
        } else {
            btn.style.background = '#27272a';
            btn.style.border = '1px solid #3f3f46';
            btn.style.color = '#a1a1aa';
            btn.classList.remove('active');
        }
    });
    
    // Show/hide tables
    document.getElementById('financesLiveTable').style.display = subTab === 'live' ? 'block' : 'none';
    document.getElementById('financesArchiveTable').style.display = subTab === 'archive' ? 'block' : 'none';
    
    renderFinances();
}

function renderFinances() {
    if (activeFinancesSubTab === 'live') {
        renderFinancesLive();
    } else {
        renderFinancesArchive();
    }
}

function renderFinancesLive() {
    const container = document.getElementById('financesLiveTable');
    
    // Helper functions
    const getMaterialsCost = (projectId) => {
        return projectMaterialsData
            .filter(m => m.project_id === projectId)
            .reduce((sum, m) => sum + ((m.quantity_needed || 0) * (m.unit_cost || 0)), 0);
    };
    
    const getDeposits = (projectId) => {
        return projectDepositsData.filter(d => d.project_id === projectId);
    };
    
    const getVariations = (projectId) => {
        return projectVariationsData.filter(v => v.project_id === projectId);
    };
    
    const sumDeposits = (projectId) => {
        return getDeposits(projectId)
            .filter(d => d.paid)
            .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    };
    
    const sumVariations = (projectId) => {
        return getVariations(projectId)
            .reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
    };
    
    // Map projects with calculations
    const projects = productionProjectsData.map(p => {
        const value = parseFloat(p.contract_value) || 0;
        const materials = getMaterialsCost(p.id);
        const labour = calculateLabourForProject(p.id);
        const variationsTotal = sumVariations(p.id);
        const total = value + variationsTotal;
        const depositsTotal = sumDeposits(p.id);
        const outstanding = total - depositsTotal;
        const profit = value - materials - labour;
        const deposits = getDeposits(p.id);
        const variations = getVariations(p.id);
        
        return {
            ...p,
            value,
            materials,
            labour,
            variationsTotal,
            total,
            depositsTotal,
            outstanding,
            profit,
            deposits,
            variations
        };
    }).sort((a, b) => (b.project_number || '').localeCompare(a.project_number || ''));
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="color: #999;">No active projects in production.</p>';
        return;
    }
    
    // Helper: format date as DD/MM
    const formatDL = (dateStr) => {
        if (!dateStr) return '<span style="color: #666;">—</span>';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    };
    
    const formatDateFull = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };
    
    let html = `
    <style>
        .finance-row { cursor: pointer; transition: background 0.2s; }
        .finance-row:hover { background: #252525; }
        .finance-row.expanded { background: #1f1f1f; }
        .expanded-content { padding: 20px; background: #191919; }
        .detail-section { background: #252525; border-radius: 6px; padding: 14px; margin-bottom: 12px; }
        .detail-section h4 { color: #888; font-size: 10px; text-transform: uppercase; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
        .add-btn { background: #f59e0b; border: none; color: #000; padding: 3px 8px; border-radius: 3px; font-size: 9px; cursor: pointer; font-weight: 600; }
        .add-btn:hover { background: #d97706; }
        .detail-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #333; font-size: 11px; }
        .detail-item:last-child { border-bottom: none; }
        .folder { background: #1a1a1a; border: 1px dashed #444; border-radius: 6px; padding: 12px 8px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .folder:hover { border-color: #f59e0b; background: #222; }
        .notes-field { width: 100%; background: #1a1a1a; border: 1px solid #333; color: #e0e0e0; padding: 10px; border-radius: 4px; font-size: 11px; resize: vertical; min-height: 50px; }
    </style>
    <table style="width: 100%; border-collapse: collapse; color: white; min-width: 1200px;">
        <thead>
            <tr style="background: #2a2a2a; border-bottom: 2px solid #444;">
                <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #888; width: 80px;">Project #</th>
                <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #888; width: 60px;">DL</th>
                <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #888; width: 180px;">Name</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #888; width: 110px;">Value</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #888; width: 110px;">Variations</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #D4AF37; width: 110px;">Total</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #888; width: 110px;">Deposits</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #888; width: 110px;">Outstanding</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #888; width: 100px;">Materials</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #888; width: 100px;">Labour</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #888; width: 100px;">Profit</th>
                <th style="padding: 12px; text-align: center; font-size: 10px; text-transform: uppercase; color: #888; width: 50px;">Docs</th>
            </tr>
        </thead>
        <tbody>`;
    
    projects.forEach(p => {
        const isExpanded = expandedProjectId === p.id;
        const variationsColor = p.variationsTotal >= 0 ? '#4ade80' : '#f87171';
        const variationsSign = p.variationsTotal >= 0 ? '+' : '';
        const outstandingColor = p.outstanding <= 0 ? '#4ade80' : '#f87171';
        const profitColor = p.profit >= 0 ? '#4ade80' : '#f87171';
        
        html += `<tr class="finance-row ${isExpanded ? 'expanded' : ''}" onclick="toggleFinanceRow('${p.id}')" style="border-bottom: 1px solid #333;">
            <td style="padding: 12px; color: #fff; font-weight: 600;">${p.project_number || '—'}</td>
            <td style="padding: 12px; color: #999;">${formatDL(p.deadline)}</td>
            <td style="padding: 12px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</td>
            <td style="padding: 12px; text-align: right; font-family: monospace; cursor: pointer;" onclick="event.stopPropagation(); editContractValue('${p.id}', ${p.value})" title="Click to edit">£${p.value.toLocaleString('en-GB', {minimumFractionDigits: 2})} <span style="font-size: 9px; color: #666;">✏️</span></td>
            <td style="padding: 12px; text-align: right; font-family: monospace; color: ${variationsColor};">${variationsSign}£${Math.abs(p.variationsTotal).toLocaleString('en-GB', {minimumFractionDigits: 2})} <span style="font-size: 9px; color: #666;">(${p.variations.length})</span></td>
            <td style="padding: 12px; text-align: right; font-family: monospace; font-weight: 600; color: #D4AF37;">£${p.total.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; font-family: monospace;">£${p.depositsTotal.toLocaleString('en-GB', {minimumFractionDigits: 2})} ${p.deposits.filter(d => d.paid).length === p.deposits.length && p.deposits.length > 0 ? '<span style="color: #4ade80;">✓</span>' : (p.deposits.length > 0 ? '<span style="color: #f59e0b;">○</span>' : '')}</td>
            <td style="padding: 12px; text-align: right; font-family: monospace; color: ${outstandingColor};">${p.outstanding <= 0 ? '£0.00 ✓' : '£' + p.outstanding.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; font-family: monospace;">${p.materials > 0 ? '£' + p.materials.toLocaleString('en-GB', {minimumFractionDigits: 2}) : '—'}</td>
            <td style="padding: 12px; text-align: right; font-family: monospace;">${p.labour > 0 ? '£' + p.labour.toLocaleString('en-GB', {minimumFractionDigits: 2}) : '—'}</td>
            <td style="padding: 12px; text-align: right; font-family: monospace; color: ${profitColor};">${p.materials > 0 || p.labour > 0 ? '£' + p.profit.toLocaleString('en-GB', {minimumFractionDigits: 2}) : '—'}</td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="event.stopPropagation(); openFinanceDocs('${p.id}')" style="background: #333; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; color: #e0e0e0;">📁</button>
            </td>
        </tr>`;
        
        // Expanded content
        if (isExpanded) {
            html += `<tr><td colspan="12" style="padding: 0; background: #191919;">
                <div class="expanded-content">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px;">
                        <!-- Variations -->
                        <div class="detail-section">
                            <h4>📝 Variations <button class="add-btn" onclick="event.stopPropagation(); openAddVariation('${p.id}')">+ Add</button></h4>
                            ${p.variations.length === 0 ? '<div style="color: #555; font-size: 11px; font-style: italic;">No variations</div>' : ''}
                            ${p.variations.map(v => `
                                <div class="detail-item">
                                    <span style="color: #ccc; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${v.description}</span>
                                    <span style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-family: monospace; color: ${parseFloat(v.amount) >= 0 ? '#4ade80' : '#f87171'};">${parseFloat(v.amount) >= 0 ? '+' : ''}£${parseFloat(v.amount).toLocaleString('en-GB', {minimumFractionDigits: 2})}</span>
                                        <span style="color: #888; font-size: 10px;">${formatDateFull(v.date)}</span>
                                        <button onclick="event.stopPropagation(); editVariation('${v.id}')" style="background: none; border: none; cursor: pointer; font-size: 10px; color: #888;" title="Edit">✏️</button>
                                        <button onclick="event.stopPropagation(); deleteVariation('${v.id}')" style="background: none; border: none; cursor: pointer; font-size: 10px; color: #f87171;" title="Delete">🗑️</button>
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- Deposits -->
                        <div class="detail-section">
                            <h4>💰 Deposits <button class="add-btn" onclick="event.stopPropagation(); openAddDeposit('${p.id}')">+ Add</button></h4>
                            ${p.deposits.length === 0 ? '<div style="color: #555; font-size: 11px; font-style: italic;">No deposits</div>' : ''}
                            ${p.deposits.map(d => `
                                <div class="detail-item">
                                    <span style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-family: monospace;">£${parseFloat(d.amount).toLocaleString('en-GB', {minimumFractionDigits: 2})}</span>
                                        <span style="color: ${d.paid ? '#4ade80' : '#f59e0b'};">${d.paid ? '✓' : '○'}</span>
                                    </span>
                                    <span style="display: flex; align-items: center; gap: 6px;">
                                        <span style="color: #888; font-size: 10px;">${d.invoice_number ? d.invoice_number + ' · ' : ''}${formatDateFull(d.paid_date)}</span>
                                        <button onclick="event.stopPropagation(); editDeposit('${d.id}')" style="background: none; border: none; cursor: pointer; font-size: 10px; color: #888;" title="Edit">✏️</button>
                                        <button onclick="event.stopPropagation(); deleteDeposit('${d.id}')" style="background: none; border: none; cursor: pointer; font-size: 10px; color: #f87171;" title="Delete">🗑️</button>
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- Documents -->
                        <div class="detail-section" style="grid-column: span 2;">
                            <h4>📁 Documents</h4>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                <div class="folder" onclick="event.stopPropagation(); openFinanceFolder('${p.id}', 'estimates')">
                                    <div style="font-size: 20px; margin-bottom: 4px;">📄</div>
                                    <div style="font-size: 9px; color: #888;">Estimates</div>
                                </div>
                                <div class="folder" onclick="event.stopPropagation(); openFinanceFolder('${p.id}', 'invoices')">
                                    <div style="font-size: 20px; margin-bottom: 4px;">🧾</div>
                                    <div style="font-size: 9px; color: #888;">Invoices</div>
                                </div>
                                <div class="folder" onclick="event.stopPropagation(); openFinanceFolder('${p.id}', 'others')">
                                    <div style="font-size: 20px; margin-bottom: 4px;">📎</div>
                                    <div style="font-size: 9px; color: #888;">Others</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Notes -->
                    <div class="detail-section" style="margin-top: 12px;">
                        <h4>📋 Notes</h4>
                        <textarea class="notes-field" placeholder="VAT rate, payment terms, special conditions..." onblur="saveFinanceNotes('${p.id}', this.value)" onclick="event.stopPropagation()">${p.finance_notes || ''}</textarea>
                    </div>
                </div>
            </td></tr>`;
        }
    });
    
    html += `</tbody></table>`;
    
    container.innerHTML = html;
}

// Toggle expanded row
function toggleFinanceRow(projectId) {
    expandedProjectId = expandedProjectId === projectId ? null : projectId;
    renderFinancesLive();
}

function renderFinancesArchive() {
    const container = document.getElementById('financesArchiveTable');
    
    // Helper: oblicz materials dla archived projektu
    const getMaterialsCostArchived = (projectId) => {
        // Szukamy w archived_project_materials jeśli istnieje, lub używamy zapisanego kosztu
        return archivedProjectMaterialsData
            .filter(m => m.project_id === projectId)
            .reduce((sum, m) => sum + ((m.quantity_needed || 0) * (m.unit_cost || 0)), 0);
    };
    
    // Filtruj ukończone projekty
    const projects = archivedProjectsData
        .filter(p => p.archive_reason === 'completed')
        .map(p => {
            const value = parseFloat(p.actual_value || p.contract_value) || 0;
            const materials = getMaterialsCostArchived(p.id);
            const labour = calculateLabourForProject(p.id);
            const totalCost = materials + labour;
            const profit = value - totalCost;
            const margin = value > 0 ? (profit / value * 100) : 0;
            
            return {
                ...p,
                value,
                materials,
                labour,
                totalCost,
                profit,
                margin
            };
        })
        .sort((a, b) => b.margin - a.margin);
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="color: #999;">No completed projects in archive.</p>';
        return;
    }
    
    // Helper: format date as MM/YYYY
    const formatDL = (dateStr) => {
        if (!dateStr) return '<span style="color: #666;">—</span>';
        const d = new Date(dateStr);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${month}/${year}`;
    };
    
    let html = `<table style="width: 100%; border-collapse: collapse; color: white;">
        <thead>
            <tr style="background: #2a2a2a; border-bottom: 2px solid #444;">
                <th style="padding: 12px; text-align: left;">Project #</th>
                <th style="padding: 12px; text-align: left;">DL</th>
                <th style="padding: 12px; text-align: left;">Name</th>
                <th style="padding: 12px; text-align: right;">Value</th>
                <th style="padding: 12px; text-align: right;">Materials</th>
                <th style="padding: 12px; text-align: right;">Labour</th>
                <th style="padding: 12px; text-align: right;">Profit</th>
                <th style="padding: 12px; text-align: right;">Margin %</th>
            </tr>
        </thead>
        <tbody>`;
    
    projects.forEach(p => {
        const hasCosts = p.materials > 0 || p.labour > 0;
        const marginColor = p.margin >= 20 ? '#4ade80' : p.margin >= 10 ? '#fee140' : '#f5576c';
        
        const materialsDisplay = p.materials > 0 ? `£${p.materials.toLocaleString('en-GB', {minimumFractionDigits: 2})}` : '<span style="color: #666;">—</span>';
        const labourDisplay = p.labour > 0 ? `£${p.labour.toLocaleString('en-GB', {minimumFractionDigits: 2})}` : '<span style="color: #666;">—</span>';
        const profitDisplay = hasCosts ? `£${p.profit.toLocaleString('en-GB', {minimumFractionDigits: 2})}` : '<span style="color: #666;">—</span>';
        const marginDisplay = hasCosts ? `${p.margin.toFixed(1)}%` : '<span style="color: #666;">—</span>';
        
        html += `<tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">${p.project_number}</td>
            <td style="padding: 12px; color: #999;">${formatDL(p.completed_date)}</td>
            <td style="padding: 12px;">${p.name}</td>
            <td style="padding: 12px; text-align: right;">£${p.value.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; color: #f97316;">${materialsDisplay}</td>
            <td style="padding: 12px; text-align: right; color: #8b5cf6;">${labourDisplay}</td>
            <td style="padding: 12px; text-align: right; color: ${p.profit >= 0 ? '#4ade80' : '#f5576c'};">${profitDisplay}</td>
            <td style="padding: 12px; text-align: right; font-weight: bold; color: ${marginColor};">${marginDisplay}</td>
        </tr>`;
    });
    
    // Totals
    const totalValue = projects.reduce((sum, p) => sum + p.value, 0);
    const totalMaterials = projects.reduce((sum, p) => sum + p.materials, 0);
    const totalLabour = projects.reduce((sum, p) => sum + p.labour, 0);
    const totalProfit = totalValue - totalMaterials - totalLabour;
    const avgMargin = totalValue > 0 ? (totalProfit / totalValue * 100) : 0;
    
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;">
        <td colspan="3" style="padding: 12px;">TOTAL (${projects.length} projects)</td>
        <td style="padding: 12px; text-align: right;">£${totalValue.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #f97316;">£${totalMaterials.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #8b5cf6;">£${totalLabour.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: ${totalProfit >= 0 ? '#4ade80' : '#f5576c'};">£${totalProfit.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #4facfe;">${avgMargin.toFixed(1)}%</td>
    </tr></tbody></table>`;
    
    container.innerHTML = html;
}

function renderMonthlyBreakdown() {
    const months = getMonthlyBreakdown();
    
    // Usuwamy pierwszą tabelę (skill)
    document.getElementById('monthlyBreakdownTable').innerHTML = '';
    
    // Nowa tabela z pełnym podsumowaniem
    let html = `<table style="width: 100%; border-collapse: collapse; color: white;">
        <thead>
            <tr style="background: #2a2a2a; border-bottom: 2px solid #444;">
                <th style="padding: 12px; text-align: left;">Month</th>
                <th style="padding: 12px; text-align: right;">Revenue</th>
                <th style="padding: 12px; text-align: right;">Materials</th>
                <th style="padding: 12px; text-align: right;">Labour</th>
                <th style="padding: 12px; text-align: right;">Overheads</th>
                <th style="padding: 12px; text-align: right;">Real Profit</th>
                <th style="padding: 12px; text-align: right;">Margin</th>
            </tr>
        </thead>
        <tbody>`;
    
    months.forEach(m => {
        const marginColor = m.margin >= 20 ? '#4ade80' : m.margin >= 10 ? '#fee140' : '#f5576c';
        const profitColor = m.realProfit >= 0 ? '#4ade80' : '#f5576c';
        
        html += `<tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">${formatMonth(m.month)}</td>
            <td style="padding: 12px; text-align: right;">£${m.totalValue.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; color: #f97316;">£${m.totalMaterials.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; color: #8b5cf6;">£${m.totalLabour.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; color: #ef4444;">£${m.overheads.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; font-weight: bold; color: ${profitColor};">£${m.realProfit.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; font-weight: bold; color: ${marginColor};">${m.margin.toFixed(1)}%</td>
        </tr>`;
    });
    
    // Totals
    const totals = months.reduce((acc, m) => ({
        value: acc.value + m.totalValue,
        materials: acc.materials + m.totalMaterials,
        labour: acc.labour + m.totalLabour,
        overheads: acc.overheads + m.overheads,
        profit: acc.profit + m.realProfit
    }), { value: 0, materials: 0, labour: 0, overheads: 0, profit: 0 });
    
    const totalMargin = totals.value > 0 ? (totals.profit / totals.value * 100) : 0;
    
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;">
        <td style="padding: 12px;">TOTAL</td>
        <td style="padding: 12px; text-align: right;">£${totals.value.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #f97316;">£${totals.materials.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #8b5cf6;">£${totals.labour.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #ef4444;">£${totals.overheads.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: ${totals.profit >= 0 ? '#4ade80' : '#f5576c'};">£${totals.profit.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #4facfe;">${totalMargin.toFixed(1)}%</td>
    </tr></tbody></table>`;
    
    document.getElementById('monthlyOverheadsTable').innerHTML = html;
}

function renderProjectProfits() {
    const projects = getProjectProfits();
    const container = document.getElementById('projectProfitsTable');
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="color: #999;">No completed projects with cost data.</p>';
        return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Project #</th><th style="padding: 12px; text-align: left;">Name</th><th style="padding: 12px; text-align: right;">Value</th><th style="padding: 12px; text-align: right;">Cost</th><th style="padding: 12px; text-align: right;">Profit</th><th style="padding: 12px; text-align: right;">Margin %</th></tr></thead><tbody>';
    
    projects.forEach(p => {
        const marginColor = p.margin >= 20 ? '#4ade80' : p.margin >= 10 ? '#fee140' : '#f5576c';
        html += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 12px;">${p.project_number}</td><td style="padding: 12px;">${p.name}</td><td style="padding: 12px; text-align: right;">£${p.value.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right;">£${p.cost.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right; color: ${p.profit >= 0 ? '#4ade80' : '#f5576c'};">£${p.profit.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right; font-weight: bold; color: ${marginColor};">${p.margin.toFixed(1)}%</td></tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderRevenuePerClient() {
    const clients = getRevenuePerClient();
    const container = document.getElementById('clientsRevenueTable');
    
    if (clients.length === 0) {
        container.innerHTML = '<p style="color: #999;">No completed projects with client data.</p>';
        return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Client</th><th style="padding: 12px; text-align: center;">Projects</th><th style="padding: 12px; text-align: right;">Total Revenue</th></tr></thead><tbody>';
    
    clients.forEach(c => {
        html += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 12px;">${c.client_name}</td><td style="padding: 12px; text-align: center;">${c.projects.length}</td><td style="padding: 12px; text-align: right; font-weight: bold;">£${c.totalRevenue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr>`;
    });
    
    const grandTotal = clients.reduce((sum, c) => sum + c.totalRevenue, 0);
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;"><td colspan="2" style="padding: 12px;">TOTAL</td><td style="padding: 12px; text-align: right;">£${grandTotal.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr></tbody></table>`;
    
    container.innerHTML = html;
}

// ========================================
// TAB SWITCHING & MODALS
// ========================================

function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName + 'Tab').style.display = 'block';
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    renderActiveTab();
}

// Monthly settings modal - see monthly-overheads-modal.js

function openExportRangeModal() {
    document.getElementById('exportRangeModal').style.display = 'block';
}

function closeExportRangeModal() {
    document.getElementById('exportRangeModal').style.display = 'none';
}

async function exportProjectsByRange() {
    const fromDate = document.getElementById('exportFromDate').value;
    const toDate = document.getElementById('exportToDate').value;
    
    if (!fromDate || !toDate) {
        showToast('Please select both dates', 'warning');
        return;
    }
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    const projectsInRange = archivedProjectsData.filter(p => {
        if (!p.completed_date && !p.archived_date) return false;
        const date = new Date(p.completed_date || p.archived_date);
        return date >= from && date <= to && p.archive_reason === 'completed';
    });
    
    const totalValue = projectsInRange.reduce((sum, p) => 
        sum + (parseFloat(p.actual_value || p.contract_value) || 0), 0
    );
    
    let html = `<h3 style="color: white; margin-bottom: 15px;">Export Results</h3><p style="color: #999;">Period: ${formatDate(from)} - ${formatDate(to)}</p><p style="color: #999; margin-bottom: 15px;">Found ${projectsInRange.length} completed projects</p><table style="width: 100%; border-collapse: collapse; color: white; margin-bottom: 20px;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 10px; text-align: left;">Project #</th><th style="padding: 10px; text-align: left;">Name</th><th style="padding: 10px; text-align: right;">Value</th></tr></thead><tbody>`;
    
    projectsInRange.forEach(p => {
        const value = parseFloat(p.actual_value || p.contract_value) || 0;
        html += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 10px;">${p.project_number}</td><td style="padding: 10px;">${p.name}</td><td style="padding: 10px; text-align: right;">£${value.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr>`;
    });
    
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;"><td colspan="2" style="padding: 10px;">TOTAL</td><td style="padding: 10px; text-align: right;">£${totalValue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr></tbody></table><button class="modal-btn primary" onclick="downloadRangeCSV('${fromDate}', '${toDate}')">Download CSV</button>`;
    
    document.getElementById('exportResult').innerHTML = html;
    document.getElementById('exportResult').style.display = 'block';
}

function downloadRangeCSV(fromDate, toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    const projectsInRange = archivedProjectsData.filter(p => {
        if (!p.completed_date && !p.archived_date) return false;
        const date = new Date(p.completed_date || p.archived_date);
        return date >= from && date <= to && p.archive_reason === 'completed';
    });
    
    let csv = 'Project Number,Name,Value,Completed Date\n';
    projectsInRange.forEach(p => {
        const value = parseFloat(p.actual_value || p.contract_value) || 0;
        const date = p.completed_date || p.archived_date;
        csv += `${p.project_number},"${p.name}",${value},${date}\n`;
    });
    
    const totalValue = projectsInRange.reduce((sum, p) => 
        sum + (parseFloat(p.actual_value || p.contract_value) || 0), 0
    );
    csv += `,,${totalValue},TOTAL\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects_${fromDate}_to_${toDate}.csv`;
    a.click();
}

function formatDate(date) {
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

function populateYearFilter() {
    const select = document.getElementById('yearFilter');
    const years = new Set();
    
    archivedProjectsData.forEach(p => {
        if (p.completed_date || p.archived_date) {
            const year = new Date(p.completed_date || p.archived_date).getFullYear();
            years.add(year);
        }
    });
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        select.appendChild(option);
    });
}

function filterByYear() {
    const select = document.getElementById('yearFilter');
    const selectedYear = select.value;
    
    if (selectedYear === 'all') {
        currentYear = new Date().getFullYear();
    } else {
        currentYear = parseInt(selectedYear);
    }
    
    renderDashboard();
}

// Check if 1st day of month - remind about overheads
function checkMonthlyOverheadsReminder() {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Only on 1st day of month
    if (dayOfMonth !== 1) return;
    
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const storageKey = `overheads_confirmed_${currentMonth}`;
    
    // Check if already confirmed this month
    const confirmed = localStorage.getItem(storageKey);
    
    if (confirmed) return;
    
    // Show reminder
    setTimeout(() => {
        if (confirm('⚠️ MONTHLY OVERHEADS REMINDER\n\nIt\'s the 1st day of the month!\n\nPlease review and confirm monthly overhead costs.\n\nOpen Monthly Overheads Settings?')) {
            openMonthlySettingsModal();
        }
    }, 2000); // 2 sekundy po załadowaniu strony
}

// Mark overheads as confirmed (call this after Save Changes)
function markOverheadsConfirmed() {
    const month = document.getElementById('settingsMonth').value;
    if (month) {
        localStorage.setItem(`overheads_confirmed_${month}`, 'true');
    }
}

// ========================================
// FINANCE DETAILS - CRUD FUNCTIONS
// ========================================

let currentDepositProjectId = null;
let currentVariationProjectId = null;

// Open Add Deposit Modal
function openAddDeposit(projectId) {
    currentDepositProjectId = projectId;
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositInvoiceNumber').value = '';
    document.getElementById('depositPaid').checked = false;
    document.getElementById('depositDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('depositNotes').value = '';
    document.getElementById('addDepositModal').style.display = 'block';
}

function closeAddDepositModal() {
    document.getElementById('addDepositModal').style.display = 'none';
    currentDepositProjectId = null;
}

// Edit Contract Value (inline)
async function editContractValue(projectId, currentValue) {
    const newValue = prompt('Enter Contract Value (£):', currentValue || 0);
    
    if (newValue === null) return; // Cancelled
    
    const parsedValue = parseFloat(newValue);
    if (isNaN(parsedValue) || parsedValue < 0) {
        showToast('Please enter a valid positive number', 'warning');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('projects')
            .update({ contract_value: parsedValue })
            .eq('id', projectId);
        
        if (error) throw error;
        
        // Update local data
        const project = productionProjectsData.find(p => p.id === projectId);
        if (project) project.contract_value = parsedValue;
        
        showToast('Contract value updated', 'success');
        renderFinancesLive();
        
    } catch (err) {
        console.error('Error updating contract value:', err);
        showToast('Error saving: ' + err.message, 'error');
    }
}

async function saveDeposit() {
    if (!currentDepositProjectId) return;
    
    const amount = parseFloat(document.getElementById('depositAmount').value);
    const invoiceNumber = document.getElementById('depositInvoiceNumber').value.trim();
    const paid = document.getElementById('depositPaid').checked;
    const paidDate = document.getElementById('depositDate').value;
    const notes = document.getElementById('depositNotes').value.trim();
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'warning');
        return;
    }
    
    try {
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('tenant_id')
            .eq('id', (await supabaseClient.auth.getUser()).data.user.id)
            .single();
        
        const { error } = await supabaseClient
            .from('project_deposits')
            .insert({
                tenant_id: profile.tenant_id,
                project_id: currentDepositProjectId,
                amount: amount,
                invoice_number: invoiceNumber || null,
                paid: paid,
                paid_date: paid ? paidDate : null,
                notes: notes || null
            });
        
        if (error) throw error;
        
        showToast('Deposit added successfully', 'success');
        closeAddDepositModal();
        await loadAllAccountingData();
        renderFinancesLive();
        
    } catch (error) {
        console.error('Error saving deposit:', error);
        showToast('Error saving deposit', 'error');
    }
}

// Open Add Variation Modal
function openAddVariation(projectId) {
    currentVariationProjectId = projectId;
    document.getElementById('variationDescription').value = '';
    document.getElementById('variationAmount').value = '';
    document.getElementById('variationType').value = 'add';
    document.getElementById('variationDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('addVariationModal').style.display = 'block';
}

function closeAddVariationModal() {
    document.getElementById('addVariationModal').style.display = 'none';
    currentVariationProjectId = null;
}

async function saveVariation() {
    if (!currentVariationProjectId) return;
    
    const description = document.getElementById('variationDescription').value.trim();
    let amount = parseFloat(document.getElementById('variationAmount').value);
    const type = document.getElementById('variationType').value;
    const date = document.getElementById('variationDate').value;
    
    if (!description) {
        showToast('Please enter a description', 'warning');
        return;
    }
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'warning');
        return;
    }
    
    // Apply sign based on type
    if (type === 'subtract') {
        amount = -Math.abs(amount);
    } else {
        amount = Math.abs(amount);
    }
    
    try {
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('tenant_id')
            .eq('id', (await supabaseClient.auth.getUser()).data.user.id)
            .single();
        
        const { error } = await supabaseClient
            .from('project_variations')
            .insert({
                tenant_id: profile.tenant_id,
                project_id: currentVariationProjectId,
                description: description,
                amount: amount,
                date: date
            });
        
        if (error) throw error;
        
        showToast('Variation added successfully', 'success');
        closeAddVariationModal();
        await loadAllAccountingData();
        renderFinancesLive();
        
    } catch (error) {
        console.error('Error saving variation:', error);
        showToast('Error saving variation', 'error');
    }
}

// ========================================
// EDIT / DELETE FUNCTIONS
// ========================================

// Edit Variation
async function editVariation(variationId) {
    const variation = projectVariationsData.find(v => v.id === variationId);
    if (!variation) return;
    
    const newDescription = prompt('Description:', variation.description);
    if (newDescription === null) return;
    
    const currentAmount = Math.abs(parseFloat(variation.amount));
    const newAmountStr = prompt('Amount (£):', currentAmount);
    if (newAmountStr === null) return;
    
    const newAmount = parseFloat(newAmountStr);
    if (isNaN(newAmount)) {
        showToast('Invalid amount', 'warning');
        return;
    }
    
    const isAddition = confirm('Is this an ADDITION (+)?\n\nOK = Addition (+)\nCancel = Reduction (-)');
    const finalAmount = isAddition ? Math.abs(newAmount) : -Math.abs(newAmount);
    
    try {
        const { error } = await supabaseClient
            .from('project_variations')
            .update({ 
                description: newDescription.trim(),
                amount: finalAmount
            })
            .eq('id', variationId);
        
        if (error) throw error;
        
        showToast('Variation updated', 'success');
        await loadAllAccountingData();
        renderFinancesLive();
        
    } catch (err) {
        console.error('Error updating variation:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Delete Variation
async function deleteVariation(variationId) {
    if (!confirm('Delete this variation?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('project_variations')
            .delete()
            .eq('id', variationId);
        
        if (error) throw error;
        
        showToast('Variation deleted', 'success');
        await loadAllAccountingData();
        renderFinancesLive();
        
    } catch (err) {
        console.error('Error deleting variation:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Edit Deposit
async function editDeposit(depositId) {
    const deposit = projectDepositsData.find(d => d.id === depositId);
    if (!deposit) return;
    
    const newAmountStr = prompt('Amount (£):', deposit.amount);
    if (newAmountStr === null) return;
    
    const newAmount = parseFloat(newAmountStr);
    if (isNaN(newAmount) || newAmount <= 0) {
        showToast('Invalid amount', 'warning');
        return;
    }
    
    const newInvoice = prompt('Invoice Number:', deposit.invoice_number || '');
    if (newInvoice === null) return;
    
    const isPaid = confirm('Is this deposit PAID?\n\nOK = Paid\nCancel = Pending');
    
    try {
        const { error } = await supabaseClient
            .from('project_deposits')
            .update({ 
                amount: newAmount,
                invoice_number: newInvoice.trim() || null,
                paid: isPaid,
                paid_date: isPaid ? (deposit.paid_date || new Date().toISOString().split('T')[0]) : null
            })
            .eq('id', depositId);
        
        if (error) throw error;
        
        showToast('Deposit updated', 'success');
        await loadAllAccountingData();
        renderFinancesLive();
        
    } catch (err) {
        console.error('Error updating deposit:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Delete Deposit
async function deleteDeposit(depositId) {
    if (!confirm('Delete this deposit?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('project_deposits')
            .delete()
            .eq('id', depositId);
        
        if (error) throw error;
        
        showToast('Deposit deleted', 'success');
        await loadAllAccountingData();
        renderFinancesLive();
        
    } catch (err) {
        console.error('Error deleting deposit:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Save Finance Notes
async function saveFinanceNotes(projectId, notes) {
    try {
        const { error } = await supabaseClient
            .from('projects')
            .update({ finance_notes: notes })
            .eq('id', projectId);
        
        if (error) throw error;
        
        // Update local data
        const project = productionProjectsData.find(p => p.id === projectId);
        if (project) project.finance_notes = notes;
        
    } catch (error) {
        console.error('Error saving notes:', error);
        showToast('Error saving notes', 'error');
    }
}

// Open Finance Documents
function openFinanceDocs(projectId) {
    // For now, just expand the row to show docs section
    expandedProjectId = projectId;
    renderFinancesLive();
}

// Open specific finance folder (placeholder - integrate with project-files.js)
function openFinanceFolder(projectId, folder) {
    showToast(`Opening ${folder} folder...`, 'info');
    // TODO: Integrate with Supabase Storage
    // Path: projects/{projectId}/finances/{folder}/
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}
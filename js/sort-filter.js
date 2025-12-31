// ========== FILTER SYSTEM ==========

let currentFilter = null; // { type: 'timberGlazing'|'spray', workerId: 'uuid'|'all'|'unassigned' }
let originalProjects = null;

// Initialize workers lists in dropdowns
function initializeFilterDropdowns() {
    
    // Wait for teamMembers to be loaded
    const waitForTeamMembers = setInterval(() => {
        if (typeof teamMembers !== 'undefined' && teamMembers && teamMembers.length > 0) {
            clearInterval(waitForTeamMembers);
            populateWorkerDropdowns();
        }
    }, 100);
}

function populateWorkerDropdowns() {
    // Production workers list - production AND spray departments combined
    const productionList = document.getElementById('productionWorkersList');
    if (productionList) {
        productionList.innerHTML = '';

        const productionWorkers = teamMembers.filter(w => w.department === 'production');
        const sprayWorkers = teamMembers.filter(w => w.department === 'spray');

        // Add production workers (timber/glazing)
        productionWorkers.forEach(worker => {
            const button = document.createElement('button');
            button.onclick = () => setProductionFilter(worker.id);
            button.innerHTML = `<span class="worker-color-dot" style="background: ${worker.color_code || worker.color};"></span>🪵 ${worker.name}`;
            productionList.appendChild(button);
        });

        // Add spray workers
        sprayWorkers.forEach(worker => {
            const button = document.createElement('button');
            button.onclick = () => setProductionFilter(worker.id);
            button.innerHTML = `<span class="worker-color-dot" style="background: ${worker.color_code || worker.color};"></span>🎨 ${worker.name}`;
            productionList.appendChild(button);
        });

        // Add unassigned option
        const unassignedBtn = document.createElement('button');
        unassignedBtn.onclick = () => setProductionFilter('unassigned');
        unassignedBtn.innerHTML = '<span style="color: #999;">(Unassigned)</span>';
        productionList.appendChild(unassignedBtn);

    }

    // Timber workers list - ONLY production department
    const timberList = document.getElementById('timberWorkersList');
    if (timberList) {
        timberList.innerHTML = '';

        const productionWorkers = teamMembers.filter(w => w.department === 'production');

        productionWorkers.forEach(worker => {
            const button = document.createElement('button');
            button.onclick = () => setTimberFilter(worker.id);
            button.innerHTML = `<span class="worker-color-dot" style="background: ${worker.color_code || worker.color};"></span>${worker.name}`;
            timberList.appendChild(button);
        });

        // Add unassigned option
        const unassignedBtn = document.createElement('button');
        unassignedBtn.onclick = () => setTimberFilter('unassigned');
        unassignedBtn.innerHTML = '<span style="color: #999;">(Unassigned)</span>';
        timberList.appendChild(unassignedBtn);

    }

    // Spray workers list - ONLY spray department
    const sprayList = document.getElementById('sprayWorkersList');
    if (sprayList) {
        sprayList.innerHTML = '';

        const sprayWorkers = teamMembers.filter(w => w.department === 'spray');

        sprayWorkers.forEach(worker => {
            const button = document.createElement('button');
            button.onclick = () => setSprayFilter(worker.id);
            button.innerHTML = `<span class="worker-color-dot" style="background: ${worker.color_code || worker.color};"></span>${worker.name}`;
            sprayList.appendChild(button);
        });

        // Add unassigned option
        const unassignedBtn = document.createElement('button');
        unassignedBtn.onclick = () => setSprayFilter('unassigned');
        unassignedBtn.innerHTML = '<span style="color: #999;">(Unassigned)</span>';
        sprayList.appendChild(unassignedBtn);

    }
}

// Toggle dropdown visibility
function toggleFilterDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Close other dropdowns
    document.querySelectorAll('.filter-menu').forEach(menu => {
        if (menu.id !== dropdownId) {
            menu.style.display = 'none';
        }
    });
    
    // Toggle current dropdown
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown') && !e.target.closest('.toolbar-btn')) {
        document.querySelectorAll('.filter-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

// ========== FILTERING FUNCTIONS ==========

function setProductionFilter(workerId) {

    currentFilter = {
        type: 'production',
        workerId: workerId
    };

    // Close dropdown
    document.querySelectorAll('.filter-menu').forEach(menu => {
        menu.style.display = 'none';
    });

    applyFilter();
}

function setTimberFilter(workerId) {

    currentFilter = {
        type: 'timberGlazing',
        workerId: workerId
    };

    // Close dropdown
    document.querySelectorAll('.filter-menu').forEach(menu => {
        menu.style.display = 'none';
    });

    applyFilter();
}

function setSprayFilter(workerId) {

    currentFilter = {
        type: 'spray',
        workerId: workerId
    };

    // Close dropdown
    document.querySelectorAll('.filter-menu').forEach(menu => {
        menu.style.display = 'none';
    });

    applyFilter();
}

function clearFilters() {
    
    currentFilter = null;
    
    // Restore original projects if they were saved
    if (originalProjects) {
        projects.length = 0;
        projects.push(...originalProjects);
        originalProjects = null;
    }
    
    render();
}

function applyFilter() {
    if (!currentFilter) {
        render();
        return;
    }
    
    const { type, workerId } = currentFilter;
    
    
    // Save original projects if not already saved
    if (!originalProjects) {
        originalProjects = projects.map(p => ({
            ...p,
            phases: [...(p.phases || [])]
        }));
    }
    
    // Define phase keys based on filter type
    let phaseKeys = [];
    if (type === 'production') {
        phaseKeys = ['timber', 'glazing', 'spray'];
    } else if (type === 'timberGlazing') {
        phaseKeys = ['timber', 'glazing'];
    } else if (type === 'spray') {
        phaseKeys = ['spray'];
    }
    
    // Filter projects that have at least one of the target phases
    const filteredProjects = originalProjects.filter(project => {
        if (!project.phases) return false;
        
        // Check if project has any of the target phases with matching worker
        return phaseKeys.some(phaseKey => {
            const targetPhase = project.phases.find(p => p.key === phaseKey);
            if (!targetPhase) return false;
            
            // Check worker assignment
            if (workerId === 'all') {
                return true; // Show all projects with this phase
            } else if (workerId === 'unassigned') {
                return !targetPhase.assignedTo;
            } else {
                return targetPhase.assignedTo === workerId;
            }
        });
    });
    
    
    // Create filtered view with only target phases visible
    const viewProjects = filteredProjects.map(project => ({
        ...project,
        phases: project.phases.filter(p => phaseKeys.includes(p.key) && (workerId === 'all' || !p.assignedTo || p.assignedTo === workerId))
    }));
    
    // Replace projects array
    projects.length = 0;
    projects.push(...viewProjects);
    
    // Render
    render();
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFilterDropdowns);
} else {
    initializeFilterDropdowns();
}


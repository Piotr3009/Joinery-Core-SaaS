// ========== TEAM MANAGEMENT ==========
function openTeamModal() {
    updateTeamMembersList();
    openModal('teamModal');
}

function addTeamMember() {
    const name = document.getElementById('newMemberName').value.trim();
    const color = document.getElementById('newMemberColor').value;
    
    if (!name) {
        showToast('Please enter team member name', 'warning');
        return;
    }
    
    const id = 'member_' + Date.now();
    teamMembers.push({ id, name, color });
    
    saveDataQueued();
    updateTeamMembersList();
    
    document.getElementById('newMemberName').value = '';
}

function updateTeamMembersList() {
    const container = document.getElementById('teamMembersList');
    container.innerHTML = '';
    
    if (teamMembers.length === 0) {
        container.innerHTML = '<div style="color: #999; text-align: center; padding: 10px;">No team members added</div>';
        return;
    }
    
    teamMembers.forEach((member, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 5px; border-bottom: 1px solid #3e3e42;';
        div.innerHTML = `
            <div style="width: 30px; height: 20px; background: ${member.color_code || member.color}; border-radius: 2px;"></div>
            <span style="flex: 1;">${member.name}</span>
            <button class="action-btn delete" onclick="removeTeamMember(${index})">✕</button>
        `;
        container.appendChild(div);
    });
}

function removeTeamMember(index) {
    const member = teamMembers[index];
    if (confirm(`Remove ${member.name} from team?`)) {
        teamMembers.splice(index, 1);
        
        // Remove assignments from projects
        projects.forEach(project => {
            if (project.phases) {
                project.phases.forEach(phase => {
                    if (phase.assignedTo === member.id) {
                        delete phase.assignedTo;
                    }
                });
            }
        });
        
        saveDataQueued();
        updateTeamMembersList();
        render();
    }
}
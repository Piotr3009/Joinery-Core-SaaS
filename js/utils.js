// ========== UTILITIES ==========

// Uniwersalna funkcja renderująca - wybiera właściwy renderer
function renderUniversal() {
    if (window.location.pathname.includes('pipeline')) {
        if (typeof renderPipeline === 'function') {
            renderPipeline();
        }
    } else {
        if (typeof render === 'function') {
            render();
        }
    }
}

// Deduplikacja faz - usuwa duplikaty na podstawie id lub klucza+segmentu
function dedupeProjectPhases(phases) {
    if (!Array.isArray(phases)) return phases;
    const seen = new Set();
    const originalLength = phases.length;
    const result = phases.filter(p => {
        // Preferuj id, fallback na key+segmentNo
        const k = p.id || `${p.key}|${p.segmentNo || 1}`;
        if (seen.has(k)) {
            // 🔍 DIAGNOSTYKA: Loguj usunięte duplikaty
            console.warn(`⚠️ dedupe: removing duplicate phase key="${p.key}" segmentNo=${p.segmentNo || 1} dedupeKey="${k}"`);
            return false;
        }
        seen.add(k);
        return true;
    });
    
    // 🔍 DIAGNOSTYKA: Loguj jeśli coś zostało usunięte
    if (result.length !== originalLength) {
        console.warn(`⚠️ dedupeProjectPhases: removed ${originalLength - result.length} duplicates`);
        console.trace('dedupe stack trace:');
    }
    
    return result;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function shiftWeek(direction) {
    visibleStartDate.setDate(visibleStartDate.getDate() + (7 * direction));
    renderUniversal();
}

function zoomIn() {
    dayWidth = Math.min(72, dayWidth + 5);  // Max 72px (zmniejszone z 80)
    renderUniversal();
}

function zoomOut() {
    dayWidth = Math.max(18, dayWidth - 5);  // Min 18px (zmniejszone z 20)
    renderUniversal();
}

// Reset zoom to 100% (original size)
function zoomReset() {
    dayWidth = 36; // Original default width (zmniejszone z 40)
    renderUniversal();
}

// Calculate ALL calendar days between dates (BEZ pomijania niedziel)
function calculateWorkDays(startDate, endDate) {
    const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
}

// Check if date is Sunday
function isSunday(date) {
    return date.getDay() === 0;
}

// Get next day (BEZ pomijania niedziel)
function getNextWorkDay(date) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
}

// Add calendar days to date (BEZ pomijania niedziel)
function addWorkDays(startDate, days) {
    const result = new Date(startDate);
    result.setDate(result.getDate() + days);
    return result;
}

// Calculate calendar days (BEZ pomijania niedziel)
function calculateCalendarDaysForWorkDays(startDate, workDays) {
    return workDays; // Prosto zwracamy tę samą liczbę
}

// Na samym końcu utils.js
function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth()+1}`;
}
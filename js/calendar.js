// ========== CALENDAR UTILITIES - WORKING DAYS ==========
// Rozwiązanie problemu puchnienia faz przy pomijaniu niedziel

// 0 = niedziela (Date.getDay())
const WEEKENDS = new Set([0]); // możesz dodać 6 dla sobót

function isWeekend(d, weekends = WEEKENDS) {
    return weekends.has(d.getDay());
}

function startOfDay(d) {
    const x = new Date(d); 
    x.setHours(0, 0, 0, 0); 
    return x;
}

// Dodaje N dni roboczych (N >= 0), zwraca nową datę
function addWorkingDays(startDate, nWorkDays, weekends = WEEKENDS) {
    let d = startOfDay(startDate);
    let added = 0;
    while (added < nWorkDays) {
        d.setDate(d.getDate() + 1);
        if (!isWeekend(d, weekends)) added++;
    }
    return d;
}

// Różnica w dniach roboczych (inclusive start, inclusive end)
function workingDaysBetween(startDate, endDate, weekends = WEEKENDS) {
    let s = startOfDay(startDate);
    let e = startOfDay(endDate);
    if (e < s) return 0;
    let cnt = 0, d = new Date(s);
    while (d <= e) {
        if (!isWeekend(d, weekends)) cnt++;
        d.setDate(d.getDate() + 1);
    }
    return cnt;
}

// Wyprowadź datę końca na podstawie danych kanonicznych
function computeEnd(phase) {
    // workDays >= 1: 1 dzień pracy => end = start (jeśli start nie-niedziela)
    let start = startOfDay(new Date(phase.start));
    // jeśli start w niedzielę, snap do poniedziałku (bez zmiany workDays)
    while (isWeekend(start)) start.setDate(start.getDate() + 1);
    
    // Jeśli phase nie ma workDays, wylicz z obecnych dat
    if (!phase.workDays) {
        phase.workDays = workingDaysBetween(new Date(phase.start), new Date(phase.end));
    }
    
    return phase.workDays <= 1 ? start : addWorkingDays(start, phase.workDays - 1);
}

// Oblicz szerokość paska w pikselach (dni kalendarzowe * dayWidth)
function calculatePhaseWidth(phase) {
    const start = startOfDay(new Date(phase.start));
    const end = computeEnd(phase);
    const calendarDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return calendarDays * dayWidth;
}

// Oblicz pozycję paska (od początku timeline)
function calculatePhasePosition(phase) {
    const start = new Date(phase.start);
    const daysDiff = Math.round((start - visibleStartDate) / (1000 * 60 * 60 * 24));
    return daysDiff * dayWidth;
}
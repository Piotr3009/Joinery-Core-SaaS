// ========== STICKY COLUMNS FIX ==========
// Rozwiązanie problemu ze sticky columns przy scrollowaniu

let scrollTimeout;
let lastScrollLeft = 0;

function initStickyColumns() {
    const chartWrapper = document.querySelector('.chart-wrapper');
    if (!chartWrapper) return;
    
    // Obsługa scrollowania poziomego
    chartWrapper.addEventListener('scroll', function(e) {
        const scrollLeft = chartWrapper.scrollLeft;
        
        // Przesuń wszystkie lewe kolumny
        const projectCells = document.querySelectorAll('.project-cell');
        const projectHeader = document.querySelector('.project-header');
        
        // Nagłówek
        if (projectHeader) {
            projectHeader.style.transform = `translateX(${scrollLeft}px)`;
            projectHeader.style.position = 'relative';
            projectHeader.style.zIndex = '30';
        }
        
        // Komórki projektów
        projectCells.forEach(cell => {
            cell.style.transform = `translateX(${scrollLeft}px)`;
            cell.style.position = 'relative';
            cell.style.zIndex = '20';
            // Upewnij się że tło jest nieprzezroczyste
            cell.style.background = getComputedStyle(cell).background || '#2d2d30';
        });
        
        lastScrollLeft = scrollLeft;
    });
}

// Inicjalizuj po załadowaniu strony
document.addEventListener('DOMContentLoaded', initStickyColumns);

// Reinicjalizuj po każdym render()
const originalRender = window.render;
window.render = function() {
    originalRender.apply(this, arguments);
    setTimeout(initStickyColumns, 100);
};
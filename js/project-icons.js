// ========== PROJECT TYPE ICONS (SVG) ==========

/**
 * Returns SVG string for project type icon
 * @param {string} type - Project type key (sash, casement, kitchen, etc.)
 * @param {number} size - Icon size in pixels (default: 24)
 * @returns {string} SVG markup
 */
function getProjectTypeIcon(type, size = 24) {
    const icons = {
        sash: `
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <!-- Outer window box frame -->
                    <rect x="14" y="6" width="36" height="48" rx="2" stroke-width="2"/>
                    <!-- Window frame -->
                    <rect x="18" y="8" width="28" height="42" rx="2"/>
                    <!-- Horizontal divider (slider) -->
                    <line x1="18" y1="29" x2="46" y2="29"/>
                    <!-- Window sill -->
                    <rect x="14" y="50" width="36" height="4" rx="1" stroke-width="2"/>
                </g>
            </svg>
        `,
        
        casement: `
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <rect x="8" y="8" width="48" height="48" rx="4"/>
                    <line x1="32" y1="8" x2="32" y2="56"/>
                    <!-- Inner frames -->
                    <rect x="12" y="12" width="16" height="40" rx="1" stroke-width="1" opacity="0.5"/>
                    <rect x="36" y="12" width="16" height="40" rx="1" stroke-width="1" opacity="0.5"/>
                    <!-- Handle -->
                    <circle cx="24" cy="32" r="3" stroke-width="2"/>
                    <line x1="24" y1="32" x2="16" y2="32" stroke-width="2"/>
                    <!-- Opening arc -->
                    <path d="M 56 20 Q 60 32 56 44" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.6"/>
                    <!-- Window sill -->
                    <rect x="4" y="56" width="56" height="4" rx="1" stroke-width="2"/>
                </g>
            </svg>
        `,
        
        internalDoors: `
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M 16 6 L 48 6 L 48 58 L 16 58 Z"/>
                    <path d="M 48 6 L 56 14 L 56 50 L 48 58" fill="none"/>
                    <!-- 4 horizontal door panels -->
                    <rect x="20" y="10" width="24" height="10" rx="1.5" stroke-width="1.5" opacity="0.6"/>
                    <rect x="20" y="23" width="24" height="10" rx="1.5" stroke-width="1.5" opacity="0.6"/>
                    <rect x="20" y="36" width="24" height="10" rx="1.5" stroke-width="1.5" opacity="0.6"/>
                    <rect x="20" y="49" width="24" height="7" rx="1.5" stroke-width="1.5" opacity="0.6"/>
                    <!-- Handle -->
                    <circle cx="42" cy="32" r="2.5" stroke-width="2"/>
                    <!-- Hinges -->
                    <line x1="48" y1="14" x2="52" y2="18" stroke-width="1.5" opacity="0.6"/>
                    <line x1="48" y1="50" x2="52" y2="46" stroke-width="1.5" opacity="0.6"/>
                </g>
            </svg>
        `,
        
        wardrobe: `
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <rect x="8" y="6" width="48" height="52" rx="3"/>
                    <line x1="32" y1="6" x2="32" y2="58"/>
                    <!-- Handles -->
                    <rect x="24" y="28" width="3" height="8" rx="1.5" stroke-width="1.5"/>
                    <rect x="37" y="28" width="3" height="8" rx="1.5" stroke-width="1.5"/>
                </g>
            </svg>
        `,
        
        kitchen: `
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <!-- Pan/pot on hob -->
                    <ellipse cx="32" cy="16" rx="14" ry="5" stroke-width="2.5"/>
                    <line x1="46" y1="16" x2="52" y2="12"/>
                    <!-- Worktop -->
                    <line x1="12" y1="24" x2="52" y2="24" stroke-width="3"/>
                    <!-- Left cabinet -->
                    <rect x="12" y="28" width="18" height="26" rx="2" stroke-width="2.5"/>
                    <rect x="15" y="32" width="12" height="18" rx="1" stroke-width="1.5" opacity="0.6"/>
                    <circle cx="26" cy="41" r="1.5" stroke-width="1.5"/>
                    <!-- Right cabinet -->
                    <rect x="34" y="28" width="18" height="26" rx="2" stroke-width="2.5"/>
                    <line x1="34" y1="36" x2="52" y2="36" stroke-width="1.5"/>
                    <line x1="34" y1="43" x2="52" y2="43" stroke-width="1.5"/>
                    <circle cx="46" cy="32" r="1" stroke-width="1.5"/>
                    <circle cx="46" cy="39.5" r="1" stroke-width="1.5"/>
                    <circle cx="46" cy="48" r="1" stroke-width="1.5"/>
                </g>
            </svg>
        `,
        
        externalSpray: `
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <!-- Paint cup -->
                    <ellipse cx="24" cy="18" rx="6" ry="4"/>
                    <line x1="24" y1="14" x2="24" y2="24"/>
                    <!-- Gun body -->
                    <rect x="20" y="24" width="12" height="6" rx="1" stroke-width="2.5"/>
                    <!-- Nozzle -->
                    <line x1="32" y1="27" x2="38" y2="27" stroke-width="3"/>
                    <!-- Handle -->
                    <path d="M 24 30 L 24 38 L 20 42 L 20 38 Z" stroke-width="2.5"/>
                    <!-- Trigger -->
                    <path d="M 26 30 L 26 34 L 24 36"/>
                    <!-- Spray mist -->
                    <line x1="40" y1="20" x2="44" y2="18" opacity="0.7"/>
                    <line x1="42" y1="24" x2="48" y2="22" opacity="0.7"/>
                    <line x1="40" y1="28" x2="46" y2="28" opacity="0.7"/>
                    <line x1="42" y1="32" x2="48" y2="34" opacity="0.7"/>
                    <line x1="44" y1="26" x2="50" y2="24" stroke-width="1.5" opacity="0.6"/>
                    <line x1="46" y1="30" x2="52" y2="30" stroke-width="1.5" opacity="0.6"/>
                    <line x1="44" y1="34" x2="50" y2="36" stroke-width="1.5" opacity="0.6"/>
                    <line x1="48" y1="20" x2="54" y2="18" stroke-width="1.5" opacity="0.5"/>
                    <line x1="50" y1="28" x2="56" y2="28" stroke-width="1.5" opacity="0.5"/>
                </g>
            </svg>
        `,
        
        partition: `
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <!-- Outer frame -->
                    <rect x="8" y="10" width="48" height="44" rx="2" stroke-width="2.5"/>
                    <!-- Vertical frames -->
                    <line x1="22" y1="10" x2="22" y2="54" stroke-width="2.5"/>
                    <line x1="42" y1="10" x2="42" y2="54" stroke-width="2.5"/>
                    <!-- Door -->
                    <rect x="10" y="20" width="10" height="28" rx="1"/>
                    <circle cx="18" cy="34" r="1.5" stroke-width="1.5"/>
                    <!-- Glass panels -->
                    <rect x="24" y="14" width="16" height="36" rx="1" stroke-width="1" opacity="0.4"/>
                    <rect x="44" y="14" width="10" height="36" rx="1" stroke-width="1" opacity="0.4"/>
                </g>
            </svg>
        `,
        
        other: `
            <svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <!-- Roof -->
                    <path d="M 12 32 L 32 12 L 52 32" stroke-width="2.5" fill="none"/>
                    <!-- Roof ridge -->
                    <line x1="32" y1="12" x2="32" y2="18" stroke-width="1.5" opacity="0.6"/>
                    <!-- House body -->
                    <rect x="18" y="32" width="28" height="24" rx="3" stroke-width="2.5"/>
                    <!-- Door -->
                    <rect x="28" y="40" width="8" height="16" rx="2"/>
                    <!-- Door handle -->
                    <circle cx="34" cy="48" r="1" stroke-width="1.5"/>
                    <!-- Window -->
                    <rect x="20" y="36" width="6" height="6" rx="1" stroke-width="1.5" opacity="0.6"/>
                    <line x1="23" y1="36" x2="23" y2="42" stroke-width="1" opacity="0.5"/>
                </g>
            </svg>
        `
    };
    
    return icons[type] || icons.other;
}

/**
 * Returns color for project type
 * @param {string} type - Project type key
 * @returns {string} Hex color code
 */
function getProjectTypeColor(type) {
    const colors = {
        sash: '#3b82f6',           // Blue
        casement: '#06b6d4',       // Cyan
        internalDoors: '#10b981',  // Green
        wardrobe: '#8b5cf6',       // Purple
        kitchen: '#f97316',        // Orange
        externalSpray: '#8b5cf6',  // Purple
        partition: '#8b4513',      // Brown
        other: '#6b7280'           // Gray
    };
    
    return colors[type] || colors.other;
}

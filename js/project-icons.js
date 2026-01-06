// ========== PROJECT TYPE ICONS (SVG) - GOLD THEME ==========

// Counter for unique gradient IDs
let iconIdCounter = 0;

/**
 * Returns SVG string for project type icon
 * @param {string} type - Project type key (sash, casement, kitchen, etc.)
 * @param {number} size - Icon size in pixels (default: 24)
 * @returns {string} SVG markup
 */
function getProjectTypeIcon(type, size = 24) {
    const uid = ++iconIdCounter; // Unique ID for each icon instance
    
    const icons = {
        sash: `
            <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="gs${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4AF37"/><stop offset="50%" stop-color="#FBF5B7"/><stop offset="100%" stop-color="#AA771C"/></linearGradient></defs>
                <g transform="translate(15, 10)" stroke="url(#gs${uid})" fill="none">
                    <rect x="0" y="0" width="70" height="80" stroke-width="2"/>
                    <rect x="8" y="6" width="54" height="35" stroke-width="2"/>
                    <path d="M8 23 H62 M35 6 V41" stroke-width="1" opacity="0.5"/>
                    <rect x="4" y="44" width="62" height="32" stroke-width="3"/>
                    <path d="M4 60 H66 M35 44 V76" stroke-width="1.5"/>
                    <rect x="30" y="70" width="10" height="3" fill="url(#gs${uid})" rx="1"/>
                </g>
            </svg>
        `,
        
        casement: `
            <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="gc${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4AF37"/><stop offset="50%" stop-color="#FBF5B7"/><stop offset="100%" stop-color="#AA771C"/></linearGradient></defs>
                <g transform="translate(10, 10)" stroke="url(#gc${uid})" fill="none">
                    <rect x="0" y="0" width="55" height="80" stroke-width="1.5" opacity="0.4"/>
                    <path d="M30 5 L80 15 L80 75 L30 85 Z" stroke-width="2.5"/>
                    <path d="M38 14 L72 22 L72 68 L38 76 Z" stroke-width="1" opacity="0.5"/>
                    <rect x="70" y="42" width="3" height="14" fill="url(#gc${uid})" rx="1"/>
                </g>
            </svg>
        `,
        
        internalDoors: `
            <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="gd${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4AF37"/><stop offset="50%" stop-color="#FBF5B7"/><stop offset="100%" stop-color="#AA771C"/></linearGradient></defs>
                <g transform="translate(15, 5)" stroke="url(#gd${uid})" fill="none">
                    <path d="M0 90 V0 H70 V90" stroke-width="2.5" fill="url(#gd${uid})" opacity="0.2"/>
                    <path d="M10 10 L65 20 L65 85 L10 80 Z" stroke-width="2.5"/>
                    <path d="M18 20 L55 28 L55 42 L18 36 Z" stroke-width="1" opacity="0.5"/>
                    <path d="M18 50 L55 58 L55 72 L18 64 Z" stroke-width="1" opacity="0.5"/>
                    <circle cx="52" cy="52" r="3" fill="url(#gd${uid})"/>
                    <rect x="52" y="50" width="10" height="3" fill="url(#gd${uid})" rx="1"/>
                </g>
            </svg>
        `,
        
        wardrobe: `
            <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="gw${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4AF37"/><stop offset="50%" stop-color="#FBF5B7"/><stop offset="100%" stop-color="#AA771C"/></linearGradient></defs>
                <g transform="translate(20, 5)" stroke="url(#gw${uid})" fill="none">
                    <rect x="0" y="0" width="60" height="90" stroke-width="2.5"/>
                    <line x1="30" y1="0" x2="30" y2="90" stroke-width="1.5"/>
                    <rect x="24" y="35" width="3" height="20" rx="1" fill="url(#gw${uid})"/>
                    <rect x="33" y="35" width="3" height="20" rx="1" fill="url(#gw${uid})"/>
                </g>
            </svg>
        `,
        
        kitchen: `
            <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="gk${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4AF37"/><stop offset="50%" stop-color="#FBF5B7"/><stop offset="100%" stop-color="#AA771C"/></linearGradient></defs>
                <g transform="translate(5, 10)" stroke="url(#gk${uid})" fill="none">
                    <rect x="0" y="6" width="22" height="64" stroke-width="2"/>
                    <path d="M22 6 L29 1 L29 65 L22 70" stroke-width="1.5"/>
                    <rect x="3" y="10" width="16" height="18" stroke-width="0.8" opacity="0.5"/>
                    <rect x="3" y="32" width="16" height="34" stroke-width="0.8" opacity="0.5"/>
                    <circle cx="17" cy="19" r="2" fill="url(#gk${uid})"/>
                    <circle cx="17" cy="49" r="2" fill="url(#gk${uid})"/>
                    <path d="M24 38 L90 38 L97 33 L31 33 Z" stroke-width="2" fill="url(#gk${uid})" opacity="0.4"/>
                    <rect x="26" y="40" width="22" height="32" stroke-width="2"/>
                    <path d="M48 40 L55 35 L55 67 L48 72" stroke-width="1.5"/>
                    <line x1="37" y1="40" x2="37" y2="72" stroke-width="1"/>
                    <circle cx="33" cy="56" r="2" fill="url(#gk${uid})"/>
                    <circle cx="41" cy="56" r="2" fill="url(#gk${uid})"/>
                    <rect x="50" y="40" width="22" height="32" stroke-width="2"/>
                    <path d="M72 40 L79 35 L79 67 L72 72" stroke-width="1.5"/>
                    <line x1="50" y1="50" x2="72" y2="50" stroke-width="1"/>
                    <line x1="50" y1="60" x2="72" y2="60" stroke-width="1"/>
                    <line x1="56" y1="44" x2="66" y2="44" stroke-width="2"/>
                    <line x1="56" y1="54" x2="66" y2="54" stroke-width="2"/>
                    <line x1="56" y1="65" x2="66" y2="65" stroke-width="2"/>
                </g>
            </svg>
        `,
        
        externalSpray: `
            <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="gx${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4AF37"/><stop offset="50%" stop-color="#FBF5B7"/><stop offset="100%" stop-color="#AA771C"/></linearGradient></defs>
                <g transform="translate(15, 15)" stroke="url(#gx${uid})" fill="none">
                    <path d="M0 40 L15 40 L20 25 L45 25 Q55 25 55 38 L55 50 L20 50 L15 70 L0 70 Z" stroke-width="2" fill="url(#gx${uid})" opacity="0.3"/>
                    <path d="M22 25 L12 0 L42 0 L32 25" stroke-width="2"/>
                    <rect x="55" y="32" width="12" height="12" rx="2" fill="url(#gx${uid})"/>
                    <circle cx="8" cy="60" r="8" stroke-width="2"/>
                </g>
            </svg>
        `,
        
        partition: `
            <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="gp${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4AF37"/><stop offset="50%" stop-color="#FBF5B7"/><stop offset="100%" stop-color="#AA771C"/></linearGradient></defs>
                <g transform="translate(10, 15)" stroke="url(#gp${uid})" fill="none">
                    <path d="M5 15 L45 5 L45 65 L5 75 Z" stroke-width="1.5"/>
                    <path d="M25 10 L65 0 L65 60 L25 70 Z" stroke-width="2.5"/>
                    <path d="M45 5 L85 -5 L85 55 L45 65 Z" stroke-width="1.5"/>
                    <rect x="58" y="25" width="4" height="8" fill="url(#gp${uid})"/>
                </g>
            </svg>
        `,
        
        other: `
            <svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="go${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D4AF37"/><stop offset="50%" stop-color="#FBF5B7"/><stop offset="100%" stop-color="#AA771C"/></linearGradient></defs>
                <g transform="translate(15, 15)" stroke="url(#go${uid})" fill="none">
                    <path d="M5 40 L35 10 L65 40" stroke-width="2.5"/>
                    <rect x="12" y="40" width="46" height="35" stroke-width="2.5"/>
                    <rect x="28" y="50" width="14" height="25" stroke-width="2" fill="url(#go${uid})" opacity="0.3"/>
                    <circle cx="38" cy="62" r="2" fill="url(#go${uid})"/>
                    <rect x="16" y="46" width="10" height="10" stroke-width="1.5"/>
                    <line x1="21" y1="46" x2="21" y2="56" stroke-width="1"/>
                    <line x1="16" y1="51" x2="26" y2="51" stroke-width="1"/>
                </g>
            </svg>
        `
    };
    
    return icons[type] || icons.other;
}

/**
 * Returns color for project type - ALL GOLD NOW
 * @param {string} type - Project type key
 * @returns {string} Hex color code
 */
function getProjectTypeColor(type) {
    // All types now use gold color
    return '#D4AF37';
}
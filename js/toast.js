// JC Toast Notification System
// Usage: showToast('Message', 'success') or showToast('Error!', 'error')

function showToast(message, type = 'info', duration = 4000) {
    // Create container if not exists
    let container = document.getElementById('jc-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'jc-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    // JC Logo SVG (small version)
    const jcLogo = `<svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="toastBg${Date.now()}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#2a2a2a"/>
                <stop offset="100%" style="stop-color:#1a1a1a"/>
            </linearGradient>
            <linearGradient id="toastText${Date.now()}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#5dd879"/>
                <stop offset="50%" style="stop-color:#4caf50"/>
                <stop offset="100%" style="stop-color:#3d8b40"/>
            </linearGradient>
        </defs>
        <rect width="64" height="64" rx="12" fill="url(#toastBg${Date.now()})"/>
        <text x="32" y="46" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="url(#toastText${Date.now()})" text-anchor="middle" letter-spacing="-2">JC</text>
    </svg>`;

    // Colors based on type (matching system colors)
    const colors = {
        success: { border: '#10b981', icon: '✓' },
        error: { border: '#f97316', icon: '✕' },
        warning: { border: '#f59e0b', icon: '!' },
        info: { border: '#3b82f6', icon: 'i' }
    };
    
    const color = colors[type] || colors.info;

    // Create toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #27272a;
        border: 1px solid #3f3f46;
        border-left: 4px solid ${color.border};
        color: #e4e4e7;
        padding: 14px 18px;
        border-radius: 10px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 320px;
        max-width: 450px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        animation: jcToastIn 0.3s ease;
    `;
    
    toast.innerHTML = `
        <div style="flex-shrink: 0;">${jcLogo}</div>
        <div style="flex: 1; line-height: 1.5;">${message}</div>
        <div style="
            width: 24px;
            height: 24px;
            background: ${color.border};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 13px;
            font-weight: bold;
            flex-shrink: 0;
        ">${color.icon}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        toast.style.animation = 'jcToastOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Add CSS animation (only once)
if (!document.getElementById('jc-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'jc-toast-styles';
    style.textContent = `
        @keyframes jcToastIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes jcToastOut {
            from { transform: translateY(0); opacity: 1; }
            to { transform: translateY(-20px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
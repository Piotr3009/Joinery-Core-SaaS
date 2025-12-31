// ========== PDF BRANDING HELPER ==========
// Dodaje logo firmy do PDF-ów

// Cache dla logo
let cachedLogoData = null;
let cachedCompanyName = null;

/**
 * Pobiera dane brandingu (logo + nazwa firmy)
 * @returns {Promise<{logoBase64: string|null, companyName: string}>}
 */
async function getPdfBranding() {
    // Użyj cache jeśli dostępne
    if (cachedLogoData !== null || cachedCompanyName !== null) {
        return {
            logoBase64: cachedLogoData,
            companyName: cachedCompanyName || 'Joinery Core'
        };
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('company_settings')
            .select('logo_url, company_name')
            .limit(1)
            .single();
        
        if (error || !data) {
            cachedCompanyName = 'Joinery Core';
            return { logoBase64: null, companyName: cachedCompanyName };
        }
        
        cachedCompanyName = data.company_name || 'Joinery Core';
        
        // Konwertuj logo URL na base64
        if (data.logo_url) {
            try {
                cachedLogoData = await imageUrlToBase64(data.logo_url);
            } catch (e) {
                console.warn('Could not load logo:', e);
                cachedLogoData = null;
            }
        }
        
        return {
            logoBase64: cachedLogoData,
            companyName: cachedCompanyName
        };
        
    } catch (error) {
        console.error('Error fetching branding:', error);
        return { logoBase64: null, companyName: 'Joinery Core' };
    }
}

/**
 * Konwertuje URL obrazka na base64
 * @param {string} url 
 * @returns {Promise<string>}
 */
async function imageUrlToBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            try {
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            } catch (e) {
                reject(e);
            }
        };
        
        img.onerror = function() {
            reject(new Error('Failed to load image'));
        };
        
        img.src = url;
    });
}

/**
 * Dodaje nagłówek z logo i nazwą firmy do PDF
 * @param {jsPDF} doc - instancja jsPDF
 * @param {object} options - opcje
 * @param {number} options.logoSize - rozmiar logo (domyślnie 15)
 * @param {number} options.startY - pozycja Y startu (domyślnie 10)
 * @param {boolean} options.showDate - czy pokazać datę (domyślnie true)
 * @returns {Promise<number>} - pozycja Y po nagłówku
 */
async function addPdfHeader(doc, options = {}) {
    const {
        logoSize = 15,
        startY = 10,
        showDate = true
    } = options;
    
    const branding = await getPdfBranding();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = startY;
    
    // Logo po lewej stronie
    if (branding.logoBase64) {
        try {
            doc.addImage(branding.logoBase64, 'PNG', 10, currentY, logoSize, logoSize);
        } catch (e) {
            console.warn('Could not add logo to PDF:', e);
        }
    }
    
    // Nazwa firmy
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const nameX = branding.logoBase64 ? 10 + logoSize + 5 : 10;
    doc.text(branding.companyName, nameX, currentY + 10);
    
    // Data po prawej stronie
    if (showDate) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('en-GB');
        doc.text(dateStr, pageWidth - 10, currentY + 5, { align: 'right' });
    }
    
    // Linia pod nagłówkiem
    currentY = startY + logoSize + 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(10, currentY, pageWidth - 10, currentY);
    
    return currentY + 5; // Zwróć pozycję Y po nagłówku
}

/**
 * Dodaje stopkę z numerem strony
 * @param {jsPDF} doc 
 * @param {number} pageNumber 
 * @param {number} totalPages 
 */
function addPdfFooter(doc, pageNumber, totalPages) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    
    // Numer strony
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Reset koloru
    doc.setTextColor(0, 0, 0);
}

/**
 * Czyści cache brandingu (wywołaj po zmianie logo)
 */
function clearBrandingCache() {
    cachedLogoData = null;
    cachedCompanyName = null;
}

// Eksportuj dla użycia globalnego
window.getPdfBranding = getPdfBranding;
window.addPdfHeader = addPdfHeader;
window.addPdfFooter = addPdfFooter;
window.clearBrandingCache = clearBrandingCache;

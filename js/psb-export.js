// ============================================
// PRODUCTION SHEET BUILDER - PDF EXPORT MODULE
// ============================================
// Depends on: production-sheet-builder.js, psb-preview.js (must be loaded first)
// Uses globals: projectData, showToast, showLoading, hideLoading
// External libs: jsPDF, html2canvas

// ========== PDF GENERATION ==========

// Export state - prevents multiple exports
let isExporting = false;
let exportJobId = 0;

// Cache
const imageBase64Cache = new Map();
const imageInflightMap = new Map();

function getStableUrlKey(url) {
    if (!url || url.startsWith('data:')) return url;
    try {
        const urlObj = new URL(url);
        urlObj.searchParams.delete('token');
        urlObj.searchParams.delete('t');
        urlObj.searchParams.delete('sig');
        return urlObj.origin + urlObj.pathname;
    } catch { return url; }
}

async function getImageAsBase64(url) {
    if (!url || url.startsWith('data:')) return url;
    const cacheKey = getStableUrlKey(url);
    if (imageBase64Cache.has(cacheKey)) return imageBase64Cache.get(cacheKey);
    if (imageInflightMap.has(cacheKey)) return imageInflightMap.get(cacheKey);
    
    const fetchPromise = (async () => {
        try {
            const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' });
            if (!response.ok) return url;
            const blob = await response.blob();
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            imageBase64Cache.set(cacheKey, base64);
            return base64;
        } catch { return url; }
        finally { imageInflightMap.delete(cacheKey); }
    })();
    
    imageInflightMap.set(cacheKey, fetchPromise);
    return fetchPromise;
}

async function processWithLimit(items, fn, limit = 4) {
    const results = [];
    const executing = [];
    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        if (limit <= items.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= limit) await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

async function precachePageImages(page) {
    const images = page.querySelectorAll('img');
    const urls = [];
    for (const img of images) {
        if (img.src && !img.src.startsWith('data:')) {
            const cacheKey = getStableUrlKey(img.src);
            if (!imageBase64Cache.has(cacheKey)) urls.push(img.src);
        }
    }
    await processWithLimit(urls, getImageAsBase64, 4);
}

async function waitForImages(element) {
    const images = element.querySelectorAll('img');
    const promises = [];
    for (const img of images) {
        if (!img.complete || img.naturalWidth === 0) {
            promises.push(new Promise(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(() => resolve(), 3000);
            }));
        }
    }
    if (promises.length > 0) await Promise.all(promises);
    await new Promise(r => setTimeout(r, 50));
}


async function clonePageWithBase64Images(page) {
    const clone = page.cloneNode(true);
    const images = [...clone.querySelectorAll('img')];
    
    // Set crossOrigin for CORS compliance
    images.forEach(img => {
        img.crossOrigin = 'anonymous';
    });
    
    // 1) Collect URLs that need to be converted to base64
    const urls = images
        .map(img => img.src)
        .filter(src => src && !src.startsWith('data:'));
    
    // 2) Force download to cache (parallel with limit)
    await processWithLimit(urls, getImageAsBase64, 4);
    
    // 3) Replace src in clone with base64 (from cache)
    for (const img of images) {
        if (!img.src || img.src.startsWith('data:')) continue;
        const key = getStableUrlKey(img.src);
        const base64 = imageBase64Cache.get(key);
        if (base64) img.src = base64;
    }
    
    // 4) Wait for decode (no timeout - base64 decodes instantly)
    await Promise.allSettled(images.map(img => img.decode ? img.decode() : Promise.resolve()));
    
    return clone;
}

// Check if export was cancelled
function assertExportJob(jobId) {
    if (jobId !== exportJobId) {
        throw new Error('Export cancelled - newer export started');
    }
}

async function generatePDF(progressCallback, jobId) {
    const pages = document.querySelectorAll('.ps-page');
    if (pages.length === 0) throw new Error('No pages to export');
    
    const totalPages = pages.length;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a3');
    const pdfWidth = 420, pdfHeight = 297;
    
    for (let i = 0; i < pages.length; i++) {
        assertExportJob(jobId);
        
        const page = pages[i];
        if (progressCallback) progressCallback(`Page ${i + 1}/${totalPages}: caching...`, i, totalPages);
        await new Promise(r => setTimeout(r, 0));
        
        await precachePageImages(page);
        assertExportJob(jobId);
        
        if (progressCallback) progressCallback(`Page ${i + 1}/${totalPages}: rendering...`, i, totalPages);
        await new Promise(r => setTimeout(r, 0));
        
        // Clone page with base64 images (NO waitForImages - decode already done in clone)
        const clonedPage = await clonePageWithBase64Images(page);
        clonedPage.style.position = 'absolute';
        clonedPage.style.left = '-9999px';
        clonedPage.style.top = '0';
        clonedPage.style.transform = 'none';
        clonedPage.style.marginBottom = '0';
        document.body.appendChild(clonedPage);
        
        try {
            assertExportJob(jobId);
            
            const canvas = await html2canvas(clonedPage, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff',
                logging: false
            });
            
            assertExportJob(jobId);
            
            const canvasWidth = canvas.width, canvasHeight = canvas.height;
            if (!canvasWidth || !canvasHeight || canvasWidth <= 0 || canvasHeight <= 0) continue;
            
            if (i > 0) pdf.addPage();
            
            const canvasRatio = canvasWidth / canvasHeight;
            const pdfRatio = pdfWidth / pdfHeight;
            let imgWidth, imgHeight, offsetX = 0, offsetY = 0;
            
            if (canvasRatio > pdfRatio) {
                imgWidth = pdfWidth;
                imgHeight = pdfWidth / canvasRatio;
                offsetY = (pdfHeight - imgHeight) / 2;
            } else {
                imgHeight = pdfHeight;
                imgWidth = pdfHeight * canvasRatio;
                offsetX = (pdfWidth - imgWidth) / 2;
            }
            
            // Quality 0.82 instead of 0.95 (faster, smaller file, minimal visual diff)
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.82), 'JPEG', offsetX, offsetY, imgWidth, imgHeight);
        } finally {
            document.body.removeChild(clonedPage);
        }
    }
    
    return pdf;
}

async function downloadPDF() {
    // Prevent multiple exports
    if (isExporting) {
        showToast('Export already in progress...', 'warning');
        return;
    }
    
    isExporting = true;
    const myJobId = ++exportJobId;
    
    // Disable button
    const btn = document.querySelector('[onclick*="downloadPDF"]');
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
    }
    
    const totalPages = document.querySelectorAll('.ps-page').length;
    const updateProgress = (message, current, total) => {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        showToast(`${message} (${percent}%)`, 'info');
    };
    
    updateProgress('Starting...', 0, totalPages);
    showLoading();
    
    try {
        const pdf = await generatePDF(updateProgress, myJobId);
        
        // Final check before save
        assertExportJob(myJobId);
        
        const projectNumber = projectData.project?.project_number || 'PS';
        const cleanNumber = projectNumber.replace(/\//g, '-');
        pdf.save(`Production-Sheet-${cleanNumber}.pdf`);
        showToast('PDF downloaded!', 'success');
    } catch (err) {
        if (err.message.includes('cancelled')) {
            showToast('Export cancelled', 'info');
        } else {
            console.error('PDF generation error:', err);
            showToast('Error generating PDF: ' + err.message, 'error');
        }
    } finally {
        isExporting = false;
        hideLoading();
        
        // Re-enable button
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        }
    }
}
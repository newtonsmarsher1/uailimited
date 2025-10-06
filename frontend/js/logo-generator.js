// UAI Logo Generator - Creates PNG logo data URLs
function generateUAILogo(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Scale factor for different sizes
    const scale = size / 512;
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#2979ff');
    gradient.addColorStop(1, '#ad7ce6');
    
    // Draw background circle
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size/2, size/2, 240 * scale, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw white border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8 * scale;
    ctx.stroke();
    
    // Draw UAI text
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2 * scale;
    ctx.font = `bold ${120 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('UAI', size/2, size/2 + 24 * scale);
    ctx.fillText('UAI', size/2, size/2 + 24 * scale);
    
    // Draw decorative circles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(size/2, 180 * scale, 20 * scale, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(size/2, size - 132 * scale, 15 * scale, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(180 * scale, size/2, 18 * scale, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(size - 180 * scale, size/2, 18 * scale, 0, 2 * Math.PI);
    ctx.fill();
    
    return canvas.toDataURL('image/png');
}

// Generate all required logo sizes
const logoSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const logoDataURLs = {};

logoSizes.forEach(size => {
    logoDataURLs[size] = generateUAILogo(size);
});

// Export for use in other files
window.UAILogoGenerator = {
    generate: generateUAILogo,
    getLogo: (size) => logoDataURLs[size] || generateUAILogo(size),
    getAllLogos: () => logoDataURLs
};


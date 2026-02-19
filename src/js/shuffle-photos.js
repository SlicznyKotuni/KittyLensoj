/**
 * Shuffle images on the random photos page
 */

document.addEventListener('DOMContentLoaded', function() {
    const shuffleBtn = document.getElementById('shuffle-btn');
    const galleryGrid = document.getElementById('gallery-grid');
    
    if (!shuffleBtn || !galleryGrid) return;
    
    shuffleBtn.addEventListener('click', function() {
        // Add animation class
        shuffleBtn.style.animation = 'none';
        setTimeout(() => {
            shuffleBtn.style.animation = 'spin 0.6s ease-in-out';
        }, 10);
        
        // Get all gallery items
        const items = Array.from(galleryGrid.querySelectorAll('.gallery-item'));
        
        // Shuffle using Fisher-Yates algorithm
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            // Swap
            galleryGrid.insertBefore(items[j], items[i]);
            [items[i], items[j]] = [items[j], items[i]];
        }
    });
});

/**
 * Shuffle images on the random photos page - select 50 NEW random images each time
 */

document.addEventListener('DOMContentLoaded', function() {
    const shuffleBtn = document.getElementById('shuffle-btn');
    const galleryGrid = document.getElementById('gallery-grid');
    const imgDataElement = document.getElementById('all-images-data');
    
    if (!shuffleBtn || !galleryGrid || !imgDataElement) return;
    
    // Load all images data
    let allImages = [];
    try {
        allImages = JSON.parse(imgDataElement.textContent);
    } catch (e) {
        console.error('Failed to parse images data', e);
        return;
    }
    
    // Function to select N random items from array
    function getRandomItems(array, count) {
        const shuffled = [...array].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, array.length));
    }
    
    // Function to create gallery item HTML
    function createGalleryItem(image) {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.dataset.lens = image.lens;
        
        const img = document.createElement('img');
        img.src = image.thumb.src;
        img.srcset = image.thumb.srcset;
        img.sizes = image.thumb.sizes;
        img.alt = `${image.lens} - ${image.filename}`;
        img.dataset.full = image.path;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.fetchpriority = 'low';
        img.className = 'gallery-img';
        
        if (image.thumb.width) img.width = image.thumb.width;
        if (image.thumb.height) img.height = image.thumb.height;
        
        const info = document.createElement('div');
        info.className = 'image-info';
        
        const lensSpan = document.createElement('span');
        lensSpan.className = 'lens-name';
        lensSpan.textContent = image.lens;
        
        const fileSpan = document.createElement('span');
        fileSpan.className = 'file-title';
        fileSpan.textContent = image.filename;
        
        info.appendChild(lensSpan);
        info.appendChild(fileSpan);
        div.appendChild(img);
        div.appendChild(info);
        
        return div;
    }
    
    // Function to regenerate gallery with new random images
    function shuffleAndLoad() {
        // Add animation class
        shuffleBtn.style.animation = 'none';
        setTimeout(() => {
            shuffleBtn.style.animation = 'spin 0.6s ease-in-out';
        }, 10);
        
        // Select 50 random images
        const randomImages = getRandomItems(allImages, 50);
        
        // Clear gallery
        galleryGrid.innerHTML = '';
        
        // Add new gallery items
        randomImages.forEach(image => {
            const item = createGalleryItem(image);
            galleryGrid.appendChild(item);
        });
    }
    
    shuffleBtn.addEventListener('click', shuffleAndLoad);
});

// Filtrowanie zdjęć w galerii
document.addEventListener('DOMContentLoaded', function() {
    const folderSelect = document.getElementById('folder-select');
    const galleryGrid = document.getElementById('gallery-grid');
    
    if (folderSelect && galleryGrid) {
        folderSelect.addEventListener('change', function() {
            const selectedLens = this.value;
            const galleryItems = galleryGrid.querySelectorAll('.gallery-item');
            
            galleryItems.forEach(item => {
                if (selectedLens === 'all' || item.dataset.lens === selectedLens) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
    
    // Lightbox dla zdjęć
    const images = document.querySelectorAll('.gallery-item img, .image-item img');
    images.forEach(img => {
        img.addEventListener('click', function() {
            const lightbox = document.createElement('div');
            lightbox.className = 'lightbox';
            lightbox.innerHTML = `
                <div class="lightbox-content">
                    <span class="close">&times;</span>
                    <img src="${this.src}" alt="${this.alt}">
                    <div class="image-caption">${this.alt}</div>
                </div>
            `;
            
            document.body.appendChild(lightbox);
            
            lightbox.querySelector('.close').addEventListener('click', function() {
                document.body.removeChild(lightbox);
            });
            
            lightbox.addEventListener('click', function(e) {
                if (e.target === lightbox) {
                    document.body.removeChild(lightbox);
                }
            });
        });
    });
});

// Dodanie styli dla lightboxa
const lightboxStyles = `
.lightbox {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.lightbox-content {
    position: relative;
    max-width: 90%;
    max-height: 90%;
}

.lightbox-content img {
    max-width: 100%;
    max-height: 80vh;
    border-radius: 8px;
    box-shadow: 0 0 30px var(--neon-color);
}

.lightbox .close {
    position: absolute;
    top: -40px;
    right: 0;
    color: white;
    font-size: 30px;
    cursor: pointer;
    background: none;
    border: none;
    color: var(--neon-color);
}

.image-caption {
    color: white;
    text-align: center;
    margin-top: 10px;
    color: var(--neon-color);
}
`;

// Wstrzyknięcie styli lightboxa
const styleSheet = document.createElement('style');
styleSheet.textContent = lightboxStyles;
document.head.appendChild(styleSheet);
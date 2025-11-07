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
    
    // Lightbox dla zdjęć z nawigacją
    let currentImageIndex = 0;
    let visibleImages = [];
    let currentLightbox = null;
    let isFullscreenActive = false;

    const fullscreenEvents = [
        'fullscreenchange',
        'webkitfullscreenchange',
        'mozfullscreenchange',
        'MSFullscreenChange'
    ];

    function getFullscreenElement() {
        return document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement ||
            null;
    }

    function requestFullscreen(element) {
        if (!element) return Promise.resolve();
        if (element.requestFullscreen) {
            return element.requestFullscreen();
        }
        if (element.webkitRequestFullscreen) {
            return element.webkitRequestFullscreen();
        }
        if (element.mozRequestFullScreen) {
            return element.mozRequestFullScreen();
        }
        if (element.msRequestFullscreen) {
            return element.msRequestFullscreen();
        }
        return Promise.resolve();
    }

    function exitFullscreen() {
        if (document.exitFullscreen) {
            return document.exitFullscreen();
        }
        if (document.webkitExitFullscreen) {
            return document.webkitExitFullscreen();
        }
        if (document.mozCancelFullScreen) {
            return document.mozCancelFullScreen();
        }
        if (document.msExitFullscreen) {
            return document.msExitFullscreen();
        }
        return Promise.resolve();
    }

    function toggleFullscreen(element) {
        if (!element) return;
        if (getFullscreenElement()) {
            exitFullscreen();
        } else {
            requestFullscreen(element);
        }
    }

    const handleFullscreenChange = () => {
        isFullscreenActive = !!getFullscreenElement();
    };

    fullscreenEvents.forEach(eventName => {
        document.addEventListener(eventName, handleFullscreenChange);
    });
    
    function getVisibleImages() {
        const images = galleryGrid.querySelectorAll('.gallery-item img');
        const visible = Array.from(images).filter(img => {
            const item = img.closest('.gallery-item');
            return item && item.style.display !== 'none';
        });
        return visible.map(img => ({
            src: img.src,
            alt: img.alt,
            element: img
        }));
    }
    
    function openLightbox(imageIndex) {
        visibleImages = getVisibleImages();
        if (visibleImages.length === 0) return;
        
        currentImageIndex = imageIndex;
        const image = visibleImages[currentImageIndex];

        let lightbox = currentLightbox;
        const isNewLightbox = !lightbox;

        if (!lightbox) {
            lightbox = document.createElement('div');
            lightbox.className = 'lightbox';
            currentLightbox = lightbox;
        }

        const prevButton = currentImageIndex > 0 
            ? '<button class="lightbox-nav lightbox-prev" aria-label="Previous image">‹</button>'
            : '<button class="lightbox-nav lightbox-prev disabled" aria-label="Previous image" disabled>‹</button>';
        
        const nextButton = currentImageIndex < visibleImages.length - 1
            ? '<button class="lightbox-nav lightbox-next" aria-label="Next image">›</button>'
            : '<button class="lightbox-nav lightbox-next disabled" aria-label="Next image" disabled>›</button>';
        
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <span class="close">&times;</span>
                ${prevButton}
                <div class="lightbox-image-wrapper">
                    <img src="${image.src}" alt="${image.alt}">
                    <div class="image-counter">${currentImageIndex + 1} / ${visibleImages.length}</div>
                </div>
                ${nextButton}
                <div class="image-caption">${image.alt}</div>
            </div>
        `;

        if (isNewLightbox) {
            document.body.appendChild(lightbox);
            document.addEventListener('keydown', handleLightboxKeydown);
            document.body.style.overflow = 'hidden';
            lightbox.addEventListener('click', function(e) {
                if (e.target === lightbox) {
                    closeLightbox();
                }
            });
        }

        // Close button
        const closeButton = lightbox.querySelector('.close');
        if (closeButton) {
            closeButton.addEventListener('click', function(e) {
                e.stopPropagation();
                closeLightbox();
            });
        }

        // Prevent image clicks from closing and allow fullscreen toggle
        const img = lightbox.querySelector('img');
        if (img) {
            img.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleFullscreen(currentLightbox);
            });
        }

        const imageWrapper = lightbox.querySelector('.lightbox-image-wrapper');
        if (imageWrapper) {
            imageWrapper.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }

        // Previous button
        const prevBtn = lightbox.querySelector('.lightbox-prev');
        if (prevBtn && !prevBtn.disabled) {
            prevBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (currentImageIndex > 0) {
                    openLightbox(currentImageIndex - 1);
                }
            });
        }
        
        // Next button
        const nextBtn = lightbox.querySelector('.lightbox-next');
        if (nextBtn && !nextBtn.disabled) {
            nextBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (currentImageIndex < visibleImages.length - 1) {
                    openLightbox(currentImageIndex + 1);
                }
            });
        }

        // Restore fullscreen if active after rebuilding content
        if (isFullscreenActive && currentLightbox && getFullscreenElement() !== currentLightbox) {
            requestFullscreen(currentLightbox);
        }
    }
    
    function closeLightbox() {
        const lightbox = currentLightbox;
        if (!lightbox) return;

        const cleanup = () => {
            if (lightbox.parentNode) {
                lightbox.parentNode.removeChild(lightbox);
            }
            document.removeEventListener('keydown', handleLightboxKeydown);
            document.body.style.overflow = '';
            currentLightbox = null;
        };

        if (isFullscreenActive) {
            const exitPromise = exitFullscreen();
            if (exitPromise && typeof exitPromise.then === 'function') {
                exitPromise.catch(() => {}).finally(() => {
                    handleFullscreenChange();
                    cleanup();
                });
                return;
            }
        }

        cleanup();
    }
    
    function handleLightboxKeydown(e) {
        if (!currentLightbox) return;
        
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (currentImageIndex > 0) {
                    openLightbox(currentImageIndex - 1);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (currentImageIndex < visibleImages.length - 1) {
                    openLightbox(currentImageIndex + 1);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeLightbox();
                break;
        }
    }
    
    // Attach click handlers to gallery items (works better on mobile)
    galleryGrid.addEventListener('click', function(e) {
        const item = e.target.closest('.gallery-item');
        if (!item || !galleryGrid.contains(item)) return;

        const img = item.querySelector('img');
        if (!img) return;

        e.preventDefault();
        visibleImages = getVisibleImages();
        const clickedImage = visibleImages.findIndex(imgData => imgData.element === img);
        if (clickedImage !== -1) {
            openLightbox(clickedImage);
        }
    });
    
    // Also handle images on lens detail pages
    const lensImages = document.querySelectorAll('.image-item img');
    lensImages.forEach((img, index) => {
        img.addEventListener('click', function() {
            // For lens detail pages, just show this image
            visibleImages = [{
                src: this.src,
                alt: this.alt,
                element: this
            }];
            openLightbox(0);
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
    background-color: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(10px);
}

.lightbox-content {
    position: relative;
    max-width: 95%;
    max-height: 95%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
}

.lightbox-image-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.lightbox-content img {
    max-width: 100%;
    max-height: 85vh;
    border-radius: 8px;
    box-shadow: 0 0 40px rgba(0, 255, 170, 0.5);
    transition: opacity 0.3s ease;
}

.lightbox .close {
    position: absolute;
    top: 20px;
    right: 20px;
    color: var(--neon-color);
    font-size: 40px;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.5);
    border: 2px solid var(--neon-color);
    border-radius: 50%;
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    z-index: 1001;
    line-height: 1;
}

.lightbox .close:hover {
    background: var(--neon-color);
    color: var(--background-color);
    box-shadow: 0 0 20px var(--neon-color);
    transform: scale(1.1);
}

.lightbox-nav {
    background: rgba(0, 0, 0, 0.7);
    border: 2px solid var(--neon-color);
    color: var(--neon-color);
    font-size: 50px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    z-index: 1001;
    line-height: 1;
    padding: 0;
    user-select: none;
}

.lightbox-nav:hover:not(.disabled) {
    background: var(--neon-color);
    color: var(--background-color);
    box-shadow: 0 0 25px var(--neon-color);
    transform: scale(1.1);
}

.lightbox-nav.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    border-color: rgba(0, 255, 170, 0.3);
}

.image-caption {
    color: var(--neon-color);
    text-align: center;
    margin-top: 15px;
    font-size: 1.1rem;
    text-shadow: 0 0 10px var(--neon-color);
}

.image-counter {
    position: absolute;
    top: -35px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--neon-color);
    background: rgba(0, 0, 0, 0.7);
    padding: 5px 15px;
    border-radius: 20px;
    border: 1px solid var(--neon-color);
    font-size: 0.9rem;
    text-shadow: 0 0 5px var(--neon-color);
}

@media (max-width: 768px) {
    .lightbox-content {
        flex-direction: row;
        gap: 10px;
        align-items: center;
    }
    
    .lightbox-nav {
        position: absolute;
        width: 45px;
        height: 45px;
        font-size: 35px;
    }
    
    .lightbox-prev {
        left: 10px;
    }
    
    .lightbox-next {
        right: 10px;
    }
    
    .lightbox-image-wrapper {
        width: 100%;
    }
    
    .lightbox-content img {
        max-height: 75vh;
    }
    
    .lightbox .close {
        top: 10px;
        right: 10px;
        width: 40px;
        height: 40px;
        font-size: 30px;
    }
    
    .image-counter {
        top: -30px;
        font-size: 0.8rem;
        padding: 4px 12px;
    }
}
`;

// Wstrzyknięcie styli lightboxa
const styleSheet = document.createElement('style');
styleSheet.textContent = lightboxStyles;
document.head.appendChild(styleSheet);
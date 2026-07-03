const GALLERY_BATCH_SIZE = 72;
const GALLERY_DATA_URL = "/gallery-data.json";

function getGalleryShape(width, height) {
  if (!width || !height) return "square";
  const ratio = height / width;
  if (ratio >= 1.35) return "portrait-tall";
  if (ratio >= 1.02) return "portrait";
  if (ratio <= 0.48) return "panorama-wide";
  if (ratio <= 0.68) return "panorama";
  if (ratio < 0.92) return "landscape";
  return "square";
}

function buildGalleryItemElement(image, index, eagerLoad) {
  const w = image.w || image.thumb?.width || 0;
  const h = image.h || image.thumb?.height || 0;
  const shape = getGalleryShape(w, h);

  const item = document.createElement("article");
  item.className = `gallery-item gallery-item--${shape}`;
  item.dataset.lens = image.lens;
  item.dataset.shape = shape;
  item.dataset.index = String(index);
  if (w > 0 && h > 0) {
    item.style.setProperty("--gallery-ar", `${w} / ${h}`);
  }

  const media = document.createElement("div");
  media.className = "gallery-item__media";

  const img = document.createElement("img");
  img.src = image.src || image.thumb?.src || image.path;
  img.alt = `${image.lens} - ${image.filename}`;
  img.dataset.full = image.path;
  img.loading = eagerLoad ? "eager" : "lazy";
  img.decoding = "async";
  if (eagerLoad) img.fetchPriority = "high";
  img.className = "gallery-img";

  const glow = document.createElement("div");
  glow.className = "gallery-item__glow";
  glow.setAttribute("aria-hidden", "true");

  const info = document.createElement("div");
  info.className = "image-info";
  const lensSpan = document.createElement("span");
  lensSpan.className = "lens-name";
  lensSpan.textContent = image.lens;
  const fileSpan = document.createElement("span");
  fileSpan.className = "file-title";
  fileSpan.textContent = image.filename;
  info.append(lensSpan, fileSpan);
  media.append(img, glow);
  item.append(media, info);
  return item;
}

function manifestToLightboxEntry(image, element) {
  return {
    src: image.src || image.thumb?.src || image.path,
    full: image.path,
    alt: `${image.lens} - ${image.filename}`,
    element: element || null,
  };
}

window.getGalleryShape = getGalleryShape;
window.buildGalleryItemElement = buildGalleryItemElement;

document.addEventListener("DOMContentLoaded", function () {
  const folderSelect = document.getElementById("folder-select");
  const galleryGrid = document.getElementById("gallery-grid");
  const galleryStatus = document.getElementById("gallery-status");
  const gallerySentinel = document.getElementById("gallery-sentinel");

  let allGalleryImages = [];
  let filteredGalleryImages = [];
  let renderedCount = 0;
  let galleryLoadObserver = null;
  let virtualGallery = false;

  function updateGalleryStatus() {
    if (!galleryStatus) return;
    const total = filteredGalleryImages.length;
    const shown = Math.min(renderedCount, total);
    galleryStatus.textContent =
      total > 0 ? `Montras ${shown} el ${total} fotoj` : "";
  }

  function syncLightboxManifest() {
    visibleImages = filteredGalleryImages.map((image) =>
      manifestToLightboxEntry(image),
    );
  }

  function renderGalleryBatch() {
    if (!galleryGrid || renderedCount >= filteredGalleryImages.length) return;

    const end = Math.min(
      renderedCount + GALLERY_BATCH_SIZE,
      filteredGalleryImages.length,
    );
    const fragment = document.createDocumentFragment();

    for (let i = renderedCount; i < end; i++) {
      fragment.appendChild(
        buildGalleryItemElement(filteredGalleryImages[i], i, i < 8),
      );
    }

    galleryGrid.appendChild(fragment);
    renderedCount = end;
    updateGalleryStatus();

    if (gallerySentinel) {
      gallerySentinel.hidden = renderedCount >= filteredGalleryImages.length;
    }
  }

  function resetVirtualGallery() {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = "";
    renderedCount = 0;
    if (gallerySentinel) gallerySentinel.hidden = false;
    renderGalleryBatch();
    syncLightboxManifest();
    setupGalleryInfiniteScroll();
  }

  function applyLensFilter(lensValue) {
    filteredGalleryImages =
      lensValue === "all"
        ? allGalleryImages
        : allGalleryImages.filter((image) => image.lens === lensValue);
    resetVirtualGallery();
  }

  function setupGalleryInfiniteScroll() {
    if (!gallerySentinel || !("IntersectionObserver" in window)) return;
    if (galleryLoadObserver) galleryLoadObserver.disconnect();

    galleryLoadObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          renderGalleryBatch();
        }
      },
      { rootMargin: "1200px 0px" },
    );
    galleryLoadObserver.observe(gallerySentinel);
  }

  function startVirtualGallery(data) {
    if (!galleryGrid || !Array.isArray(data) || data.length === 0) return false;

    allGalleryImages = data;
    virtualGallery = true;
    filteredGalleryImages = allGalleryImages;
    resetVirtualGallery();

    if (folderSelect) {
      folderSelect.addEventListener("change", function () {
        applyLensFilter(this.value);
      });
    }

    return true;
  }

  async function initVirtualGallery() {
    if (!galleryGrid) return false;

    try {
      const response = await fetch(GALLERY_DATA_URL, {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return startVirtualGallery(data);
    } catch (error) {
      console.error("Nie udało się wczytać danych galerii", error);
      if (galleryStatus) {
        galleryStatus.textContent = "Eraro ŝargante galerion.";
      }
      return false;
    }
  }

  // Lightbox — pokaz slajdów na pełnym ekranie
  let currentImageIndex = 0;
  let visibleImages = [];
  let currentLightbox = null;
  let isFullscreenActive = false;

  const fullscreenEvents = [
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange",
  ];

  function getFullscreenElement() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null
    );
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

  function enterSlideshowFullscreen(element) {
    if (!element) return;
    const req = requestFullscreen(element);
    if (req && typeof req.then === "function") {
      req.catch(() => {});
    }
  }

  const handleFullscreenChange = () => {
    isFullscreenActive = !!getFullscreenElement();
  };

  fullscreenEvents.forEach((eventName) => {
    document.addEventListener(eventName, handleFullscreenChange);
  });

  function showLightboxUi(lightbox) {
    if (!lightbox) return;
    lightbox.classList.add("show-ui");
    clearTimeout(lightbox._uiHideTimer);
    lightbox._uiHideTimer = setTimeout(() => {
      lightbox.classList.remove("show-ui");
    }, 3000);
  }

  function getVisibleImages() {
    if (virtualGallery) {
      return filteredGalleryImages.map((image) => manifestToLightboxEntry(image));
    }
    if (!galleryGrid) return visibleImages;
    const images = galleryGrid.querySelectorAll(".gallery-item img");
    const visible = Array.from(images).filter((img) => {
      const item = img.closest(".gallery-item");
      return item && item.style.display !== "none";
    });
    return visible.map((img) => ({
      src: img.src,
      full: img.dataset.full || img.src,
      alt: img.alt,
      element: img,
    }));
  }

  function openLightbox(imageIndex) {
    if (!virtualGallery && galleryGrid) {
      visibleImages = getVisibleImages();
    } else if (virtualGallery) {
      syncLightboxManifest();
    }
    if (visibleImages.length === 0) return;

    currentImageIndex = imageIndex;
  const image = visibleImages[currentImageIndex];

    let lightbox = currentLightbox;
    const isNewLightbox = !lightbox;

    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.className = "lightbox lightbox-slideshow";
      currentLightbox = lightbox;
    }

    const hasPrev = currentImageIndex > 0;
    const hasNext = currentImageIndex < visibleImages.length - 1;

    lightbox.innerHTML = `
      <button class="lightbox-close close" type="button" aria-label="Zamknij">&times;</button>
      <button class="lightbox-nav lightbox-prev${hasPrev ? "" : " disabled"}" type="button" aria-label="Poprzednie zdjęcie"${hasPrev ? "" : " disabled"}>‹</button>
      <button class="lightbox-nav lightbox-next${hasNext ? "" : " disabled"}" type="button" aria-label="Następne zdjęcie"${hasNext ? "" : " disabled"}>›</button>
           <div class="lightbox-stage" id="lightbox-stage">
        <img src="${image.full}" alt="${image.alt}" loading="eager" decoding="async" class="lightbox-slide-img" style="transform: scale(1); transform-origin: center center; cursor: zoom-in;">
      </div>
      <div class="lightbox-ui">
        <div class="image-counter">${currentImageIndex + 1} / ${visibleImages.length}</div>
        <div class="image-caption">${image.alt}</div>
      </div>
    `;

    const lightboxImg = lightbox.querySelector("img");
        const lightboxStage = lightbox.querySelector("#lightbox-stage");
    if (lightboxImg && lightboxStage) {
      setupLightboxZoom(lightboxImg, lightboxStage);
    }
    if (lightboxImg) {
      lightboxImg.classList.add("is-loading");
      lightboxImg.onload = function () {
        this.classList.remove("is-loading");
      };
      lightboxImg.onerror = function () {
        this.classList.remove("is-loading");
      };
    }

    if (isNewLightbox) {
      document.body.appendChild(lightbox);
      document.addEventListener("keydown", handleLightboxKeydown);
      document.body.style.overflow = "hidden";
      enterSlideshowFullscreen(lightbox);

      lightbox.addEventListener("click", function (e) {
        if (
          e.target === lightbox ||
          e.target.classList.contains("lightbox-stage")
        ) {
          showLightboxUi(lightbox);
        }
      });

      // Disable swipe navigation on mobile: use buttons only.
      lightbox.addEventListener("mousemove", () => showLightboxUi(lightbox));
    } else if (
      isFullscreenActive &&
      getFullscreenElement() !== currentLightbox
    ) {
      enterSlideshowFullscreen(currentLightbox);
    }

    showLightboxUi(lightbox);

    const closeButton = lightbox.querySelector(".close");
    if (closeButton) {
      closeButton.addEventListener("click", function (e) {
        e.stopPropagation();
        closeLightbox();
      });
    }

    const prevBtn = lightbox.querySelector(".lightbox-prev");
    if (prevBtn && hasPrev) {
      prevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openLightbox(currentImageIndex - 1);
      });
    }

    const nextBtn = lightbox.querySelector(".lightbox-next");
    if (nextBtn && hasNext) {
      nextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        openLightbox(currentImageIndex + 1);
      });
    }
  }
  function setupLightboxZoom(imgElement, stageElement) {
    if (!imgElement || !stageElement) return;

    let scale = 1;
    let posX = 0;
    let posY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const resetZoom = () => {
      scale = 1;
      posX = 0;
      posY = 0;
      imgElement.style.transition = 'transform 0.2s ease';
      imgElement.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
      imgElement.style.transformOrigin = 'center center';
      imgElement.style.cursor = 'zoom-in';
    };

    const applyTransform = () => {
      imgElement.style.transition = 'none';
      imgElement.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
    };

    // Mouse wheel zoom
    stageElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = stageElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
      const newScale = Math.min(Math.max(scale * zoomFactor, 1), 8);

      if (newScale !== scale) {
        const scaleChange = newScale / scale;
        posX = mouseX - (mouseX - posX) * scaleChange;
        posY = mouseY - (mouseY - posY) * scaleChange;
        scale = newScale;
        applyTransform();
        imgElement.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
      }
    }, { passive: false });

    // Double click = toggle zoom
    stageElement.addEventListener('dblclick', () => {
      if (scale > 1) {
        resetZoom();
      } else {
        scale = 3;
        posX = 0;
        posY = 0;
        applyTransform();
        imgElement.style.cursor = 'grab';
      }
    });
        // Single click = zoom in / reset (lupa)
    let clickTimeout = null;
    stageElement.addEventListener('click', (e) => {
      // ignorujemy kliknięcia podczas dragowania
      if (isDragging) return;

      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
        return; // to był double-click – nie robimy nic (dblclick obsłuży)
      }

      clickTimeout = setTimeout(() => {
        clickTimeout = null;

        if (scale === 1) {
          scale = 3;
          posX = 0;
          posY = 0;
          applyTransform();
          imgElement.style.cursor = 'grab';
        }
      }, 250); // 250ms – czas na wykrycie double-clicku
    });

    // Drag when zoomed
    imgElement.addEventListener('mousedown', (e) => {
      if (scale <= 1) return;
      isDragging = true;
      startX = e.clientX - posX;
      startY = e.clientY - posY;
      imgElement.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        imgElement.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || scale <= 1) return;
      posX = e.clientX - startX;
      posY = e.clientY - startY;
      applyTransform();
    });
/* To tu zmiana dotyk
    // Touch support (basic pinch + drag)
    let initialDistance = 0;
    let initialScale = 1;
*/
    stageElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = scale;
      } else if (e.touches.length === 1 && scale > 1) {
        isDragging = true;
        startX = e.touches[0].clientX - posX;
        startY = e.touches[0].clientY - posY;
      }
    }, { passive: true });

    stageElement.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const newScale = Math.min(Math.max(initialScale * (currentDistance / initialDistance), 1), 8);
        scale = newScale;
        applyTransform();
      } else if (e.touches.length === 1 && isDragging && scale > 1) {
        posX = e.touches[0].clientX - startX;
        posY = e.touches[0].clientY - startY;
        applyTransform();
      }
    }, { passive: false });

    stageElement.addEventListener('touchend', () => {
      isDragging = false;
      imgElement.style.cursor = scale > 1 ? 'grab' : 'zoom-in';
    });

    // Reset when changing image
    imgElement.dataset.zoomInitialized = 'true';
  }

  function closeLightbox() {
    const lightbox = currentLightbox;
    if (!lightbox) return;

    const cleanup = () => {
      if (lightbox.parentNode) {
        lightbox.parentNode.removeChild(lightbox);
      }
      document.removeEventListener("keydown", handleLightboxKeydown);
      document.body.style.overflow = "";
      currentLightbox = null;
    };

    if (isFullscreenActive) {
      const exitPromise = exitFullscreen();
      if (exitPromise && typeof exitPromise.then === "function") {
        exitPromise
          .catch(() => {})
          .finally(() => {
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

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        if (currentImageIndex > 0) {
          openLightbox(currentImageIndex - 1);
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        if (currentImageIndex < visibleImages.length - 1) {
          openLightbox(currentImageIndex + 1);
        }
        break;
      case "Escape":
        e.preventDefault();
        closeLightbox();
        break;
    }
  }

  if (document.getElementById("folder-select")) {
    initVirtualGallery();
}

  if (!virtualGallery && folderSelect && galleryGrid) {
    folderSelect.addEventListener("change", function () {
      const selectedLens = this.value;
      galleryGrid.querySelectorAll(".gallery-item").forEach((item) => {
        if (selectedLens === "all" || item.dataset.lens === selectedLens) {
          item.style.display = "";
        } else {
          item.style.display = "none";
        }
      });
    });
  }

  if (galleryGrid) {
  galleryGrid.addEventListener("click", function (e) {
    const item = e.target.closest(".gallery-item");
    if (!item || !galleryGrid.contains(item)) return;

    e.preventDefault();

    if (virtualGallery) {
      const index = parseInt(item.dataset.index, 10);
      if (!Number.isNaN(index)) {
        syncLightboxManifest();
        openLightbox(index);
      }
      return;
    }

    const img = item.querySelector("img");
    if (!img) return;

    visibleImages = getVisibleImages();
    const clickedImage = visibleImages.findIndex(
      (imgData) => imgData.element === img,
    );
    if (clickedImage !== -1) {
      openLightbox(clickedImage);
    }
  });
}

  // Also handle images on lens detail pages
  const lensImages = document.querySelectorAll(".image-item img");
  lensImages.forEach((img, index) => {
    img.addEventListener("click", function () {
      // For lens detail pages, just show this image
      visibleImages = [
        {
          src: this.src,
          full: this.dataset.full || this.src,
          alt: this.alt,
          element: this,
        },
      ];
      openLightbox(0);
    });
  });

  // Back-to-top button behavior
  const backToTop = document.getElementById("back-to-top");
  if (backToTop) {
    const toggleBackToTop = () => {
      if (window.scrollY > 300) {
        backToTop.classList.add("visible");
      } else {
        backToTop.classList.remove("visible");
      }
    };

    // Smooth scroll on click
    backToTop.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Throttle scroll handler slightly
    let throttled = false;
    window.addEventListener("scroll", () => {
      if (throttled) return;
      throttled = true;
      requestAnimationFrame(() => {
        toggleBackToTop();
        throttled = false;
      });
    }, { passive: true });

    // Initial check
    toggleBackToTop();
  }

});

// Style pokazu slajdów na pełnym ekranie
const lightboxStyles = `
.lightbox-slideshow {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    background: #000;
    z-index: 10000;
    overflow: hidden;
    cursor: none;
}

.lightbox-slideshow.show-ui,
.lightbox-slideshow:hover {
    cursor: default;
}

.lightbox-stage {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

.lightbox-slide-img {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-width: 100vw;
    max-height: 100vh;
    max-height: 100dvh;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
    transition: opacity 0.25s ease;
}

.lightbox-slide-img.is-loading {
    opacity: 0.35;
}

.lightbox-slideshow .close,
.lightbox-slideshow .lightbox-close {
    position: fixed;
    top: max(16px, env(safe-area-inset-top, 0px));
    right: max(16px, env(safe-area-inset-right, 0px));
    color: var(--neon-color);
    font-size: 36px;
    cursor: pointer;
    background: rgba(0, 0, 0, 0.55);
    border: 2px solid var(--neon-color);
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.3s ease, transform 0.2s ease, background 0.2s ease;
    z-index: 10002;
    line-height: 1;
    opacity: 0;
    pointer-events: none;
}

.lightbox-slideshow .lightbox-nav {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.45);
    border: 2px solid var(--neon-color);
    color: var(--neon-color);
    font-size: 48px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.3s ease, transform 0.2s ease, background 0.2s ease;
    z-index: 10002;
    line-height: 1;
    padding: 0;
    user-select: none;
    opacity: 0;
    pointer-events: none;
}

.lightbox-slideshow.show-ui .close,
.lightbox-slideshow.show-ui .lightbox-close,
.lightbox-slideshow.show-ui .lightbox-nav,
.lightbox-slideshow:hover .close,
.lightbox-slideshow:hover .lightbox-close,
.lightbox-slideshow:hover .lightbox-nav {
    opacity: 1;
    pointer-events: auto;
}

.lightbox-slideshow .lightbox-prev {
    left: max(12px, env(safe-area-inset-left, 0px));
}

.lightbox-slideshow .lightbox-next {
    right: max(12px, env(safe-area-inset-right, 0px));
}

.lightbox-slideshow .close:hover,
.lightbox-slideshow .lightbox-nav:hover:not(.disabled) {
    background: var(--neon-color);
    color: var(--background-color);
    box-shadow: 0 0 20px var(--neon-color);
}

.lightbox-slideshow .lightbox-nav.disabled {
    opacity: 0 !important;
    pointer-events: none !important;
}

.lightbox-ui {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 48px 24px 24px;
    padding-bottom: max(24px, env(safe-area-inset-bottom, 0px));
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
    text-align: center;
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.lightbox-slideshow.show-ui .lightbox-ui,
.lightbox-slideshow:hover .lightbox-ui {
    opacity: 1;
}

.image-caption {
    color: var(--neon-color);
    font-size: 1rem;
    text-shadow: 0 0 10px var(--neon-color);
    margin-top: 8px;
}

.image-counter {
    display: inline-block;
    color: var(--neon-color);
    background: rgba(0, 0, 0, 0.6);
    padding: 6px 16px;
    border-radius: 20px;
    border: 1px solid var(--neon-color);
    font-size: 0.9rem;
    text-shadow: 0 0 5px var(--neon-color);
}

.lightbox-slideshow:fullscreen,
.lightbox-slideshow:-webkit-full-screen {
    width: 100%;
    height: 100%;
}

.lightbox-slideshow:fullscreen .lightbox-slide-img,
.lightbox-slideshow:-webkit-full-screen .lightbox-slide-img {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
}

@media (max-width: 768px) {
    .lightbox-slideshow .close,
    .lightbox-slideshow .lightbox-close {
        width: 44px;
        height: 44px;
        font-size: 28px;
    }

    .lightbox-slideshow .lightbox-nav {
        width: 48px;
        height: 48px;
        font-size: 38px;
    }

    .lightbox-slideshow.show-ui .close,
    .lightbox-slideshow.show-ui .lightbox-close,
    .lightbox-slideshow.show-ui .lightbox-nav {
        opacity: 1;
        pointer-events: auto;
    }

    .lightbox-slideshow.show-ui .lightbox-ui {
        opacity: 1;
    }
}
`;

const responsiveStyles = `
@media (hover: none) and (pointer: coarse) {
    .lightbox-slideshow {
        cursor: default;
    }

    .lightbox-slideshow .lightbox-nav {
        width: 52px;
        height: 52px;
    }
}
`;

// Wstrzyknięcie styli lightboxa
const styleSheet = document.createElement("style");
styleSheet.textContent = lightboxStyles + responsiveStyles;
document.head.appendChild(styleSheet);

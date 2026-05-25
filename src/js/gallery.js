const GALLERY_SHAPES = [
  "square",
  "landscape",
  "portrait",
  "portrait-tall",
  "panorama",
  "panorama-wide",
];

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

function applyGalleryShape(item, width, height) {
  const shape = getGalleryShape(width, height);
  GALLERY_SHAPES.forEach((s) => item.classList.remove(`gallery-item--${s}`));
  item.classList.add(`gallery-item--${shape}`);
  item.dataset.shape = shape;
  if (width && height) {
    item.style.setProperty("--gallery-ar", `${width} / ${height}`);
  }
  return shape;
}

function applyGalleryLayout(item, width, height) {
  return applyGalleryShape(item, width, height);
}

function initGalleryShapes(grid) {
  if (!grid) return;
  grid.querySelectorAll(".gallery-item").forEach((item) => {
    if (item.style.display === "none") return;
    const img = item.querySelector(".gallery-img, img");
    if (!img) return;

    const apply = () => {
      const w = img.naturalWidth || Number(img.getAttribute("width"));
      const h = img.naturalHeight || Number(img.getAttribute("height"));
      if (w && h) applyGalleryLayout(item, w, h);
    };

    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener("load", apply, { once: true });
  });
}

function initGalleryLayout(root = document) {
  const grid =
    root.id === "gallery-grid"
      ? root
      : root.querySelector?.("#gallery-grid") ||
        document.getElementById("gallery-grid");
  if (grid) initGalleryShapes(grid);
}

window.getGalleryShape = getGalleryShape;
window.applyGalleryLayout = applyGalleryLayout;
window.initGalleryLayout = initGalleryLayout;

// Filtrowanie zdjęć w galerii
document.addEventListener("DOMContentLoaded", function () {
  const folderSelect = document.getElementById("folder-select");
  const galleryGrid = document.getElementById("gallery-grid");

  if (folderSelect && galleryGrid) {
    folderSelect.addEventListener("change", function () {
      const selectedLens = this.value;
      const galleryItems = galleryGrid.querySelectorAll(".gallery-item");

      galleryItems.forEach((item) => {
        if (selectedLens === "all" || item.dataset.lens === selectedLens) {
          item.style.display = "";
        } else {
          item.style.display = "none";
        }
      });
      requestAnimationFrame(() => initGalleryShapes(galleryGrid));
    });
  }

  // Lightbox — pokaz slajdów na pełnym ekranie
  let currentImageIndex = 0;
  let visibleImages = [];
  let currentLightbox = null;
  let isFullscreenActive = false;
  let lightboxTouchStartX = 0;

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
    if (galleryGrid) {
      visibleImages = getVisibleImages();
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
      <div class="lightbox-stage">
        <img src="${image.full}" alt="${image.alt}" loading="eager" decoding="async" class="lightbox-slide-img">
      </div>
      <div class="lightbox-ui">
        <div class="image-counter">${currentImageIndex + 1} / ${visibleImages.length}</div>
        <div class="image-caption">${image.alt}</div>
      </div>
    `;

    const lightboxImg = lightbox.querySelector("img");
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

      lightbox.addEventListener(
        "touchstart",
        function (e) {
          lightboxTouchStartX = e.changedTouches[0].screenX;
        },
        { passive: true },
      );

      lightbox.addEventListener(
        "touchend",
        function (e) {
          const diffX = lightboxTouchStartX - e.changedTouches[0].screenX;
          if (Math.abs(diffX) < 50) {
            showLightboxUi(lightbox);
            return;
          }
          if (diffX > 0 && currentImageIndex < visibleImages.length - 1) {
            openLightbox(currentImageIndex + 1);
          } else if (diffX < 0 && currentImageIndex > 0) {
            openLightbox(currentImageIndex - 1);
          }
        },
        { passive: true },
      );

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

  // Attach click handlers to gallery items (works better on mobile)
  if (galleryGrid) {
  galleryGrid.addEventListener("click", function (e) {
    const item = e.target.closest(".gallery-item");
    if (!item || !galleryGrid.contains(item)) return;

    const img = item.querySelector("img");
    if (!img) return;

    e.preventDefault();
    visibleImages = getVisibleImages();
    const clickedImage = visibleImages.findIndex(
      (imgData) => imgData.element === img,
    );
    if (clickedImage !== -1) {
      openLightbox(clickedImage);
    }
  });

  // Add touch gesture support for mobile
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  galleryGrid.addEventListener(
    "touchstart",
    function (e) {
      if (e.target.closest(".gallery-item")) {
        const touch = e.changedTouches[0];
        touchStartX = touch.screenX;
        touchStartY = touch.screenY;
      }
    },
    { passive: true },
  );

  galleryGrid.addEventListener(
    "touchend",
    function (e) {
      if (e.target.closest(".gallery-item")) {
        const touch = e.changedTouches[0];
        touchEndX = touch.screenX;
        touchEndY = touch.screenY;

        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;

        // Only trigger on horizontal swipes (to avoid conflicts with scrolling)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
          e.preventDefault();
          const item = e.target.closest(".gallery-item");
          const img = item.querySelector("img");
          if (img) {
            visibleImages = getVisibleImages();
            const clickedImage = visibleImages.findIndex(
              (imgData) => imgData.element === img,
            );
            if (clickedImage !== -1) {
              openLightbox(clickedImage);
            }
          }
        }
      }
    },
    { passive: true },
  );
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

  initGalleryLayout();
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

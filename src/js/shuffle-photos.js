/**
 * Shuffle images on the random photos page - select 50 NEW random images each time
 */

document.addEventListener("DOMContentLoaded", function () {
  const shuffleBtn = document.getElementById("shuffle-btn");
  const galleryGrid = document.getElementById("gallery-grid");
  const imgDataElement = document.getElementById("all-images-data");

  if (!shuffleBtn || !galleryGrid || !imgDataElement) return;

  let allImages = [];
  try {
    allImages = JSON.parse(imgDataElement.textContent);
  } catch (e) {
    console.error("Failed to parse images data", e);
    return;
  }

  function getRandomItems(array, count) {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  function createGalleryItem(image) {
    const w = image.thumb?.width;
    const h = image.thumb?.height;
    const shape =
      typeof window.getGalleryShape === "function" && w && h
        ? window.getGalleryShape(w, h)
        : "square";

    const div = document.createElement("div");
    div.className = `gallery-item gallery-item--${shape}`;
    div.dataset.lens = image.lens;
    div.dataset.shape = shape;
    if (w && h) {
      div.style.setProperty("--gallery-ar", `${w} / ${h}`);
    }

    const media = document.createElement("div");
    media.className = "gallery-item__media";

    const img = document.createElement("img");
    img.src = image.thumb.src;
    img.srcset = image.thumb.srcset;
    img.sizes = "(max-width: 699px) 50vw, (max-width: 1199px) 33vw, 280px";
    img.alt = `${image.lens} - ${image.filename}`;
    img.dataset.full = image.path;
    img.loading = "lazy";
    img.decoding = "async";
    img.fetchpriority = "low";
    img.className = "gallery-img";

    if (w) img.width = w;
    if (h) img.height = h;

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

    info.appendChild(lensSpan);
    info.appendChild(fileSpan);
    media.appendChild(img);
    media.appendChild(glow);
    div.appendChild(media);
    div.appendChild(info);

    return div;
  }

  function shuffleAndLoad() {
    shuffleBtn.style.animation = "none";
    setTimeout(() => {
      shuffleBtn.style.animation = "spin 0.6s ease-in-out";
    }, 10);

    const randomImages = getRandomItems(allImages, 50);
    galleryGrid.innerHTML = "";

    randomImages.forEach((image) => {
      galleryGrid.appendChild(createGalleryItem(image));
    });

    if (typeof window.initGalleryLayout === "function") {
      requestAnimationFrame(() => window.initGalleryLayout(galleryGrid));
    }
  }

  shuffleBtn.addEventListener("click", shuffleAndLoad);
});

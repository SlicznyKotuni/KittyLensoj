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
    if (typeof window.buildGalleryItemElement === "function") {
      return window.buildGalleryItemElement(image, 0, false);
    }

    const div = document.createElement("div");
    div.className = "gallery-item gallery-item--square";
    div.dataset.lens = image.lens;
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

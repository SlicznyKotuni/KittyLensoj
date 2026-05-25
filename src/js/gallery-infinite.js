/**
 * Infinity Scroll dla galerii - DOKŁADNIE zgodny z Twoją strukturą HTML
 * Nie usuwa żadnych istniejących funkcji (filtry, strzałki, lightbox)
 */
document.addEventListener("DOMContentLoaded", function () {
  var grid = document.getElementById("gallery-grid");
  var sentinel = document.getElementById("load-sentinel");
  var dataEl = document.getElementById("gallery-data");
  
  if (!grid || !sentinel || !dataEl) return;
  
  var allImages = [];
  try { allImages = JSON.parse(dataEl.textContent).images; } 
  catch (e) { console.error("Błąd danych galerii:", e); return; }
  
  var INITIAL = 60;
  var BATCH = 40;
  var index = INITIAL;
  var isLoading = false;
  var observer = null;
  
  // Funkcja tworząca element - ZGODNA z Twoim gallery-item.njk
  function createGalleryItem(image) {
    var w = image.thumb && image.thumb.width ? image.thumb.width : null;
    var h = image.thumb && image.thumb.height ? image.thumb.height : null;
    
    var shape = "square";
    if (w && h) {
      var ratio = w / h;
      if (ratio > 1.3) shape = "landscape";
      else if (ratio < 0.7) shape = "portrait";
    }
    
    var div = document.createElement("div");
    div.className = "gallery-item gallery-item--" + shape;
    div.dataset.lens = image.lens;
    div.dataset.shape = shape;
    if (w && h) {
      div.style.setProperty("--gallery-ar", w + " / " + h);
    }
    
    var media = document.createElement("div");
    media.className = "gallery-item__media";
    
    var img = document.createElement("img");
    img.src = image.thumb.src;
    img.srcset = image.thumb.srcset || "";
    img.sizes = image.thumb.sizes || "(max-width: 699px) 50vw, 25vw";
    img.alt = image.alt || image.lens + " - " + image.filename;
    img.dataset.full = image.path;
    img.loading = "lazy";
    img.decoding = "async";
    img.fetchpriority = "low";
    img.className = "gallery-img";
    if (w) img.width = w;
    if (h) img.height = h;
    
    var glow = document.createElement("div");
    glow.className = "gallery-item__glow";
    glow.setAttribute("aria-hidden", "true");
    
    var info = document.createElement("div");
    info.className = "image-info";
    
    var lensSpan = document.createElement("span");
    lensSpan.className = "lens-name";
    lensSpan.textContent = image.lens;
    
    var fileSpan = document.createElement("span");
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
  
  function loadBatch() {
    if (isLoading || index >= allImages.length) return;
    isLoading = true;
    
    // Pokaż spinner
    var spinner = document.createElement("div");
    spinner.className = "loading-spinner";
    if (sentinel.parentNode) {
      sentinel.parentNode.replaceChild(spinner, sentinel);
    }
    
    // Async render, żeby nie blokować UI
    setTimeout(function() {
      var fragment = document.createDocumentFragment();
      var end = Math.min(index + BATCH, allImages.length);
      
      for (; index < end; index++) {
        fragment.appendChild(createGalleryItem(allImages[index]));
      }
      
      grid.appendChild(fragment);
      
      // Przywróć sentinel
      var newSentinel = document.createElement("div");
      newSentinel.id = "load-sentinel";
      newSentinel.className = "load-sentinel";
      if (spinner.parentNode) {
        spinner.parentNode.replaceChild(newSentinel, spinner);
        sentinel = newSentinel;
        
        // Ponownie obserwuj, jeśli observer istnieje
        if (observer) {
          observer.observe(sentinel);
        }
      }
      
      isLoading = false;
      
      // Koniec danych?
      if (index >= allImages.length && observer) {
        observer.disconnect();
        if (sentinel.parentNode) {
          sentinel.parentNode.removeChild(sentinel);
        }
      }
    }, 50);
  }
  
  // IntersectionObserver (Infinity Scroll)
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting && !isLoading) {
        loadBatch();
      }
    }, { rootMargin:
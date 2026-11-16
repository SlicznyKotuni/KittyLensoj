const fs = require('fs');
const path = require('path');

// 🛑 KRYTYCZNE DLA PAMIĘCI: Ograniczamy libvips (silnik Sharp) do 1 wątku
// i wyłączamy jego wewnętrzny cache, żeby nie trzymał buforów w RAM.
process.env.VIPS_CONCURRENCY = "1";
try {
  const sharp = require('sharp');
  sharp.cache(false);
  sharp.concurrency(1);
} catch (e) {
  console.warn("[Sharp] Nie udało się załadować modułu bezpośrednio:", e.message);
}

const Image = require("@11ty/eleventy-img");

// Limit NOWYCH miniatur generowanych w jednym buildzie.
// Ustaw w Cloudflare Pages: MAX_NEW_THUMBS=3500
// Brak zmiennej (lub 0) = bez limitu (np. lokalnie).
const MAX_NEW_THUMBS = parseInt(process.env.MAX_NEW_THUMBS || "0", 10);
// Limit CZASU generowania nowych miniatur w minutach (np. 14). 0 = brak.
// Po jego przekroczeniu build kończy się normalnie i zapisuje cache.
const MAX_THUMB_MINUTES = parseFloat(process.env.MAX_THUMB_MINUTES || "0");
console.log(`[KittyLensoj] config załadowany, MAX_NEW_THUMBS=${MAX_NEW_THUMBS || "brak"}, MAX_THUMB_MINUTES=${MAX_THUMB_MINUTES || "brak"}, node ${process.version}`);

// ============================================================
// MAGAZYNY ZDJĘĆ (opcjonalne)
// Adresy magazynów w zmiennej środowiskowej GALLERY_STORES (po przecinku),
// np. GALLERY_STORES=https://kittylensoj-gallery2.pages.dev
// Brak zmiennej = strona działa dokładnie jak dotąd (tylko lokalne ./images).
// Każdy magazyn wystawia /index.json (generowany przez jego workflow).
// ============================================================
const https = require('https');
const http = require('http');

const STORE_URLS = (process.env.GALLERY_STORES || "")
  .split(",")
  .map(s => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function getJson(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.get(url, { headers: { "Accept": "application/json", "Cache-Control": "no-cache" } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(getJson(new URL(res.headers.location, url).toString(), redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (e) { reject(e); }
      });
    });
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function getJsonRetry(url, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try { return await getJson(url); }
    catch (e) {
      lastErr = e;
      if (i < tries) await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
  throw lastErr;
}

const encSeg = (s) => encodeURIComponent(s);
const encPath = (p) => p.split("/").map(encSeg).join("/");

// Numer z nazwy pliku (taka sama zasada jak dla zdjęć lokalnych)
function nameNumericOf(file) {
  const m = file.match(/\d+/g);
  if (!m || m.length === 0) return null;
  const n = parseInt(m[m.length - 1], 10);
  return Number.isNaN(n) ? null : n;
}

async function fetchStore(base) {
  const url = `${base}/index.json?t=${Date.now()}`;
  let data;
  try {
    data = await getJsonRetry(url);
  } catch (e) {
    // Celowo przerywamy build: lepiej zostawić poprzednią wersję strony
    // niż opublikować galerię bez zdjęć z magazynu.
    throw new Error(`[Magazyn] Nie udało się pobrać ${base}/index.json (${e.message}). Build przerwany.`);
  }
  if (!data || !Array.isArray(data.images)) {
    throw new Error(`[Magazyn] ${base}/index.json ma zły format (brak tablicy "images"). Build przerwany.`);
  }

  const images = [];
  const lenses = new Set();
  for (const e of data.images) {
    if (!e || !e.lens || !e.filename) continue;
    const urlPath = `${base}/images/${encSeg(e.lens)}/${encSeg(e.filename)}`;
    let thumb;
    if (e.t && e.w > 0 && e.h > 0) {
      const src = `${base}/${encPath(e.t)}`;
      thumb = {
        src,
        srcset: `${src} ${e.w}w`,
        sizes: "(max-width: 600px) 100vw, 25vw",
        width: e.w,
        height: e.h
      };
    } else {
      thumb = { src: urlPath, srcset: `${urlPath} 800w`, sizes: "100vw", width: null, height: null };
    }
    lenses.add(e.lens);
    images.push({
      lens: e.lens,
      filename: e.filename,
      path: urlPath,
      mtime: e.mtime || 0,
      nameNumeric: nameNumericOf(e.filename),
      thumb
    });
  }
  console.log(`[Magazyn] ${base}: ${images.length} zdjęć, ${lenses.size} obiektywów`);
  return { base, images, lenses: Array.from(lenses) };
}

let storesPromise = null;

// Miniatury faktycznie używane w tym buildzie (żeby nie kopiować do _site starych z cache)
const usedThumbs = new Set();
function loadStores() {
  if (STORE_URLS.length === 0) return Promise.resolve([]);
  if (!storesPromise) storesPromise = Promise.all(STORE_URLS.map(fetchStore));
  return storesPromise;
}

module.exports = function(eleventyConfig) {
  // Magazyny: pobieraj index.json od nowa przy każdym buildzie (tryb --serve)
  eleventyConfig.on("eleventy.before", () => { storesPromise = null; usedThumbs.clear(); });

  // 1. Watch
  eleventyConfig.addWatchTarget("./lenses/");

  // 2. Kopiowanie assets
  eleventyConfig.addPassthroughCopy({"src/css": "css"});
  eleventyConfig.addPassthroughCopy({"src/js": "js"});
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy({"src/favicon.ico": "favicon.ico"});

  // 3. Kolekcja lenses
  eleventyConfig.addCollection("lenses", function(collectionApi) {
    const lenses = collectionApi.getFilteredByGlob("src/lenses/*.md");
    console.log(`Znaleziono obiektywów: ${lenses.length}`);
    return lenses;
  });

  // 3b. Kolekcja brands
  eleventyConfig.addCollection("brands", function(collectionApi) {
    const brands = collectionApi.getFilteredByGlob("src/brands/*.md");
    console.log(`Znaleziono producentów: ${brands.length}`);
    return brands;
  });

  // 3c. CZYSZCZENIE CACHE W PAMIĘCI ELEVENTY-IMG (zapobiega OOM)
  try {
    const { memCache: imgMemCache } = require("@11ty/eleventy-img/src/caches.js");
    eleventyConfig.on("eleventy.before", () => {
      const size = imgMemCache.size ? imgMemCache.size() : 0;
      if (size > 0) {
        imgMemCache.cache = {};
        console.log(`[eleventy-img] Wyczyszczono cache w pamięci (${size} wpisów).`);
      }
    });
  } catch (e) {
    console.warn("[eleventy-img] Nie udało się załadować modułu cache:", e.message);
  }

  // 4. Kolekcja obrazów z sekwencyjnym przetwarzaniem i limitem na build
  eleventyConfig.addCollection("allImages", async function(collectionApi) {
    const images = [];
    const imagesDir = './images';
    // Cache zapisywany w .cache (Cloudflare Pages zachowuje go po UDANYM buildzie)
    const cacheThumbDir = './.cache/eleventy-img-thumbnails';

    const imgOpts = {
      widths: [640],
      formats: ["webp"],
      outputDir: cacheThumbDir,
      urlPath: "/images/thumbnails/",
      useAbsolutePath: false,
      sharpOptions: { sequentialRead: true, failOn: "none" },
      sharpWebpOptions: { quality: 72, effort: 2 },
      cacheOptions: {
        duration: "30d",
        directory: ".cache/eleventy-img",
      }
    };

    let newThisBuild = 0; // wygenerowane w tym buildzie
    let pending = 0;      // odłożone na kolejne buildy
    let reused = 0;       // już w cache
    let lastLogged = 0;
    const startedAt = Date.now();
    const timeUp = () => MAX_THUMB_MINUTES > 0 && (Date.now() - startedAt) > MAX_THUMB_MINUTES * 60000;

    if (fs.existsSync(imagesDir)) {
      const lensDirs = fs.readdirSync(imagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const lensDir of lensDirs) {
        const lensPath = path.join(imagesDir, lensDir);
        if (!fs.existsSync(lensPath)) continue;

        const imageFiles = fs.readdirSync(lensPath)
          .filter(file => /\.(jpg|jpeg|png|gif|avif|av1|webp)$/i.test(file));

        for (const file of imageFiles) {
          const fullPath = path.join(lensPath, file);
          let mtime = 0;
          try {
            const stats = fs.statSync(fullPath);
            mtime = stats.mtimeMs || stats.mtime?.getTime?.() || 0;
          } catch (e) {
            mtime = 0;
          }

          const urlPath = `/images/${lensDir}/${file}`;
          const fallbackThumb = {
            src: urlPath,
            srcset: `${urlPath} 800w`,
            sizes: "100vw",
            width: null,
            height: null
          };

          let thumb = null;
          try {
            // Czy miniatura już jest w cache na dysku?
            const expectedPath = Image.statsSync(fullPath, imgOpts).webp[0].outputPath;
            const alreadyDone = fs.existsSync(expectedPath);

            const limitHit = (MAX_NEW_THUMBS > 0 && newThisBuild >= MAX_NEW_THUMBS) || timeUp();
            if (!alreadyDone && limitHit) {
              // Limit (liczby lub czasu) wyczerpany – zostaje oryginał, dokończymy w następnym buildzie
              pending++;
              thumb = fallbackThumb;
            } else {
              if (alreadyDone) reused++; else newThisBuild++;

              const metadata = await Image(fullPath, imgOpts);
              const webp = metadata.webp || [];
              if (webp.length > 0) {
                usedThumbs.add(path.basename(webp[0].outputPath));
                thumb = {
                  src: webp[0].url,
                  srcset: webp.map(i => `${i.url} ${i.width}w`).join(", "),
                  sizes: "(max-width: 600px) 100vw, 25vw",
                  width: webp[0].width,
                  height: webp[0].height
                };
              }
            }
          } catch (err) {
            console.warn(`Błąd miniatury ${fullPath}:`, err.message || err);
            thumb = fallbackThumb;
          }

          if (!thumb) thumb = fallbackThumb;

          // Numer z nazwy pliku
          let nameNumeric = null;
          try {
            const digitMatches = file.match(/\d+/g);
            if (digitMatches && digitMatches.length > 0) {
              nameNumeric = parseInt(digitMatches[digitMatches.length - 1], 10);
              if (Number.isNaN(nameNumeric)) nameNumeric = null;
            }
          } catch (e) {
            nameNumeric = null;
          }

          images.push({ lens: lensDir, filename: file, path: urlPath, mtime, nameNumeric, thumb });

          if (newThisBuild > 0 && newThisBuild % 100 === 0 && newThisBuild !== lastLogged) {
            lastLogged = newThisBuild;
            console.log(`[Galeria] Nowych miniatur w tym buildzie: ${newThisBuild}/${MAX_NEW_THUMBS || "∞"}`);
          }
        }
      }
    }

    console.log(`[Galeria] Z cache: ${reused}, nowe: ${newThisBuild}, ODŁOŻONE na kolejne buildy: ${pending}, czas: ${((Date.now() - startedAt) / 60000).toFixed(1)} min`);
    if (pending > 0) {
      console.log(`[Galeria] ⚠️ Zostało ${pending} zdjęć bez miniatur – uruchom kolejny deployment.`);
    }

    // Zdjęcia z magazynów (jeśli ustawiono GALLERY_STORES)
    if (STORE_URLS.length > 0) {
      const seen = new Set(images.map(i => `${i.lens}/${i.filename}`));
      let fromStores = 0;
      let dupes = 0;
      for (const store of await loadStores()) {
        for (const img of store.images) {
          const key = `${img.lens}/${img.filename}`;
          if (seen.has(key)) { dupes++; continue; } // lokalne ma pierwszeństwo
          seen.add(key);
          images.push(img);
          fromStores++;
        }
      }
      console.log(`[Galeria] Z magazynów: ${fromStores}, pominięte duplikaty: ${dupes}`);
    }

    // Sortowanie
    images.sort((a, b) => {
      const aNum = typeof a.nameNumeric === "number" ? a.nameNumeric : -1;
      const bNum = typeof b.nameNumeric === "number" ? b.nameNumeric : -1;
      if (aNum !== bNum) return bNum - aNum;

      const mtimeCmp = (b.mtime || 0) - (a.mtime || 0);
      if (mtimeCmp !== 0) return mtimeCmp;

      const fileCmp = b.filename.localeCompare(a.filename, undefined, { numeric: true, sensitivity: "base" });
      if (fileCmp !== 0) return fileCmp;

      return a.lens.localeCompare(b.lens, undefined, { numeric: true, sensitivity: "base" });
    });

    console.log(`Znaleziono ${images.length} zdjęć (gotowe).`);
    return images;
  });

  // 5. Kolekcja katalogów (lokalne + obiektywy z magazynów)
  eleventyConfig.addCollection("imageFolders", async function(collectionApi) {
    const imagesDir = './images';
    const folders = fs.existsSync(imagesDir)
      ? fs.readdirSync(imagesDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name)
      : [];

    let added = false;
    for (const store of await loadStores()) {
      for (const lens of store.lenses) {
        if (!folders.includes(lens)) { folders.push(lens); added = true; }
      }
    }
    if (added) folders.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return folders;
  });

  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));

  eleventyConfig.addFilter("galleryJson", (images) => {
    if (!Array.isArray(images)) return "[]";
    return JSON.stringify(
      images.map(({ lens, filename, path, thumb }) => ({
        lens,
        filename,
        path,
        src: thumb?.src || path,
        w: thumb?.width || 0,
        h: thumb?.height || 0,
      }))
    );
  });

  // 6. Filtry
  eleventyConfig.addFilter("displayName", (lens) => {
    if (!lens) return "Nieznany obiektyw";
    return lens.data.alias || lens.data.title || lens.fileSlug;
  });

  eleventyConfig.addFilter("groupByLens", (images) => {
    const groups = {};
    if (images && Array.isArray(images)) {
      images.forEach(image => {
        if (!groups[image.lens]) groups[image.lens] = [];
        groups[image.lens].push(image);
      });
    }
    return groups;
  });

  eleventyConfig.addFilter("shuffle", (array) => {
    if (!Array.isArray(array)) return array;
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  // 7. Kopiowanie miniatur z cache do _site po zakończeniu
  eleventyConfig.on("eleventy.after", ({ dir } = {}) => {
    const cacheThumbDir = './.cache/eleventy-img-thumbnails';
    // Eleventy v2 przekazuje katalogi w argumencie zdarzenia (v3 ma też eleventyConfig.directories)
    const outputDir = (dir && dir.output)
      || (eleventyConfig.directories && eleventyConfig.directories.output)
      || "_site";
    const outputThumbDir = path.join(outputDir, "images/thumbnails");
    if (fs.existsSync(cacheThumbDir)) {
      try {
        if (usedThumbs.size > 0) {
          // Tylko miniatury zdjęć, które są teraz w ./images (stare z cache zostają poza wdrożeniem)
          fs.mkdirSync(outputThumbDir, { recursive: true });
          let copied = 0;
          for (const f of usedThumbs) {
            const from = path.join(cacheThumbDir, f);
            if (fs.existsSync(from)) {
              fs.copyFileSync(from, path.join(outputThumbDir, f));
              copied++;
            }
          }
          console.log(`[eleventy-img] Skopiowano ${copied} miniatur do _site.`);
        } else {
          fs.cpSync(cacheThumbDir, outputThumbDir, { recursive: true });
          console.log(`[eleventy-img] Skopiowano miniatury do _site.`);
        }
      } catch (e) {
        console.warn("[eleventy-img] Błąd kopiowania miniatur:", e.message);
      }
    }
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk"
  };
};

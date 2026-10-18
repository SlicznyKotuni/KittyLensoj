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

module.exports = function(eleventyConfig) {
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

            if (!alreadyDone && MAX_NEW_THUMBS > 0 && newThisBuild >= MAX_NEW_THUMBS) {
              // Limit na ten build wyczerpany – zostaje oryginał, dokończymy w następnym buildzie
              pending++;
              thumb = fallbackThumb;
            } else {
              if (alreadyDone) reused++; else newThisBuild++;

              const metadata = await Image(fullPath, imgOpts);
              const webp = metadata.webp || [];
              if (webp.length > 0) {
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

    console.log(`[Galeria] Z cache: ${reused}, nowe: ${newThisBuild}, ODŁOŻONE na kolejne buildy: ${pending}`);
    if (pending > 0) {
      console.log(`[Galeria] ⚠️ Zostało ${pending} zdjęć bez miniatur – uruchom kolejny deployment.`);
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

  // 5. Kolekcja katalogów
  eleventyConfig.addCollection("imageFolders", function(collectionApi) {
    const imagesDir = './images';
    if (!fs.existsSync(imagesDir)) return [];
    return fs.readdirSync(imagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
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
  eleventyConfig.on("eleventy.after", () => {
    const cacheThumbDir = './.cache/eleventy-img-thumbnails';
    const outputThumbDir = path.join(eleventyConfig.directories.output, "images/thumbnails");
    if (fs.existsSync(cacheThumbDir)) {
      try {
        fs.cpSync(cacheThumbDir, outputThumbDir, { recursive: true });
        console.log(`[eleventy-img] Skopiowano miniatury do _site.`);
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

const fs = require('fs');
const path = require('path');
const Image = require("@11ty/eleventy-img");

module.exports = function(eleventyConfig) {
  // 1. Dodaj katalog lenses jako dodatkowy katalog wejściowy
  eleventyConfig.addWatchTarget("./lenses/");
  
  // 2. Kopiowanie assets
  eleventyConfig.addPassthroughCopy({"src/css": "css"});
  eleventyConfig.addPassthroughCopy({"src/js": "js"});
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy({"src/favicon.ico": "favicon.ico"});
  
  // 3. Kolekcja lenses - POPRAWIONE
  eleventyConfig.addCollection("lenses", function(collectionApi) {
    const lenses = collectionApi.getFilteredByGlob("src/lenses/*.md");
    console.log(`Znaleziono obiektywów: ${lenses.length}`);
    return lenses;
  });

  // 3b. Kolekcja brands (producentów)
  eleventyConfig.addCollection("brands", function(collectionApi) {
    const brands = collectionApi.getFilteredByGlob("src/brands/*.md");
    console.log(`Znaleziono producentów: ${brands.length}`);
    return brands;
  });

  // 4. Kolekcja obrazów — zbieramy zdjęcia i generujemy responsywne miniatury (thumbnails)
  eleventyConfig.addCollection("allImages", async function(collectionApi) {
    const images = [];
    const imagesDir = './images';

    if (fs.existsSync(imagesDir)) {
      const lensDirs = fs.readdirSync(imagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      // Process images in parallel for faster builds
      for (const lensDir of lensDirs) {
        const lensPath = path.join(imagesDir, lensDir);
        if (!fs.existsSync(lensPath)) continue;

        const imageFiles = fs.readdirSync(lensPath)
          .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));

        // Process all images in this lens folder in parallel
        const imagePromises = imageFiles.map(async (file) => {
          const fullPath = path.join(lensPath, file);
          let mtime = 0;
          try {
            const stats = fs.statSync(fullPath);
            mtime = stats.mtimeMs || stats.mtime?.getTime?.() || 0;
          } catch (e) {
            mtime = 0;
          }

          const urlPath = `/images/${lensDir}/${file}`;

          // Generate small responsive thumbnails (webp) and return metadata
          let thumb = null;
          try {
            const metadata = await Image(fullPath, {
              widths: [640],
              formats: ["webp"],
              outputDir: "./_site/images/thumbnails",
              urlPath: "/images/thumbnails/",
              // keep generated files deterministic and small
              useAbsolutePath: false
            });

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
          } catch (err) {
            // If generation fails, fall back to original image path
            console.warn(`Thumbnail generation failed for ${fullPath}:`, err.message || err);
            thumb = {
              src: urlPath,
              srcset: `${urlPath} 800w`,
              sizes: "100vw",
              width: null,
              height: null
            };
          }

          // Extract numeric portion from filename (take the last group of digits if any)
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

          return { lens: lensDir, filename: file, path: urlPath, mtime, nameNumeric, thumb };
        });

        const lensImages = await Promise.all(imagePromises);
        images.push(...lensImages);
      }
    }

    // Sort so that files with higher numeric name come first; fallback to mtime when numeric part is missing
    images.sort((a, b) => {
      const aKey = (typeof a.nameNumeric === 'number' ? a.nameNumeric : (a.mtime || 0));
      const bKey = (typeof b.nameNumeric === 'number' ? b.nameNumeric : (b.mtime || 0));
      return bKey - aKey;
    });
    console.log(`Znaleziono ${images.length} zdjęć (posortowano według numeru w nazwie lub daty)`);
    return images;
  });
  
  // 5. Kolekcja katalogów ze zdjęciami
  eleventyConfig.addCollection("imageFolders", function(collectionApi) {
    const imagesDir = './images';
    if (!fs.existsSync(imagesDir)) return [];
    
    return fs.readdirSync(imagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
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
        if (!groups[image.lens]) {
          groups[image.lens] = [];
        }
        groups[image.lens].push(image);
      });
    }
    return groups;
  });

  // Filtr do randomizacji tablicy
  eleventyConfig.addFilter("shuffle", (array) => {
    if (!Array.isArray(array)) return array;
    
    // Fisher-Yates shuffle algorithm
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    // DODAJ TO: Eleventy będzie przetwarzać pliki poza katalogiem src
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk"
  };
};
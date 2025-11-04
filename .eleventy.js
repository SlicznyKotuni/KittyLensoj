const fs = require('fs');
const path = require('path');

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

  // 4. Kolekcja obrazów (to działało, więc zostawiamy)
  eleventyConfig.addCollection("allImages", function(collectionApi) {
    const images = [];
    const imagesDir = './images';
    
    if (fs.existsSync(imagesDir)) {
      const lensDirs = fs.readdirSync(imagesDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      lensDirs.forEach(lensDir => {
        const lensPath = path.join(imagesDir, lensDir);
        if (fs.existsSync(lensPath)) {
          const imageFiles = fs.readdirSync(lensPath)
            .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
            .map(file => ({
              lens: lensDir,
              filename: file,
              path: `/images/${lensDir}/${file}`
            }));
          
          images.push(...imageFiles);
        }
      });
    }
    
    console.log(`Znaleziono ${images.length} zdjęć`);
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
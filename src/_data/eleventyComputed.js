module.exports = {
  layout: function(data) {
    // Only apply default layout to markdown files that don't have one explicitly set
    if (data.page && data.page.inputPath && data.page.inputPath.endsWith('.md')) {
      // If layout is not explicitly set in frontmatter, use the default
      if (!data.layout) {
        return "layout.njk";
      }
    }
    // Return existing layout (or undefined if not set, which is fine)
    return data.layout;
  }
};

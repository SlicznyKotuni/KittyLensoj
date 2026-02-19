/**
 * Tag-based lens filtering system
 */

document.addEventListener('DOMContentLoaded', function() {
    const grid = document.getElementById('lens-grid');
    const noResults = document.getElementById('no-results');
    const tagsContainer = document.getElementById('tags-container');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const lensCount = document.getElementById('lens-count');
    const tagSearchInput = document.getElementById('tag-search');
    
    let selectedTags = new Set();
    let allTags = new Map(); // tag -> count
    let searchQuery = '';
    
    // Initialize: collect all tags and their counts
    function initializeTags() {
        if (!window.lensesData) return;
        
        window.lensesData.forEach(lens => {
            lens.tags.forEach(tag => {
                if (allTags.has(tag)) {
                    allTags.set(tag, allTags.get(tag) + 1);
                } else {
                    allTags.set(tag, 1);
                }
            });
        });
        
        renderTagButtons();
        setupSearch();
    }
    
    // Setup search input
    function setupSearch() {
        tagSearchInput.addEventListener('input', function(e) {
            searchQuery = e.target.value.toLowerCase();
            renderTagButtons();
        });
    }
    
    // Render tag buttons in sidebar
    function renderTagButtons() {
        tagsContainer.innerHTML = '';
        
        // Sort tags alphabetically
        let sortedTags = Array.from(allTags.keys()).sort();
        
        // Filter tags based on search query
        if (searchQuery) {
            sortedTags = sortedTags.filter(tag => 
                tag.toLowerCase().includes(searchQuery)
            );
        }
        
        if (sortedTags.length === 0 && searchQuery) {
            tagsContainer.innerHTML = '<p class="no-tags-found">Brak tagów</p>';
            return;
        }
        
        sortedTags.forEach(tag => {
            const count = allTags.get(tag);
            const button = document.createElement('button');
            button.className = 'tag-button';
            button.dataset.tag = tag;
            button.innerHTML = `<span class="tag-name">${tag}</span><span class="tag-count">${count}</span>`;
            
            button.addEventListener('click', function(e) {
                e.preventDefault();
                toggleTag(tag, button);
            });
            
            tagsContainer.appendChild(button);
        });
    }
    
    // Toggle tag selection
    function toggleTag(tag, button) {
        if (selectedTags.has(tag)) {
            selectedTags.delete(tag);
            button.classList.remove('active');
        } else {
            selectedTags.add(tag);
            button.classList.add('active');
        }
        
        updateClearButton();
        filterLenses();
    }
    
    // Update clear filters button visibility
    function updateClearButton() {
        if (selectedTags.size > 0) {
            clearFiltersBtn.style.display = 'inline-block';
        } else {
            clearFiltersBtn.style.display = 'none';
        }
    }
    
    // Clear all filters
    clearFiltersBtn.addEventListener('click', function() {
        selectedTags.clear();
        document.querySelectorAll('.tag-button.active').forEach(btn => {
            btn.classList.remove('active');
        });
        updateClearButton();
        filterLenses();
    });
    
    // Filter lenses based on selected tags
    function filterLenses() {
        const tiles = grid.querySelectorAll('.tile');
        let visibleCount = 0;
        
        tiles.forEach(tile => {
            if (selectedTags.size === 0) {
                // No filters - show all
                tile.style.display = '';
                visibleCount++;
            } else {
                // Check if tile has all selected tags
                const tileTags = tile.dataset.tags ? tile.dataset.tags.split(',') : [];
                const hasAllTags = Array.from(selectedTags).every(tag => tileTags.includes(tag));
                
                if (hasAllTags) {
                    tile.style.display = '';
                    visibleCount++;
                } else {
                    tile.style.display = 'none';
                }
            }
        });
        
        // Show/hide no results message
        if (visibleCount === 0) {
            noResults.style.display = 'grid';
        } else {
            noResults.style.display = 'none';
        }
        
        // Update lens count
        lensCount.textContent = visibleCount;
    }
    
    // Initialize
    initializeTags();
});

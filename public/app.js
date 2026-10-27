/**
 * DAPUR 500 — Application Logic
 * Modern, responsive culinary browser with Peti Ais matcher & dual theme support
 */

document.addEventListener('DOMContentLoaded', () => {
  // Master state
  const state = {
    recipes: [],
    filtered: [],
    searchQuery: '',
    selectedBook: 'all',
    selectedCategory: 'all',
    currentView: 'all', // 'all' | 'fridge' | 'saved'
    selectedPantry: new Set(),
    bookmarks: new Set(JSON.parse(localStorage.getItem('dapur500_saved') || '[]')),
    sortBy: 'book',
    page: 1,
    pageSize: 24,
    activeRecipe: null,
    checkedIngredients: new Set()
  };

  // Pantry common ingredients
  const PANTRY_ITEMS = [
    'ayam', 'telur', 'daging', 'ikan', 'udang', 'sotong', 'nasi', 'mee',
    'roti', 'pasta', 'kentang', 'bawang', 'cili', 'santan', 'keju', 'kicap',
    'cendawan', 'sayur', 'madu', 'coklat', 'oat', 'pisang', 'lemon'
  ];

  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const viewTabs = document.querySelectorAll('.view-tab');
  const fridgePanel = document.getElementById('fridgePanel');
  const pantryChipsContainer = document.getElementById('pantryChips');
  const customIngredientInput = document.getElementById('customIngredientInput');
  const addCustomIngredientBtn = document.getElementById('addCustomIngredientBtn');
  const resetFridgeBtn = document.getElementById('resetFridgeBtn');
  const bookChipsContainer = document.getElementById('bookChips');
  const categoryChipsContainer = document.getElementById('categoryChips');
  const activeFiltersSummary = document.getElementById('activeFiltersSummary');
  const displayedCount = document.getElementById('displayedCount');
  const totalCount = document.getElementById('totalCount');
  const sortSelect = document.getElementById('sortSelect');
  const recipeGrid = document.getElementById('recipeGrid');
  const emptyState = document.getElementById('emptyState');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const remainingCount = document.getElementById('remainingCount');
  const savedCountBadge = document.getElementById('savedCountBadge');
  const btnBookmarksTab = document.getElementById('btnBookmarksTab');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const toast = document.getElementById('toast');

  // Modal elements
  const recipeModal = document.getElementById('recipeModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBookBadge = document.getElementById('modalBookBadge');
  const modalCatBadge = document.getElementById('modalCatBadge');
  const modalPageBadge = document.getElementById('modalPageBadge');
  const modalRecipeTitle = document.getElementById('modalRecipeTitle');
  const modalRecipeDesc = document.getElementById('modalRecipeDesc');
  const modalBookmarkBtn = document.getElementById('modalBookmarkBtn');
  const modalCopyBtn = document.getElementById('modalCopyBtn');
  const modalPrintBtn = document.getElementById('modalPrintBtn');
  const tabBtnText = document.getElementById('tabBtnText');
  const tabBtnPdf = document.getElementById('tabBtnPdf');
  const modalTextView = document.getElementById('modalTextView');
  const modalPdfView = document.getElementById('modalPdfView');
  const modalIngredientsList = document.getElementById('modalIngredientsList');
  const modalStepsList = document.getElementById('modalStepsList');
  const modalTipsWrap = document.getElementById('modalTipsWrap');
  const modalTipsContent = document.getElementById('modalTipsContent');
  const switchToPdfBtn = document.getElementById('switchToPdfBtn');
  const pdfPageIndicator = document.getElementById('pdfPageIndicator');
  const openFullPdfLink = document.getElementById('openFullPdfLink');
  const pdfCanvas = document.getElementById('pdfCanvas');
  const pdfCanvasContainer = document.getElementById('pdfCanvasContainer');
  const pdfLoadingNotice = document.getElementById('pdfLoadingNotice');
  const pdfZoomInBtn = document.getElementById('pdfZoomInBtn');
  const pdfZoomOutBtn = document.getElementById('pdfZoomOutBtn');
  const pdfZoomLevel = document.getElementById('pdfZoomLevel');
  const printContainer = document.getElementById('printContainer');

  // PDF.js State & Cache
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  let currentRenderTask = null;
  let pdfScale = 1.3;
  const pdfDocCache = new Map();

  async function loadAndRenderPdfPage(filename, pageNum) {
    if (!window.pdfjsLib || !pdfCanvas) return;

    pdfLoadingNotice.style.display = 'flex';
    pdfCanvas.style.display = 'none';

    if (currentRenderTask) {
      try { currentRenderTask.cancel(); } catch (e) {}
    }

    try {
      const pdfUrl = `pdf/${encodeURIComponent(filename)}`;
      let pdfDoc = pdfDocCache.get(filename);
      if (!pdfDoc) {
        pdfDoc = await window.pdfjsLib.getDocument(pdfUrl).promise;
        pdfDocCache.set(filename, pdfDoc);
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: pdfScale });

      const ctx = pdfCanvas.getContext('2d');
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;

      currentRenderTask = page.render({
        canvasContext: ctx,
        viewport: viewport
      });

      await currentRenderTask.promise;
      pdfLoadingNotice.style.display = 'none';
      pdfCanvas.style.display = 'block';
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('PDF render error:', err);
        pdfLoadingNotice.innerHTML = `
          <div style="color: #ef4444; font-weight: 600;">Gagal memuatkan paparan PDF</div>
          <p style="font-size: 13px; margin: 4px 0;">Sila buka terus fail PDF penuh melalui pautan di atas.</p>
        `;
      }
    }
  }

  // Zoom handlers
  if (pdfZoomInBtn && pdfZoomOutBtn) {
    pdfZoomInBtn.addEventListener('click', () => {
      if (pdfScale < 2.5) {
        pdfScale += 0.25;
        pdfZoomLevel.textContent = `${Math.round((pdfScale / 1.3) * 100)}%`;
        if (state.activeRecipe) {
          loadAndRenderPdfPage(state.activeRecipe.pdfFilename, state.activeRecipe.page);
        }
      }
    });

    pdfZoomOutBtn.addEventListener('click', () => {
      if (pdfScale > 0.6) {
        pdfScale -= 0.25;
        pdfZoomLevel.textContent = `${Math.round((pdfScale / 1.3) * 100)}%`;
        if (state.activeRecipe) {
          loadAndRenderPdfPage(state.activeRecipe.pdfFilename, state.activeRecipe.page);
        }
      }
    });
  }

  // Initialize Theme
  function initTheme() {
    const savedTheme = localStorage.getItem('dapur500_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('dapur500_theme', newTheme);
    showToast(`Tema ditukar kepada: ${newTheme === 'dark' ? 'Mod Gelap' : 'Mod Cerah'}`);
  }

  themeToggleBtn.addEventListener('click', toggleTheme);
  initTheme();

  // Show Toast
  let toastTimer = null;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Update Bookmark Badge
  function updateBookmarkBadge() {
    const count = state.bookmarks.size;
    savedCountBadge.textContent = count;
  }

  // Save Bookmarks to LocalStorage
  function saveBookmarks() {
    localStorage.setItem('dapur500_saved', JSON.stringify(Array.from(state.bookmarks)));
    updateBookmarkBadge();
  }

  // Toggle Bookmark for a Recipe
  function toggleBookmark(recipeId, e) {
    if (e) e.stopPropagation();
    if (state.bookmarks.has(recipeId)) {
      state.bookmarks.delete(recipeId);
      showToast('Dikeluarkan dari resipi kegemaran');
    } else {
      state.bookmarks.add(recipeId);
      showToast('Disimpan dalam resipi kegemaran');
    }
    saveBookmarks();
    if (state.currentView === 'saved') {
      applyFilters();
    } else {
      updateCardBookmarkState(recipeId);
    }
    if (state.activeRecipe && state.activeRecipe.id === recipeId) {
      modalBookmarkBtn.classList.toggle('saved', state.bookmarks.has(recipeId));
    }
  }

  function updateCardBookmarkState(recipeId) {
    const btn = document.querySelector(`.bookmark-icon-btn[data-id="${recipeId}"]`);
    if (btn) {
      btn.classList.toggle('saved', state.bookmarks.has(recipeId));
    }
  }

  // Render Book Chips
  function renderBookChips() {
    const books = [
      { code: 'all', label: 'Semua Ebook', count: state.recipes.length },
      { code: 'air-fryer', label: 'Air Fryer', count: 115 },
      { code: 'jimat-poket', label: 'Jimat Poket', count: 100 },
      { code: 'thai', label: 'Masakan Thai', count: 52 },
      { code: 'western', label: 'Western Padu', count: 51 },
      { code: 'sihat', label: 'Sihat Tanpa Gula & Sos', count: 50 },
      { code: 'klasik-tradisional', label: 'Klasik Tradisional', count: 30 },
      { code: 'rice-cooker', label: 'Rice Cooker', count: 30 },
      { code: 'dessert', label: 'Dessert & Kek', count: 30 },
      { code: 'pizza', label: 'Pizza', count: 30 },
      { code: 'low-calorie', label: 'Low Calorie', count: 30 }
    ];

    bookChipsContainer.innerHTML = '';
    books.forEach(b => {
      const chip = document.createElement('button');
      chip.className = `chip ${state.selectedBook === b.code ? 'active' : ''}`;
      chip.innerHTML = `${b.label} <span class="chip-count">(${b.count})</span>`;
      chip.addEventListener('click', () => {
        state.selectedBook = b.code;
        state.page = 1;
        renderBookChips();
        applyFilters();
      });
      bookChipsContainer.appendChild(chip);
    });
  }

  // Render Category Chips
  function renderCategoryChips() {
    // Collect unique categories
    const categories = ['Semua', 'Ayam', 'Daging', 'Ikan & Makanan Laut', 'Nasi', 'Mee & Pasta', 'Sayur', 'Sarapan', 'Snek & Kudapan', 'Kek & Dessert', 'Pizza', 'Diet / Sihat'];

    categoryChipsContainer.innerHTML = '';
    categories.forEach(cat => {
      const code = cat.toLowerCase();
      const isActive = state.selectedCategory === code || (cat === 'Semua' && state.selectedCategory === 'all');
      const chip = document.createElement('button');
      chip.className = `chip ${isActive ? 'active' : ''}`;
      chip.textContent = cat;
      chip.addEventListener('click', () => {
        state.selectedCategory = cat === 'Semua' ? 'all' : code;
        state.page = 1;
        renderCategoryChips();
        applyFilters();
      });
      categoryChipsContainer.appendChild(chip);
    });
  }

  // Render Pantry Chips (Peti Ais)
  function renderPantryChips() {
    pantryChipsContainer.innerHTML = '';
    PANTRY_ITEMS.forEach(item => {
      const isSelected = state.selectedPantry.has(item);
      const chip = document.createElement('button');
      chip.className = `pantry-chip ${isSelected ? 'active' : ''}`;
      chip.textContent = item.charAt(0).toUpperCase() + item.slice(1);
      chip.addEventListener('click', () => {
        if (state.selectedPantry.has(item)) {
          state.selectedPantry.delete(item);
        } else {
          state.selectedPantry.add(item);
        }
        chip.classList.toggle('active', state.selectedPantry.has(item));
        applyFilters();
      });
      pantryChipsContainer.appendChild(chip);
    });
  }

  // Add Custom Pantry Ingredient
  function addCustomPantryIngredient() {
    const val = customIngredientInput.value.trim().toLowerCase();
    if (!val) return;
    if (!PANTRY_ITEMS.includes(val)) {
      PANTRY_ITEMS.push(val);
    }
    state.selectedPantry.add(val);
    customIngredientInput.value = '';
    renderPantryChips();
    applyFilters();
  }

  addCustomIngredientBtn.addEventListener('click', addCustomPantryIngredient);
  customIngredientInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomPantryIngredient();
  });

  resetFridgeBtn.addEventListener('click', () => {
    state.selectedPantry.clear();
    renderPantryChips();
    applyFilters();
    showToast('Peti Ais dikosongkan');
  });

  // Switch Active View Tab
  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const view = tab.dataset.view;
      state.currentView = view;
      state.page = 1;

      if (view === 'fridge') {
        fridgePanel.style.display = 'flex';
        sortSelect.querySelector('option[value="fridge-match"]').disabled = false;
        state.sortBy = 'fridge-match';
        sortSelect.value = 'fridge-match';
      } else {
        fridgePanel.style.display = 'none';
        sortSelect.querySelector('option[value="fridge-match"]').disabled = true;
        if (state.sortBy === 'fridge-match') {
          state.sortBy = 'book';
          sortSelect.value = 'book';
        }
      }

      applyFilters();
    });
  });

  btnBookmarksTab.addEventListener('click', () => {
    const savedTab = document.querySelector('.view-tab[data-view="saved"]');
    if (savedTab) savedTab.click();
  });

  // Search input handler with debounce
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    searchTimer = setTimeout(() => {
      state.searchQuery = searchInput.value.trim().toLowerCase();
      state.page = 1;
      applyFilters();
    }, 120);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    state.searchQuery = '';
    state.page = 1;
    applyFilters();
    searchInput.focus();
  });

  sortSelect.addEventListener('change', () => {
    state.sortBy = sortSelect.value;
    sortAndRender();
  });

  resetFiltersBtn.addEventListener('click', () => {
    state.searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    state.selectedBook = 'all';
    state.selectedCategory = 'all';
    state.selectedPantry.clear();
    state.page = 1;
    renderBookChips();
    renderCategoryChips();
    renderPantryChips();
    applyFilters();
  });

  // Filter Algorithm
  function applyFilters() {
    let list = state.recipes;

    // View filter: Saved
    if (state.currentView === 'saved') {
      list = list.filter(r => state.bookmarks.has(r.id));
    }

    // Book filter
    if (state.selectedBook !== 'all') {
      list = list.filter(r => r.bookCode === state.selectedBook);
    }

    // Category filter
    if (state.selectedCategory !== 'all') {
      const q = state.selectedCategory;
      list = list.filter(r => {
        const cat = r.category.toLowerCase();
        const tags = (r.tags || []).map(t => t.toLowerCase());
        const title = r.title.toLowerCase();
        return cat.includes(q) || tags.some(t => t.includes(q)) || title.includes(q);
      });
    }

    // Text search filter
    if (state.searchQuery) {
      const terms = state.searchQuery.split(/\s+/).filter(Boolean);
      list = list.filter(r => {
        const title = r.title.toLowerCase();
        const book = r.bookTitle.toLowerCase();
        const cat = r.category.toLowerCase();
        const tags = (r.tags || []).join(' ').toLowerCase();
        const ings = (r.ingredients || []).join(' ').toLowerCase();
        const haystack = `${title} ${book} ${cat} ${tags} ${ings}`;
        return terms.every(term => haystack.includes(term));
      });
    }

    // Peti Ais (Fridge) Matching
    if (state.currentView === 'fridge' && state.selectedPantry.size > 0) {
      const pantryList = Array.from(state.selectedPantry);
      list = list.map(r => {
        const haystack = [r.title, r.category, ...(r.tags || []), ...(r.ingredients || [])].join(' ').toLowerCase();
        let matchCount = 0;
        const matchedItems = [];
        pantryList.forEach(item => {
          if (haystack.includes(item)) {
            matchCount++;
            matchedItems.push(item);
          }
        });
        return { ...r, matchCount, matchedItems };
      }).filter(r => r.matchCount > 0);
    }

    state.filtered = list;
    sortAndRender();
  }

  // Sorting
  function sortAndRender() {
    let sorted = [...state.filtered];

    if (state.sortBy === 'fridge-match') {
      sorted.sort((a, b) => (b.matchCount || 0) - (a.matchCount || 0));
    } else if (state.sortBy === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      // Default: book order
      sorted.sort((a, b) => {
        if (a.bookCode === b.bookCode) return a.num - b.num;
        return a.id.localeCompare(b.id);
      });
    }

    state.filtered = sorted;
    renderResults();
  }

  // Render Grid
  function renderResults() {
    const total = state.filtered.length;
    displayedCount.textContent = total;

    // Filter summary pill
    const summaries = [];
    if (state.selectedBook !== 'all') {
      const chip = document.querySelector(`.book-chips .chip.active`);
      if (chip) summaries.push(chip.textContent.split('(')[0].trim());
    }
    if (state.selectedCategory !== 'all') {
      summaries.push(`Kategori: ${state.selectedCategory}`);
    }
    if (state.searchQuery) {
      summaries.push(`"${state.searchQuery}"`);
    }
    activeFiltersSummary.textContent = summaries.length ? `• ${summaries.join(' • ')}` : '';

    if (total === 0) {
      recipeGrid.innerHTML = '';
      emptyState.style.display = 'flex';
      loadMoreContainer.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';

    // Pagination slice
    const visibleCount = state.page * state.pageSize;
    const visibleRecipes = state.filtered.slice(0, visibleCount);

    recipeGrid.innerHTML = '';
    const frag = document.createDocumentFragment();

    visibleRecipes.forEach(r => {
      const card = createRecipeCard(r);
      frag.appendChild(card);
    });

    recipeGrid.appendChild(frag);

    // Load more button logic
    if (visibleCount < total) {
      loadMoreContainer.style.display = 'flex';
      remainingCount.textContent = total - visibleCount;
    } else {
      loadMoreContainer.style.display = 'none';
    }
  }

  // Create Card Element
  function createRecipeCard(r) {
    const isSaved = state.bookmarks.has(r.id);
    const card = document.createElement('article');
    card.className = 'recipe-card';
    card.setAttribute('tabindex', '0');

    // Tags preview
    const tagsPreview = (r.tags || []).slice(0, 3).map(t => `<span class="mini-tag">${t}</span>`).join('');

    // Fridge match badge if any
    const matchHtml = (r.matchCount && r.matchCount > 0)
      ? `<div class="card-match-badge">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
           Padan ${r.matchCount} bahan (${r.matchedItems.slice(0, 2).join(', ')})
         </div>`
      : '';

    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="book-tag">${r.bookShort}</span>
          <button class="bookmark-icon-btn ${isSaved ? 'saved' : ''}" data-id="${r.id}" title="Simpan Resipi" aria-label="Simpan Resipi">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>

        <h3 class="card-title">${r.title}</h3>
        ${matchHtml}
        ${r.description ? `<p class="card-desc">${r.description}</p>` : ''}

        <div class="card-tags">
          <span class="mini-tag" style="font-weight: 600; color: var(--text-secondary);">${r.category}</span>
          ${tagsPreview}
        </div>
      </div>

      <div class="card-footer">
        <span class="page-info">Muka Surat ${r.page}</span>
        <span class="view-link">
          Lihat Resipi
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
      </div>
    `;

    // Click handler for card
    card.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-icon-btn')) {
        toggleBookmark(r.id, e);
      } else {
        openRecipeModal(r);
      }
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openRecipeModal(r);
    });

    return card;
  }

  // Load More Button
  loadMoreBtn.addEventListener('click', () => {
    state.page++;
    renderResults();
  });

  // Modal Open & Render
  function openRecipeModal(r) {
    state.activeRecipe = r;
    state.checkedIngredients.clear();

    modalRecipeTitle.textContent = r.title;
    modalRecipeDesc.textContent = r.description || `${r.category} • Ebook: ${r.bookTitle}`;
    modalBookBadge.textContent = r.bookShort;
    modalCatBadge.textContent = r.category;
    modalPageBadge.textContent = `Halaman ${r.page}`;

    // Bookmark state in modal
    modalBookmarkBtn.classList.toggle('saved', state.bookmarks.has(r.id));

    // Render Ingredients Checklist
    modalIngredientsList.innerHTML = '';
    if (r.ingredients && r.ingredients.length) {
      r.ingredients.forEach((ing, idx) => {
        const raw = ing.trim();
        if (raw.startsWith('---')) {
          const headerLi = document.createElement('li');
          headerLi.className = 'checklist-section-header';
          headerLi.textContent = raw.replace(/[\-—]/g, '').trim();
          modalIngredientsList.appendChild(headerLi);
          return;
        }

        let cleanText = raw;
        const unitMatch = raw.match(/\b(\d+[\/\d\.]*\s*(keping|sudu\s+besar|sudu\s+kecil|sudu|cawan|g|kg|ml|biji|ulas|batang|helai|inci|ikat|ekor|paket|tin|kotak|bungkus)\b.*)/i);
        if (unitMatch) {
          cleanText = unitMatch[1];
        }

        const li = document.createElement('li');
        li.className = 'checklist-item';
        const checkboxId = `ing_${r.id}_${idx}`;
        li.innerHTML = `
          <input type="checkbox" id="${checkboxId}">
          <label for="${checkboxId}"><span>${cleanText}</span></label>
        `;

        const chk = li.querySelector('input');
        chk.addEventListener('change', () => {
          li.classList.toggle('done', chk.checked);
        });

        modalIngredientsList.appendChild(li);
      });
    }

    // Render Steps
    modalStepsList.innerHTML = '';
    if (r.steps && r.steps.length) {
      r.steps.forEach(st => {
        const raw = st.trim();
        if (raw.startsWith('---')) {
          const headerLi = document.createElement('li');
          headerLi.className = 'steps-section-header';
          headerLi.textContent = raw.replace(/[\-—]/g, '').trim();
          modalStepsList.appendChild(headerLi);
          return;
        }

        let cleanStep = raw.replace(/^[^\w\d\(\)]+/, '').replace(/^[a-z0-9]{1,4}\s+[\(\/\\\|\@\*\•\s]+/i, '').trim();
        if (cleanStep.length > 5) {
          const li = document.createElement('li');
          li.textContent = cleanStep;
          modalStepsList.appendChild(li);
        }
      });
    }

    // Tips (if present)
    if (r.tips && r.tips.length) {
      modalTipsWrap.style.display = 'block';
      modalTipsContent.innerHTML = r.tips.join('<br>');
    } else {
      modalTipsWrap.style.display = 'none';
    }

    // Setup PDF View Info
    pdfPageIndicator.textContent = `${r.bookShort || r.bookTitle} — Halaman ${r.page}`;
    openFullPdfLink.href = `pdf/${encodeURIComponent(r.pdfFilename)}`;
    openFullPdfLink.title = `Buka atau muat turun ${r.pdfFilename}`;

    pdfScale = 1.3;
    if (pdfZoomLevel) pdfZoomLevel.textContent = '100%';

    // Default tab: show checklist & cooking steps first!
    switchModalTab('text');

    recipeModal.classList.add('open');
    recipeModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeRecipeModal() {
    recipeModal.classList.remove('open');
    recipeModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (currentRenderTask) {
      try { currentRenderTask.cancel(); } catch (e) {}
    }
    state.activeRecipe = null;
  }

  modalCloseBtn.addEventListener('click', closeRecipeModal);
  recipeModal.addEventListener('click', (e) => {
    if (e.target === recipeModal) closeRecipeModal();
  });

  // Switch Modal Tab
  function switchModalTab(tabName) {
    if (tabName === 'text') {
      tabBtnText.classList.add('active');
      tabBtnPdf.classList.remove('active');
      modalTextView.classList.add('active');
      modalPdfView.classList.remove('active');
    } else {
      tabBtnPdf.classList.add('active');
      tabBtnText.classList.remove('active');
      modalPdfView.classList.add('active');
      modalTextView.classList.remove('active');
      if (state.activeRecipe) {
        loadAndRenderPdfPage(state.activeRecipe.pdfFilename, state.activeRecipe.page);
      }
    }
  }

  tabBtnText.addEventListener('click', () => switchModalTab('text'));
  tabBtnPdf.addEventListener('click', () => switchModalTab('pdf'));
  switchToPdfBtn.addEventListener('click', () => switchModalTab('pdf'));

  // Modal Bookmark Button
  modalBookmarkBtn.addEventListener('click', () => {
    if (state.activeRecipe) {
      toggleBookmark(state.activeRecipe.id);
    }
  });

  // Modal Copy Button
  modalCopyBtn.addEventListener('click', () => {
    if (!state.activeRecipe) return;
    const r = state.activeRecipe;
    const textLines = [
      `DAPUR 500: ${r.title.toUpperCase()}`,
      `Buku: ${r.bookTitle} (Halaman ${r.page})`,
      `Kategori: ${r.category}`,
      '',
      '=== BAHAN-BAHAN ===',
      ...(r.ingredients || []).map(i => `• ${i}`),
      '',
      '=== CARA PENYEDIAAN ===',
      ...(r.steps || []).map((s, idx) => `${idx + 1}. ${s}`)
    ];
    if (r.tips && r.tips.length) {
      textLines.push('', '=== TIP MASAKAN ===', ...r.tips);
    }

    navigator.clipboard.writeText(textLines.join('\n')).then(() => {
      showToast('Resipi telah disalin ke papan keratan (clipboard)!');
    }).catch(() => {
      showToast('Gagal menyalin resipi');
    });
  });

  // Modal Print Button
  modalPrintBtn.addEventListener('click', () => {
    if (!state.activeRecipe) return;
    const r = state.activeRecipe;
    printContainer.innerHTML = `
      <h1 style="font-size: 22pt; margin-bottom: 4px;">${r.title}</h1>
      <p style="font-size: 11pt; color: #555; margin-bottom: 20px;">
        ${r.bookTitle} • Kategori: ${r.category} • Halaman ${r.page}
      </p>

      <h2 style="font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px;">Bahan-Bahan</h2>
      <ul style="margin: 10px 0 20px 20px;">
        ${(r.ingredients || []).map(i => `<li>${i}</li>`).join('')}
      </ul>

      <h2 style="font-size: 14pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px;">Cara Memasak</h2>
      <ol style="margin: 10px 0 20px 20px;">
        ${(r.steps || []).map(s => `<li style="margin-bottom: 8px;">${s}</li>`).join('')}
      </ol>
    `;
    window.print();
  });

  // Global Keydown shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && recipeModal.classList.contains('open')) {
      closeRecipeModal();
    }
    if (e.key === '/' && document.activeElement !== searchInput && !recipeModal.classList.contains('open')) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // Fetch Recipe Data & Start
  async function loadData() {
    try {
      const res = await fetch('recipes.json');
      if (!res.ok) throw new Error('Failed to load recipes.json');
      const data = await res.json();
      state.recipes = data;
      state.filtered = data;

      totalCount.textContent = data.length;
      displayedCount.textContent = data.length;

      updateBookmarkBadge();
      renderBookChips();
      renderCategoryChips();
      renderPantryChips();
      renderResults();

      console.log(`DAPUR 500 loaded ${data.length} recipes successfully.`);
    } catch (err) {
      console.error(err);
      recipeGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <h3>Ralat memuatkan data resipi</h3>
          <p>Sila pastikan server berjalan dan fail recipes.json wujud.</p>
        </div>
      `;
    }
  }

  loadData();
});

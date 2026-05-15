/* =========================================================
   Mar de Histórias — catálogo
   Busca, filtros, ordenação e estado vazio
   ========================================================= */

(() => {
  'use strict';

  const normalize = (value = '') =>
    value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const parsePrice = (value = '') => Number(String(value).replace(',', '.')) || 0;

  const matchesPriceRange = (price, range) => {
    if (!range) return true;
    if (range === 'ate-50') return price <= 50;
    if (range === '50-80') return price > 50 && price <= 80;
    if (range === 'acima-80') return price > 80;
    return true;
  };

  const page = document.body;
  if (page?.dataset.page !== 'catalogo') return;

  const grid = document.getElementById('catalogGrid');
  const empty = document.getElementById('catalogEmpty');
  const resultCount = document.getElementById('resultCount');
  const categoryFilter = document.getElementById('categoryFilter');
  const authorFilter = document.getElementById('authorFilter');
  const priceFilter = document.getElementById('priceFilter');
  const sortSelect = document.getElementById('sortSelect');
  const clearFilters = document.getElementById('clearFilters');
  const searchForm = document.querySelector('.search');
  const searchInput = searchForm?.querySelector('input');

  if (!grid || !empty || !resultCount) return;

  const getCards = () => Array.from(grid.querySelectorAll('.catalog-book-link'));

  const updateUrlSearch = (value) => {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set('busca', value);
    } else {
      url.searchParams.delete('busca');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const sortCards = () => {
    const cards = getCards();
    const type = sortSelect?.value || 'featured';

    cards.sort((a, b) => {
      const titleA = normalize(a.dataset.title);
      const titleB = normalize(b.dataset.title);
      const priceA = parsePrice(a.dataset.price);
      const priceB = parsePrice(b.dataset.price);
      const rankA = Number(a.dataset.rank || 0);
      const rankB = Number(b.dataset.rank || 0);

      if (type === 'price-asc') return priceA - priceB;
      if (type === 'price-desc') return priceB - priceA;
      if (type === 'title-asc') return titleA.localeCompare(titleB, 'pt-BR');
      if (type === 'title-desc') return titleB.localeCompare(titleA, 'pt-BR');
      return rankA - rankB;
    });

    cards.forEach((card) => grid.appendChild(card));
  };

  const applyFilters = () => {
    const cards = getCards();
    const query = normalize(searchInput?.value || '');
    const category = normalize(categoryFilter?.value || '');
    const author = normalize(authorFilter?.value || '');
    const priceRange = priceFilter?.value || '';

    let visible = 0;

    cards.forEach((card) => {
      const title = normalize(card.dataset.title);
      const cardAuthor = normalize(card.dataset.author);
      const cardCategory = normalize(card.dataset.category);
      const cardPrice = parsePrice(card.dataset.price);

      const searchText = `${title} ${cardAuthor} ${cardCategory}`;
      const matchesQuery = !query || searchText.includes(query);
      const matchesCategory = !category || cardCategory === category;
      const matchesAuthor = !author || cardAuthor === author;
      const matchesPrice = matchesPriceRange(cardPrice, priceRange);

      const show = matchesQuery && matchesCategory && matchesAuthor && matchesPrice;
      card.classList.toggle('is-hidden', !show);
      if (show) visible += 1;
    });

    resultCount.textContent = visible === 1 ? '1 livro encontrado' : `${visible} livros encontrados`;
    empty.hidden = visible !== 0;
    updateUrlSearch(searchInput?.value.trim() || '');
  };

  const resetFilters = () => {
    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (authorFilter) authorFilter.value = '';
    if (priceFilter) priceFilter.value = '';
    if (sortSelect) sortSelect.value = 'featured';
    sortCards();
    applyFilters();
  };

  const initSearchFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('busca') || '';
    if (searchInput && search) {
      searchInput.value = search;
    }
  };

  searchInput?.addEventListener('input', applyFilters);

  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });

  [categoryFilter, authorFilter, priceFilter].forEach((control) => {
    control?.addEventListener('change', applyFilters);
  });

  sortSelect?.addEventListener('change', () => {
    sortCards();
    applyFilters();
  });

  clearFilters?.addEventListener('click', resetFilters);

  document.addEventListener('DOMContentLoaded', () => {
    initSearchFromUrl();
    sortCards();
    applyFilters();
  });
})();

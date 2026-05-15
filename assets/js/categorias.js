/* =========================================================
   Mar de Histórias — categorias
   Filtro da vitrine geral e ordenação das páginas internas
   ========================================================= */

(() => {
  'use strict';

  const page = document.body?.dataset.page || '';

  const normalize = (value = '') =>
    value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const toNumber = (value = '') => Number(String(value).replace(',', '.')) || 0;

  const initOverview = () => {
    const input = document.getElementById('categoryExplorerSearch');
    const cards = Array.from(document.querySelectorAll('[data-category-card]'));
    const empty = document.getElementById('categoriesEmpty');

    if (!input || !cards.length) return;

    const applyFilter = () => {
      const query = normalize(input.value);
      let visible = 0;

      cards.forEach((card) => {
        const content = normalize(
          `${card.dataset.categoryName || ''} ${card.dataset.categoryDescription || ''} ${card.textContent || ''}`
        );
        const show = !query || content.includes(query);
        card.classList.toggle('is-hidden', !show);
        if (show) visible += 1;
      });

      if (empty) empty.hidden = visible !== 0;
    };

    input.addEventListener('input', applyFilter);
    applyFilter();
  };

  const initDetail = () => {
    const grid = document.getElementById('categoryGrid');
    const cards = () => Array.from(grid?.querySelectorAll('.category-book-link') || []);
    const input = document.getElementById('categoryBookSearch');
    const sort = document.getElementById('categorySort');
    const count = document.getElementById('categoryResultCount');
    const empty = document.getElementById('categoryEmpty');

    if (!grid) return;

    const visibleCards = () =>
      cards().filter((card) => !card.classList.contains('is-category-hidden') && !card.classList.contains('is-hidden'));

    const updateCount = () => {
      const total = visibleCards().length;
      if (count) {
        count.textContent = total === 1 ? '1 título encontrado' : `${total} títulos encontrados`;
      }
      if (empty) empty.hidden = total !== 0;
    };

    const applySearch = () => {
      const query = normalize(input?.value || '');

      cards().forEach((card) => {
        const content = normalize(
          `${card.dataset.title || ''} ${card.dataset.author || ''} ${card.dataset.category || ''}`
        );
        card.classList.toggle('is-category-hidden', Boolean(query) && !content.includes(query));
      });

      updateCount();
    };

    const sortCards = () => {
      const type = sort?.value || 'featured';
      const ordered = cards().sort((a, b) => {
        const rankA = toNumber(a.dataset.rank);
        const rankB = toNumber(b.dataset.rank);
        const priceA = toNumber(a.dataset.price);
        const priceB = toNumber(b.dataset.price);
        const titleA = normalize(a.dataset.title);
        const titleB = normalize(b.dataset.title);

        if (type === 'price-asc') return priceA - priceB;
        if (type === 'price-desc') return priceB - priceA;
        if (type === 'title-asc') return titleA.localeCompare(titleB, 'pt-BR');
        return rankA - rankB;
      });

      ordered.forEach((card) => grid.appendChild(card));
      updateCount();
    };

    input?.addEventListener('input', applySearch);
    sort?.addEventListener('change', sortCards);

    const headerSearch = document.querySelector('.search input');
    headerSearch?.addEventListener('input', () => {
      window.requestAnimationFrame(updateCount);
    });

    sortCards();
    applySearch();
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (page === 'categorias') initOverview();
    if (page === 'categoria') initDetail();
  });
})();

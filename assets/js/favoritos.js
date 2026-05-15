/* =========================================================
   Mar de Histórias — favoritos
   Lista salva, remoção e integração com carrinho
   ========================================================= */

(() => {
  'use strict';

  const page = document.body?.dataset.page || '';
  if (page !== 'favoritos') return;

  const favoritesGrid = document.getElementById('favoritesGrid');
  const favoritesEmpty = document.getElementById('favoritesEmpty');
  const favoritesCountText = document.getElementById('favoritesCountText');
  const favoritesHeroCount = document.getElementById('favoritesHeroCount');
  const favoritesTotalCount = document.getElementById('favoritesTotalCount');
  const favoritesEstimatedValue = document.getElementById('favoritesEstimatedValue');
  const clearFavoritesButton = document.getElementById('clearFavorites');
  const addAllButton = document.getElementById('addAllFavoritesToCart');

  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(value || 0));

  const parseCurrency = (value = '') => {
    const cleaned = String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');

    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const escapeHtml = (value = '') =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const getFavorites = () => window.MarDeHistorias?.getFavorites?.() || [];

  const calculateEstimatedValue = (favorites) =>
    favorites.reduce((total, item) => total + parseCurrency(item.price), 0);

  const renderCard = (item) => {
    const title = escapeHtml(item.title || 'Livro');
    const author = escapeHtml(item.author || 'Autor não informado');
    const category = escapeHtml(item.category || 'Livro favorito');
    const image = escapeHtml(item.image || '');
    const href = escapeHtml(item.href || `${item.id}.html`);
    const id = escapeHtml(item.id || '');
    const price = formatCurrency(parseCurrency(item.price));

    return `
      <article class="favorite-card" data-favorite-item="${id}">
        <button class="favorite-remove-btn" type="button" data-favorite-action="remove" data-favorite-id="${id}" aria-label="Remover ${title} dos favoritos">
          <i class="fa-solid fa-heart"></i>
        </button>

        <a class="favorite-card-cover" href="${href}" aria-label="Abrir ${title}">
          <img src="${image}" alt="${title}">
        </a>

        <span class="favorite-card-category">${category}</span>
        <h3><a href="${href}">${title}</a></h3>
        <p class="favorite-card-author">${author}</p>

        <div class="favorite-card-footer">
          <strong class="favorite-card-price">${price}</strong>
          <button class="favorite-add-cart-btn" type="button" data-favorite-action="cart" data-favorite-id="${id}" aria-label="Adicionar ${title} ao carrinho">
            <i class="fa-solid fa-bag-shopping"></i>
          </button>
        </div>
      </article>
    `;
  };

  const updateSummary = (favorites) => {
    const count = favorites.length;
    const total = calculateEstimatedValue(favorites);

    if (favoritesHeroCount) favoritesHeroCount.textContent = String(count);
    if (favoritesTotalCount) favoritesTotalCount.textContent = String(count);
    if (favoritesEstimatedValue) favoritesEstimatedValue.textContent = formatCurrency(total);

    if (favoritesCountText) {
      favoritesCountText.textContent =
        count === 0
          ? 'Nenhum livro salvo.'
          : count === 1
          ? '1 livro salvo para ver depois.'
          : `${count} livros salvos para ver depois.`;
    }

    if (clearFavoritesButton) clearFavoritesButton.disabled = count === 0;
    if (addAllButton) addAllButton.disabled = count === 0;
  };

  const renderFavorites = () => {
    const favorites = getFavorites();

    if (!favoritesGrid || !favoritesEmpty) return;

    if (!favorites.length) {
      favoritesGrid.innerHTML = '';
      favoritesEmpty.hidden = false;
    } else {
      favoritesGrid.innerHTML = favorites.map(renderCard).join('');
      favoritesEmpty.hidden = true;
    }

    updateSummary(favorites);
    window.MarDeHistorias?.updateFavoritesBadge?.();
  };

  const removeFavorite = (id) => {
    const favorite = getFavorites().find((item) => String(item.id) === String(id));
    if (!favorite) return;

    window.MarDeHistorias?.toggleFavorite?.(favorite);
    renderFavorites();
  };

  const addFavoriteToCart = (id) => {
    const favorite = getFavorites().find((item) => String(item.id) === String(id));
    if (!favorite) return;

    window.MarDeHistorias?.addToCart?.(
      {
        id: favorite.id,
        title: favorite.title,
        author: favorite.author,
        price: favorite.price,
        image: favorite.image,
      },
      1
    );
  };

  const clearFavorites = () => {
    const favorites = getFavorites();
    if (!favorites.length) return;

    window.MarDeHistorias?.saveFavorites?.([]);
    renderFavorites();

    window.MarDeHistorias?.showToast?.({
      title: 'Favoritos limpos',
      message: 'Sua lista foi esvaziada.',
      icon: 'fa-regular fa-trash-can',
    });
  };

  const addAllFavoritesToCart = () => {
    const favorites = getFavorites();
    if (!favorites.length) return;

    favorites.forEach((favorite) => {
      window.MarDeHistorias?.addToCart?.(
        {
          id: favorite.id,
          title: favorite.title,
          author: favorite.author,
          price: favorite.price,
          image: favorite.image,
        },
        1,
        { silent: true }
      );
    });

    window.MarDeHistorias?.showToast?.({
      title: 'Favoritos enviados ao carrinho',
      message: 'Todos os livros salvos foram adicionados.',
      icon: 'fa-solid fa-bag-shopping',
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderFavorites();

    favoritesGrid?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-favorite-action]');
      if (!button) return;

      const action = button.dataset.favoriteAction;
      const id = button.dataset.favoriteId;

      if (action === 'remove') {
        removeFavorite(id);
      }

      if (action === 'cart') {
        addFavoriteToCart(id);
      }
    });

    clearFavoritesButton?.addEventListener('click', clearFavorites);
    addAllButton?.addEventListener('click', addAllFavoritesToCart);
  });
})();

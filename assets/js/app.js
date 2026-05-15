/* =========================================================
   Mar de Histórias — JavaScript global
   Menu responsivo, busca, carrinho, newsletter e toasts
   ========================================================= */

(() => {
  'use strict';

  const STORAGE_KEY = 'marDeHistoriasCarrinho';
  const AUTH_SESSION_KEY = 'marDeHistoriasSessao';

  const normalize = (value = '') =>
    value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const slugify = (value = '') =>
    normalize(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const getCart = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
      return [];
    }
  };

  const saveCart = (cart) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCartBadge();
  };

  const getCartCount = () =>
    getCart().reduce((total, item) => total + Number(item.quantity || 0), 0);

  const updateCartBadge = () => {
    const count = getCartCount();
    document.querySelectorAll('.badge').forEach((badge) => {
      badge.textContent = String(count);
      badge.classList.remove('pulse');
      window.requestAnimationFrame(() => badge.classList.add('pulse'));
    });
  };

  const readStoredSession = (storage) => {
    try {
      return JSON.parse(storage.getItem(AUTH_SESSION_KEY)) || null;
    } catch (error) {
      return null;
    }
  };

  const getSession = () =>
    readStoredSession(localStorage) || readStoredSession(sessionStorage);

  const clearSession = () => {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  };

  const escapeHtml = (value = '') =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const showToast = ({ title, message, icon = 'fa-solid fa-circle-check' }) => {
    let container = document.querySelector('.toast-container');

    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('article');
    toast.className = 'toast';
    toast.innerHTML = `
      <i class="${icon}" aria-hidden="true"></i>
      <div>
        <strong>${title}</strong>
        <p>${message}</p>
      </div>
    `;

    container.appendChild(toast);

    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = '.24s ease';
      window.setTimeout(() => toast.remove(), 260);
    }, 3200);
  };

  const addToCart = (item, quantity = 1) => {
    const safeQuantity = Math.max(1, Number(quantity) || 1);
    const cart = getCart();
    const itemId = item.id || slugify(item.title);

    const existing = cart.find((cartItem) => cartItem.id === itemId);
    if (existing) {
      existing.quantity += safeQuantity;
    } else {
      cart.push({
        id: itemId,
        title: item.title,
        author: item.author || '',
        price: item.price || '',
        image: item.image || '',
        quantity: safeQuantity,
      });
    }

    saveCart(cart);
    showToast({
      title: 'Livro adicionado ao carrinho',
      message: `${item.title} foi adicionado com sucesso.`,
      icon: 'fa-solid fa-bag-shopping',
    });
  };


  const refreshAccountArea = () => {
    const accountLinks = document.querySelectorAll('.account-link');
    const actionsAreas = document.querySelectorAll('.actions');
    const session = getSession();

    accountLinks.forEach((link) => {
      const label = link.querySelector('[data-account-label]');

      if (!session) {
        link.href = 'login.html';
        link.removeAttribute('aria-expanded');
        link.classList.remove('is-authenticated');
        if (label) label.textContent = 'Entrar';
        return;
      }

      const firstName = String(session.name || 'Leitor').trim().split(/\s+/)[0] || 'Leitor';
      link.href = '#conta';
      link.classList.add('is-authenticated');
      link.setAttribute('aria-expanded', 'false');
      if (label) label.textContent = `Olá, ${firstName}`;
    });

    actionsAreas.forEach((actions) => {
      const existing = actions.querySelector('.account-dropdown');
      if (existing) existing.remove();

      if (!session) return;

      const dropdown = document.createElement('div');
      dropdown.className = 'account-dropdown';
      dropdown.hidden = true;
      dropdown.innerHTML = `
        <p>Conta ativa</p>
        <strong>${escapeHtml(session.name || 'Leitor')}</strong>
        <span>${escapeHtml(session.email || '')}</span>
        <button type="button" data-auth-logout>
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
          Sair
        </button>
      `;
      actions.appendChild(dropdown);
    });
  };

  const initAccountArea = () => {
    refreshAccountArea();

    document.addEventListener('click', (event) => {
      const accountLink = event.target.closest('.account-link.is-authenticated');
      const logoutButton = event.target.closest('[data-auth-logout]');

      if (accountLink) {
        event.preventDefault();
        const actions = accountLink.closest('.actions');
        const dropdown = actions?.querySelector('.account-dropdown');
        if (!dropdown) return;

        const willOpen = dropdown.hidden;
        document.querySelectorAll('.account-dropdown').forEach((menu) => {
          menu.hidden = true;
        });
        dropdown.hidden = !willOpen;
        accountLink.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        return;
      }

      if (logoutButton) {
        clearSession();
        refreshAccountArea();
        showToast({
          title: 'Sessão encerrada',
          message: 'Você saiu da conta da Mar de Histórias.',
          icon: 'fa-solid fa-arrow-right-from-bracket',
        });
        return;
      }

      document.querySelectorAll('.account-dropdown').forEach((menu) => {
        menu.hidden = true;
      });
      document.querySelectorAll('.account-link.is-authenticated').forEach((link) => {
        link.setAttribute('aria-expanded', 'false');
      });
    });
  };

  const initMobileMenu = () => {
    const topbar = document.getElementById('topbar');
    const menuButton = document.querySelector('.menu-btn');

    if (!topbar || !menuButton) return;

    menuButton.addEventListener('click', () => {
      topbar.classList.toggle('active');
      menuButton.setAttribute(
        'aria-expanded',
        topbar.classList.contains('active') ? 'true' : 'false'
      );
    });
  };

  const initHomeCartButtons = () => {
    document.querySelectorAll('.book-card .cart-btn').forEach((button) => {
      button.setAttribute('type', 'button');

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const card = button.closest('.book-card');
        const link = button.closest('.book-link');

        if (!card) return;

        const title = card.querySelector('.book-title')?.textContent?.trim() || 'Livro';
        const author = card.querySelector('.author')?.textContent?.trim() || '';
        const price = card.querySelector('.price')?.textContent?.trim() || '';
        const image = card.querySelector('.cover')?.getAttribute('src') || '';
        const id = link?.getAttribute('href')?.replace('.html', '') || slugify(title);

        addToCart({ id, title, author, price, image }, 1);
      });
    });
  };

  const filterBooks = (query) => {
    const normalizedQuery = normalize(query);
    const links = document.querySelectorAll('.book-link');

    if (!links.length) return;

    links.forEach((link) => {
      const content = normalize(link.textContent || '');
      link.classList.toggle('is-hidden', normalizedQuery !== '' && !content.includes(normalizedQuery));
    });
  };

  const initSearch = () => {
    const form = document.querySelector('.search');
    const input = form?.querySelector('input');

    if (!form || !input) return;

    if (document.body?.dataset?.page === 'catalogo') {
      return;
    }

    const bookGridExists = Boolean(document.querySelector('.book-link'));

    if (bookGridExists) {
      const params = new URLSearchParams(window.location.search);
      const initialSearch = params.get('busca') || '';
      if (initialSearch) {
        input.value = initialSearch;
        filterBooks(initialSearch);
      }

      input.addEventListener('input', () => filterBooks(input.value));

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const query = input.value.trim();
        if (query) {
          window.location.href = `catalogo.html?busca=${encodeURIComponent(query)}`;
          return;
        }
        filterBooks('');
      });
    } else {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const query = input.value.trim();
        const destination = query
          ? `catalogo.html?busca=${encodeURIComponent(query)}`
          : 'catalogo.html';
        window.location.href = destination;
      });
    }
  };


  const initExploreButton = () => {
    const button = document.querySelector('.js-scroll-books');
    const target = document.getElementById('mais-comprados');

    if (!button || !target) return;

    button.addEventListener('click', () => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const initNewsletter = () => {
    document.querySelectorAll('.newsletter').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const input = form.querySelector('input[type="email"]');
        const email = input?.value.trim() || '';

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showToast({
            title: 'E-mail inválido',
            message: 'Digite um e-mail válido para receber as novidades.',
            icon: 'fa-solid fa-triangle-exclamation',
          });
          input?.focus();
          return;
        }

        showToast({
          title: 'Cadastro realizado',
          message: 'Você entrou na newsletter da Mar de Histórias.',
          icon: 'fa-regular fa-envelope',
        });
        form.reset();
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    initAccountArea();
    initHomeCartButtons();
    initSearch();
    initExploreButton();
    initNewsletter();
    updateCartBadge();
  });

  window.MarDeHistorias = {
    addToCart,
    getCart,
    getCartCount,
    updateCartBadge,
    showToast,
    slugify,
    getSession,
    clearSession,
    refreshAccountArea,
  };
})();

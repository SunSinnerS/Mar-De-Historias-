/* =========================================================
   Mar de Histórias — ofertas
   Filtros, ordenação, contador visual e cópia de cupom
   ========================================================= */

(() => {
  'use strict';

  const page = document.body?.dataset.page || '';
  if (page !== 'ofertas') return;

  const OFFER_END_KEY = 'marDeHistoriasFimOfertas';
  const OFFER_DURATION = 1000 * 60 * 60 * 24 * 6;

  const grid = document.getElementById('offersGrid');
  const empty = document.getElementById('offersEmpty');
  const resultCount = document.getElementById('offersResultCount');
  const sortSelect = document.getElementById('offersSort');
  const filterContainer = document.getElementById('discountFilters');
  const couponButton = document.getElementById('copyOfferCoupon');
  const couponCode = document.getElementById('offerCouponCode');

  const normalize = (value = '') =>
    value
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const toNumber = (value = '') => Number(String(value).replace(',', '.')) || 0;

  const cards = () => Array.from(grid?.querySelectorAll('.offer-book-link') || []);

  const rangeMatch = (discount, filter) => {
    if (filter === 'low') return discount <= 15;
    if (filter === 'mid') return discount >= 16 && discount <= 20;
    if (filter === 'high') return discount > 20;
    return true;
  };

  const activeFilter = () =>
    filterContainer?.querySelector('.discount-filter.is-active')?.dataset.offerFilter || 'all';

  const visibleCards = () =>
    cards().filter((card) => !card.classList.contains('is-offer-hidden') && !card.classList.contains('is-hidden'));

  const updateCount = () => {
    const count = visibleCards().length;

    if (resultCount) {
      resultCount.textContent =
        count === 1 ? '1 oferta encontrada' : `${count} ofertas encontradas`;
    }

    if (empty) empty.hidden = count !== 0;
  };

  const applyDiscountFilter = () => {
    const filter = activeFilter();

    cards().forEach((card) => {
      const discount = toNumber(card.dataset.discount);
      card.classList.toggle('is-offer-hidden', !rangeMatch(discount, filter));
    });

    updateCount();
  };

  const sortOffers = () => {
    if (!grid) return;

    const type = sortSelect?.value || 'discount-desc';
    const sorted = cards().sort((a, b) => {
      const discountA = toNumber(a.dataset.discount);
      const discountB = toNumber(b.dataset.discount);
      const promoA = toNumber(a.dataset.promo);
      const promoB = toNumber(b.dataset.promo);
      const titleA = normalize(a.dataset.title);
      const titleB = normalize(b.dataset.title);

      if (type === 'price-asc') return promoA - promoB;
      if (type === 'price-desc') return promoB - promoA;
      if (type === 'title-asc') return titleA.localeCompare(titleB, 'pt-BR');
      return discountB - discountA;
    });

    sorted.forEach((card) => grid.appendChild(card));
    updateCount();
  };

  const copyText = async (value) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard indisponível');
      }

      await navigator.clipboard.writeText(value);
      window.MarDeHistorias?.showToast?.({
        title: 'Cupom copiado',
        message: 'Use MARDEHISTORIAS10 no seu protótipo.',
        icon: 'fa-regular fa-copy',
      });
    } catch (error) {
      const temporary = document.createElement('textarea');
      temporary.value = value;
      temporary.setAttribute('readonly', '');
      temporary.style.position = 'fixed';
      temporary.style.opacity = '0';
      document.body.appendChild(temporary);
      temporary.select();

      try {
        document.execCommand?.('copy');
      } catch (copyError) {
        // fallback visual only
      }

      temporary.remove();

      window.MarDeHistorias?.showToast?.({
        title: 'Cupom selecionado',
        message: 'Copie o código MARDEHISTORIAS10 para usar no fluxo visual.',
        icon: 'fa-regular fa-copy',
      });
    }
  };

  const getOfferEnd = () => {
    const stored = Number(localStorage.getItem(OFFER_END_KEY) || 0);
    const now = Date.now();

    if (stored > now) return stored;

    const next = now + OFFER_DURATION;
    localStorage.setItem(OFFER_END_KEY, String(next));
    return next;
  };

  const pad = (value) => String(Math.max(0, value)).padStart(2, '0');

  const updateCountdown = () => {
    const end = getOfferEnd();
    const now = Date.now();
    const diff = Math.max(0, end - now);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const dayEl = document.getElementById('countDays');
    const hourEl = document.getElementById('countHours');
    const minuteEl = document.getElementById('countMinutes');
    const secondEl = document.getElementById('countSeconds');

    if (dayEl) dayEl.textContent = pad(days);
    if (hourEl) hourEl.textContent = pad(hours);
    if (minuteEl) minuteEl.textContent = pad(minutes);
    if (secondEl) secondEl.textContent = pad(seconds);
  };

  document.addEventListener('DOMContentLoaded', () => {
    applyDiscountFilter();
    sortOffers();
    updateCountdown();
    window.setInterval(updateCountdown, 1000);

    filterContainer?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-offer-filter]');
      if (!button) return;

      filterContainer.querySelectorAll('.discount-filter').forEach((item) => {
        item.classList.toggle('is-active', item === button);
      });

      applyDiscountFilter();
    });

    sortSelect?.addEventListener('change', sortOffers);

    couponButton?.addEventListener('click', () => {
      copyText(couponCode?.textContent?.trim() || 'MARDEHISTORIAS10');
    });

    const searchInput = document.querySelector('.search input');
    searchInput?.addEventListener('input', () => {
      window.requestAnimationFrame(updateCount);
    });
  });
})();

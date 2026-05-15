/* =========================================================
   Mar de Histórias — carrinho
   Renderização, quantidade, remoção, frete e resumo do pedido
   ========================================================= */

(() => {
  'use strict';

  const STORAGE_KEY = 'marDeHistoriasCarrinho';
  const FREIGHT_KEY = 'marDeHistoriasFrete';
  const FREE_SHIPPING_LIMIT = 150;

  const state = {
    freightCalculated: false,
    cep: '',
    baseFreight: 0,
    delivery: '',
  };

  const cartList = document.getElementById('cartList');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartItemsCount = document.getElementById('cartItemsCount');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const cartShipping = document.getElementById('cartShipping');
  const cartTotal = document.getElementById('cartTotal');
  const clearCartButton = document.getElementById('clearCart');
  const checkoutButton = document.getElementById('checkoutButton');
  const cepInput = document.getElementById('cartCep');
  const calculateFreightButton = document.getElementById('calculateCartFreight');
  const shippingResult = document.getElementById('cartShippingResult');

  if (document.body?.dataset.page !== 'carrinho') return;

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

  const readCart = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
      return [];
    }
  };

  const saveCart = (cart) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    window.MarDeHistorias?.updateCartBadge?.();
  };

  const getSubtotal = (cart) =>
    cart.reduce((sum, item) => {
      const price = parseCurrency(item.price);
      const quantity = Math.max(1, Number(item.quantity || 1));
      return sum + price * quantity;
    }, 0);

  const getTotalItems = (cart) =>
    cart.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);

  const getBookHref = (item) => {
    const id = String(item.id || '').trim();
    return id ? `${id}.html` : 'catalogo.html';
  };

  const escapeHtml = (value = '') =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const renderCartItem = (item) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = parseCurrency(item.price);
    const itemTotal = unitPrice * quantity;
    const title = escapeHtml(item.title || 'Livro');
    const author = escapeHtml(item.author || 'Autor não informado');
    const image = escapeHtml(item.image || '');
    const href = escapeHtml(getBookHref(item));
    const id = escapeHtml(item.id || '');

    return `
      <article class="cart-item" data-cart-item="${id}">
        <a class="cart-item-cover-wrap" href="${href}" aria-label="Abrir ${title}">
          <img class="cart-item-cover" src="${image}" alt="${title}">
        </a>

        <div class="cart-item-info">
          <h3><a href="${href}">${title}</a></h3>
          <p>${author}</p>
          <span class="cart-item-price"><i class="fa-solid fa-tag"></i> ${formatCurrency(unitPrice)}</span>
        </div>

        <div class="cart-quantity">
          <span class="cart-column-label">Quantidade</span>
          <div class="quantity-control" aria-label="Quantidade de ${title}">
            <button type="button" data-cart-action="decrease" data-cart-id="${id}" aria-label="Diminuir quantidade">−</button>
            <span>${quantity}</span>
            <button type="button" data-cart-action="increase" data-cart-id="${id}" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>

        <div class="cart-item-total">
          <span class="cart-column-label">Total</span>
          <strong>${formatCurrency(itemTotal)}</strong>
        </div>

        <button class="remove-item-btn" type="button" data-cart-action="remove" data-cart-id="${id}" aria-label="Remover ${title}">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </article>
    `;
  };

  const getShippingAmount = (subtotal) => {
    if (!state.freightCalculated) return 0;
    return subtotal >= FREE_SHIPPING_LIMIT ? 0 : state.baseFreight;
  };

  const getShippingLabel = (subtotal) => {
    if (!state.freightCalculated) return 'A calcular';
    return subtotal >= FREE_SHIPPING_LIMIT ? 'Grátis' : formatCurrency(state.baseFreight);
  };

  const updateShippingMessage = (subtotal) => {
    if (!shippingResult || !state.freightCalculated) return;

    const isFree = subtotal >= FREE_SHIPPING_LIMIT;
    const freightText = isFree ? 'Grátis' : formatCurrency(state.baseFreight);
    const promoText = isFree
      ? 'Frete grátis aplicado automaticamente por subtotal acima de R$ 150,00.'
      : 'Frete grátis em pedidos acima de R$ 150,00.';

    shippingResult.className = 'shipping-result cart-shipping-result show';
    shippingResult.innerHTML = `
      <strong>Entrega estimada:</strong> ${state.delivery}<br>
      <strong>Frete padrão:</strong> ${freightText}<br>
      <strong>Promoção:</strong> ${promoText}
    `;
  };

  const updateSummary = (cart) => {
    const subtotal = getSubtotal(cart);
    const shippingAmount = getShippingAmount(subtotal);
    const total = subtotal + shippingAmount;
    const totalItems = getTotalItems(cart);

    if (cartItemsCount) {
      cartItemsCount.textContent =
        totalItems === 1 ? '1 item selecionado' : `${totalItems} itens selecionados`;
    }

    if (cartSubtotal) cartSubtotal.textContent = formatCurrency(subtotal);
    if (cartShipping) cartShipping.textContent = getShippingLabel(subtotal);
    if (cartTotal) cartTotal.textContent = formatCurrency(total);

    if (clearCartButton) clearCartButton.disabled = cart.length === 0;
    if (checkoutButton) checkoutButton.disabled = cart.length === 0;

    updateShippingMessage(subtotal);
  };

  const renderCart = () => {
    const cart = readCart();

    if (!cartList || !cartEmpty) return;

    if (!cart.length) {
      cartList.innerHTML = '';
      cartEmpty.hidden = false;
    } else {
      cartList.innerHTML = cart.map(renderCartItem).join('');
      cartEmpty.hidden = true;
    }

    updateSummary(cart);
  };

  const findCartItem = (cart, id) => cart.find((item) => String(item.id) === String(id));

  const changeQuantity = (id, amount) => {
    const cart = readCart();
    const item = findCartItem(cart, id);
    if (!item) return;

    const current = Math.max(1, Number(item.quantity || 1));
    const next = Math.max(1, Math.min(10, current + amount));
    item.quantity = next;

    saveCart(cart);
    renderCart();
  };

  const removeItem = (id) => {
    const cart = readCart();
    const item = findCartItem(cart, id);
    const nextCart = cart.filter((cartItem) => String(cartItem.id) !== String(id));

    saveCart(nextCart);
    renderCart();

    if (item) {
      window.MarDeHistorias?.showToast?.({
        title: 'Livro removido',
        message: `${item.title} saiu do carrinho.`,
        icon: 'fa-regular fa-trash-can',
      });
    }
  };

  const clearCart = () => {
    const cart = readCart();
    if (!cart.length) return;

    saveCart([]);
    localStorage.removeItem(FREIGHT_KEY);
    state.freightCalculated = false;
    state.cep = '';
    state.baseFreight = 0;
    state.delivery = '';

    if (cepInput) cepInput.value = '';
    if (shippingResult) {
      shippingResult.className = 'shipping-result cart-shipping-result';
      shippingResult.innerHTML = '';
    }

    renderCart();

    window.MarDeHistorias?.showToast?.({
      title: 'Carrinho limpo',
      message: 'Todos os livros foram removidos.',
      icon: 'fa-regular fa-trash-can',
    });
  };

  const calculateFreight = async () => {
    const cart = readCart();
    const subtotal = getSubtotal(cart);

    if (!cart.length) {
      window.MarDeHistorias?.showToast?.({
        title: 'Carrinho vazio',
        message: 'Adicione um livro antes de calcular o frete.',
        icon: 'fa-solid fa-triangle-exclamation',
      });
      return;
    }

    if (!cepInput || !shippingResult) return;

    const cep = cepInput.value.replace(/\D/g, '');

    if (cep.length !== 8) {
      shippingResult.className = 'shipping-result cart-shipping-result show error';
      shippingResult.innerHTML = '<strong>CEP inválido.</strong><br>Digite 8 números para visualizar a estimativa.';
      return;
    }

    shippingResult.className = 'shipping-result cart-shipping-result show';
    shippingResult.innerHTML = '<strong>Calculando frete...</strong>';

    try {
      const response = await fetch('/api/frete/cotacoes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cep,
          subtotal,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Não foi possível calcular o frete.');
      }

      const option = data.cotacao?.options?.[0];
      if (!option) {
        throw new Error('Nenhuma modalidade de frete retornada.');
      }

      state.freightCalculated = true;
      state.cep = cep;
      state.baseFreight = Number(option.price || 0);
      state.delivery = option.delivery || '';

      localStorage.setItem(
        FREIGHT_KEY,
        JSON.stringify({
          cep,
          baseFreight: Number(option.price || 0),
          delivery: option.delivery || '',
          options: data.cotacao.options,
          updatedAt: new Date().toISOString(),
        })
      );

      updateSummary(cart);

      window.MarDeHistorias?.showToast?.({
        title: 'Frete calculado',
        message: 'A estimativa de entrega veio da API.',
        icon: 'fa-solid fa-truck-fast',
      });
    } catch (error) {
      shippingResult.className = 'shipping-result cart-shipping-result show error';
      shippingResult.innerHTML = `<strong>Falha no cálculo.</strong><br>${error.message}`;
    }
  };

  const initCepMask = () => {
    if (!cepInput) return;

    cepInput.addEventListener('input', () => {
      let value = cepInput.value.replace(/\D/g, '').slice(0, 8);
      if (value.length > 5) {
        value = `${value.slice(0, 5)}-${value.slice(5)}`;
      }
      cepInput.value = value;
    });

    cepInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        calculateFreight();
      }
    });
  };

  const initCartActions = () => {
    cartList?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-action]');
      if (!button) return;

      const id = button.dataset.cartId;
      const action = button.dataset.cartAction;

      if (action === 'increase') changeQuantity(id, 1);
      if (action === 'decrease') changeQuantity(id, -1);
      if (action === 'remove') removeItem(id);
    });

    clearCartButton?.addEventListener('click', clearCart);
    calculateFreightButton?.addEventListener('click', calculateFreight);

    checkoutButton?.addEventListener('click', () => {
      const cart = readCart();

      if (!cart.length) {
        window.MarDeHistorias?.showToast?.({
          title: 'Carrinho vazio',
          message: 'Adicione livros para continuar.',
          icon: 'fa-solid fa-triangle-exclamation',
        });
        return;
      }

      const session = window.MarDeHistorias?.getSession?.();

      if (!session) {
        window.MarDeHistorias?.showToast?.({
          title: 'Identificação necessária',
          message: 'Entre ou crie uma conta para continuar.',
          icon: 'fa-regular fa-user',
        });

        window.setTimeout(() => {
          window.location.href = 'login.html?redirect=carrinho.html';
        }, 650);
        return;
      }

      window.MarDeHistorias?.showToast?.({
        title: 'Conta identificada',
        message: 'Abrindo a etapa de endereço e entrega.',
        icon: 'fa-solid fa-circle-check',
      });

      window.setTimeout(() => {
        window.location.href = 'checkout-endereco.html';
      }, 600);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    initCepMask();
    initCartActions();
  });
})();

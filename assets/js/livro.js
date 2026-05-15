/* =========================================================
   Mar de Histórias — JavaScript das páginas de livro
   Quantidade, cálculo de frete e botão de compra
   ========================================================= */

(() => {
  'use strict';

  const getProductInfo = () => {
    const title = document.querySelector('.product-info h1')?.textContent?.trim() || 'Livro';
    const author = document.querySelector('.author-line strong')?.textContent?.trim() || '';
    const price = document.querySelector('.main-price')?.textContent?.trim() || '';
    const image = document.querySelector('.detail-cover')?.getAttribute('src') || '';
    const fileName = window.location.pathname.split('/').pop()?.replace('.html', '') || '';
    const id = fileName || window.MarDeHistorias?.slugify?.(title) || title;

    return { id, title, author, price, image };
  };

  const getQuantityElement = () => document.querySelector('[data-qty-value]');

  const getQuantity = () => {
    const value = Number(getQuantityElement()?.textContent || 1);
    return Math.max(1, Math.min(10, Number.isFinite(value) ? value : 1));
  };

  const setQuantity = (quantity) => {
    const element = getQuantityElement();
    if (!element) return;
    element.textContent = String(Math.max(1, Math.min(10, quantity)));
  };

  const initQuantityControl = () => {
    document.querySelectorAll('[data-qty-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const current = getQuantity();
        const action = button.dataset.qtyAction;
        setQuantity(action === 'increase' ? current + 1 : current - 1);
      });
    });
  };

  const calculateShipping = () => {
    const input = document.querySelector('[data-cep]');
    const result = document.querySelector('.shipping-result');

    if (!input || !result) return;

    const cep = input.value.replace(/\D/g, '');

    if (cep.length !== 8) {
      result.className = 'shipping-result show error';
      result.innerHTML = '<strong>CEP inválido.</strong><br>Digite 8 números para visualizar a estimativa de entrega.';
      return;
    }

    const firstDigit = Number(cep.charAt(0));
    let price = 'R$ 18,90';
    let delivery = '5 a 8 dias úteis';

    if (firstDigit <= 2) {
      price = 'R$ 14,90';
      delivery = '3 a 5 dias úteis';
    } else if (firstDigit <= 5) {
      price = 'R$ 16,90';
      delivery = '4 a 7 dias úteis';
    } else if (firstDigit <= 7) {
      price = 'R$ 19,90';
      delivery = '5 a 9 dias úteis';
    } else {
      price = 'R$ 22,90';
      delivery = '6 a 10 dias úteis';
    }

    result.className = 'shipping-result show';
    result.innerHTML = `
      <strong>Entrega estimada:</strong> ${delivery}<br>
      <strong>Frete padrão:</strong> ${price}<br>
      <strong>Promoção:</strong> frete grátis em pedidos acima de R$ 150,00.
    `;
  };

  const initFreightCalculator = () => {
    const input = document.querySelector('[data-cep]');
    const button = document.querySelector('.js-calculate-freight');

    if (!input || !button) return;

    input.addEventListener('input', () => {
      let value = input.value.replace(/\D/g, '').slice(0, 8);
      if (value.length > 5) {
        value = `${value.slice(0, 5)}-${value.slice(5)}`;
      }
      input.value = value;
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        calculateShipping();
      }
    });

    button.addEventListener('click', calculateShipping);
  };

  const initProductButton = () => {
    const button = document.querySelector('.js-add-product');
    if (!button) return;

    button.addEventListener('click', () => {
      const product = getProductInfo();
      const quantity = getQuantity();
      window.MarDeHistorias?.addToCart(product, quantity);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initQuantityControl();
    initFreightCalculator();
    initProductButton();
  });
})();

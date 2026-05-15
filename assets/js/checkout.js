/* =========================================================
   Mar de Histórias — checkout completo
   Endereço, pagamento, métodos e confirmação do pedido
   ========================================================= */

(() => {
  'use strict';

  const CART_KEY = 'marDeHistoriasCarrinho';
  const CHECKOUT_KEY = 'marDeHistoriasCheckout';
  const FREIGHT_KEY = 'marDeHistoriasFrete';
  const LAST_ORDER_KEY = 'marDeHistoriasUltimoPedido';
  const FREE_SHIPPING_LIMIT = 150;

  const page = document.body?.dataset.page || '';
  const statusBox = document.getElementById('checkoutStatus');

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

  const readJson = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (error) {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const removeJson = (key) => {
    localStorage.removeItem(key);
  };

  const readCart = () => readJson(CART_KEY, []);
  const readCheckout = () => readJson(CHECKOUT_KEY, {});
  const saveCheckout = (state) => writeJson(CHECKOUT_KEY, state);
  const readFreight = () => readJson(FREIGHT_KEY, null);

  const showStatus = (message, type = 'error') => {
    if (!statusBox) return;
    statusBox.className = `checkout-status is-visible is-${type}`;
    statusBox.textContent = message;
  };

  const clearStatus = () => {
    if (!statusBox) return;
    statusBox.className = 'checkout-status';
    statusBox.textContent = '';
  };

  const toast = ({ title, message, icon }) => {
    window.MarDeHistorias?.showToast?.({ title, message, icon });
  };

  const normalizeDigits = (value = '') => String(value).replace(/\D/g, '');

  const escapeHtml = (value = '') =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const getSession = () => window.MarDeHistorias?.getSession?.() || null;

  const ensureSession = () => {
    const session = getSession();
    if (session) return true;

    toast({
      title: 'Identificação necessária',
      message: 'Entre ou crie uma conta para continuar o checkout.',
      icon: 'fa-regular fa-user',
    });

    window.setTimeout(() => {
      const redirect = encodeURIComponent(window.location.pathname.split('/').pop() || 'checkout-endereco.html');
      window.location.href = `login.html?redirect=${redirect}`;
    }, 650);

    return false;
  };

  const ensureCart = () => {
    const cart = readCart();
    if (cart.length) return true;

    toast({
      title: 'Carrinho vazio',
      message: 'Adicione livros antes de continuar.',
      icon: 'fa-solid fa-cart-shopping',
    });

    window.setTimeout(() => {
      window.location.href = 'carrinho.html';
    }, 650);

    return false;
  };

  const getCartSubtotal = (cart = readCart()) =>
    cart.reduce((total, item) => {
      const price = parseCurrency(item.price);
      const quantity = Math.max(1, Number(item.quantity || 1));
      return total + price * quantity;
    }, 0);

  const getCartTotalItems = (cart = readCart()) =>
    cart.reduce((total, item) => total + Math.max(1, Number(item.quantity || 1)), 0);

  const getEffectiveShipping = (checkout = readCheckout(), subtotal = getCartSubtotal()) => {
    const delivery = checkout.delivery;
    if (!delivery) return null;

    if (delivery.freeEligible && subtotal >= FREE_SHIPPING_LIMIT) {
      return 0;
    }

    return Number(delivery.price || 0);
  };

  const getTotals = () => {
    const cart = readCart();
    const checkout = readCheckout();
    const subtotal = getCartSubtotal(cart);
    const shipping = getEffectiveShipping(checkout, subtotal);
    const total = subtotal + Number(shipping || 0);

    return { cart, checkout, subtotal, shipping, total };
  };

  const renderCheckoutItems = () => {
    const { cart } = getTotals();
    const targets = document.querySelectorAll('.js-checkout-items');

    if (!targets.length) return;

    const markup = cart.map((item) => {
      const title = escapeHtml(item.title || 'Livro');
      const image = escapeHtml(item.image || '');
      const quantity = Math.max(1, Number(item.quantity || 1));
      const price = parseCurrency(item.price);
      const total = price * quantity;

      return `
        <article class="checkout-item">
          <img src="${image}" alt="${title}">
          <div>
            <strong>${title}</strong>
            <span>${quantity} un. × ${formatCurrency(price)}</span>
          </div>
          <em>${formatCurrency(total)}</em>
        </article>
      `;
    }).join('');

    targets.forEach((target) => {
      target.innerHTML = markup;
    });
  };

  const renderCheckoutTotals = () => {
    const { checkout, subtotal, shipping, total } = getTotals();

    document.querySelectorAll('.js-checkout-subtotal').forEach((element) => {
      element.textContent = formatCurrency(subtotal);
    });

    document.querySelectorAll('.js-checkout-shipping').forEach((element) => {
      element.textContent = shipping === null ? 'A calcular' : shipping === 0 ? 'Grátis' : formatCurrency(shipping);
    });

    document.querySelectorAll('.js-checkout-total').forEach((element) => {
      element.textContent = formatCurrency(total);
    });

    const note = document.querySelector('.js-checkout-summary-note');
    if (note) {
      const delivery = checkout.delivery;
      if (!delivery) {
        note.innerHTML = `
          <i class="fa-solid fa-truck-fast"></i>
          <p>O valor final será atualizado conforme o endereço e a forma de entrega.</p>
        `;
      } else {
        const shippingLabel = shipping === 0 ? 'frete grátis' : formatCurrency(shipping);
        note.innerHTML = `
          <i class="fa-solid fa-truck-fast"></i>
          <p><strong>${escapeHtml(delivery.label)}</strong> selecionada: ${escapeHtml(delivery.delivery)} • ${shippingLabel}.</p>
        `;
      }
    }
  };

  const renderOrderSummary = () => {
    renderCheckoutItems();
    renderCheckoutTotals();
  };

  const formatCep = (value = '') => {
    const digits = normalizeDigits(value).slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  };

  const formatPhone = (value = '') => {
    const digits = normalizeDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const calculateFreightByCep = (cep) => {
    const digits = normalizeDigits(cep);
    if (digits.length !== 8) return null;

    const firstDigit = Number(digits.charAt(0));

    if (firstDigit <= 2) {
      return {
        cep: digits,
        options: [
          { id: 'padrao', label: 'Entrega padrão', price: 14.90, delivery: '3 a 5 dias úteis', freeEligible: true },
          { id: 'expressa', label: 'Entrega expressa', price: 24.90, delivery: '1 a 2 dias úteis', freeEligible: false },
        ],
      };
    }

    if (firstDigit <= 5) {
      return {
        cep: digits,
        options: [
          { id: 'padrao', label: 'Entrega padrão', price: 16.90, delivery: '4 a 7 dias úteis', freeEligible: true },
          { id: 'expressa', label: 'Entrega expressa', price: 26.90, delivery: '2 a 4 dias úteis', freeEligible: false },
        ],
      };
    }

    if (firstDigit <= 7) {
      return {
        cep: digits,
        options: [
          { id: 'padrao', label: 'Entrega padrão', price: 19.90, delivery: '5 a 9 dias úteis', freeEligible: true },
          { id: 'expressa', label: 'Entrega expressa', price: 29.90, delivery: '3 a 5 dias úteis', freeEligible: false },
        ],
      };
    }

    return {
      cep: digits,
      options: [
        { id: 'padrao', label: 'Entrega padrão', price: 22.90, delivery: '6 a 10 dias úteis', freeEligible: true },
        { id: 'expressa', label: 'Entrega expressa', price: 32.90, delivery: '4 a 6 dias úteis', freeEligible: false },
      ],
    };
  };

  const renderDeliveryOptions = (freight, selectedId = 'padrao') => {
    const container = document.getElementById('deliveryOptions');
    const chip = document.getElementById('deliveryChip');
    if (!container || !chip || !freight) return;

    const subtotal = getCartSubtotal();
    chip.textContent = `CEP ${formatCep(freight.cep)}`;

    container.innerHTML = freight.options.map((option) => {
      const isSelected = option.id === selectedId;
      const isFree = option.freeEligible && subtotal >= FREE_SHIPPING_LIMIT;
      const priceLabel = isFree ? 'Grátis' : formatCurrency(option.price);

      return `
        <label class="delivery-option ${isSelected ? 'is-selected' : ''}">
          <input type="radio" name="deliveryOption" value="${escapeHtml(option.id)}" ${isSelected ? 'checked' : ''}>
          <div>
            <strong>${escapeHtml(option.label)}</strong>
            <span>${escapeHtml(option.delivery)}${isFree ? ' • frete grátis aplicado' : ''}</span>
          </div>
          <em>${priceLabel}</em>
        </label>
      `;
    }).join('');
  };

  const getSelectedDeliveryFromFreight = (freight, selectedId) => {
    if (!freight) return null;
    const option = freight.options.find((item) => item.id === selectedId) || freight.options[0];
    return {
      ...option,
      cep: freight.cep,
    };
  };

  const saveAddressState = ({ address, delivery, freight }) => {
    const checkout = readCheckout();
    saveCheckout({
      ...checkout,
      address,
      delivery,
      freight,
      updatedAt: new Date().toISOString(),
    });
  };

  const initAddressPage = () => {
    if (!ensureSession() || !ensureCart()) return;

    renderOrderSummary();

    const session = getSession();
    const checkout = readCheckout();
    const storedFreight = checkout.freight || readFreight();
    const storedAddress = checkout.address || {};

    const fields = {
      recipientName: document.getElementById('recipientName'),
      recipientPhone: document.getElementById('recipientPhone'),
      addressCep: document.getElementById('addressCep'),
      addressStreet: document.getElementById('addressStreet'),
      addressNumber: document.getElementById('addressNumber'),
      addressComplement: document.getElementById('addressComplement'),
      addressNeighborhood: document.getElementById('addressNeighborhood'),
      addressCity: document.getElementById('addressCity'),
      addressState: document.getElementById('addressState'),
    };

    if (fields.recipientName) {
      fields.recipientName.value = storedAddress.recipientName || session?.name || '';
    }
    if (fields.recipientPhone) fields.recipientPhone.value = storedAddress.phone || '';
    if (fields.addressCep) fields.addressCep.value = formatCep(storedAddress.cep || storedFreight?.cep || '');
    if (fields.addressStreet) fields.addressStreet.value = storedAddress.street || '';
    if (fields.addressNumber) fields.addressNumber.value = storedAddress.number || '';
    if (fields.addressComplement) fields.addressComplement.value = storedAddress.complement || '';
    if (fields.addressNeighborhood) fields.addressNeighborhood.value = storedAddress.neighborhood || '';
    if (fields.addressCity) fields.addressCity.value = storedAddress.city || '';
    if (fields.addressState) fields.addressState.value = storedAddress.state || '';

    if (fields.recipientPhone) {
      fields.recipientPhone.addEventListener('input', () => {
        fields.recipientPhone.value = formatPhone(fields.recipientPhone.value);
      });
    }

    if (fields.addressCep) {
      fields.addressCep.addEventListener('input', () => {
        fields.addressCep.value = formatCep(fields.addressCep.value);
      });
    }

    let currentFreight = storedFreight?.options ? storedFreight : calculateFreightByCep(fields.addressCep?.value || '');
    let selectedDeliveryId = checkout.delivery?.id || 'padrao';

    if (currentFreight) {
      renderDeliveryOptions(currentFreight, selectedDeliveryId);

      const delivery = getSelectedDeliveryFromFreight(currentFreight, selectedDeliveryId);
      const address = {
        ...storedAddress,
        recipientName: fields.recipientName?.value.trim() || '',
        phone: fields.recipientPhone?.value.trim() || '',
        cep: currentFreight.cep,
      };

      saveAddressState({ address, delivery, freight: currentFreight });
      renderOrderSummary();
    }

    const calculateButton = document.getElementById('calculateCheckoutFreight');
    calculateButton?.addEventListener('click', () => {
      clearStatus();

      const freight = calculateFreightByCep(fields.addressCep?.value || '');
      if (!freight) {
        showStatus('Digite um CEP válido com 8 números para calcular o envio.');
        fields.addressCep?.focus();
        return;
      }

      currentFreight = freight;
      selectedDeliveryId = 'padrao';
      renderDeliveryOptions(currentFreight, selectedDeliveryId);

      const delivery = getSelectedDeliveryFromFreight(currentFreight, selectedDeliveryId);
      const state = readCheckout();
      saveAddressState({
        address: {
          ...(state.address || {}),
          cep: currentFreight.cep,
        },
        delivery,
        freight: currentFreight,
      });

      renderOrderSummary();

      showStatus('Opções de entrega atualizadas para o CEP informado.', 'success');
      toast({
        title: 'Frete calculado',
        message: 'Selecione a modalidade de envio desejada.',
        icon: 'fa-solid fa-truck-fast',
      });
    });

    document.getElementById('deliveryOptions')?.addEventListener('change', (event) => {
      const input = event.target.closest('input[name="deliveryOption"]');
      if (!input || !currentFreight) return;

      selectedDeliveryId = input.value;
      renderDeliveryOptions(currentFreight, selectedDeliveryId);

      const state = readCheckout();
      const delivery = getSelectedDeliveryFromFreight(currentFreight, selectedDeliveryId);
      saveAddressState({
        address: state.address || {},
        delivery,
        freight: currentFreight,
      });

      renderOrderSummary();
    });

    document.getElementById('addressForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      clearStatus();

      const address = {
        recipientName: fields.recipientName?.value.trim() || '',
        phone: fields.recipientPhone?.value.trim() || '',
        cep: normalizeDigits(fields.addressCep?.value || ''),
        street: fields.addressStreet?.value.trim() || '',
        number: fields.addressNumber?.value.trim() || '',
        complement: fields.addressComplement?.value.trim() || '',
        neighborhood: fields.addressNeighborhood?.value.trim() || '',
        city: fields.addressCity?.value.trim() || '',
        state: fields.addressState?.value || '',
      };

      if (address.recipientName.length < 3) {
        showStatus('Informe o nome completo do destinatário.');
        fields.recipientName?.focus();
        return;
      }

      if (normalizeDigits(address.phone).length < 10) {
        showStatus('Informe um telefone válido para contato.');
        fields.recipientPhone?.focus();
        return;
      }

      if (address.cep.length !== 8) {
        showStatus('Digite e calcule um CEP válido antes de continuar.');
        fields.addressCep?.focus();
        return;
      }

      if (!address.street || !address.number || !address.neighborhood || !address.city || !address.state) {
        showStatus('Preencha todos os campos obrigatórios do endereço.');
        return;
      }

      if (!currentFreight || currentFreight.cep !== address.cep) {
        showStatus('Calcule o frete para o CEP informado antes de continuar.');
        fields.addressCep?.focus();
        return;
      }

      const delivery = getSelectedDeliveryFromFreight(currentFreight, selectedDeliveryId);
      if (!delivery) {
        showStatus('Selecione uma modalidade de entrega.');
        return;
      }

      saveAddressState({ address, delivery, freight: currentFreight });
      renderOrderSummary();

      toast({
        title: 'Endereço salvo',
        message: 'Agora escolha a forma de pagamento.',
        icon: 'fa-solid fa-location-dot',
      });

      window.setTimeout(() => {
        window.location.href = 'checkout-pagamento.html';
      }, 650);
    });
  };

  const renderAddressReview = () => {
    const target = document.querySelector('.js-address-review');
    if (!target) return;

    const checkout = readCheckout();
    const address = checkout.address;
    const delivery = checkout.delivery;

    if (!address || !delivery) {
      target.innerHTML = '';
      return;
    }

    const complement = address.complement ? ` • ${escapeHtml(address.complement)}` : '';

    target.innerHTML = `
      <article class="address-review-card">
        <p class="panel-kicker">Endereço selecionado</p>
        <h3>${escapeHtml(address.recipientName)}</h3>
        <p>
          ${escapeHtml(address.street)}, ${escapeHtml(address.number)}${complement}<br>
          ${escapeHtml(address.neighborhood)} • ${escapeHtml(address.city)} / ${escapeHtml(address.state)}<br>
          CEP ${formatCep(address.cep)} • ${escapeHtml(address.phone)}
        </p>
        <p><strong>${escapeHtml(delivery.label)}:</strong> ${escapeHtml(delivery.delivery)}</p>
        <a href="checkout-endereco.html">Editar endereço</a>
      </article>
    `;
  };

  const ensureAddressState = () => {
    const checkout = readCheckout();
    if (checkout.address && checkout.delivery) return true;

    toast({
      title: 'Endereço necessário',
      message: 'Preencha a entrega antes de escolher o pagamento.',
      icon: 'fa-solid fa-location-dot',
    });

    window.setTimeout(() => {
      window.location.href = 'checkout-endereco.html';
    }, 650);

    return false;
  };

  const initPaymentSelectionPage = () => {
    if (!ensureSession() || !ensureCart() || !ensureAddressState()) return;

    renderOrderSummary();
    renderAddressReview();

    const checkout = readCheckout();
    const method = checkout.paymentMethod || 'pix';

    document.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
      input.checked = input.value === method;
      input.closest('.payment-method-card')?.classList.toggle('is-selected', input.checked);
    });

    document.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
      input.addEventListener('change', () => {
        document.querySelectorAll('.payment-method-card').forEach((card) => {
          const radio = card.querySelector('input[name="paymentMethod"]');
          card.classList.toggle('is-selected', Boolean(radio?.checked));
        });
      });
    });

    document.getElementById('paymentMethodForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      clearStatus();

      const selected = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'pix';
      const state = readCheckout();

      saveCheckout({
        ...state,
        paymentMethod: selected,
        updatedAt: new Date().toISOString(),
      });

      const routes = {
        pix: 'pagamento-pix.html',
        cartao: 'pagamento-cartao.html',
        boleto: 'pagamento-boleto.html',
      };

      toast({
        title: 'Pagamento selecionado',
        message: 'Abrindo a tela da modalidade escolhida.',
        icon: 'fa-solid fa-circle-check',
      });

      window.setTimeout(() => {
        window.location.href = routes[selected] || routes.pix;
      }, 500);
    });
  };

  const ensurePaymentContext = (method) => {
    if (!ensureSession() || !ensureCart() || !ensureAddressState()) return false;

    const checkout = readCheckout();
    saveCheckout({
      ...checkout,
      paymentMethod: method,
      updatedAt: new Date().toISOString(),
    });

    renderOrderSummary();
    return true;
  };

  const generatePixCode = () => {
    const { total } = getTotals();
    const numeric = String(Math.round(total * 100)).padStart(8, '0');
    return `00020101021226880014BR.GOV.BCB.PIX2566mardehistorias.checkout-${Date.now()}520400005303986540${numeric}5802BR5918MAR DE HISTORIAS6009SAO PAULO62070503***6304ABCD`;
  };

  const copyFromInput = async (input, successMessage) => {
    if (!input) return;

    const value = input.value || '';
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard indisponível');
      }

      await navigator.clipboard.writeText(value);
      toast({
        title: 'Copiado',
        message: successMessage,
        icon: 'fa-regular fa-copy',
      });
    } catch (error) {
      input.select();
      document.execCommand?.('copy');
      toast({
        title: 'Código selecionado',
        message: 'Use Ctrl+C para copiar, caso necessário.',
        icon: 'fa-regular fa-copy',
      });
    }
  };

  const initPixPage = () => {
    if (!ensurePaymentContext('pix')) return;

    const state = readCheckout();
    const code = state.pixCode || generatePixCode();
    const input = document.getElementById('pixCode');

    if (input) input.value = code;

    if (!state.pixCode) {
      saveCheckout({ ...state, paymentMethod: 'pix', pixCode: code });
    }

    document.getElementById('copyPixCode')?.addEventListener('click', () => {
      copyFromInput(input, 'Código PIX copiado para a área de transferência.');
    });

    initFinalizeButtons();
  };

  const formatCardNumber = (value = '') => {
    const digits = normalizeDigits(value).slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value = '') => {
    const digits = normalizeDigits(value).slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const initCardPage = () => {
    if (!ensurePaymentContext('cartao')) return;

    const numberInput = document.getElementById('cardNumber');
    const nameInput = document.getElementById('cardName');
    const expiryInput = document.getElementById('cardExpiry');
    const cvvInput = document.getElementById('cardCvv');
    const installmentsInput = document.getElementById('cardInstallments');

    const previewNumber = document.getElementById('cardPreviewNumber');
    const previewName = document.getElementById('cardPreviewName');
    const previewExpiry = document.getElementById('cardPreviewExpiry');

    const updatePreview = () => {
      const number = formatCardNumber(numberInput?.value || '');
      const name = (nameInput?.value || '').trim().toUpperCase();
      const expiry = formatExpiry(expiryInput?.value || '');

      if (previewNumber) previewNumber.textContent = number || '•••• •••• •••• ••••';
      if (previewName) previewName.textContent = name || 'NOME DO TITULAR';
      if (previewExpiry) previewExpiry.textContent = expiry || 'MM/AA';
    };

    numberInput?.addEventListener('input', () => {
      numberInput.value = formatCardNumber(numberInput.value);
      updatePreview();
    });

    nameInput?.addEventListener('input', updatePreview);

    expiryInput?.addEventListener('input', () => {
      expiryInput.value = formatExpiry(expiryInput.value);
      updatePreview();
    });

    cvvInput?.addEventListener('input', () => {
      cvvInput.value = normalizeDigits(cvvInput.value).slice(0, 4);
    });

    document.getElementById('cardPaymentForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      clearStatus();

      const digits = normalizeDigits(numberInput?.value || '');
      const name = nameInput?.value.trim() || '';
      const expiry = expiryInput?.value.trim() || '';
      const cvv = normalizeDigits(cvvInput?.value || '');
      const installments = installmentsInput?.value || '1';

      if (digits.length !== 16) {
        showStatus('Digite um número de cartão com 16 dígitos.');
        numberInput?.focus();
        return;
      }

      if (name.length < 5) {
        showStatus('Informe o nome impresso no cartão.');
        nameInput?.focus();
        return;
      }

      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
        showStatus('Informe uma validade no formato MM/AA.');
        expiryInput?.focus();
        return;
      }

      if (cvv.length < 3) {
        showStatus('Digite um CVV válido.');
        cvvInput?.focus();
        return;
      }

      finalizeOrder('cartao', {
        last4: digits.slice(-4),
        holder: name,
        expiry,
        installments,
      });
    });

    updatePreview();
  };

  const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const formatDateBR = (date) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);

  const generateBoletoLine = () => {
    const seed = String(Date.now()).slice(-10);
    return `34191.79001 01043.510047 91020.150008 8 ${seed}`;
  };

  const initBoletoPage = () => {
    if (!ensurePaymentContext('boleto')) return;

    const state = readCheckout();
    const dueDate = state.boletoDueDate || formatDateBR(addDays(new Date(), 3));
    const line = state.boletoLine || generateBoletoLine();

    const dueElement = document.getElementById('boletoDueDate');
    const lineInput = document.getElementById('boletoLine');

    if (dueElement) dueElement.textContent = dueDate;
    if (lineInput) lineInput.value = line;

    if (!state.boletoLine || !state.boletoDueDate) {
      saveCheckout({
        ...state,
        paymentMethod: 'boleto',
        boletoDueDate: dueDate,
        boletoLine: line,
      });
    }

    document.getElementById('copyBoletoLine')?.addEventListener('click', () => {
      copyFromInput(lineInput, 'Linha digitável copiada.');
    });

    initFinalizeButtons();
  };

  const paymentLabels = {
    pix: 'PIX',
    cartao: 'Cartão de crédito',
    boleto: 'Boleto bancário',
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const random = String(Math.floor(Math.random() * 9000) + 1000);
    return `MDH-${date}-${random}`;
  };

  const finalizeOrder = (paymentMethod, paymentDetails = {}) => {
    if (!ensureSession() || !ensureCart() || !ensureAddressState()) return;

    const session = getSession();
    const { cart, checkout, subtotal, shipping, total } = getTotals();

    const order = {
      orderNumber: generateOrderNumber(),
      createdAt: new Date().toISOString(),
      customer: session,
      items: cart,
      address: checkout.address,
      delivery: checkout.delivery,
      freight: checkout.freight,
      paymentMethod,
      paymentLabel: paymentLabels[paymentMethod] || paymentMethod,
      paymentDetails,
      subtotal,
      shipping: shipping || 0,
      total,
    };

    writeJson(LAST_ORDER_KEY, order);
    writeJson(CART_KEY, []);
    removeJson(FREIGHT_KEY);
    removeJson(CHECKOUT_KEY);
    window.MarDeHistorias?.updateCartBadge?.();

    toast({
      title: 'Pedido confirmado',
      message: 'A simulação de compra foi concluída.',
      icon: 'fa-solid fa-circle-check',
    });

    window.setTimeout(() => {
      window.location.href = 'pedido-confirmado.html';
    }, 700);
  };

  const initFinalizeButtons = () => {
    document.querySelectorAll('.js-finalize-order').forEach((button) => {
      button.addEventListener('click', () => {
        const method = button.dataset.payment || 'pix';
        finalizeOrder(method);
      });
    });
  };

  const initConfirmationPage = () => {
    const order = readJson(LAST_ORDER_KEY, null);

    if (!order) {
      const panel = document.querySelector('.order-success-panel');
      if (panel) {
        panel.innerHTML = `
          <section class="checkout-fallback">
            <div>
              <i class="fa-solid fa-circle-exclamation"></i>
              <h3>Nenhum pedido recente</h3>
              <p>Conclua uma compra pelo carrinho para visualizar esta tela de confirmação.</p>
              <a class="primary-action link-action" href="catalogo.html">Explorar catálogo <i class="fa-solid fa-arrow-right"></i></a>
            </div>
          </section>
        `;
      }
      return;
    }

    const orderDate = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(order.createdAt));

    const address = order.address || {};
    const complement = address.complement ? ` • ${escapeHtml(address.complement)}` : '';
    const delivery = order.delivery || {};
    const items = Array.isArray(order.items) ? order.items : [];

    const successMessage = document.getElementById('orderSuccessMessage');
    if (successMessage) {
      successMessage.textContent = `Pedido ${order.orderNumber} registrado em ${orderDate}.`;
    }

    const orderNumber = document.getElementById('orderNumber');
    const orderPayment = document.getElementById('orderPayment');
    const orderTotal = document.getElementById('orderTotal');
    const addressTarget = document.getElementById('orderAddress');
    const deliveryTarget = document.getElementById('orderDelivery');
    const itemsTarget = document.getElementById('confirmedItems');

    if (orderNumber) orderNumber.textContent = order.orderNumber;
    if (orderPayment) orderPayment.textContent = order.paymentLabel || 'Pagamento';
    if (orderTotal) orderTotal.textContent = formatCurrency(order.total);

    if (addressTarget) {
      addressTarget.innerHTML = `
        <p>
          ${escapeHtml(address.recipientName || '')}<br>
          ${escapeHtml(address.street || '')}, ${escapeHtml(address.number || '')}${complement}<br>
          ${escapeHtml(address.neighborhood || '')} • ${escapeHtml(address.city || '')} / ${escapeHtml(address.state || '')}<br>
          CEP ${formatCep(address.cep || '')}
        </p>
      `;
    }

    if (deliveryTarget) {
      const shippingLabel = Number(order.shipping || 0) === 0 ? 'Grátis' : formatCurrency(order.shipping);
      deliveryTarget.innerHTML = `
        <p>
          <strong>${escapeHtml(delivery.label || 'Entrega')}</strong><br>
          ${escapeHtml(delivery.delivery || 'Prazo informado no checkout')}<br>
          Frete: ${shippingLabel}
        </p>
      `;
    }

    if (itemsTarget) {
      itemsTarget.innerHTML = items.map((item) => {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const price = parseCurrency(item.price);
        return `
          <article class="confirmed-item">
            <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.title || 'Livro')}">
            <div>
              <strong>${escapeHtml(item.title || 'Livro')}</strong>
              <span>${quantity} un. × ${formatCurrency(price)}</span>
            </div>
            <em>${formatCurrency(price * quantity)}</em>
          </article>
        `;
      }).join('');
    }

    const confirmedSubtotal = document.getElementById('confirmedSubtotal');
    const confirmedShipping = document.getElementById('confirmedShipping');
    const confirmedTotal = document.getElementById('confirmedTotal');

    if (confirmedSubtotal) confirmedSubtotal.textContent = formatCurrency(order.subtotal);
    if (confirmedShipping) confirmedShipping.textContent = Number(order.shipping || 0) === 0 ? 'Grátis' : formatCurrency(order.shipping);
    if (confirmedTotal) confirmedTotal.textContent = formatCurrency(order.total);
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (page === 'checkout-endereco') initAddressPage();
    if (page === 'checkout-pagamento') initPaymentSelectionPage();
    if (page === 'pagamento-pix') initPixPage();
    if (page === 'pagamento-cartao') initCardPage();
    if (page === 'pagamento-boleto') initBoletoPage();
    if (page === 'pedido-confirmado') initConfirmationPage();
  });
})();

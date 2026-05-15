const { digitsOnly } = require('../utils/security');

const FREE_SHIPPING_LIMIT = 150;

function quoteFreight({ cep, subtotal = 0 }) {
  const digits = digitsOnly(cep);
  if (digits.length !== 8) {
    return null;
  }

  const firstDigit = Number(digits.charAt(0));

  let options;
  if (firstDigit <= 2) {
    options = [
      { id: 'padrao', label: 'Entrega padrão', price: 14.9, delivery: '3 a 5 dias úteis', freeEligible: true },
      { id: 'expressa', label: 'Entrega expressa', price: 24.9, delivery: '1 a 2 dias úteis', freeEligible: false },
    ];
  } else if (firstDigit <= 5) {
    options = [
      { id: 'padrao', label: 'Entrega padrão', price: 16.9, delivery: '4 a 7 dias úteis', freeEligible: true },
      { id: 'expressa', label: 'Entrega expressa', price: 27.9, delivery: '2 a 4 dias úteis', freeEligible: false },
    ];
  } else if (firstDigit <= 7) {
    options = [
      { id: 'padrao', label: 'Entrega padrão', price: 19.9, delivery: '5 a 9 dias úteis', freeEligible: true },
      { id: 'expressa', label: 'Entrega expressa', price: 29.9, delivery: '3 a 5 dias úteis', freeEligible: false },
    ];
  } else {
    options = [
      { id: 'padrao', label: 'Entrega padrão', price: 22.9, delivery: '6 a 10 dias úteis', freeEligible: true },
      { id: 'expressa', label: 'Entrega expressa', price: 32.9, delivery: '4 a 6 dias úteis', freeEligible: false },
    ];
  }

  const normalizedSubtotal = Number(subtotal || 0);
  const hydratedOptions = options.map((option) => ({
    ...option,
    finalPrice:
      option.freeEligible && normalizedSubtotal >= FREE_SHIPPING_LIMIT
        ? 0
        : option.price,
  }));

  return {
    cep: digits,
    freeShippingLimit: FREE_SHIPPING_LIMIT,
    options: hydratedOptions,
  };
}

function chooseFreightOption({ cep, subtotal, optionId = 'padrao' }) {
  const quote = quoteFreight({ cep, subtotal });
  if (!quote) return null;

  return quote.options.find((option) => option.id === optionId) || quote.options[0];
}

module.exports = {
  FREE_SHIPPING_LIMIT,
  quoteFreight,
  chooseFreightOption,
};

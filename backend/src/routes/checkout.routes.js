const express = require('express');
const crypto = require('node:crypto');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { sendError, sendOk } = require('../utils/response');
const {
  sanitizePlainText,
  digitsOnly,
  parseMoney,
  moneyEquals,
  encryptSensitiveText,
} = require('../utils/security');
const { quoteFreight, chooseFreightOption } = require('../services/freight.service');
const { requireAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

function formatOrderNumber() {
  const now = new Date();
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `LMH-${date}-${suffix}`;
}

function createPixCode(orderNumber, total) {
  const cents = String(Math.round(Number(total || 0) * 100)).padStart(8, '0');
  return `000201010212LMHPIX${orderNumber.replace(/[^A-Z0-9]/g, '')}${cents}BRMARDEHISTORIAS`;
}

function createBoletoLine() {
  const seed = String(Date.now()).slice(-10);
  return `34191.79001 01043.510047 91020.150008 8 ${seed}`;
}

function normalizeAddress(raw = {}) {
  return {
    destinatario: sanitizePlainText(raw.recipientName || raw.destinatario, 180),
    telefone: sanitizePlainText(raw.phone || raw.telefone, 40),
    cep: digitsOnly(raw.cep),
    logradouro: sanitizePlainText(raw.street || raw.logradouro, 220),
    numero: sanitizePlainText(raw.number || raw.numero, 30),
    complemento: sanitizePlainText(raw.complement || raw.complemento, 180),
    bairro: sanitizePlainText(raw.neighborhood || raw.bairro, 160),
    cidade: sanitizePlainText(raw.city || raw.cidade, 160),
    estado: sanitizePlainText(raw.state || raw.estado, 2).toUpperCase(),
  };
}

function validateAddress(address) {
  if (address.destinatario.length < 3) return 'Informe o nome completo do destinatário.';
  if (digitsOnly(address.telefone).length < 10) return 'Informe um telefone válido.';
  if (address.cep.length !== 8) return 'Informe um CEP válido com 8 dígitos.';
  if (!address.logradouro || !address.numero || !address.bairro || !address.cidade) {
    return 'Preencha os campos obrigatórios do endereço.';
  }
  if (address.estado.length !== 2) return 'Informe a UF com 2 letras.';
  return null;
}

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item) => ({
      slug: sanitizePlainText(item?.id || item?.slug, 220),
      quantity: Math.max(1, Math.min(99, Number(item?.quantity || item?.quantidade || 1))),
      submittedPrice: parseMoney(item?.price || item?.preco || ''),
      image: sanitizePlainText(item?.image || item?.imagem, 255),
    }))
    .filter((item) => item.slug);
}

function toFixedMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

router.post(
  '/frete/cotacoes',
  asyncHandler(async (req, res) => {
    const cep = digitsOnly(req.body?.cep);
    const subtotal = parseMoney(req.body?.subtotal || 0);
    const quote = quoteFreight({
      cep,
      subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    });

    if (!quote) {
      return sendError(res, 400, 'Digite um CEP válido com 8 números.');
    }

    return sendOk(res, {
      cotacao: quote,
    });
  })
);

router.post(
  '/pedidos',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = normalizeItems(req.body?.items);
    const address = normalizeAddress(req.body?.address || {});
    const deliveryId = sanitizePlainText(req.body?.delivery?.id || 'padrao', 60);
    const paymentMethod = sanitizePlainText(req.body?.paymentMethod || '', 20);
    const paymentDetails = req.body?.paymentDetails || {};

    if (!items.length) {
      return sendError(res, 400, 'O pedido precisa ter ao menos um item.');
    }

    const addressError = validateAddress(address);
    if (addressError) {
      return sendError(res, 400, addressError);
    }

    if (!['pix', 'cartao', 'boleto'].includes(paymentMethod)) {
      return sendError(res, 400, 'Selecione uma forma de pagamento válida.');
    }

    const slugs = [...new Set(items.map((item) => item.slug))];
    const placeholders = slugs.map(() => '?').join(', ');

    const [bookRows] = await pool.execute(
      `
      SELECT
        l.livro_id,
        l.slug,
        l.titulo,
        l.preco,
        l.preco_promocional,
        l.estoque,
        a.nome AS autor
      FROM livros l
      INNER JOIN autores a ON a.autor_id = l.autor_id
      WHERE l.slug IN (${placeholders})
        AND l.ativo = TRUE
      `,
      slugs
    );

    if (bookRows.length !== slugs.length) {
      return sendError(res, 404, 'Um ou mais livros não foram encontrados.');
    }

    const booksBySlug = new Map(bookRows.map((book) => [book.slug, book]));
    const orderItems = [];

    for (const item of items) {
      const book = booksBySlug.get(item.slug);
      const quantity = Math.max(1, Math.min(99, Number(item.quantity || 1)));

      if (!book) {
        return sendError(res, 404, `Livro não encontrado: ${item.slug}.`);
      }

      if (Number(book.estoque || 0) < quantity) {
        return sendError(res, 409, `Estoque insuficiente para ${book.titulo}.`);
      }

      const regularPrice = toFixedMoney(book.preco);
      const promoPrice =
        book.preco_promocional === null || book.preco_promocional === undefined
          ? null
          : toFixedMoney(book.preco_promocional);

      let acceptedPrice = regularPrice;
      if (Number.isFinite(item.submittedPrice)) {
        if (moneyEquals(item.submittedPrice, regularPrice)) {
          acceptedPrice = regularPrice;
        } else if (promoPrice !== null && moneyEquals(item.submittedPrice, promoPrice)) {
          acceptedPrice = promoPrice;
        } else {
          return sendError(
            res,
            409,
            `O preço de ${book.titulo} mudou. Atualize o carrinho e tente novamente.`
          );
        }
      }

      const subtotalItem = toFixedMoney(acceptedPrice * quantity);

      orderItems.push({
        livroId: book.livro_id,
        slug: book.slug,
        titulo: book.titulo,
        autor: book.autor,
        quantidade: quantity,
        precoUnitario: acceptedPrice,
        subtotalItem,
      });
    }

    const subtotal = toFixedMoney(
      orderItems.reduce((sum, item) => sum + Number(item.subtotalItem || 0), 0)
    );
    const freightOption = chooseFreightOption({
      cep: address.cep,
      subtotal,
      optionId: deliveryId,
    });

    if (!freightOption) {
      return sendError(res, 400, 'Não foi possível calcular o frete para o CEP informado.');
    }

    const shipping = toFixedMoney(freightOption.finalPrice ?? freightOption.price ?? 0);
    const discount = 0;
    const total = toFixedMoney(subtotal - discount + shipping);
    const orderNumber = formatOrderNumber();

    const paymentStatus = paymentMethod === 'cartao' ? 'capturado' : 'pendente';
    const orderStatus = paymentMethod === 'cartao' ? 'pago' : 'aguardando_pagamento';
    const paidAt = paymentMethod === 'cartao' ? new Date() : null;

    const cardFinal4 = digitsOnly(paymentDetails?.last4 || '').slice(-4) || null;
    const installments = Math.max(1, Math.min(24, Number(paymentDetails?.installments || 1)));

    const encryptedPhone = encryptSensitiveText(address.telefone);
    const pixCode = paymentMethod === 'pix' ? createPixCode(orderNumber, total) : null;
    const pixExpiresAt =
      paymentMethod === 'pix' ? new Date(Date.now() + 30 * 60 * 1000) : null;
    const boletoLine = paymentMethod === 'boleto' ? createBoletoLine() : null;
    const boletoDueDate =
      paymentMethod === 'boleto'
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        : null;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [orderResult] = await connection.execute(
        `
        INSERT INTO pedidos (
          numero_pedido,
          usuario_id,
          status,
          subtotal,
          desconto,
          frete,
          total,
          pago_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          orderNumber,
          req.user.usuarioId,
          orderStatus,
          subtotal,
          discount,
          shipping,
          total,
          paidAt,
        ]
      );

      const pedidoId = orderResult.insertId;

      for (const item of orderItems) {
        await connection.execute(
          `
          INSERT INTO pedido_itens (
            pedido_id,
            livro_id,
            titulo_snapshot,
            autor_snapshot,
            slug_snapshot,
            quantidade,
            preco_unitario,
            subtotal_item
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            pedidoId,
            item.livroId,
            item.titulo,
            item.autor,
            item.slug,
            item.quantidade,
            item.precoUnitario,
            item.subtotalItem,
          ]
        );
      }

      await connection.execute(
        `
        INSERT INTO pedido_enderecos (
          pedido_id,
          destinatario,
          telefone_ciphertext,
          telefone_iv,
          telefone_auth_tag,
          cep,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          modalidade_entrega,
          prazo_entrega
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          pedidoId,
          address.destinatario,
          encryptedPhone.ciphertext,
          encryptedPhone.iv,
          encryptedPhone.authTag,
          address.cep,
          address.logradouro,
          address.numero,
          address.complemento || null,
          address.bairro,
          address.cidade,
          address.estado,
          freightOption.label,
          freightOption.delivery,
        ]
      );

      await connection.execute(
        `
        INSERT INTO pagamentos (
          pedido_id,
          tentativa,
          metodo,
          status,
          valor,
          gateway,
          gateway_referencia,
          cartao_bandeira,
          cartao_final4,
          parcelas,
          pix_copia_cola,
          pix_expira_em,
          boleto_linha_digitavel,
          boleto_vencimento,
          metadados_sanitizados,
          confirmado_em
        ) VALUES (?, 1, ?, ?, ?, 'simulador-local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          pedidoId,
          paymentMethod,
          paymentStatus,
          total,
          `LMH-${orderNumber}-${paymentMethod}`,
          paymentMethod === 'cartao' ? sanitizePlainText(paymentDetails?.brand || '', 60) || null : null,
          paymentMethod === 'cartao' ? cardFinal4 : null,
          paymentMethod === 'cartao' ? installments : null,
          pixCode,
          pixExpiresAt,
          boletoLine,
          boletoDueDate,
          JSON.stringify({
            ambiente: 'simulacao-local',
            metodo: paymentMethod,
          }),
          paymentMethod === 'cartao' ? new Date() : null,
        ]
      );

      await connection.commit();

      return sendOk(
        res,
        {
          message: 'Pedido registrado com sucesso.',
          pedido: {
            id: pedidoId,
            numeroPedido: orderNumber,
            status: orderStatus,
            subtotal,
            desconto: discount,
            frete: shipping,
            total,
            pagamento: {
              metodo: paymentMethod,
              status: paymentStatus,
              pixCode,
              pixExpiraEm: pixExpiresAt,
              boletoLinhaDigitavel: boletoLine,
              boletoVencimento: boletoDueDate,
            },
            entrega: {
              id: freightOption.id,
              label: freightOption.label,
              delivery: freightOption.delivery,
              price: shipping,
            },
          },
        },
        201
      );
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

module.exports = router;

const express = require('express');
const { pool } = require('../config/db');
const asyncHandler = require('../utils/async-handler');
const { sendError, sendOk } = require('../utils/response');
const { sanitizePlainText } = require('../utils/security');

const router = express.Router();

function mapCatalogBook(row) {
  return {
    id: row.livro_id,
    slug: row.slug,
    titulo: row.titulo,
    subtitulo: row.subtitulo,
    autor: row.autor,
    preco: Number(row.preco || 0),
    precoPromocional:
      row.preco_promocional === null || row.preco_promocional === undefined
        ? null
        : Number(row.preco_promocional),
    precoExibicao: Number(row.preco_exibicao || row.preco || 0),
    estoque: Number(row.estoque || 0),
    destaque: Boolean(row.destaque),
    novoTitulo: Boolean(row.novo_titulo),
    urlPagina: row.url_pagina,
    capaUrl: row.capa_url,
    mediaAvaliacoes: Number(row.media_avaliacoes || 0),
    totalAvaliacoes: Number(row.total_avaliacoes || 0),
    categorias: row.categorias ? String(row.categorias).split(' | ') : [],
  };
}

router.get(
  '/livros',
  asyncHandler(async (req, res) => {
    const busca = sanitizePlainText(req.query?.busca || '', 180);
    const categoria = sanitizePlainText(req.query?.categoria || '', 120);
    const autor = sanitizePlainText(req.query?.autor || '', 180);
    const somenteOfertas = String(req.query?.ofertas || '') === '1';
    const somenteDestaques = String(req.query?.destaque || '') === '1';
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 100)));
    const offset = Math.max(0, Number(req.query?.offset || 0));

    const where = ['v.ativo = TRUE'];
    const params = [];

    if (busca) {
      where.push(
        `(
          v.titulo LIKE ?
          OR v.autor LIKE ?
          OR EXISTS (
            SELECT 1
            FROM livro_categorias lcb
            INNER JOIN categorias cb ON cb.categoria_id = lcb.categoria_id
            WHERE lcb.livro_id = v.livro_id
              AND cb.nome LIKE ?
          )
        )`
      );
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }

    if (categoria) {
      where.push(
        `EXISTS (
          SELECT 1
          FROM livro_categorias lcc
          INNER JOIN categorias cc ON cc.categoria_id = lcc.categoria_id
          WHERE lcc.livro_id = v.livro_id
            AND cc.nome = ?
        )`
      );
      params.push(categoria);
    }

    if (autor) {
      where.push('v.autor = ?');
      params.push(autor);
    }

    if (somenteOfertas) {
      where.push('v.preco_promocional IS NOT NULL AND v.preco_promocional < v.preco');
    }

    if (somenteDestaques) {
      where.push('v.destaque = TRUE');
    }

    const orderByMap = {
      'preco-asc': 'v.preco_exibicao ASC, v.titulo ASC',
      'preco-desc': 'v.preco_exibicao DESC, v.titulo ASC',
      'titulo-asc': 'v.titulo ASC',
      'titulo-desc': 'v.titulo DESC',
      destaque: 'v.destaque DESC, v.novo_titulo DESC, v.titulo ASC',
    };

    const orderBy = orderByMap[String(req.query?.ordem || 'destaque')] || orderByMap.destaque;

    const [rows] = await pool.execute(
      `
      SELECT
        v.*,
        COALESCE((
          SELECT GROUP_CONCAT(c.nome ORDER BY c.nome SEPARATOR ' | ')
          FROM livro_categorias lc
          INNER JOIN categorias c ON c.categoria_id = lc.categoria_id
          WHERE lc.livro_id = v.livro_id
        ), '') AS categorias
      FROM vw_livros_catalogo v
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return sendOk(res, {
      livros: rows.map(mapCatalogBook),
      totalRetornado: rows.length,
    });
  })
);

router.get(
  '/livros/:slug',
  asyncHandler(async (req, res) => {
    const slug = sanitizePlainText(req.params?.slug || '', 220);

    const [bookRows] = await pool.execute(
      `
      SELECT
        l.livro_id,
        l.slug,
        l.titulo,
        l.subtitulo,
        l.descricao,
        l.isbn13,
        l.editora,
        l.idioma,
        l.ano_publicacao,
        l.numero_paginas,
        l.formato,
        l.preco,
        l.preco_promocional,
        l.estoque,
        l.destaque,
        l.novo_titulo,
        l.url_pagina,
        l.capa_url,
        a.nome AS autor
      FROM livros l
      INNER JOIN autores a ON a.autor_id = l.autor_id
      WHERE l.slug = ?
        AND l.ativo = TRUE
      LIMIT 1
      `,
      [slug]
    );

    const book = bookRows[0];

    if (!book) {
      return sendError(res, 404, 'Livro não encontrado.');
    }

    const [categories] = await pool.execute(
      `
      SELECT c.nome, c.slug
      FROM livro_categorias lc
      INNER JOIN categorias c ON c.categoria_id = lc.categoria_id
      WHERE lc.livro_id = ?
      ORDER BY c.nome ASC
      `,
      [book.livro_id]
    );

    const [images] = await pool.execute(
      `
      SELECT tipo, url, texto_alternativo, ordem
      FROM imagens_livros
      WHERE livro_id = ?
      ORDER BY ordem ASC, imagem_livro_id ASC
      `,
      [book.livro_id]
    );

    const [reviews] = await pool.execute(
      `
      SELECT
        av.avaliacao_livro_id,
        av.nota,
        av.titulo,
        av.comentario,
        av.compra_verificada,
        av.criado_em,
        u.nome AS autor_nome
      FROM avaliacoes_livros av
      INNER JOIN usuarios u ON u.usuario_id = av.usuario_id
      WHERE av.livro_id = ?
        AND av.status = 'aprovada'
      ORDER BY av.criado_em DESC
      LIMIT 20
      `,
      [book.livro_id]
    );

    return sendOk(res, {
      livro: {
        id: book.livro_id,
        slug: book.slug,
        titulo: book.titulo,
        subtitulo: book.subtitulo,
        descricao: book.descricao,
        isbn13: book.isbn13,
        editora: book.editora,
        idioma: book.idioma,
        anoPublicacao: book.ano_publicacao,
        numeroPaginas: book.numero_paginas,
        formato: book.formato,
        preco: Number(book.preco || 0),
        precoPromocional:
          book.preco_promocional === null || book.preco_promocional === undefined
            ? null
            : Number(book.preco_promocional),
        estoque: Number(book.estoque || 0),
        destaque: Boolean(book.destaque),
        novoTitulo: Boolean(book.novo_titulo),
        urlPagina: book.url_pagina,
        capaUrl: book.capa_url,
        autor: book.autor,
        categorias,
        imagens: images.map((image) => ({
          tipo: image.tipo,
          url: image.url,
          textoAlternativo: image.texto_alternativo,
          ordem: image.ordem,
        })),
        avaliacoes: reviews.map((review) => ({
          id: review.avaliacao_livro_id,
          nota: review.nota,
          titulo: review.titulo,
          comentario: review.comentario,
          compraVerificada: Boolean(review.compra_verificada),
          criadoEm: review.criado_em,
          autorNome: review.autor_nome,
        })),
      },
    });
  })
);

router.get(
  '/categorias',
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `
      SELECT categoria_id, nome, slug, descricao
      FROM categorias
      WHERE ativo = TRUE
      ORDER BY nome ASC
      `
    );

    return sendOk(res, {
      categorias: rows.map((row) => ({
        id: row.categoria_id,
        nome: row.nome,
        slug: row.slug,
        descricao: row.descricao,
      })),
    });
  })
);

module.exports = router;

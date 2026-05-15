const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const { testConnection } = require('./src/config/db');
const { optionalAuth } = require('./src/middlewares/auth.middleware');
const authRoutes = require('./src/routes/auth.routes');
const catalogRoutes = require('./src/routes/catalog.routes');
const formsRoutes = require('./src/routes/forms.routes');
const checkoutRoutes = require('./src/routes/checkout.routes');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const ASSETS_ROOT = path.join(FRONTEND_ROOT, 'assets');

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com',
        ],
        fontSrc: [
          "'self'",
          'data:',
          'https://fonts.gstatic.com',
          'https://cdnjs.cloudflare.com',
        ],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    ...(String(process.env.NODE_ENV || 'development') === 'production'
      ? {}
      : { strictTransportSecurity: false }),
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  '/assets',
  express.static(ASSETS_ROOT, {
    dotfiles: 'ignore',
    maxAge: '1h',
    fallthrough: true,
  })
);

app.get(
  '/api/health',
  async (req, res, next) => {
    try {
      const dbOk = await testConnection();
      return res.json({
        ok: true,
        api: 'online',
        banco: dbOk ? 'conectado' : 'indisponível',
        database: process.env.DB_NAME || 'LMH',
      });
    } catch (error) {
      return res.status(503).json({
        ok: false,
        api: 'online',
        banco: 'indisponível',
        database: process.env.DB_NAME || 'LMH',
        message: 'A API iniciou, mas não conseguiu conectar ao MySQL.',
      });
    }
  }
);

app.use('/api', optionalAuth);
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', formsRoutes);
app.use('/api', checkoutRoutes);

app.get('/', (_req, res) => {
  return res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

app.get('/:file', (req, res, next) => {
  const file = String(req.params.file || '');

  if (!/^[a-z0-9-]+\.html$/i.test(file)) {
    return next();
  }

  const target = path.join(FRONTEND_ROOT, file);
  if (!target.startsWith(FRONTEND_ROOT) || !fs.existsSync(target)) {
    return next();
  }

  return res.sendFile(target);
});

app.use('/api', (_req, res) => {
  return res.status(404).json({
    ok: false,
    message: 'Rota da API não encontrada.',
  });
});

app.use((_req, res) => {
  return res.status(404).sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

app.use((error, req, res, _next) => {
  console.error('[LMH API]', error);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      ok: false,
      message: 'Ocorreu um erro interno na API.',
    });
  }

  return res.status(500).send('Erro interno do servidor.');
});

app.listen(PORT, () => {
  console.log(`Mar de Histórias disponível em http://localhost:${PORT}`);
  console.log(`API em http://localhost:${PORT}/api/health`);
});

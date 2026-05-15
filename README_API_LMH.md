# Mar de Histórias — Front + API + MySQL

Este pacote contém o front-end da livraria e uma API Node.js/Express integrada ao banco MySQL `LMH`.

## O que já está conectado

- Cadastro e login com senha armazenada como hash no banco
- Sessão via cookie HttpOnly
- Recuperação de senha em modo local
- Newsletter gravada no MySQL
- Formulário de contato gravado no MySQL
- Catálogo consumindo `/api/livros`
- Cálculo de frete via API
- Finalização de pedido via API, com itens, endereço e pagamento simulados
- Telefone do pedido criptografado no backend antes de ir ao banco
- Pagamento sem armazenar número completo do cartão nem CVV

## Estrutura importante

- `database/LMH.sql` — banco completo
- `backend/.env` — configuração local já preenchida
- `backend/server.js` — servidor da aplicação
- `backend/src/routes/` — rotas da API

## Como rodar

### 1. Importar o banco

No MySQL Workbench:
1. Abra o Workbench.
2. Vá em **Server > Data Import** ou execute o arquivo SQL em uma aba.
3. Rode `database/LMH.sql`.

Ou no terminal:

```bash
mysql -u root -p < database/LMH.sql
```

Quando pedir a senha do MySQL, use:

```text
senac
```

### 2. Instalar dependências da API

Abra o terminal dentro da pasta `backend`:

```bash
npm install
```

### 3. Iniciar a aplicação

```bash
npm run dev
```

### 4. Abrir no navegador

```text
http://localhost:3000
```

Teste da API:

```text
http://localhost:3000/api/health
```

## Configuração do banco

O arquivo `backend/.env` foi deixado assim:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=senac
DB_NAME=LMH
```

Caso seu usuário MySQL não seja `root`, altere apenas `DB_USER`.

## Rotas principais

### Catálogo
- `GET /api/livros`
- `GET /api/livros/:slug`
- `GET /api/categorias`

### Autenticação
- `POST /api/auth/cadastro`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/recuperacao/iniciar`
- `POST /api/auth/recuperacao/redefinir`

### Loja
- `POST /api/frete/cotacoes`
- `POST /api/pedidos`

### Formulários
- `POST /api/newsletter`
- `POST /api/contato`
- `POST /api/titulos-solicitados`

## Observações de segurança

- Troque `APP_HASH_SECRET` e `FIELD_ENCRYPTION_KEY` antes de produção.
- Em produção, use `COOKIE_SECURE=true` com HTTPS.
- O modo de recuperação de senha retorna um token local apenas em `NODE_ENV=development`.
- O sistema de pagamento é uma simulação; para produção, conecte um gateway real.

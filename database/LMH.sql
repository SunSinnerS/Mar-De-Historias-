-- =====================================================================
-- BANCO DE DADOS: Mar de Histórias
-- MySQL 8.4+
-- Modelagem para: cadastro, autenticação, catálogo, categorias,
-- avaliações, favoritos, carrinho, checkout, pedidos, pagamentos,
-- newsletter, contato e segurança.
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS LMH
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE LMH;

-- ---------------------------------------------------------------------
-- CRIPTOGRAFIA EM REPOUSO (OPCIONAL, PRODUÇÃO)
-- Requer keyring/tablespace encryption devidamente configurado no MySQL.
-- Após configurar o servidor, um DBA pode habilitar:
-- ALTER DATABASE LMH DEFAULT ENCRYPTION = 'Y';
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1) USUÁRIOS E AUTENTICAÇÃO
-- =====================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  usuario_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL COMMENT 'UUID gerado pela aplicação; não expor o ID incremental em URLs públicas.',
  nome VARCHAR(120) NOT NULL,
  sobrenome VARCHAR(120) NULL,
  email VARCHAR(254) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL COMMENT 'Hash de senha gerado no backend com esquema apropriado; nunca armazenar senha em texto puro.',
  papel ENUM('cliente', 'atendente', 'admin') NOT NULL DEFAULT 'cliente',
  status ENUM('pendente_email', 'ativo', 'bloqueado', 'excluido') NOT NULL DEFAULT 'pendente_email',
  email_verificado_em DATETIME NULL,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  falhas_login SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_ate DATETIME NULL,
  ultimo_login_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  excluido_em DATETIME NULL,
  PRIMARY KEY (usuario_id),
  UNIQUE KEY uk_usuarios_public_id (public_id),
  UNIQUE KEY uk_usuarios_email (email),
  KEY idx_usuarios_status (status),
  KEY idx_usuarios_criado_em (criado_em),
  CONSTRAINT chk_usuarios_falhas_login CHECK (falhas_login <= 100)
) ENGINE=InnoDB COMMENT='Contas de clientes, atendentes e administradores.';

CREATE TABLE IF NOT EXISTS documentos_legais (
  documento_legal_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipo ENUM('termos_uso', 'politica_privacidade') NOT NULL,
  versao VARCHAR(30) NOT NULL,
  hash_conteudo CHAR(64) NOT NULL COMMENT 'SHA-256 do conteúdo publicado, para rastrear a versão aceita.',
  publicado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (documento_legal_id),
  UNIQUE KEY uk_documentos_legais_tipo_versao (tipo, versao),
  KEY idx_documentos_legais_ativo (ativo)
) ENGINE=InnoDB COMMENT='Versões de termos e política de privacidade.';

CREATE TABLE IF NOT EXISTS aceites_documentos (
  aceite_documento_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  documento_legal_id BIGINT UNSIGNED NOT NULL,
  aceito_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash BINARY(32) NULL COMMENT 'HMAC/hash do IP gerado pela aplicação, quando necessário.',
  user_agent_hash BINARY(32) NULL COMMENT 'HMAC/hash do user-agent gerado pela aplicação, quando necessário.',
  PRIMARY KEY (aceite_documento_id),
  UNIQUE KEY uk_aceite_documento (usuario_id, documento_legal_id),
  KEY idx_aceites_documentos_aceito_em (aceito_em),
  CONSTRAINT fk_aceites_documentos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_aceites_documentos_documento
    FOREIGN KEY (documento_legal_id) REFERENCES documentos_legais (documento_legal_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Registro de aceite dos documentos legais.';

CREATE TABLE IF NOT EXISTS tokens_verificacao_email (
  token_verificacao_email_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL COMMENT 'Hash de token aleatório de alta entropia; nunca guardar token em claro.',
  expira_em DATETIME NOT NULL,
  usado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_verificacao_email_id),
  UNIQUE KEY uk_tokens_verificacao_email_hash (token_hash),
  KEY idx_tokens_verificacao_email_usuario (usuario_id),
  KEY idx_tokens_verificacao_email_expira (expira_em),
  CONSTRAINT fk_tokens_verificacao_email_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Tokens de verificação de e-mail.';

CREATE TABLE IF NOT EXISTS tokens_redefinicao_senha (
  token_redefinicao_senha_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  token_hash BINARY(32) NOT NULL COMMENT 'Hash de token aleatório de alta entropia; nunca guardar token em claro.',
  expira_em DATETIME NOT NULL,
  usado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_redefinicao_senha_id),
  UNIQUE KEY uk_tokens_redefinicao_senha_hash (token_hash),
  KEY idx_tokens_redefinicao_senha_usuario (usuario_id),
  KEY idx_tokens_redefinicao_senha_expira (expira_em),
  CONSTRAINT fk_tokens_redefinicao_senha_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Tokens seguros para recuperação de senha.';

CREATE TABLE IF NOT EXISTS sessoes_usuarios (
  sessao_usuario_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  refresh_token_hash BINARY(32) NOT NULL COMMENT 'Hash do refresh token; o token real deve ficar apenas no cliente/cookie seguro.',
  ip_hash BINARY(32) NULL,
  user_agent_hash BINARY(32) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_uso_em DATETIME NULL,
  expira_em DATETIME NOT NULL,
  revogado_em DATETIME NULL,
  PRIMARY KEY (sessao_usuario_id),
  UNIQUE KEY uk_sessoes_refresh_token_hash (refresh_token_hash),
  KEY idx_sessoes_usuario (usuario_id),
  KEY idx_sessoes_expira (expira_em),
  CONSTRAINT fk_sessoes_usuarios_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Sessões persistentes e revogáveis.';

-- =====================================================================
-- 2) CATÁLOGO DE LIVROS
-- =====================================================================

CREATE TABLE IF NOT EXISTS autores (
  autor_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(180) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  biografia TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (autor_id),
  UNIQUE KEY uk_autores_slug (slug),
  KEY idx_autores_nome (nome)
) ENGINE=InnoDB COMMENT='Autores dos livros.';

CREATE TABLE IF NOT EXISTS categorias (
  categoria_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  descricao VARCHAR(255) NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  ordem_exibicao SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (categoria_id),
  UNIQUE KEY uk_categorias_slug (slug),
  KEY idx_categorias_ativa_ordem (ativa, ordem_exibicao)
) ENGINE=InnoDB COMMENT='Categorias usadas no catálogo e páginas de coleção.';

CREATE TABLE IF NOT EXISTS livros (
  livro_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  autor_id BIGINT UNSIGNED NOT NULL,
  slug VARCHAR(220) NOT NULL,
  titulo VARCHAR(220) NOT NULL,
  subtitulo VARCHAR(220) NULL,
  descricao TEXT NOT NULL,
  isbn13 CHAR(13) NULL,
  editora VARCHAR(160) NULL,
  idioma VARCHAR(60) NULL DEFAULT 'Português',
  ano_publicacao SMALLINT UNSIGNED NULL,
  numero_paginas SMALLINT UNSIGNED NULL,
  formato ENUM('fisico', 'ebook', 'audiobook') NOT NULL DEFAULT 'fisico',
  preco DECIMAL(10,2) NOT NULL,
  preco_promocional DECIMAL(10,2) NULL,
  estoque INT UNSIGNED NOT NULL DEFAULT 0,
  peso_gramas INT UNSIGNED NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  destaque BOOLEAN NOT NULL DEFAULT FALSE,
  novo_titulo BOOLEAN NOT NULL DEFAULT FALSE,
  url_pagina VARCHAR(255) NULL COMMENT 'Ex.: harry-potter.html no front estático.',
  capa_url VARCHAR(255) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (livro_id),
  UNIQUE KEY uk_livros_slug (slug),
  UNIQUE KEY uk_livros_isbn13 (isbn13),
  KEY idx_livros_autor (autor_id),
  KEY idx_livros_ativo_destaque (ativo, destaque),
  KEY idx_livros_preco (preco),
  FULLTEXT KEY ftx_livros_busca (titulo, subtitulo, descricao),
  CONSTRAINT fk_livros_autor
    FOREIGN KEY (autor_id) REFERENCES autores (autor_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_livros_preco CHECK (preco >= 0),
  CONSTRAINT chk_livros_preco_promocional CHECK (preco_promocional IS NULL OR preco_promocional >= 0),
  CONSTRAINT chk_livros_preco_promocional_menor CHECK (preco_promocional IS NULL OR preco_promocional <= preco)
) ENGINE=InnoDB COMMENT='Produtos/livros disponíveis na livraria.';

CREATE TABLE IF NOT EXISTS livro_categorias (
  livro_id BIGINT UNSIGNED NOT NULL,
  categoria_id BIGINT UNSIGNED NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (livro_id, categoria_id),
  KEY idx_livro_categorias_categoria (categoria_id),
  CONSTRAINT fk_livro_categorias_livro
    FOREIGN KEY (livro_id) REFERENCES livros (livro_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_livro_categorias_categoria
    FOREIGN KEY (categoria_id) REFERENCES categorias (categoria_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB COMMENT='Relação N:N entre livros e categorias.';

CREATE TABLE IF NOT EXISTS imagens_livros (
  imagem_livro_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  livro_id BIGINT UNSIGNED NOT NULL,
  url_imagem VARCHAR(255) NOT NULL,
  texto_alt VARCHAR(255) NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  ordem_exibicao SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (imagem_livro_id),
  UNIQUE KEY uk_imagens_livros_livro_url (livro_id, url_imagem),
  KEY idx_imagens_livros_livro (livro_id),
  KEY idx_imagens_livros_principal (livro_id, principal),
  CONSTRAINT fk_imagens_livros_livro
    FOREIGN KEY (livro_id) REFERENCES livros (livro_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Galeria de imagens de produto.';

-- =====================================================================
-- 3) INTERAÇÕES DO CLIENTE: AVALIAÇÕES, FAVORITOS E CARRINHO
-- =====================================================================

CREATE TABLE IF NOT EXISTS avaliacoes_livros (
  avaliacao_livro_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  livro_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  nota TINYINT UNSIGNED NOT NULL,
  titulo VARCHAR(180) NULL,
  comentario TEXT NOT NULL,
  compra_verificada BOOLEAN NOT NULL DEFAULT FALSE,
  status ENUM('pendente', 'aprovada', 'reprovada') NOT NULL DEFAULT 'pendente',
  moderado_por BIGINT UNSIGNED NULL,
  moderado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (avaliacao_livro_id),
  UNIQUE KEY uk_avaliacoes_livros_usuario_livro (usuario_id, livro_id),
  KEY idx_avaliacoes_livros_livro_status (livro_id, status),
  KEY idx_avaliacoes_livros_usuario (usuario_id),
  CONSTRAINT fk_avaliacoes_livros_livro
    FOREIGN KEY (livro_id) REFERENCES livros (livro_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_avaliacoes_livros_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_avaliacoes_livros_moderador
    FOREIGN KEY (moderado_por) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_avaliacoes_nota CHECK (nota BETWEEN 1 AND 5)
) ENGINE=InnoDB COMMENT='Avaliações de livros enviadas por clientes.';

CREATE TABLE IF NOT EXISTS favoritos (
  favorito_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  livro_id BIGINT UNSIGNED NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (favorito_id),
  UNIQUE KEY uk_favoritos_usuario_livro (usuario_id, livro_id),
  KEY idx_favoritos_livro (livro_id),
  CONSTRAINT fk_favoritos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_favoritos_livro
    FOREIGN KEY (livro_id) REFERENCES livros (livro_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Lista de favoritos do cliente.';

CREATE TABLE IF NOT EXISTS carrinhos (
  carrinho_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  session_public_id CHAR(64) NULL COMMENT 'Identificador anônimo gerado pelo backend para carrinho sem login.',
  status ENUM('aberto', 'convertido', 'abandonado', 'expirado') NOT NULL DEFAULT 'aberto',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expira_em DATETIME NULL,
  PRIMARY KEY (carrinho_id),
  KEY idx_carrinhos_usuario_status (usuario_id, status),
  KEY idx_carrinhos_session (session_public_id),
  CONSTRAINT fk_carrinhos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Carrinho persistente para usuários logados ou visitantes.';

CREATE TABLE IF NOT EXISTS carrinho_itens (
  carrinho_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  carrinho_id BIGINT UNSIGNED NOT NULL,
  livro_id BIGINT UNSIGNED NOT NULL,
  quantidade SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  preco_unitario_snapshot DECIMAL(10,2) NOT NULL COMMENT 'Preço observado ao adicionar ao carrinho; o checkout deve validar o preço atual novamente.',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (carrinho_item_id),
  UNIQUE KEY uk_carrinho_itens_carrinho_livro (carrinho_id, livro_id),
  KEY idx_carrinho_itens_livro (livro_id),
  CONSTRAINT fk_carrinho_itens_carrinho
    FOREIGN KEY (carrinho_id) REFERENCES carrinhos (carrinho_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_carrinho_itens_livro
    FOREIGN KEY (livro_id) REFERENCES livros (livro_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_carrinho_itens_quantidade CHECK (quantidade BETWEEN 1 AND 99),
  CONSTRAINT chk_carrinho_itens_preco CHECK (preco_unitario_snapshot >= 0)
) ENGINE=InnoDB COMMENT='Itens adicionados ao carrinho.';

-- =====================================================================
-- 4) ENDEREÇOS, FRETE, PEDIDOS E PAGAMENTOS
-- =====================================================================

CREATE TABLE IF NOT EXISTS enderecos_usuarios (
  endereco_usuario_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  apelido VARCHAR(80) NULL,
  destinatario VARCHAR(180) NOT NULL,
  telefone_ciphertext VARBINARY(512) NULL COMMENT 'Telefone criptografado no backend com cifra autenticada.',
  telefone_iv BINARY(12) NULL,
  telefone_auth_tag BINARY(16) NULL,
  cep CHAR(8) NOT NULL,
  logradouro VARCHAR(220) NOT NULL,
  numero VARCHAR(30) NOT NULL,
  complemento VARCHAR(180) NULL,
  bairro VARCHAR(160) NOT NULL,
  cidade VARCHAR(160) NOT NULL,
  estado CHAR(2) NOT NULL,
  principal BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (endereco_usuario_id),
  KEY idx_enderecos_usuario (usuario_id),
  KEY idx_enderecos_usuario_principal (usuario_id, principal),
  KEY idx_enderecos_cep (cep),
  CONSTRAINT fk_enderecos_usuarios_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_enderecos_estado CHECK (CHAR_LENGTH(estado) = 2),
  CONSTRAINT chk_enderecos_cep CHECK (CHAR_LENGTH(cep) = 8)
) ENGINE=InnoDB COMMENT='Endereços salvos do cliente.';

CREATE TABLE IF NOT EXISTS frete_cotacoes (
  frete_cotacao_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  carrinho_id BIGINT UNSIGNED NULL,
  usuario_id BIGINT UNSIGNED NULL,
  cep_destino CHAR(8) NOT NULL,
  modalidade VARCHAR(120) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  prazo_min_dias SMALLINT UNSIGNED NULL,
  prazo_max_dias SMALLINT UNSIGNED NULL,
  provedor VARCHAR(120) NULL,
  selecionada BOOLEAN NOT NULL DEFAULT FALSE,
  criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em DATETIME NULL,
  PRIMARY KEY (frete_cotacao_id),
  KEY idx_frete_cotacoes_carrinho (carrinho_id),
  KEY idx_frete_cotacoes_usuario (usuario_id),
  KEY idx_frete_cotacoes_cep (cep_destino),
  CONSTRAINT fk_frete_cotacoes_carrinho
    FOREIGN KEY (carrinho_id) REFERENCES carrinhos (carrinho_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_frete_cotacoes_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_frete_cotacoes_valor CHECK (valor >= 0),
  CONSTRAINT chk_frete_cotacoes_prazo CHECK (
    prazo_min_dias IS NULL OR prazo_max_dias IS NULL OR prazo_min_dias <= prazo_max_dias
  )
) ENGINE=InnoDB COMMENT='Histórico opcional de cotações de frete.';

CREATE TABLE IF NOT EXISTS pedidos (
  pedido_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero_pedido VARCHAR(50) NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  carrinho_id BIGINT UNSIGNED NULL,
  status ENUM('aguardando_pagamento', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado') NOT NULL DEFAULT 'aguardando_pagamento',
  subtotal DECIMAL(10,2) NOT NULL,
  desconto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  frete DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL,
  observacoes_cliente VARCHAR(500) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  pago_em DATETIME NULL,
  cancelado_em DATETIME NULL,
  PRIMARY KEY (pedido_id),
  UNIQUE KEY uk_pedidos_numero (numero_pedido),
  KEY idx_pedidos_usuario_status (usuario_id, status),
  KEY idx_pedidos_criado_em (criado_em),
  CONSTRAINT fk_pedidos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pedidos_carrinho
    FOREIGN KEY (carrinho_id) REFERENCES carrinhos (carrinho_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_pedidos_subtotal CHECK (subtotal >= 0),
  CONSTRAINT chk_pedidos_desconto CHECK (desconto >= 0),
  CONSTRAINT chk_pedidos_frete CHECK (frete >= 0),
  CONSTRAINT chk_pedidos_total CHECK (total >= 0),
  CONSTRAINT chk_pedidos_total_formula CHECK (total = subtotal - desconto + frete)
) ENGINE=InnoDB COMMENT='Pedidos finalizados pelo cliente.';

CREATE TABLE IF NOT EXISTS pedido_itens (
  pedido_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id BIGINT UNSIGNED NOT NULL,
  livro_id BIGINT UNSIGNED NULL,
  titulo_snapshot VARCHAR(220) NOT NULL,
  autor_snapshot VARCHAR(180) NOT NULL,
  slug_snapshot VARCHAR(220) NULL,
  quantidade SMALLINT UNSIGNED NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal_item DECIMAL(10,2) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pedido_item_id),
  KEY idx_pedido_itens_pedido (pedido_id),
  KEY idx_pedido_itens_livro (livro_id),
  CONSTRAINT fk_pedido_itens_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos (pedido_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pedido_itens_livro
    FOREIGN KEY (livro_id) REFERENCES livros (livro_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_pedido_itens_quantidade CHECK (quantidade BETWEEN 1 AND 999),
  CONSTRAINT chk_pedido_itens_preco CHECK (preco_unitario >= 0),
  CONSTRAINT chk_pedido_itens_subtotal CHECK (subtotal_item = preco_unitario * quantidade)
) ENGINE=InnoDB COMMENT='Snapshot dos itens de cada pedido.';

CREATE TABLE IF NOT EXISTS pedido_enderecos (
  pedido_endereco_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id BIGINT UNSIGNED NOT NULL,
  destinatario VARCHAR(180) NOT NULL,
  telefone_ciphertext VARBINARY(512) NULL COMMENT 'Telefone criptografado no backend com cifra autenticada.',
  telefone_iv BINARY(12) NULL,
  telefone_auth_tag BINARY(16) NULL,
  cep CHAR(8) NOT NULL,
  logradouro VARCHAR(220) NOT NULL,
  numero VARCHAR(30) NOT NULL,
  complemento VARCHAR(180) NULL,
  bairro VARCHAR(160) NOT NULL,
  cidade VARCHAR(160) NOT NULL,
  estado CHAR(2) NOT NULL,
  modalidade_entrega VARCHAR(120) NULL,
  prazo_entrega VARCHAR(120) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pedido_endereco_id),
  UNIQUE KEY uk_pedido_enderecos_pedido (pedido_id),
  CONSTRAINT fk_pedido_enderecos_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos (pedido_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_pedido_enderecos_estado CHECK (CHAR_LENGTH(estado) = 2),
  CONSTRAINT chk_pedido_enderecos_cep CHECK (CHAR_LENGTH(cep) = 8)
) ENGINE=InnoDB COMMENT='Endereço de entrega congelado no momento da compra.';

CREATE TABLE IF NOT EXISTS pagamentos (
  pagamento_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id BIGINT UNSIGNED NOT NULL,
  tentativa SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  metodo ENUM('pix', 'cartao', 'boleto') NOT NULL,
  status ENUM('criado', 'pendente', 'autorizado', 'capturado', 'recusado', 'cancelado', 'expirado', 'estornado') NOT NULL DEFAULT 'criado',
  valor DECIMAL(10,2) NOT NULL,
  gateway VARCHAR(120) NULL,
  gateway_referencia VARCHAR(160) NULL,
  token_gateway_ciphertext VARBINARY(1024) NULL COMMENT 'Token sensível criptografado pela aplicação; nunca armazene chaves no mesmo banco.',
  token_gateway_iv BINARY(12) NULL,
  token_gateway_auth_tag BINARY(16) NULL,
  cartao_bandeira VARCHAR(60) NULL,
  cartao_final4 CHAR(4) NULL COMMENT 'Somente os 4 últimos dígitos para exibição; nunca armazenar PAN completo ou CVV.',
  parcelas TINYINT UNSIGNED NULL,
  pix_copia_cola TEXT NULL,
  pix_expira_em DATETIME NULL,
  boleto_linha_digitavel VARCHAR(180) NULL,
  boleto_vencimento DATE NULL,
  metadados_sanitizados JSON NULL COMMENT 'Salvar somente resposta sanitizada do provedor, sem segredos ou dados proibidos.',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  confirmado_em DATETIME NULL,
  PRIMARY KEY (pagamento_id),
  UNIQUE KEY uk_pagamentos_gateway_referencia (gateway_referencia),
  KEY idx_pagamentos_pedido_status (pedido_id, status),
  KEY idx_pagamentos_metodo (metodo),
  CONSTRAINT fk_pagamentos_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos (pedido_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_pagamentos_valor CHECK (valor >= 0),
  CONSTRAINT chk_pagamentos_parcelas CHECK (parcelas IS NULL OR parcelas BETWEEN 1 AND 24),
  CONSTRAINT chk_pagamentos_final4 CHECK (cartao_final4 IS NULL OR CHAR_LENGTH(cartao_final4) = 4)
) ENGINE=InnoDB COMMENT='Tentativas e confirmações de pagamento.';

-- =====================================================================
-- 5) NEWSLETTER, CONTATO E SOLICITAÇÃO DE TÍTULOS
-- =====================================================================

CREATE TABLE IF NOT EXISTS newsletter_inscricoes (
  newsletter_inscricao_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  email VARCHAR(254) NOT NULL,
  origem VARCHAR(120) NULL COMMENT 'Ex.: footer, cadastro, página de livro.',
  status ENUM('pendente_confirmacao', 'inscrito', 'descadastrado', 'bloqueado') NOT NULL DEFAULT 'pendente_confirmacao',
  confirmado_em DATETIME NULL,
  descadastrado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (newsletter_inscricao_id),
  UNIQUE KEY uk_newsletter_email (email),
  KEY idx_newsletter_usuario (usuario_id),
  KEY idx_newsletter_status (status),
  CONSTRAINT fk_newsletter_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Inscrições e opt-in da newsletter.';

CREATE TABLE IF NOT EXISTS mensagens_contato (
  mensagem_contato_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  nome VARCHAR(180) NOT NULL,
  email VARCHAR(254) NOT NULL,
  assunto ENUM('pedido', 'trocas_devolucoes', 'titulo_faltante', 'feedback_site', 'trabalhe_conosco', 'outro') NOT NULL,
  mensagem TEXT NOT NULL,
  status ENUM('nova', 'em_analise', 'respondida', 'arquivada') NOT NULL DEFAULT 'nova',
  respondida_por BIGINT UNSIGNED NULL,
  respondida_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (mensagem_contato_id),
  KEY idx_mensagens_contato_usuario (usuario_id),
  KEY idx_mensagens_contato_status_data (status, criado_em),
  CONSTRAINT fk_mensagens_contato_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_mensagens_contato_responsavel
    FOREIGN KEY (respondida_por) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Mensagens enviadas pela página de contato.';

CREATE TABLE IF NOT EXISTS solicitacoes_titulos (
  solicitacao_titulo_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  nome_solicitante VARCHAR(180) NULL,
  email VARCHAR(254) NULL,
  titulo_solicitado VARCHAR(220) NOT NULL,
  autor_sugerido VARCHAR(180) NULL,
  observacoes VARCHAR(600) NULL,
  status ENUM('recebida', 'em_avaliacao', 'aprovada', 'recusada', 'catalogada') NOT NULL DEFAULT 'recebida',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (solicitacao_titulo_id),
  KEY idx_solicitacoes_titulos_usuario (usuario_id),
  KEY idx_solicitacoes_titulos_status (status),
  CONSTRAINT fk_solicitacoes_titulos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Solicitações de títulos faltantes feitas por clientes.';

-- =====================================================================
-- 6) AUDITORIA E EVENTOS DE SEGURANÇA
-- =====================================================================

CREATE TABLE IF NOT EXISTS eventos_seguranca (
  evento_seguranca_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NULL,
  tipo_evento VARCHAR(100) NOT NULL COMMENT 'Ex.: login_falhou, login_sucesso, senha_redefinida, sessao_revogada.',
  severidade ENUM('baixa', 'media', 'alta', 'critica') NOT NULL DEFAULT 'baixa',
  email_relacionado VARCHAR(254) NULL,
  ip_hash BINARY(32) NULL,
  user_agent_hash BINARY(32) NULL,
  detalhes_sanitizados JSON NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (evento_seguranca_id),
  KEY idx_eventos_seguranca_usuario (usuario_id),
  KEY idx_eventos_seguranca_tipo_data (tipo_evento, criado_em),
  KEY idx_eventos_seguranca_severidade (severidade),
  CONSTRAINT fk_eventos_seguranca_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (usuario_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Trilha mínima para auditoria e resposta a incidentes.';

-- =====================================================================
-- 7) VIEWS ÚTEIS PARA O FRONT/API
-- =====================================================================

CREATE OR REPLACE VIEW vw_livros_catalogo AS
SELECT
  l.livro_id,
  l.slug,
  l.titulo,
  l.subtitulo,
  a.nome AS autor,
  l.preco,
  l.preco_promocional,
  CASE
    WHEN l.preco_promocional IS NOT NULL THEN l.preco_promocional
    ELSE l.preco
  END AS preco_exibicao,
  l.estoque,
  l.ativo,
  l.destaque,
  l.novo_titulo,
  l.url_pagina,
  l.capa_url,
  COALESCE(ROUND(AVG(CASE WHEN av.status = 'aprovada' THEN av.nota END), 2), 0) AS media_avaliacoes,
  COUNT(CASE WHEN av.status = 'aprovada' THEN 1 END) AS total_avaliacoes
FROM livros l
INNER JOIN autores a ON a.autor_id = l.autor_id
LEFT JOIN avaliacoes_livros av ON av.livro_id = l.livro_id
GROUP BY
  l.livro_id, l.slug, l.titulo, l.subtitulo, a.nome,
  l.preco, l.preco_promocional, l.estoque, l.ativo,
  l.destaque, l.novo_titulo, l.url_pagina, l.capa_url;

CREATE OR REPLACE VIEW vw_livros_em_oferta AS
SELECT
  livro_id,
  slug,
  titulo,
  autor,
  preco,
  preco_promocional,
  preco_exibicao,
  estoque,
  url_pagina,
  capa_url,
  media_avaliacoes,
  total_avaliacoes
FROM vw_livros_catalogo
WHERE preco_promocional IS NOT NULL
  AND preco_promocional < preco
  AND ativo = TRUE;

-- =====================================================================
-- 8) SEED OPCIONAL: CATEGORIAS E AUTORES DO PROTÓTIPO
-- =====================================================================

INSERT INTO categorias (nome, slug, descricao, ordem_exibicao)
VALUES
  ('Fantasia', 'fantasia', 'Livros com mundos imaginários, magia e aventura.', 1),
  ('Romance literário', 'romance-literario', 'Obras centradas em relações, emoções e conflitos humanos.', 2),
  ('Clássicos', 'classicos', 'Grandes obras reconhecidas da literatura.', 3),
  ('Jovem adulto', 'jovem-adulto', 'Narrativas voltadas ao público jovem e crossover.', 4),
  ('Ficção histórica', 'ficcao-historica', 'Histórias ficcionais ambientadas em contextos históricos.', 5),
  ('Ficção inspiracional', 'ficcao-inspiracional', 'Livros com forte apelo de reflexão e transformação pessoal.', 6),
  ('Ficção contemporânea', 'ficcao-contemporanea', 'Narrativas atuais com temas da vida moderna.', 7)
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  descricao = VALUES(descricao),
  ordem_exibicao = VALUES(ordem_exibicao),
  atualizado_em = CURRENT_TIMESTAMP;

INSERT INTO autores (nome, slug)
VALUES
  ('Matt Haig', 'matt-haig'),
  ('Sally Rooney', 'sally-rooney'),
  ('J.K. Rowling', 'jk-rowling'),
  ('Adam Silvera', 'adam-silvera'),
  ('Paulo Coelho', 'paulo-coelho'),
  ('Fiódor Dostoiévski', 'fiodor-dostoievski'),
  ('Zoulfa Katouh', 'zoulfa-katouh'),
  ('Ruizi Chén', 'ruizi-chen')
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  atualizado_em = CURRENT_TIMESTAMP;



-- =====================================================================
-- 9) SEED OPCIONAL: LIVROS, VÍNCULOS DE CATEGORIA E IMAGENS DO SITE
-- =====================================================================

INSERT INTO livros (
  autor_id, slug, titulo, subtitulo, descricao, editora, idioma,
  formato, preco, preco_promocional, estoque, ativo, destaque, novo_titulo,
  url_pagina, capa_url
)
VALUES
  (
    (SELECT autor_id FROM autores WHERE slug = 'matt-haig'),
    'biblioteca-noite',
    'A Biblioteca da Meia-Noite',
    NULL,
    'Entre escolhas, arrependimentos e novas possibilidades, esta história acompanha Nora em uma jornada pelo espaço simbólico entre a vida que ela viveu e as vidas que poderia ter vivido. Com uma leitura envolvente e reflexiva, o livro fala sobre recomeços, autoconhecimento e o valor das pequenas decisões que moldam o caminho de cada pessoa.',
    NULL,
    'Português',
    'fisico',
    59.90,
    49.12,
    25,
    TRUE,
    TRUE,
    FALSE,
    'biblioteca-noite.html',
    'assets/fotos/biblioteca-meia-noite.jpg'
  ),
  (
    (SELECT autor_id FROM autores WHERE slug = 'sally-rooney'),
    'pessoas-normais',
    'Pessoas Normais',
    NULL,
    'Connell e Marianne atravessam a juventude em uma relação intensa, marcada por aproximações, silêncios e desencontros. O livro acompanha o amadurecimento dos dois com delicadeza e desconforto. A narrativa explora intimidade, classe social, autoestima e a dificuldade de comunicar sentimentos quando tudo parece estar em transformação.',
    NULL,
    'Português',
    'fisico',
    49.90,
    42.41,
    25,
    TRUE,
    TRUE,
    FALSE,
    'pessoas-normais.html',
    'assets/fotos/pessoas-normais.jpg'
  ),
  (
    (SELECT autor_id FROM autores WHERE slug = 'jk-rowling'),
    'harry-potter',
    'Harry Potter e a Pedra Filosofal',
    NULL,
    'Harry Potter cresceu sem imaginar que pertencia a um mundo mágico. Ao receber sua carta para Hogwarts, ele descobre amizades, desafios e segredos que mudam completamente sua vida. O primeiro volume apresenta o universo da escola de magia, personagens inesquecíveis e uma aventura cheia de mistério, coragem e descobertas.',
    NULL,
    'Português',
    'fisico',
    79.90,
    63.92,
    25,
    TRUE,
    TRUE,
    FALSE,
    'harry-potter.html',
    'assets/fotos/harry-potter-pedra-filosofal.jpg'
  ),
  (
    (SELECT autor_id FROM autores WHERE slug = 'adam-silvera'),
    'dois-morrem-final',
    'Os Dois Morrem no Final',
    NULL,
    'Mateo e Rufus recebem a ligação que ninguém gostaria de atender: ambos viverão seu último dia. A partir disso, os dois se encontram e escolhem transformar poucas horas em algo memorável. A obra combina emoção, urgência e afeto para refletir sobre amizade, coragem e o que significa viver com presença.',
    NULL,
    'Português',
    'fisico',
    55.90,
    49.19,
    25,
    TRUE,
    TRUE,
    FALSE,
    'dois-morrem-final.html',
    'assets/fotos/os-dois-morrem-no-final.jpg'
  ),
  (
    (SELECT autor_id FROM autores WHERE slug = 'paulo-coelho'),
    'o-alquimista',
    'O Alquimista',
    NULL,
    'Santiago, um jovem pastor, parte em busca de um tesouro e acaba encontrando uma jornada sobre sonhos, sinais e propósito. Cada etapa do caminho o aproxima de novas descobertas. Com linguagem simples e simbólica, a obra convida o leitor a refletir sobre desejos pessoais, coragem e escuta interior.',
    NULL,
    'Português',
    'fisico',
    44.90,
    33.67,
    25,
    TRUE,
    TRUE,
    FALSE,
    'o-alquimista.html',
    'assets/fotos/o-alquimista.jpg'
  ),
  (
    (SELECT autor_id FROM autores WHERE slug = 'fiodor-dostoievski'),
    'irmaos-karamazov',
    'Os Irmãos Karamázov',
    NULL,
    'Em torno de uma família marcada por conflitos, desejo, culpa e fé, Dostoiévski constrói um romance monumental sobre a natureza humana e suas contradições. A trama mistura drama familiar, investigação e debates filosóficos, criando uma leitura densa, poderosa e lembrada entre os grandes clássicos da literatura.',
    NULL,
    'Português',
    'fisico',
    129.90,
    116.91,
    25,
    TRUE,
    TRUE,
    FALSE,
    'irmaos-karamazov.html',
    'assets/fotos/irmaos-karamazov.jpg'
  ),
  (
    (SELECT autor_id FROM autores WHERE slug = 'zoulfa-katouh'),
    'lemon-trees',
    'As Long As The Lemon Trees Grow',
    NULL,
    'Ambientada em meio à guerra na Síria, a história acompanha Salama, uma jovem que enfrenta perdas, medo e escolhas impossíveis enquanto tenta proteger quem ama. É uma narrativa comovente sobre sobrevivência, esperança, memória e a força de continuar sonhando mesmo quando o mundo parece desabar.',
    NULL,
    'Português',
    'fisico',
    69.90,
    58.72,
    25,
    TRUE,
    TRUE,
    FALSE,
    'lemon-trees.html',
    'assets/fotos/lemon-trees-grow.jpg'
  ),
  (
    (SELECT autor_id FROM autores WHERE slug = 'ruizi-chen'),
    'sand-whisperers-daughter',
    'Sand Whisperer''s Daughter',
    NULL,
    'Entre desertos encantados, lendas antigas e segredos de família, esta fantasia acompanha uma protagonista cercada por mistério e por uma herança que pode transformar seu destino. A história combina aventura, magia e atmosfera mítica, criando uma viagem visualmente rica e cheia de descobertas.',
    NULL,
    'Português',
    'fisico',
    64.90,
    50.62,
    25,
    TRUE,
    TRUE,
    FALSE,
    'sand-whisperers-daughter.html',
    'assets/fotos/stardust-thief.jpg'
  )
ON DUPLICATE KEY UPDATE
  autor_id = VALUES(autor_id),
  titulo = VALUES(titulo),
  descricao = VALUES(descricao),
  preco = VALUES(preco),
  preco_promocional = VALUES(preco_promocional),
  estoque = VALUES(estoque),
  ativo = VALUES(ativo),
  destaque = VALUES(destaque),
  novo_titulo = VALUES(novo_titulo),
  url_pagina = VALUES(url_pagina),
  capa_url = VALUES(capa_url),
  atualizado_em = CURRENT_TIMESTAMP;

INSERT INTO livro_categorias (livro_id, categoria_id)
VALUES
  ((SELECT livro_id FROM livros WHERE slug = 'biblioteca-noite'), (SELECT categoria_id FROM categorias WHERE slug = 'ficcao-contemporanea')),
  ((SELECT livro_id FROM livros WHERE slug = 'pessoas-normais'), (SELECT categoria_id FROM categorias WHERE slug = 'romance-literario')),
  ((SELECT livro_id FROM livros WHERE slug = 'harry-potter'), (SELECT categoria_id FROM categorias WHERE slug = 'fantasia')),
  ((SELECT livro_id FROM livros WHERE slug = 'dois-morrem-final'), (SELECT categoria_id FROM categorias WHERE slug = 'jovem-adulto')),
  ((SELECT livro_id FROM livros WHERE slug = 'o-alquimista'), (SELECT categoria_id FROM categorias WHERE slug = 'ficcao-inspiracional')),
  ((SELECT livro_id FROM livros WHERE slug = 'irmaos-karamazov'), (SELECT categoria_id FROM categorias WHERE slug = 'classicos')),
  ((SELECT livro_id FROM livros WHERE slug = 'lemon-trees'), (SELECT categoria_id FROM categorias WHERE slug = 'ficcao-historica')),
  ((SELECT livro_id FROM livros WHERE slug = 'sand-whisperers-daughter'), (SELECT categoria_id FROM categorias WHERE slug = 'fantasia'))
ON DUPLICATE KEY UPDATE
  livro_id = VALUES(livro_id),
  categoria_id = VALUES(categoria_id);

INSERT INTO imagens_livros (livro_id, url_imagem, texto_alt, principal, ordem_exibicao)
VALUES
  ((SELECT livro_id FROM livros WHERE slug = 'biblioteca-noite'), 'assets/fotos/biblioteca-meia-noite.jpg', 'Capa de A Biblioteca da Meia-Noite', TRUE, 1),
  ((SELECT livro_id FROM livros WHERE slug = 'pessoas-normais'), 'assets/fotos/pessoas-normais.jpg', 'Capa de Pessoas Normais', TRUE, 1),
  ((SELECT livro_id FROM livros WHERE slug = 'harry-potter'), 'assets/fotos/harry-potter-pedra-filosofal.jpg', 'Capa de Harry Potter e a Pedra Filosofal', TRUE, 1),
  ((SELECT livro_id FROM livros WHERE slug = 'dois-morrem-final'), 'assets/fotos/os-dois-morrem-no-final.jpg', 'Capa de Os Dois Morrem no Final', TRUE, 1),
  ((SELECT livro_id FROM livros WHERE slug = 'o-alquimista'), 'assets/fotos/o-alquimista.jpg', 'Capa de O Alquimista', TRUE, 1),
  ((SELECT livro_id FROM livros WHERE slug = 'irmaos-karamazov'), 'assets/fotos/irmaos-karamazov.jpg', 'Capa de Os Irmãos Karamázov', TRUE, 1),
  ((SELECT livro_id FROM livros WHERE slug = 'lemon-trees'), 'assets/fotos/lemon-trees-grow.jpg', 'Capa de As Long As The Lemon Trees Grow', TRUE, 1),
  ((SELECT livro_id FROM livros WHERE slug = 'sand-whisperers-daughter'), 'assets/fotos/stardust-thief.jpg', 'Capa de Sand Whisperer''s Daughter', TRUE, 1)
ON DUPLICATE KEY UPDATE
  texto_alt = VALUES(texto_alt),
  principal = VALUES(principal),
  ordem_exibicao = VALUES(ordem_exibicao);

-- =====================================================================
-- 10) EXEMPLO DE PRIVILÉGIO MÍNIMO (AJUSTAR AO AMBIENTE)
-- Não executar literalmente sem trocar host e segredo.
-- ---------------------------------------------------------------------
-- CREATE USER 'api_mar_historias'@'localhost' IDENTIFIED BY 'troque-por-uma-senha-forte';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON LMH.* TO 'api_mar_historias'@'localhost';
-- FLUSH PRIVILEGES;
-- =====================================================================

-- =====================================================================
-- 11) NOTAS DE SEGURANÇA DE IMPLEMENTAÇÃO
-- ---------------------------------------------------------------------
-- 1. A coluna senha_hash deve receber um hash apropriado gerado no BACKEND.
--    Não use senha em texto puro e não use hash simples de SHA-256 para senha.
-- 2. refresh_token_hash, token_hash de verificação e redefinição guardam apenas hash.
-- 3. Não armazenar número completo do cartão, CVV, PIN ou trilha magnética.
--    Use provedor de pagamento e salve apenas referência/token, quando necessário.
-- 4. token_gateway_ciphertext e telefones *_ciphertext são campos preparados
--    para criptografia autenticada no backend, com chaves fora do banco.
-- 5. Para produção, considerar TLS entre aplicação e MySQL, criptografia em repouso,
--    backups cifrados, rotação de segredos e usuário de banco com menor privilégio.
-- =====================================================================

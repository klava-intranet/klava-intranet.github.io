-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0001 · SCHEMA
-- Substitui as abas da planilha 1IqorIjYoOxfVUNZUG2qPBYr53Pn18REB7qhYQY2C1rk
-- Tudo vive no schema "intranet" (Postgres puro → portável para fora do Supabase)
-- ═══════════════════════════════════════════════════════════════════════

-- No Supabase as extensões ficam no schema "extensions"
create schema if not exists extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists intranet;

-- ───────────────────────── ENUMS ─────────────────────────
create type intranet.papel        as enum ('admin', 'colaborador');
create type intranet.task_status  as enum ('todo', 'doing', 'done');
create type intranet.prioridade   as enum ('alta', 'media', 'baixa');
create type intranet.recorrencia  as enum ('diaria', 'semanal', 'quinzenal', 'mensal');
create type intranet.canal_tipo   as enum ('geral', 'dm', 'canal');
create type intranet.msg_tipo     as enum ('text', 'file', 'videocall', 'sistema');

-- Função de busca sem acento (imutável, para índices)
create or replace function intranet.normalizar(t text)
returns text language sql immutable parallel safe as
$$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

-- ───────────────────────── USUÁRIOS (aba "Usuários") ─────────────────────────
-- auth_id é preenchido automaticamente no 1º login Google (trigger em 0002).
create table intranet.usuarios (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid unique,
  email         text not null unique check (email = lower(email)),
  alias         text not null unique check (alias = lower(alias)),
  nome          text not null,
  setor         text,
  aniversario   date,
  telefone      text,
  papel         intranet.papel not null default 'colaborador',
  ativo         boolean not null default true,
  idioma        text not null default 'pt' check (idioma in ('pt', 'en', 'zh')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ───────────────────────── CHAT (abas "Canais", "Chat", "Reações") ─────────────────────────
-- key mantém o formato legado: 'geral', 'dm:aliasA_aliasB', 'canal:slug'
create table intranet.canais (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  tipo       intranet.canal_tipo not null,
  nome       text not null,
  descricao  text,
  criado_por uuid references intranet.usuarios(id) on delete set null,
  criado_em  timestamptz not null default now()
);

-- Membros de canais/DMs. O canal 'geral' é implícito (todos os ativos).
-- last_read_id substitui o "lastSeenMap" que hoje vive no localStorage.
create table intranet.canal_membros (
  canal_id     uuid not null references intranet.canais(id) on delete cascade,
  usuario_id   uuid not null references intranet.usuarios(id) on delete cascade,
  last_read_id bigint not null default 0,
  entrou_em    timestamptz not null default now(),
  primary key (canal_id, usuario_id)
);
create index on intranet.canal_membros (usuario_id);

-- Leitura do canal 'geral' (que não tem membros explícitos)
create table intranet.leituras_geral (
  usuario_id   uuid primary key references intranet.usuarios(id) on delete cascade,
  last_read_id bigint not null default 0
);

create table intranet.mensagens (
  id          bigint generated always as identity primary key,
  legacy_id   bigint unique,                         -- ID (timestamp ms) da aba Chat
  canal_id    uuid not null references intranet.canais(id) on delete cascade,
  autor_id    uuid references intranet.usuarios(id) on delete set null,  -- null = sistema
  tipo        intranet.msg_tipo not null default 'text',
  conteudo    text not null check (char_length(conteudo) <= 4000),
  arquivo_url text,
  arquivo_path text,                                 -- caminho no Storage (novos uploads)
  criado_em   timestamptz not null default now(),
  editado_em  timestamptz,
  deleted_at  timestamptz
);
create index mensagens_canal_idx on intranet.mensagens (canal_id, id desc);
create index mensagens_busca_idx on intranet.mensagens using gin (intranet.normalizar(conteudo) extensions.gin_trgm_ops);

create table intranet.reacoes (
  mensagem_id bigint not null references intranet.mensagens(id) on delete cascade,
  usuario_id  uuid   not null references intranet.usuarios(id) on delete cascade,
  emoji       text   not null check (char_length(emoji) <= 16),
  criado_em   timestamptz not null default now(),
  primary key (mensagem_id, usuario_id, emoji)
);

-- ───────────────────────── TAREFAS (abas "Tarefas", "Comentarios") ─────────────────────────
-- Prefixos de numeração (antes: MARCA_PREFIX_MAP fixo no GS)
create table intranet.marca_prefixos (
  unidade text not null,      -- private | atacado | ecomm
  marca   text not null,      -- sempre UPPER
  prefixo text not null,
  primary key (unidade, marca)
);

create table intranet.tarefa_contadores (
  prefixo text primary key,
  ultimo  int not null default 0
);

create table intranet.tarefas (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         text unique,                      -- 'T1712...' da planilha
  numero            text unique,                      -- ex.: PVTFF012 (gerado por trigger)
  titulo            text not null check (char_length(titulo) between 1 and 200),
  descricao         text not null default '',
  solicitante_id    uuid references intranet.usuarios(id) on delete set null,
  responsavel_id    uuid not null references intranet.usuarios(id),
  prazo             date not null,
  prioridade        intranet.prioridade not null default 'baixa',
  unidade           text not null,
  marca             text not null,
  status            intranet.task_status not null default 'todo',
  recorrencia       intranet.recorrencia,
  total_ocorrencias int not null default 1 check (total_ocorrencias between 1 and 52),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  iniciado_em       timestamptz,
  concluido_em      timestamptz
);
create index on intranet.tarefas (responsavel_id, status);
create index on intranet.tarefas (prazo) where status <> 'done';
create index tarefas_busca_idx on intranet.tarefas
  using gin ((intranet.normalizar(titulo || ' ' || descricao || ' ' || coalesce(numero, ''))) extensions.gin_trgm_ops);

-- Ocorrências da recorrência + id do evento no Google Calendar
-- (antes: CalendarEventId + CalendarEventIds em JSON dentro da célula)
create table intranet.tarefa_ocorrencias (
  tarefa_id         uuid not null references intranet.tarefas(id) on delete cascade,
  ordem             int  not null,
  data              date not null,
  calendar_event_id text,
  primary key (tarefa_id, ordem)
);

-- Anexos (antes: JSON na coluna "Anexos")
create table intranet.tarefa_anexos (
  id           uuid primary key default gen_random_uuid(),
  tarefa_id    uuid not null references intranet.tarefas(id) on delete cascade,
  nome         text not null,
  url          text,
  storage_path text,
  enviado_por  uuid references intranet.usuarios(id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index on intranet.tarefa_anexos (tarefa_id);

create table intranet.tarefa_comentarios (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  text unique,
  tarefa_id  uuid not null references intranet.tarefas(id) on delete cascade,
  autor_id   uuid references intranet.usuarios(id) on delete set null,
  texto      text not null check (char_length(texto) between 1 and 1000),
  criado_em  timestamptz not null default now(),
  deleted_at timestamptz
);
create index on intranet.tarefa_comentarios (tarefa_id, criado_em);

-- ───────────────────────── DRIVE (abas "Drive_Arquivos", "Drive_Links") ─────────────────────────
create table intranet.drive_setores (
  key             text primary key,
  nome            text not null,
  ordem           int  not null default 0,
  google_folder_id text
);

-- Quem pode enviar arquivos em cada setor (antes: DRIVE_UPLOADERS fixo no GS)
create table intranet.drive_setor_uploaders (
  setor_key  text not null references intranet.drive_setores(key) on delete cascade,
  usuario_id uuid not null references intranet.usuarios(id) on delete cascade,
  primary key (setor_key, usuario_id)
);

create table intranet.drive_arquivos (
  id             uuid primary key default gen_random_uuid(),
  google_file_id text unique,                 -- arquivos legados que ficam no Google Drive
  storage_path   text unique,                 -- novos uploads no Supabase Storage
  setor_key      text not null references intranet.drive_setores(key),
  nome           text not null,
  descricao      text not null default '',
  mime_type      text,
  url            text,
  tamanho        bigint,
  enviado_por    uuid references intranet.usuarios(id) on delete set null,
  enviado_em     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index on intranet.drive_arquivos (setor_key, enviado_em desc) where deleted_at is null;

create table intranet.drive_links (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  text unique,
  setor_key  text not null references intranet.drive_setores(key),
  titulo     text not null,
  url        text not null,
  sub        text not null default '',
  tipo       text not null default 'link',
  criado_por uuid references intranet.usuarios(id) on delete set null,
  criado_em  timestamptz not null default now(),
  deleted_at timestamptz
);
create index on intranet.drive_links (setor_key) where deleted_at is null;

-- ───────────────────────── CONTATOS (aba "Contatos") ─────────────────────────
create table intranet.contatos (
  id           uuid primary key default gen_random_uuid(),
  legacy_id    text unique,
  setor_key    text not null,      -- board | wholesale | finance | design | logistics | import | salesops | ...
  setor_label  text not null default '',
  nome         text not null,
  cargo        text not null,
  cargo_en     text not null default '',
  cargo_zh     text not null default '',
  telefone     text not null default '',
  email        text not null default '',
  ordem        int  not null default 0,
  criado_por   uuid references intranet.usuarios(id) on delete set null,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on intranet.contatos (ordem) where deleted_at is null;

-- ───────────────────────── WIKI (aba "Wiki") ─────────────────────────
create table intranet.wiki_artigos (
  id             uuid primary key default gen_random_uuid(),
  legacy_id      text unique,
  categoria      text not null,
  titulo         text not null,
  conteudo       text not null default '',
  criado_por     uuid references intranet.usuarios(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references intranet.usuarios(id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  deleted_at     timestamptz
);
create index wiki_busca_idx on intranet.wiki_artigos
  using gin ((intranet.normalizar(titulo || ' ' || categoria || ' ' || conteudo)) extensions.gin_trgm_ops);

-- ───────────────────────── CONFIG + LOGS ─────────────────────────
-- Antes: PropertiesService ("cfg_*")
create table intranet.app_config (
  chave          text primary key,
  valor          jsonb not null,
  atualizado_por uuid references intranet.usuarios(id) on delete set null,
  atualizado_em  timestamptz not null default now()
);

create table intranet.logs_acesso (
  id         bigint generated always as identity primary key,
  usuario_id uuid references intranet.usuarios(id) on delete set null,
  email      text,
  acao       text not null,
  criado_em  timestamptz not null default now()
);
create index on intranet.logs_acesso (criado_em desc);

create table intranet.logs_erros (
  id         bigint generated always as identity primary key,
  funcao     text,
  usuario    text,
  erro       text,
  detalhes   text,
  criado_em  timestamptz not null default now()
);
create index on intranet.logs_erros (criado_em desc);

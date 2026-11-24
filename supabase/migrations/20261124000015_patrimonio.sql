-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0015 · PATRIMÔNIO (inventário de equipamentos e móveis)
-- Ficha do bem, locais, responsáveis, plaquetagem, campanhas de
-- inventário (leitura de placa), movimentações e conciliação contábil.
--
-- Acesso (tabela pat_equipe):
--   admin da intranet → tudo (cadastros, campanhas, saldos, equipe)
--   inventariante     → cadastra/edita bens e registra leituras
--   consulta          → só visualiza e exporta
-- Quem não está na equipe nem é admin não vê o módulo.
-- Fotos no bucket PRIVADO "patrimonio".
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────── Equipe do patrimônio ─────────────
create table if not exists intranet.pat_equipe (
  usuario_id uuid primary key references intranet.usuarios(id) on delete cascade,
  papel      text not null check (papel in ('inventariante', 'consulta')),
  criado_em  timestamptz not null default now()
);

create or replace function intranet.pat_papel()
returns text language sql stable security definer set search_path = '' as
$$ select case
     when intranet.is_admin() then 'admin'
     else (select e.papel from intranet.pat_equipe e where e.usuario_id = intranet.me())
   end $$;

create or replace function intranet.pat_pode_editar()
returns boolean language sql stable security definer set search_path = '' as
$$ select coalesce(intranet.pat_papel() in ('admin', 'inventariante'), false) $$;

-- ───────────── Cadastros de apoio ─────────────
create table if not exists intranet.pat_categorias (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null unique,
  classe_padrao   text not null default 'Imobilizado' check (classe_padrao in ('Imobilizado', 'Bem de controle')),
  vida_util_anos  numeric,
  taxa_anual      numeric check (taxa_anual is null or taxa_anual between 0 and 100),
  conta_contabil  text,
  saldo_contabil  numeric not null default 0,   -- saldo líquido no balancete (para a conciliação)
  ordem           int not null default 0,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create table if not exists intranet.pat_locais (
  id            uuid primary key default gen_random_uuid(),
  unidade       text not null check (unidade in ('RJ', 'RS', 'Terceiros')),
  nome          text not null,                 -- sala / setor
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (unidade, nome)
);

create table if not exists intranet.pat_pessoas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  tipo          text not null default 'Colaborador' check (tipo in ('Colaborador', 'Representante', 'Terceiro')),
  email         text,
  usuario_id    uuid unique references intranet.usuarios(id) on delete set null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ───────────── Bens ─────────────
create table if not exists intranet.pat_bens (
  id              uuid primary key default gen_random_uuid(),
  plaqueta        text not null unique check (plaqueta ~ '^[0-9A-Z-]{1,20}$'),
  descricao       text not null check (char_length(trim(descricao)) between 1 and 200),
  categoria_id    uuid references intranet.pat_categorias(id),
  classe          text not null default 'Imobilizado' check (classe in ('Imobilizado', 'Bem de controle')),
  fabricante      text,
  modelo          text,
  serie           text,
  marca_klava     text,
  local_id        uuid references intranet.pat_locais(id),
  responsavel_id  uuid references intranet.pat_pessoas(id),
  centro_custo    text,
  conservacao     text not null default 'Bom' check (conservacao in ('Novo', 'Bom', 'Regular', 'Ruim', 'Inservível')),
  situacao        text not null default 'Ativo' check (situacao in ('Ativo', 'Em manutenção', 'Emprestado', 'Baixado')),
  data_aquisicao  date,
  fornecedor      text,
  nf_numero       text,
  valor_aquisicao numeric check (valor_aquisicao is null or valor_aquisicao >= 0),
  vida_util_anos  numeric,
  taxa_anual      numeric check (taxa_anual is null or taxa_anual between 0 and 100),
  garantia_ate    date,
  conta_contabil  text,
  sem_documento   boolean not null default false,
  motivo_baixa    text,
  observacoes     text,
  fotos           text[] not null default '{}',   -- caminhos no bucket "patrimonio" (até 3)
  criado_por      uuid references intranet.usuarios(id) on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  check (cardinality(fotos) <= 3)
);
create index if not exists pat_bens_local_idx on intranet.pat_bens (local_id);
create index if not exists pat_bens_resp_idx  on intranet.pat_bens (responsavel_id);

-- ───────────── Inventário (campanhas e leituras) ─────────────
create table if not exists intranet.pat_campanhas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  unidade       text not null check (unidade in ('RJ', 'RS', 'Terceiros')),
  status        text not null default 'Aberta' check (status in ('Aberta', 'Encerrada')),
  aberta_em     timestamptz not null default now(),
  encerrada_em  timestamptz,
  criado_por    uuid references intranet.usuarios(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create table if not exists intranet.pat_leituras (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references intranet.pat_campanhas(id) on delete cascade,
  bem_id      uuid references intranet.pat_bens(id) on delete set null,
  plaqueta    text not null,
  resultado   text not null check (resultado in ('encontrado', 'sobra', 'local_divergente')),
  lido_por    uuid references intranet.usuarios(id) on delete set null,
  lido_em     timestamptz not null default now(),
  unique (campanha_id, plaqueta)
);

-- ───────────── Histórico (imutável, gravado pelo banco) ─────────────
create table if not exists intranet.pat_movimentacoes (
  id          uuid primary key default gen_random_uuid(),
  bem_id      uuid not null references intranet.pat_bens(id) on delete cascade,
  tipo        text not null check (tipo in ('Cadastro', 'Transferência', 'Baixa', 'Reativação')),
  de_local    uuid references intranet.pat_locais(id) on delete set null,
  para_local  uuid references intranet.pat_locais(id) on delete set null,
  de_resp     uuid references intranet.pat_pessoas(id) on delete set null,
  para_resp   uuid references intranet.pat_pessoas(id) on delete set null,
  obs         text,
  usuario_id  uuid references intranet.usuarios(id) on delete set null,
  criado_em   timestamptz not null default now()
);
create index if not exists pat_mov_bem_idx on intranet.pat_movimentacoes (bem_id, criado_em desc);

-- ───────────── Gatilhos ─────────────
do $$ declare t text; begin
  foreach t in array array['pat_categorias','pat_locais','pat_pessoas','pat_bens','pat_campanhas'] loop
    execute format('drop trigger if exists t_%1$s_touch on intranet.%1$s', t);
    execute format('create trigger t_%1$s_touch before update on intranet.%1$s for each row execute function intranet.touch_atualizado_em()', t);
  end loop;
end $$;

-- placa: maiúscula, sem espaços; número curto vira 6 dígitos ("599" → "000599")
create or replace function intranet.pat_norm_placa(p text)
returns text language sql immutable as
$$ select case when t ~ '^[0-9]{1,6}$' then lpad(t, 6, '0') else t end
     from (select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) t) x $$;

create or replace function intranet.pat_bem_before()
returns trigger language plpgsql as
$$ begin
  new.plaqueta := intranet.pat_norm_placa(new.plaqueta);
  new.descricao := trim(new.descricao);
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.criado_por := intranet.me(); end if;
  else
    new.criado_por := old.criado_por;
  end if;
  if new.situacao <> 'Baixado' then new.motivo_baixa := null; end if;
  return new;
end $$;
drop trigger if exists t_pat_bem_before on intranet.pat_bens;
create trigger t_pat_bem_before before insert or update on intranet.pat_bens
  for each row execute function intranet.pat_bem_before();

-- grava o histórico sozinho (cadastro, troca de local/responsável, baixa, reativação)
create or replace function intranet.pat_bem_after()
returns trigger language plpgsql security definer set search_path = '' as
$$ declare v_tipo text; begin
  if tg_op = 'INSERT' then
    insert into intranet.pat_movimentacoes (bem_id, tipo, para_local, para_resp, usuario_id)
    values (new.id, 'Cadastro', new.local_id, new.responsavel_id, intranet.me());
  else
    if old.situacao <> 'Baixado' and new.situacao = 'Baixado' then v_tipo := 'Baixa';
    elsif old.situacao = 'Baixado' and new.situacao <> 'Baixado' then v_tipo := 'Reativação';
    elsif old.local_id is distinct from new.local_id or old.responsavel_id is distinct from new.responsavel_id then v_tipo := 'Transferência';
    end if;
    if v_tipo is not null then
      insert into intranet.pat_movimentacoes (bem_id, tipo, de_local, para_local, de_resp, para_resp, obs, usuario_id)
      values (new.id, v_tipo, old.local_id, new.local_id, old.responsavel_id, new.responsavel_id,
              case when v_tipo = 'Baixa' then new.motivo_baixa end, intranet.me());
    end if;
  end if;
  -- placa cadastrada depois de lida como "sobra" numa campanha aberta: vincula a leitura
  update intranet.pat_leituras l
     set bem_id = new.id,
         resultado = case when c.unidade = (select x.unidade from intranet.pat_locais x where x.id = new.local_id)
                          then 'encontrado' else 'local_divergente' end
    from intranet.pat_campanhas c
   where l.campanha_id = c.id and c.status = 'Aberta' and l.bem_id is null and l.plaqueta = new.plaqueta;
  return new;
end $$;
drop trigger if exists t_pat_bem_after on intranet.pat_bens;
create trigger t_pat_bem_after after insert or update on intranet.pat_bens
  for each row execute function intranet.pat_bem_after();

-- ───────────── Leitura de placa numa campanha ─────────────
-- Classifica: encontrado (bem desta unidade), local_divergente (de outra unidade), sobra (placa sem cadastro).
create or replace function intranet.pat_ler(p_campanha uuid, p_plaqueta text)
returns jsonb language plpgsql security definer set search_path = '' as
$$ declare
  v_camp intranet.pat_campanhas;
  v_placa text := intranet.pat_norm_placa(p_plaqueta);
  v_bem intranet.pat_bens;
  v_unid text;
  v_res text;
  v_ja boolean;
begin
  if not intranet.pat_pode_editar() then raise exception 'Sem permissão para registrar leituras.'; end if;
  select * into v_camp from intranet.pat_campanhas where id = p_campanha;
  if v_camp.id is null then raise exception 'Campanha não encontrada.'; end if;
  if v_camp.status <> 'Aberta' then raise exception 'Esta campanha já foi encerrada.'; end if;
  if v_placa = '' then raise exception 'Placa vazia.'; end if;

  select * into v_bem from intranet.pat_bens where plaqueta = v_placa;
  if v_bem.id is null then v_res := 'sobra';
  else
    select unidade into v_unid from intranet.pat_locais where id = v_bem.local_id;
    v_res := case when v_unid = v_camp.unidade then 'encontrado' else 'local_divergente' end;
  end if;

  select exists (select 1 from intranet.pat_leituras where campanha_id = p_campanha and plaqueta = v_placa) into v_ja;
  insert into intranet.pat_leituras (campanha_id, bem_id, plaqueta, resultado, lido_por)
  values (p_campanha, v_bem.id, v_placa, v_res, intranet.me())
  on conflict (campanha_id, plaqueta) do update
    set bem_id = excluded.bem_id, resultado = excluded.resultado, lido_por = excluded.lido_por, lido_em = now();

  return jsonb_build_object('plaqueta', v_placa, 'resultado', v_res, 'repetida', v_ja,
                            'bem_id', v_bem.id, 'descricao', v_bem.descricao, 'unidade_bem', v_unid);
end $$;

-- ───────────── RLS ─────────────
do $$ declare t text; begin
  foreach t in array array['pat_equipe','pat_categorias','pat_locais','pat_pessoas','pat_bens','pat_campanhas','pat_leituras','pat_movimentacoes'] loop
    execute format('alter table intranet.%1$s enable row level security', t);
    execute format('drop policy if exists %1$s_ler on intranet.%1$s', t);
    execute format('drop policy if exists %1$s_admin on intranet.%1$s', t);
    execute format('create policy %1$s_ler on intranet.%1$s for select to authenticated using (intranet.pat_papel() is not null)', t);
    execute format('create policy %1$s_admin on intranet.%1$s for all to authenticated using (intranet.is_admin()) with check (intranet.is_admin())', t);
    execute format('grant select, insert, update, delete on intranet.%1$s to authenticated, service_role', t);
  end loop;
end $$;

-- inventariante: cadastra e edita bens (exclusão só admin); pode cadastrar pessoas e locais novos no campo
drop policy if exists pat_bens_inv_ins on intranet.pat_bens;
drop policy if exists pat_bens_inv_upd on intranet.pat_bens;
create policy pat_bens_inv_ins on intranet.pat_bens for insert to authenticated with check (intranet.pat_pode_editar());
create policy pat_bens_inv_upd on intranet.pat_bens for update to authenticated
  using (intranet.pat_pode_editar()) with check (intranet.pat_pode_editar());
drop policy if exists pat_pessoas_inv_ins on intranet.pat_pessoas;
create policy pat_pessoas_inv_ins on intranet.pat_pessoas for insert to authenticated with check (intranet.pat_pode_editar());
drop policy if exists pat_locais_inv_ins on intranet.pat_locais;
create policy pat_locais_inv_ins on intranet.pat_locais for insert to authenticated with check (intranet.pat_pode_editar());
-- leituras só pela função pat_ler (security definer); campanhas: inventariante abre e encerra
drop policy if exists pat_campanhas_inv_ins on intranet.pat_campanhas;
drop policy if exists pat_campanhas_inv_upd on intranet.pat_campanhas;
create policy pat_campanhas_inv_ins on intranet.pat_campanhas for insert to authenticated with check (intranet.pat_pode_editar());
create policy pat_campanhas_inv_upd on intranet.pat_campanhas for update to authenticated
  using (intranet.pat_pode_editar()) with check (intranet.pat_pode_editar());

-- movimentações: ninguém altera nem apaga (nem admin) — histórico imutável
drop policy if exists pat_movimentacoes_admin on intranet.pat_movimentacoes;
revoke insert, update, delete on intranet.pat_movimentacoes from authenticated;

grant execute on function intranet.pat_papel(), intranet.pat_pode_editar(), intranet.pat_ler(uuid, text),
  intranet.pat_norm_placa(text) to authenticated;

-- ───────────── Dados iniciais ─────────────
insert into intranet.pat_categorias (nome, classe_padrao, vida_util_anos, taxa_anual, ordem) values
  ('Computadores e periféricos', 'Imobilizado',      5,  20, 1),
  ('Móveis e utensílios',        'Imobilizado',      10, 10, 2),
  ('Máquinas e equipamentos',    'Imobilizado',      10, 10, 3),
  ('Instalações',                'Imobilizado',      10, 10, 4),
  ('Automóveis de passageiros',  'Imobilizado',      5,  20, 5),
  ('Veículos de carga e motos',  'Imobilizado',      4,  25, 6),
  ('Bens de controle',           'Bem de controle',  null, null, 7)
on conflict (nome) do nothing;

insert into intranet.pat_locais (unidade, nome) values
  ('RJ', 'Escritório RJ'), ('RS', 'Escritório RS'), ('Terceiros', 'Com representantes')
on conflict (unidade, nome) do nothing;

-- responsáveis: colaboradores ativos da intranet
insert into intranet.pat_pessoas (nome, tipo, email, usuario_id)
select u.nome, 'Colaborador', u.email, u.id from intranet.usuarios u
 where u.ativo and not exists (select 1 from intranet.pat_pessoas p where p.usuario_id = u.id);

-- ───────────── Realtime ─────────────
do $$ declare t text; begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array['pat_bens','pat_leituras','pat_campanhas'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                   and schemaname = 'intranet' and tablename = t) then
      execute format('alter publication supabase_realtime add table intranet.%I', t);
    end if;
  end loop;
end $$;

-- ───────────── Fotos: bucket privado patrimonio/<plaqueta>/<uuid>.jpg ─────────────
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schema storage não encontrado (Postgres local) — pulando bucket do patrimônio.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('patrimonio', 'patrimonio', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute 'drop policy if exists "intranet patrimonio ler" on storage.objects';
  execute 'drop policy if exists "intranet patrimonio enviar" on storage.objects';
  execute 'drop policy if exists "intranet patrimonio apagar" on storage.objects';
  execute $p$create policy "intranet patrimonio ler" on storage.objects for select to authenticated
    using (bucket_id = 'patrimonio' and intranet.pat_papel() is not null)$p$;
  execute $p$create policy "intranet patrimonio enviar" on storage.objects for insert to authenticated
    with check (bucket_id = 'patrimonio' and intranet.pat_pode_editar())$p$;
  execute $p$create policy "intranet patrimonio apagar" on storage.objects for delete to authenticated
    using (bucket_id = 'patrimonio' and intranet.pat_pode_editar())$p$;
end $$;

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0012 · CATÁLOGOS DAS MARCAS
-- Qualquer colaborador insere; quem enviou (ou um admin) edita e exclui.
-- Arquivos no bucket PRIVADO "catalogos" (link assinado para abrir).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists intranet.catalogos (
  id              uuid primary key default gen_random_uuid(),
  marca           text not null check (char_length(trim(marca)) between 1 and 60),
  titulo          text not null default '' check (char_length(titulo) <= 120),
  data_publicacao date not null default (now() at time zone 'America/Sao_Paulo')::date,
  arquivo_path    text not null,
  arquivo_nome    text not null,
  mime_type       text,
  tamanho         bigint,
  enviado_por     uuid references intranet.usuarios(id) on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists catalogos_marca_idx on intranet.catalogos (marca, data_publicacao desc) where deleted_at is null;

-- quem enviou = usuário logado (não dá para forjar)
create or replace function intranet.catalogo_before_insert()
returns trigger language plpgsql as
$$ begin if auth.uid() is not null then new.enviado_por := intranet.me(); end if; new.marca := trim(new.marca); return new; end $$;
drop trigger if exists t_catalogo_before_insert on intranet.catalogos;
create trigger t_catalogo_before_insert before insert on intranet.catalogos
  for each row execute function intranet.catalogo_before_insert();

create or replace function intranet.catalogo_before_update()
returns trigger language plpgsql as
$$ begin new.enviado_por := old.enviado_por; new.marca := trim(new.marca); new.atualizado_em := now(); return new; end $$;
drop trigger if exists t_catalogo_before_update on intranet.catalogos;
create trigger t_catalogo_before_update before update on intranet.catalogos
  for each row execute function intranet.catalogo_before_update();

alter table intranet.catalogos enable row level security;
drop policy if exists catalogos_select on intranet.catalogos;
drop policy if exists catalogos_insert on intranet.catalogos;
drop policy if exists catalogos_update on intranet.catalogos;
drop policy if exists catalogos_delete on intranet.catalogos;
create policy catalogos_select on intranet.catalogos for select to authenticated
  using (intranet.me() is not null);
create policy catalogos_insert on intranet.catalogos for insert to authenticated
  with check (intranet.me() is not null);
create policy catalogos_update on intranet.catalogos for update to authenticated
  using (enviado_por = intranet.me() or intranet.is_admin())
  with check (enviado_por = intranet.me() or intranet.is_admin());
create policy catalogos_delete on intranet.catalogos for delete to authenticated
  using (intranet.is_admin());

grant select, insert, update, delete on intranet.catalogos to authenticated, service_role;

-- Atualiza a tela de todo mundo quando alguém insere um catálogo
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                     and schemaname = 'intranet' and tablename = 'catalogos') then
    alter publication supabase_realtime add table intranet.catalogos;
  end if;
end $$;

-- Bucket privado: catalogos/<marca>/<uuid>-<arquivo>
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schema storage não encontrado (Postgres local) — pulando bucket de catálogos.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('catalogos', 'catalogos', false, 52428800, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/zip', 'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint'])
  on conflict (id) do nothing;

  execute 'drop policy if exists "intranet catalogos ler" on storage.objects';
  execute 'drop policy if exists "intranet catalogos enviar" on storage.objects';
  execute 'drop policy if exists "intranet catalogos apagar" on storage.objects';
  execute $p$create policy "intranet catalogos ler" on storage.objects for select to authenticated
    using (bucket_id = 'catalogos' and intranet.me() is not null)$p$;
  execute $p$create policy "intranet catalogos enviar" on storage.objects for insert to authenticated
    with check (bucket_id = 'catalogos' and intranet.me() is not null)$p$;
  execute $p$create policy "intranet catalogos apagar" on storage.objects for delete to authenticated
    using (bucket_id = 'catalogos' and (owner_id = auth.uid()::text or intranet.is_admin()))$p$;
end $$;

notify pgrst, 'reload schema';

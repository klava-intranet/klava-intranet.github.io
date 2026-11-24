-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0016 · STAFF (cadastro de funcionários)
-- Tela Setores → Staff. Todos veem; só admin cadastra/edita.
-- O "Aniversariante do dia" do Início (Meu Dia) passa a vir daqui.
-- Aniversário guarda só dia e mês (o ano de nascimento não é necessário).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists intranet.staff (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (char_length(trim(nome)) between 1 and 120),
  apelido        text check (apelido is null or char_length(apelido) <= 40),
  setor          text not null check (char_length(trim(setor)) between 1 and 60),
  cargo          text,
  unidade        text check (unidade is null or unidade in ('RJ', 'RS', 'Remoto')),
  vinculo        text check (vinculo is null or vinculo in ('CLT', 'PJ', 'Estágio', 'Temporário', 'Representante')),
  email          text,
  telefone       text,
  aniv_dia       smallint check (aniv_dia between 1 and 31),
  aniv_mes       smallint check (aniv_mes between 1 and 12),
  data_admissao  date,
  usuario_id     uuid unique references intranet.usuarios(id) on delete set null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check ((aniv_dia is null) = (aniv_mes is null)),
  check (aniv_dia is null or make_date(2024, aniv_mes, aniv_dia) is not null)  -- 2024: aceita 29/02
);
create index if not exists staff_aniv_idx on intranet.staff (aniv_mes, aniv_dia) where ativo;

-- limpa espaços, e-mail minúsculo e liga ao usuário da intranet pelo e-mail
create or replace function intranet.staff_before()
returns trigger language plpgsql security definer set search_path = '' as
$$ begin
  new.nome := trim(new.nome);
  new.setor := trim(new.setor);
  new.apelido := nullif(trim(coalesce(new.apelido, '')), '');
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  if new.email is not null and (tg_op = 'INSERT' or new.email is distinct from old.email) then
    new.usuario_id := (select u.id from intranet.usuarios u where u.email = new.email
                        and not exists (select 1 from intranet.staff s where s.usuario_id = u.id and s.id <> new.id));
  elsif new.email is null then
    new.usuario_id := null;
  end if;
  return new;
end $$;
drop trigger if exists t_staff_before on intranet.staff;
create trigger t_staff_before before insert or update on intranet.staff
  for each row execute function intranet.staff_before();
drop trigger if exists t_staff_touch on intranet.staff;
create trigger t_staff_touch before update on intranet.staff
  for each row execute function intranet.touch_atualizado_em();

alter table intranet.staff enable row level security;
drop policy if exists staff_ler on intranet.staff;
drop policy if exists staff_admin on intranet.staff;
create policy staff_ler on intranet.staff for select to authenticated using (intranet.me() is not null);
create policy staff_admin on intranet.staff for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());
grant select, insert, update, delete on intranet.staff to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                     and schemaname = 'intranet' and tablename = 'staff') then
    alter publication supabase_realtime add table intranet.staff;
  end if;
end $$;

-- ponto de partida: quem já está na intranet (com o aniversário que já existia)
insert into intranet.staff (nome, setor, email, telefone, aniv_dia, aniv_mes)
select u.nome, coalesce(nullif(trim(u.setor), ''), 'A definir'), u.email, u.telefone,
       extract(day from u.aniversario)::smallint, extract(month from u.aniversario)::smallint
  from intranet.usuarios u
 where u.ativo
   and not exists (select 1 from intranet.staff s where s.email = u.email);

-- ───────────── Aniversariantes do dia: agora vêm do Staff ─────────────
create or replace function intranet.staff_aniversariantes(p_dia date)
returns table (nome text, alias text)
language sql stable security definer set search_path = '' as
$$ select coalesce(s.apelido, s.nome), u.alias
     from intranet.staff s
     left join intranet.usuarios u on u.id = s.usuario_id
    where s.ativo and s.aniv_mes = extract(month from p_dia)::int
      and (s.aniv_dia = extract(day from p_dia)::int
           -- 29/02 em ano não bissexto: comemora em 28/02
           or (s.aniv_mes = 2 and s.aniv_dia = 29 and extract(day from p_dia)::int = 28
               and extract(day from (date_trunc('month', p_dia) + interval '1 month - 1 day'))::int = 28))
    order by 1 $$;

create or replace function intranet.api_meu_dia(p_data date default null)
returns jsonb language sql stable set search_path = '' as
$$
  with d as (select coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date) as dia)
  select jsonb_build_object(
    'date', to_char(d.dia, 'YYYY-MM-DD'),
    'tasksToday', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'numero', coalesce(t.numero, ''), 'titulo', t.titulo,
                                          'prioridade', t.prioridade, 'status', t.status)
                       order by case t.prioridade when 'alta' then 0 when 'media' then 1 else 2 end)
        from intranet.tarefas t
       where t.responsavel_id = intranet.me() and t.status <> 'done'
         and exists (select 1 from intranet.tarefa_ocorrencias o where o.tarefa_id = t.id and o.data = d.dia)), '[]'),
    'unreadTotal', coalesce((select sum(qtd) from intranet.nao_lidas()), 0),
    'birthdays', coalesce((
      select jsonb_agg(jsonb_build_object('nome', a.nome, 'dia', extract(day from d.dia)::int))
        from intranet.staff_aniversariantes(d.dia) a), '[]'),
    'calendarShared', true,
    'calendarEvents', '[]'::jsonb,
    'calendarRunnerEmail', '',
    'calendarError', '')
  from d
$$;

create or replace function intranet.meu_dia(p_data date default (now() at time zone 'America/Sao_Paulo')::date)
returns jsonb language sql stable security definer set search_path = '' as
$$
  select jsonb_build_object(
    'data', p_data,
    'tarefas', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'numero', t.numero, 'titulo', t.titulo,
                                          'prioridade', t.prioridade, 'status', t.status) order by t.prioridade)
        from intranet.tarefas t
        join intranet.tarefa_ocorrencias o on o.tarefa_id = t.id and o.data = p_data
       where t.responsavel_id = intranet.me() and t.status <> 'done'), '[]'::jsonb),
    'aniversariantes', coalesce((
      select jsonb_agg(jsonb_build_object('alias', a.alias, 'nome', a.nome))
        from intranet.staff_aniversariantes(p_data) a), '[]'::jsonb),
    'nao_lidas', coalesce((select sum(qtd) from intranet.nao_lidas()), 0)
  )
  where intranet.me() is not null
$$;

grant execute on function intranet.staff_aniversariantes(date), intranet.api_meu_dia(date), intranet.meu_dia(date) to authenticated;

notify pgrst, 'reload schema';

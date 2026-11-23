-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0002 · FUNÇÕES, TRIGGERS E RPCs
-- Regras de negócio que antes ficavam espalhadas no GS.txt
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────── IDENTIDADE ─────────────────────────
-- Usuário da intranet logado (null se o e-mail não estiver cadastrado ou estiver inativo)
create or replace function intranet.me()
returns uuid language sql stable security definer set search_path = '' as
$$ select u.id from intranet.usuarios u where u.auth_id = auth.uid() and u.ativo $$;

create or replace function intranet.is_admin()
returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from intranet.usuarios u
                  where u.auth_id = auth.uid() and u.ativo and u.papel = 'admin') $$;

create or replace function intranet.is_membro(p_canal uuid)
returns boolean language sql stable security definer set search_path = '' as
$$ select exists (
     select 1 from intranet.canais c
     where c.id = p_canal
       and (c.tipo = 'geral'
            or exists (select 1 from intranet.canal_membros m
                       where m.canal_id = c.id and m.usuario_id = intranet.me())))
   and intranet.me() is not null $$;

-- Vincula o login Google (auth.users) ao cadastro em intranet.usuarios pelo e-mail.
-- Quem não estiver cadastrado consegue logar, mas o RLS não libera nada.
create or replace function intranet.vincular_auth()
returns trigger language plpgsql security definer set search_path = '' as
$$
begin
  update intranet.usuarios
     set auth_id = new.id
   where email = lower(new.email)
     and (auth_id is null or auth_id = new.id);
  return new;
end $$;

do $$
begin
  if to_regclass('auth.users') is not null then
    execute 'drop trigger if exists intranet_vincular_auth on auth.users';
    execute 'create trigger intranet_vincular_auth after insert or update of email on auth.users
             for each row execute function intranet.vincular_auth()';
  end if;
end $$;

-- Dados do usuário logado para o front (substitui getGoogleUser + isAdmin do getInitialData)
create or replace function intranet.perfil()
returns table (id uuid, email text, alias text, nome text, setor text, papel intranet.papel, idioma text)
language sql stable security definer set search_path = '' as
$$ select u.id, u.email, u.alias, u.nome, u.setor, u.papel, u.idioma
     from intranet.usuarios u where u.id = intranet.me() $$;

create or replace function intranet.set_idioma(p_idioma text)
returns void language sql security definer set search_path = '' as
$$ update intranet.usuarios set idioma = p_idioma where id = intranet.me() $$;

-- ───────────────────────── UTILITÁRIOS ─────────────────────────
create or replace function intranet.touch_atualizado_em()
returns trigger language plpgsql as
$$ begin new.atualizado_em := now(); return new; end $$;

create trigger t_usuarios_touch  before update on intranet.usuarios  for each row execute function intranet.touch_atualizado_em();
create trigger t_tarefas_touch   before update on intranet.tarefas   for each row execute function intranet.touch_atualizado_em();
create trigger t_contatos_touch  before update on intranet.contatos  for each row execute function intranet.touch_atualizado_em();

create or replace function intranet.touch_wiki()
returns trigger language plpgsql as
$$ begin new.atualizado_em := now(); new.atualizado_por := coalesce(intranet.me(), new.atualizado_por); return new; end $$;
create trigger t_wiki_touch before update on intranet.wiki_artigos for each row execute function intranet.touch_wiki();

-- ───────────────────────── CHAT ─────────────────────────
-- Abre (ou devolve) a DM entre dois usuários. Key no formato legado 'dm:a_b' (aliases ordenados).
create or replace function intranet._abrir_dm(p_a uuid, p_b uuid)
returns uuid language plpgsql security definer set search_path = '' as
$$
declare
  v_a text; v_b text; v_key text; v_id uuid;
begin
  select alias into v_a from intranet.usuarios where id = p_a;
  select alias into v_b from intranet.usuarios where id = p_b;
  if v_a is null or v_b is null then raise exception 'Usuário inválido para DM'; end if;
  v_key := 'dm:' || least(v_a collate "C", v_b collate "C") || '_' || greatest(v_a collate "C", v_b collate "C");

  insert into intranet.canais (key, tipo, nome, criado_por)
  values (v_key, 'dm', v_key, p_a)
  on conflict (key) do nothing;
  select id into v_id from intranet.canais where key = v_key;

  insert into intranet.canal_membros (canal_id, usuario_id)
  values (v_id, p_a), (v_id, p_b)
  on conflict do nothing;
  return v_id;
end $$;

create or replace function intranet.abrir_dm(p_outro uuid)
returns uuid language plpgsql security definer set search_path = '' as
$$
begin
  if intranet.me() is null then raise exception 'Sem acesso'; end if;
  return intranet._abrir_dm(intranet.me(), p_outro);
end $$;

-- Cria canal nomeado com membros (o criador entra automaticamente)
create or replace function intranet.criar_canal(p_nome text, p_descricao text, p_membros uuid[])
returns uuid language plpgsql security definer set search_path = '' as
$$
declare
  v_me uuid := intranet.me(); v_slug text; v_id uuid;
begin
  if v_me is null then raise exception 'Sem acesso'; end if;
  if coalesce(trim(p_nome), '') = '' then raise exception 'Nome obrigatório'; end if;
  v_slug := 'canal:' || trim(both '-' from regexp_replace(regexp_replace(intranet.normalizar(p_nome), '[^a-z0-9]', '-', 'g'), '-+', '-', 'g'));
  if exists (select 1 from intranet.canais where key = v_slug) then
    v_slug := v_slug || '-' || (extract(epoch from now()) * 1000)::bigint;
  end if;
  insert into intranet.canais (key, tipo, nome, descricao, criado_por)
  values (v_slug, 'canal', trim(p_nome), nullif(trim(p_descricao), ''), v_me)
  returning id into v_id;
  insert into intranet.canal_membros (canal_id, usuario_id)
  select v_id, u from unnest(array_append(coalesce(p_membros, '{}'), v_me)) u
  on conflict do nothing;
  return v_id;
end $$;

-- Autor da mensagem = usuário logado (o front não consegue se passar por outro, como era com "alias")
create or replace function intranet.msg_before_insert()
returns trigger language plpgsql as
$$
begin
  if new.tipo <> 'sistema' and auth.uid() is not null then
    new.autor_id := intranet.me();
  end if;
  return new;
end $$;
create trigger t_msg_before_insert before insert on intranet.mensagens
  for each row execute function intranet.msg_before_insert();

-- Contagem de não lidas por canal (substitui getUnreadCounts + polling de 3s)
create or replace function intranet.nao_lidas()
returns table (canal_id uuid, key text, tipo intranet.canal_tipo, nome text,
               qtd bigint, ultima_id bigint, preview text, autor_alias text)
language sql stable security definer set search_path = '' as
$$
  with meus as (
    select c.id, c.key, c.tipo, c.nome,
           case when c.tipo = 'geral'
                then coalesce((select g.last_read_id from intranet.leituras_geral g where g.usuario_id = intranet.me()), 0)
                else m.last_read_id end as lido
      from intranet.canais c
      left join intranet.canal_membros m on m.canal_id = c.id and m.usuario_id = intranet.me()
     where intranet.me() is not null and (c.tipo = 'geral' or m.usuario_id is not null)
  )
  select x.id, x.key, x.tipo, x.nome, count(*) as qtd, max(msg.id) as ultima_id,
         (array_agg(case when msg.tipo = 'file' then '📎 ' || msg.conteudo else left(msg.conteudo, 60) end order by msg.id desc))[1],
         (array_agg(coalesce(u.alias, 'sistema') order by msg.id desc))[1]
    from meus x
    join intranet.mensagens msg on msg.canal_id = x.id and msg.id > x.lido and msg.deleted_at is null
    left join intranet.usuarios u on u.id = msg.autor_id
   where msg.autor_id is distinct from intranet.me()
   group by x.id, x.key, x.tipo, x.nome
$$;

create or replace function intranet.marcar_lido(p_canal uuid, p_ate bigint default null)
returns void language plpgsql security definer set search_path = '' as
$$
declare v_ate bigint;
begin
  if not intranet.is_membro(p_canal) then raise exception 'Sem acesso'; end if;
  v_ate := coalesce(p_ate, (select max(id) from intranet.mensagens where canal_id = p_canal), 0);
  if (select tipo from intranet.canais where id = p_canal) = 'geral' then
    insert into intranet.leituras_geral (usuario_id, last_read_id) values (intranet.me(), v_ate)
    on conflict (usuario_id) do update set last_read_id = greatest(intranet.leituras_geral.last_read_id, excluded.last_read_id);
  else
    update intranet.canal_membros set last_read_id = greatest(last_read_id, v_ate)
     where canal_id = p_canal and usuario_id = intranet.me();
  end if;
end $$;

-- Toggle de reação (mesmo comportamento do saveReaction)
create or replace function intranet.toggle_reacao(p_mensagem bigint, p_emoji text)
returns text language plpgsql security definer set search_path = '' as
$$
declare v_canal uuid;
begin
  select canal_id into v_canal from intranet.mensagens where id = p_mensagem;
  if v_canal is null or not intranet.is_membro(v_canal) then raise exception 'Sem acesso'; end if;
  delete from intranet.reacoes where mensagem_id = p_mensagem and usuario_id = intranet.me() and emoji = p_emoji;
  if found then return 'removed'; end if;
  insert into intranet.reacoes (mensagem_id, usuario_id, emoji) values (p_mensagem, intranet.me(), p_emoji);
  return 'added';
end $$;

-- ───────────────────────── TAREFAS ─────────────────────────
-- Numeração (substitui _getPrefix + getNextTaskNumber, agora atômica: sem número duplicado)
create or replace function intranet.prefixo_tarefa(p_marca text, p_unidade text)
returns text language sql stable set search_path = '' as
$$
  select coalesce(
    (select prefixo from intranet.marca_prefixos
      where unidade = lower(trim(p_unidade)) and marca = upper(trim(p_marca))),
    coalesce((select v from (values ('private','PVT'),('atacado','ATC'),('ecomm','ECM')) t(k, v)
               where k = lower(trim(p_unidade))), 'GEN')
    || rpad(left(regexp_replace(upper(coalesce(p_marca, '')), '[^A-Z]', '', 'g'), 2), 2, 'X'))
$$;

create or replace function intranet.proximo_numero(p_marca text, p_unidade text)
returns text language plpgsql security definer set search_path = '' as
$$
declare v_pref text := intranet.prefixo_tarefa(p_marca, p_unidade); v_n int;
begin
  insert into intranet.tarefa_contadores (prefixo, ultimo) values (v_pref, 1)
  on conflict (prefixo) do update set ultimo = intranet.tarefa_contadores.ultimo + 1
  returning ultimo into v_n;
  return v_pref || lpad(v_n::text, 3, '0');
end $$;

-- Recalcula contadores a partir dos números existentes (rodar após importar a planilha)
create or replace function intranet.recalcular_contadores()
returns void language sql security definer set search_path = '' as
$$
  insert into intranet.tarefa_contadores (prefixo, ultimo)
  select substring(numero from '^(.*?)\d+$'), max(substring(numero from '(\d+)$')::int)
    from intranet.tarefas where numero ~ '\d+$'
   group by 1
  on conflict (prefixo) do update set ultimo = greatest(intranet.tarefa_contadores.ultimo, excluded.ultimo)
$$;

create or replace function intranet.tarefa_before_insert()
returns trigger language plpgsql security definer set search_path = '' as
$$
begin
  if auth.uid() is not null then
    new.solicitante_id := intranet.me();
    new.status := 'todo';
  end if;
  new.marca := upper(trim(new.marca));
  new.unidade := lower(trim(new.unidade));
  if new.numero is null then
    new.numero := intranet.proximo_numero(new.marca, new.unidade);
  end if;
  return new;
end $$;
create trigger t_tarefa_before_insert before insert on intranet.tarefas
  for each row execute function intranet.tarefa_before_insert();

-- Gera as ocorrências da recorrência (substitui _generateOccurrences)
create or replace function intranet.gerar_ocorrencias(p_tarefa uuid)
returns void language plpgsql security definer set search_path = '' as
$$
declare t intranet.tarefas;
begin
  select * into t from intranet.tarefas where id = p_tarefa;
  delete from intranet.tarefa_ocorrencias where tarefa_id = p_tarefa and calendar_event_id is null;
  insert into intranet.tarefa_ocorrencias (tarefa_id, ordem, data)
  select t.id, i + 1,
         case t.recorrencia
           when 'diaria'    then t.prazo + i
           when 'semanal'   then t.prazo + i * 7
           when 'quinzenal' then t.prazo + i * 14
           when 'mensal'    then (t.prazo + make_interval(months => i))::date
           else t.prazo end
    from generate_series(0, case when t.recorrencia is null then 0 else t.total_ocorrencias - 1 end) i
  on conflict do nothing;
end $$;

-- Após criar: ocorrências + aviso na DM solicitante↔responsável (substitui _notifyTaskInChat)
create or replace function intranet.tarefa_after_insert()
returns trigger language plpgsql security definer set search_path = '' as
$$
declare
  v_dm uuid; v_sol text; v_rec text := '';
begin
  if new.legacy_id is not null then return new; end if;   -- importação da planilha: não notifica
  perform intranet.gerar_ocorrencias(new.id);
  if new.solicitante_id is not null and new.solicitante_id <> new.responsavel_id then
    v_dm := intranet._abrir_dm(new.solicitante_id, new.responsavel_id);
    select alias into v_sol from intranet.usuarios where id = new.solicitante_id;
    if new.recorrencia is not null and new.total_ocorrencias > 1 then
      v_rec := E'\n🔁 Recorrência: ' || new.recorrencia || ' · ' || new.total_ocorrencias || ' vezes';
    end if;
    insert into intranet.mensagens (canal_id, autor_id, tipo, conteudo)
    values (v_dm, null, 'sistema',
      E'📋 Nova tarefa atribuída!\n🔢 Número: ' || new.numero ||
      E'\n' || case new.prioridade when 'alta' then '🔴' when 'media' then '🟡' else '🟢' end ||
      ' Prioridade: ' || new.prioridade ||
      E'\n• Título: ' || new.titulo || E'\n• Unidade: ' || new.unidade || E'\n• Marca: ' || new.marca ||
      E'\n• Prazo: ' || to_char(new.prazo, 'DD/MM/YYYY') || E'\n• De: ' || coalesce(v_sol, '?') || v_rec);
  end if;
  return new;
end $$;
create trigger t_tarefa_after_insert after insert on intranet.tarefas
  for each row execute function intranet.tarefa_after_insert();

-- Regras de status (substitui updateTaskStatus):
--   • só o responsável (ou admin) muda o status
--   • fluxo todo → doing → done (admin pode reabrir)
create or replace function intranet.tarefa_before_update()
returns trigger language plpgsql security definer set search_path = '' as
$$
declare v_admin boolean := intranet.is_admin();
begin
  if auth.uid() is null then return new; end if;   -- service_role / Edge Functions
  new.solicitante_id := old.solicitante_id;
  new.numero := old.numero;
  if new.status is distinct from old.status then
    if not v_admin and old.responsavel_id <> intranet.me() then
      raise exception 'Apenas o responsável pode mover esta tarefa.';
    end if;
    if not v_admin and not ((old.status = 'todo' and new.status = 'doing') or (old.status = 'doing' and new.status = 'done')) then
      raise exception 'Transição de status inválida.';
    end if;
    if new.status = 'doing' then new.iniciado_em := coalesce(old.iniciado_em, now()); end if;
    if new.status = 'done'  then new.concluido_em := now(); else new.concluido_em := null; end if;
  end if;
  return new;
end $$;
create trigger t_tarefa_before_update before update on intranet.tarefas
  for each row execute function intranet.tarefa_before_update();

create or replace function intranet.anexo_before_insert()
returns trigger language plpgsql as
$$ begin if auth.uid() is not null then new.enviado_por := intranet.me(); end if; return new; end $$;
create trigger t_anexo_before_insert before insert on intranet.tarefa_anexos
  for each row execute function intranet.anexo_before_insert();

create or replace function intranet.comentario_before_insert()
returns trigger language plpgsql as
$$ begin if auth.uid() is not null then new.autor_id := intranet.me(); end if; return new; end $$;
create trigger t_comentario_before_insert before insert on intranet.tarefa_comentarios
  for each row execute function intranet.comentario_before_insert();

create or replace function intranet.drive_before_insert()
returns trigger language plpgsql as
$$ begin if auth.uid() is not null then new.enviado_por := intranet.me(); end if; return new; end $$;
create trigger t_drive_before_insert before insert on intranet.drive_arquivos
  for each row execute function intranet.drive_before_insert();

-- Pode enviar arquivo neste setor do Drive?
create or replace function intranet.pode_enviar_drive(p_setor text)
returns boolean language sql stable security definer set search_path = '' as
$$ select intranet.is_admin() or exists (
     select 1 from intranet.drive_setor_uploaders
      where setor_key = p_setor and usuario_id = intranet.me()) $$;

-- ───────────────────────── MEU DIA ─────────────────────────
-- Tarefas do dia + aniversariantes (o Calendar entra via Edge Function na fase 6)
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
      select jsonb_agg(jsonb_build_object('alias', u.alias, 'nome', u.nome))
        from intranet.usuarios u
       where u.ativo and u.aniversario is not null
         and extract(month from u.aniversario) = extract(month from p_data)
         and extract(day from u.aniversario) = extract(day from p_data)), '[]'::jsonb),
    'nao_lidas', coalesce((select sum(qtd) from intranet.nao_lidas()), 0)
  )
  where intranet.me() is not null
$$;

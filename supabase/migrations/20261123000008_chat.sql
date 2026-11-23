-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0008 · CHAT (fase 5)
-- Mesmo comportamento do GS.txt (sendChatMessage, getChatMessages, canais, DMs,
-- reações, não lidas), com o front recebendo o mesmo formato de antes.
--
-- IDs: o front antigo compara IDs de mensagem como timestamp em ms (Date.now()).
-- Por isso cada mensagem tem legacy_id = momento do envio em ms (único), e é esse
-- número que o front enxerga. O id interno continua sendo a chave do banco.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────── legacy_id automático ─────────────────────────
create or replace function intranet.msg_legacy_id()
returns trigger language plpgsql security definer set search_path = '' as
$$
begin
  if new.legacy_id is null then
    perform pg_advisory_xact_lock(hashtext('intranet.mensagens.legacy_id'));
    new.legacy_id := greatest((extract(epoch from clock_timestamp()) * 1000)::bigint,
                              coalesce((select max(legacy_id) from intranet.mensagens), 0) + 1);
  end if;
  return new;
end $$;
drop trigger if exists t_msg_legacy_id on intranet.mensagens;
create trigger t_msg_legacy_id before insert on intranet.mensagens
  for each row execute function intranet.msg_legacy_id();

-- Mensagens criadas antes desta migration (ex.: avisos de tarefa da fase 4) ganham legacy_id também
do $$
declare r record; v bigint;
begin
  for r in select id, criado_em from intranet.mensagens where legacy_id is null order by id loop
    v := (extract(epoch from r.criado_em) * 1000)::bigint;
    while exists (select 1 from intranet.mensagens where legacy_id = v) loop v := v + 1; end loop;
    update intranet.mensagens set legacy_id = v where id = r.id;
  end loop;
end $$;

-- ───────────────────────── helpers ─────────────────────────
-- Resolve a key do front ('geral', 'dm:a_b', 'canal:x') no canal, criando a DM se ainda não existir
create or replace function intranet.canal_por_key(p_key text, p_criar_dm boolean default false)
returns uuid language plpgsql security definer set search_path = '' as
$$
declare v_id uuid; v_me uuid := intranet.me(); v_meu text; v_partes text[]; v_outro uuid;
begin
  if v_me is null then return null; end if;
  select id into v_id from intranet.canais where key = p_key;
  if v_id is not null or not p_criar_dm or p_key not like 'dm:%' then return v_id; end if;

  select alias into v_meu from intranet.usuarios where id = v_me;
  v_partes := string_to_array(substr(p_key, 4), '_');
  if not (v_meu = any(v_partes)) then return null; end if;   -- só cria DM da qual eu participo
  select id into v_outro from intranet.usuarios
   where alias = coalesce((select p from unnest(v_partes) p where p <> v_meu limit 1), v_meu);
  if v_outro is null then return null; end if;
  return intranet._abrir_dm(v_me, v_outro);
end $$;

-- Linha no formato do front: {id(legacy), ts, alias, text, type, url, path}
create or replace function intranet._msg_json(m intranet.mensagens)
returns jsonb language sql stable set search_path = '' as
$$
  select jsonb_build_object(
    'id', m.legacy_id,
    'ts', to_char(m.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'alias', case when m.tipo = 'sistema' then 'sistema'
                  else coalesce((select alias from intranet.usuarios where id = m.autor_id), '?') end,
    'text', m.conteudo,
    'type', case when m.tipo = 'sistema' then 'text' else m.tipo::text end,
    'url', coalesce(m.arquivo_url, ''),
    'path', m.arquivo_path)
$$;

-- ───────────────────────── LER (getChatMessages / Before) ─────────────────────────
-- p_depois = 0 → últimas p_limite mensagens. Ao ler, marca o canal como lido.
create or replace function intranet.api_mensagens(p_key text, p_depois bigint, p_limite int default 60)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_canal uuid := intranet.canal_por_key(p_key); v_res jsonb;
begin
  if v_canal is null or not intranet.is_membro(v_canal) then return '[]'; end if;
  if coalesce(p_depois, 0) = 0 then
    select coalesce(jsonb_agg(j order by lid), '[]') into v_res from (
      select intranet._msg_json(m) j, m.legacy_id lid from intranet.mensagens m
       where m.canal_id = v_canal and m.deleted_at is null
       order by m.legacy_id desc limit greatest(coalesce(p_limite, 60), 1)) x;
  else
    select coalesce(jsonb_agg(j order by lid), '[]') into v_res from (
      select intranet._msg_json(m) j, m.legacy_id lid from intranet.mensagens m
       where m.canal_id = v_canal and m.deleted_at is null and m.legacy_id > p_depois
       order by m.legacy_id limit 500) x;
  end if;
  if jsonb_array_length(v_res) > 0 then perform intranet.marcar_lido(v_canal); end if;
  return v_res;
end $$;

create or replace function intranet.api_mensagens_antes(p_key text, p_antes bigint, p_limite int default 60)
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_agg(j order by lid), '[]') from (
    select intranet._msg_json(m) j, m.legacy_id lid
      from intranet.mensagens m
     where m.canal_id = intranet.canal_por_key(p_key) and m.deleted_at is null and m.legacy_id < p_antes
     order by m.legacy_id desc limit greatest(coalesce(p_limite, 60), 1)) x
$$;

-- ───────────────────────── ENVIAR (sendChatMessage / uploadChatFile) ─────────────────────────
-- p_sistema: o front manda a mensagem "🎉 canal criado" como 'sistema' — só o criador do canal pode
create or replace function intranet.api_enviar(p_key text, p_texto text, p_sistema boolean default false,
                                               p_arquivo_path text default null)
returns jsonb language plpgsql security definer set search_path = '' as
$$
declare v_canal uuid; v_me uuid := intranet.me(); v_msg intranet.mensagens; v_tipo intranet.msg_tipo;
begin
  if v_me is null then raise exception 'Sem acesso.'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'Mensagem vazia.'; end if;
  v_canal := intranet.canal_por_key(p_key, true);
  if v_canal is null or not intranet.is_membro(v_canal) then raise exception 'Canal inexistente ou sem acesso.'; end if;

  v_tipo := case when p_arquivo_path is not null then 'file' else 'text' end;
  if p_sistema then
    if not exists (select 1 from intranet.canais where id = v_canal and criado_por = v_me) then
      raise exception 'Sem permissão.';
    end if;
    v_tipo := 'sistema';
  end if;

  insert into intranet.mensagens (canal_id, autor_id, tipo, conteudo, arquivo_path)
  values (v_canal, case when v_tipo = 'sistema' then null else v_me end, v_tipo, left(trim(p_texto), 2000), p_arquivo_path)
  returning * into v_msg;
  perform intranet.marcar_lido(v_canal);
  return intranet._msg_json(v_msg) || jsonb_build_object('channel', p_key);
end $$;

-- ID do canal (para montar o caminho do arquivo no Storage); cria a DM se precisar
create or replace function intranet.api_canal_id(p_key text)
returns uuid language plpgsql security definer set search_path = '' as
$$
declare v uuid := intranet.canal_por_key(p_key, true);
begin
  if v is null or not intranet.is_membro(v) then raise exception 'Canal inexistente ou sem acesso.'; end if;
  return v;
end $$;

-- ───────────────────────── NÃO LIDAS (getUnreadCounts) ─────────────────────────
create or replace function intranet.api_nao_lidas()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_object_agg(n.key, jsonb_build_object(
           'count', n.qtd, 'sender', n.autor_alias, 'preview', n.preview,
           'isDM', n.tipo = 'dm', 'msgId', m.legacy_id)), '{}')
    from intranet.nao_lidas() n
    join intranet.mensagens m on m.id = n.ultima_id
$$;

-- DMs que eu já tenho (para o front listar na barra lateral em qualquer computador)
create or replace function intranet.api_minhas_dms()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_agg(jsonb_build_object('chKey', c.key,
           'createdBy', coalesce((select alias from intranet.usuarios where id = c.criado_por), '')) order by c.criado_em), '[]')
    from intranet.canais c
    join intranet.canal_membros m on m.canal_id = c.id and m.usuario_id = intranet.me()
   where c.tipo = 'dm' and exists (select 1 from intranet.mensagens x where x.canal_id = c.id)
$$;

-- ───────────────────────── REAÇÕES ─────────────────────────
create or replace function intranet.api_reacoes(p_key text)
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_object_agg(lid::text, emojis), '{}') from (
    select m.legacy_id lid, jsonb_object_agg(e.emoji, e.aliases) emojis
      from intranet.mensagens m
      join lateral (select r.emoji, jsonb_agg(u.alias order by r.criado_em) aliases
                      from intranet.reacoes r join intranet.usuarios u on u.id = r.usuario_id
                     where r.mensagem_id = m.id group by r.emoji) e on true
     where m.canal_id = intranet.canal_por_key(p_key)
     group by m.legacy_id) x
$$;

create or replace function intranet.api_reagir(p_legacy bigint, p_emoji text)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_id bigint;
begin
  select id into v_id from intranet.mensagens where legacy_id = p_legacy;
  if v_id is null then return jsonb_build_object('ok', false, 'msg', 'Mensagem não encontrada.'); end if;
  return jsonb_build_object('ok', true, 'action', intranet.toggle_reacao(v_id, p_emoji));
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

-- ───────────────────────── CANAIS ─────────────────────────
create or replace function intranet._membros_por_alias(p_membros text)
returns uuid[] language sql stable set search_path = '' as
$$
  select coalesce(array_agg(u.id), '{}') from intranet.usuarios u
   where u.alias = any(select lower(trim(x)) from unnest(string_to_array(coalesce(p_membros, ''), ',')) x where trim(x) <> '')
$$;

create or replace function intranet._canal_json(p_id uuid)
returns jsonb language sql stable set search_path = '' as
$$
  select jsonb_build_object('key', c.key, 'name', c.nome, 'description', coalesce(c.descricao, ''),
           'createdBy', coalesce(cr.alias, ''),
           'members', coalesce((select jsonb_agg(u.alias order by u.alias) from intranet.canal_membros m
                                 join intranet.usuarios u on u.id = m.usuario_id where m.canal_id = c.id), '[]'))
    from intranet.canais c left join intranet.usuarios cr on cr.id = c.criado_por
   where c.id = p_id
$$;

create or replace function intranet.api_canais()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_agg(intranet._canal_json(c.id) order by c.nome), '[]')
    from intranet.canais c
   where c.tipo = 'canal'
     and (c.criado_por = intranet.me()
          or exists (select 1 from intranet.canal_membros m where m.canal_id = c.id and m.usuario_id = intranet.me()))
$$;

create or replace function intranet.api_criar_canal(p_nome text, p_descricao text, p_membros text)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_id uuid; v_j jsonb;
begin
  v_id := intranet.criar_canal(p_nome, p_descricao, intranet._membros_por_alias(p_membros));
  v_j := intranet._canal_json(v_id);
  return jsonb_build_object('ok', true, 'channelKey', v_j->>'key', 'name', v_j->>'name', 'members', v_j->'members');
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

create or replace function intranet.api_editar_canal(p_key text, p_nome text, p_descricao text, p_membros text)
returns jsonb language plpgsql security definer set search_path = '' as
$$
declare c intranet.canais; v_membros uuid[]; v_j jsonb;
begin
  select * into c from intranet.canais where key = p_key and tipo = 'canal';
  if c.id is null then return jsonb_build_object('ok', false, 'msg', 'Canal não encontrado.'); end if;
  if c.criado_por is distinct from intranet.me() and not intranet.is_admin() then
    return jsonb_build_object('ok', false, 'msg', 'Apenas o criador pode editar.');
  end if;
  v_membros := array_append(intranet._membros_por_alias(p_membros), c.criado_por);
  update intranet.canais set nome = coalesce(nullif(trim(p_nome), ''), nome),
                             descricao = nullif(trim(coalesce(p_descricao, '')), '')
   where id = c.id;
  delete from intranet.canal_membros where canal_id = c.id and not (usuario_id = any(v_membros));
  insert into intranet.canal_membros (canal_id, usuario_id)
  select c.id, u from unnest(v_membros) u where u is not null on conflict do nothing;
  v_j := intranet._canal_json(c.id);
  return jsonb_build_object('ok', true, 'channelKey', p_key, 'name', v_j->>'name', 'members', v_j->'members');
end $$;

create or replace function intranet.api_excluir_canal(p_key text)
returns jsonb language plpgsql set search_path = '' as
$$
declare v uuid;
begin
  delete from intranet.canais where key = p_key and tipo = 'canal' returning id into v;   -- RLS: criador ou admin
  if v is null then return jsonb_build_object('ok', false, 'msg', 'Sem permissão.'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function intranet.api_sair_canal(p_key text)
returns jsonb language plpgsql security definer set search_path = '' as
$$
declare c intranet.canais;
begin
  select * into c from intranet.canais where key = p_key and tipo = 'canal';
  if c.id is null then return jsonb_build_object('ok', false, 'msg', 'Canal não encontrado.'); end if;
  if c.criado_por = intranet.me() then return jsonb_build_object('ok', false, 'msg', 'O criador não pode sair.'); end if;
  delete from intranet.canal_membros where canal_id = c.id and usuario_id = intranet.me();
  return jsonb_build_object('ok', true);
end $$;

grant execute on all functions in schema intranet to authenticated, service_role;
revoke execute on function intranet._abrir_dm(uuid, uuid) from authenticated, public;
revoke execute on function intranet.proximo_numero(text, text) from authenticated, public;
revoke execute on function intranet.recalcular_contadores() from authenticated, public;
revoke execute on function intranet.gerar_ocorrencias(uuid) from authenticated, public;

notify pgrst, 'reload schema';

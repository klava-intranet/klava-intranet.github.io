-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0006 · API NO FORMATO DO FRONT ATUAL (fase 3)
-- O front da versão Apps Script continua o mesmo; uma camada de compatibilidade
-- (web/src/shim/gas.js) troca cada google.script.run.X() por uma destas RPCs.
-- Todas rodam como o usuário logado (SECURITY INVOKER) → o RLS continua valendo.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────── USUÁRIOS ─────────────────────────
create or replace function intranet.api_usuarios()
returns jsonb language sql stable set search_path = '' as
$$ select coalesce(jsonb_agg(alias order by alias), '[]') from intranet.usuarios where ativo $$;

create or replace function intranet.api_usuarios_nomes()
returns jsonb language sql stable set search_path = '' as
$$ select coalesce(jsonb_object_agg(alias, nome), '{}') from intranet.usuarios where ativo $$;

-- ───────────────────────── TAREFAS (leitura) ─────────────────────────
create or replace function intranet.api_tarefas()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_agg(x.j order by x.p, x.prazo), '[]')
  from (
    select case t.prioridade when 'alta' then 0 when 'media' then 1 else 2 end as p, t.prazo,
      jsonb_build_object(
        'id', t.id, 'titulo', t.titulo, 'descricao', t.descricao,
        'solicitante', coalesce(s.alias, ''), 'responsavel', coalesce(r.alias, ''),
        'prazo', to_char(t.prazo, 'YYYY-MM-DD'), 'prioridade', t.prioridade,
        'unidade', t.unidade, 'marca', t.marca, 'status', t.status,
        'calEventId', coalesce((select o.calendar_event_id from intranet.tarefa_ocorrencias o
                                where o.tarefa_id = t.id order by o.ordem limit 1), ''),
        'criadoEm', to_char(t.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'anexos', coalesce((select jsonb_agg(jsonb_build_object('name', a.nome, 'url', coalesce(a.url, ''), 'path', a.storage_path)
                                             order by a.criado_em)
                            from intranet.tarefa_anexos a where a.tarefa_id = t.id), '[]')::text,
        'numero', coalesce(t.numero, ''), 'recorrencia', coalesce(t.recorrencia::text, ''),
        'totalOcorrencias', t.total_ocorrencias,
        'calEventIds', coalesce((select jsonb_agg(coalesce(o.calendar_event_id, '') order by o.ordem)
                                 from intranet.tarefa_ocorrencias o where o.tarefa_id = t.id), '[]')::text
      ) as j
    from intranet.tarefas t
    left join intranet.usuarios s on s.id = t.solicitante_id
    left join intranet.usuarios r on r.id = t.responsavel_id
  ) x
$$;

create or replace function intranet.api_dashboard()
returns jsonb language sql stable set search_path = '' as
$$
  select jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(jsonb_build_object(
                'id', t.id, 'status', t.status, 'prioridade', t.prioridade,
                'responsavel', coalesce(u.alias, ''), 'prazo', to_char(t.prazo, 'YYYY-MM-DD'),
                'recorrencia', coalesce(t.recorrencia::text, '')))
              from intranet.tarefas t left join intranet.usuarios u on u.id = t.responsavel_id), '[]'),
    'chatCount', (select count(*) from intranet.mensagens where deleted_at is null),
    'commentCount', (select count(*) from intranet.tarefa_comentarios where deleted_at is null))
$$;

create or replace function intranet.api_comentarios(p_tarefa uuid)
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'taskId', c.tarefa_id, 'alias', coalesce(u.alias, '?'), 'text', c.texto,
           'createdAt', to_char(c.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
         order by c.criado_em), '[]')
    from intranet.tarefa_comentarios c left join intranet.usuarios u on u.id = c.autor_id
   where c.tarefa_id = p_tarefa and c.deleted_at is null
$$;

create or replace function intranet.api_pendentes()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'numero', coalesce(numero, ''), 'titulo', titulo)
                            order by prazo), '[]')
    from intranet.tarefas where responsavel_id = intranet.me() and status <> 'done'
$$;

-- ───────────────────────── CONTATOS ─────────────────────────
create or replace function intranet.api_contatos()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'sectorKey', setor_key, 'sectorLabel', setor_label, 'nome', nome, 'cargo', cargo,
           'telefone', telefone, 'email', email, 'ordem', ordem, 'cargoEn', cargo_en, 'cargoZh', cargo_zh)
         order by ordem, nome), '[]')
    from intranet.contatos where deleted_at is null
$$;

create or replace function intranet.api_salvar_contato(p jsonb)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_id uuid;
begin
  if not intranet.is_admin() then return jsonb_build_object('ok', false, 'msg', 'Apenas administradores podem gerenciar contatos.'); end if;
  if coalesce(p->>'nome', '') = '' or coalesce(p->>'cargo', '') = '' then return jsonb_build_object('ok', false, 'msg', 'Nome e cargo são obrigatórios.'); end if;
  if coalesce(p->>'sectorKey', '') = '' then return jsonb_build_object('ok', false, 'msg', 'Selecione um setor.'); end if;
  if coalesce(p->>'id', '') <> '' then
    update intranet.contatos set setor_key = p->>'sectorKey', setor_label = coalesce(p->>'sectorLabel', ''),
           nome = p->>'nome', cargo = p->>'cargo', cargo_en = coalesce(p->>'cargoEn', ''), cargo_zh = coalesce(p->>'cargoZh', ''),
           telefone = coalesce(p->>'telefone', ''), email = lower(coalesce(p->>'email', ''))
     where id = (p->>'id')::uuid and deleted_at is null
    returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'msg', 'Contato não encontrado.'); end if;
  else
    insert into intranet.contatos (setor_key, setor_label, nome, cargo, cargo_en, cargo_zh, telefone, email, ordem, criado_por)
    values (p->>'sectorKey', coalesce(p->>'sectorLabel', ''), p->>'nome', p->>'cargo', coalesce(p->>'cargoEn', ''),
            coalesce(p->>'cargoZh', ''), coalesce(p->>'telefone', ''), lower(coalesce(p->>'email', '')),
            coalesce((select max(ordem) + 1 from intranet.contatos), 0), intranet.me())
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

create or replace function intranet.api_excluir_contato(p_id uuid)
returns jsonb language plpgsql set search_path = '' as
$$
begin
  if not intranet.is_admin() then return jsonb_build_object('ok', false, 'msg', 'Apenas administradores podem remover contatos.'); end if;
  update intranet.contatos set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Contato não encontrado.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── WIKI ─────────────────────────
create or replace function intranet.api_wiki()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', w.id, 'categoria', w.categoria, 'titulo', w.titulo, 'conteudo', w.conteudo,
           'createdBy', coalesce(c.alias, ''), 'createdAt', to_char(w.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'updatedBy', coalesce(a.alias, ''), 'updatedAt', to_char(w.atualizado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
         order by w.titulo), '[]')
    from intranet.wiki_artigos w
    left join intranet.usuarios c on c.id = w.criado_por
    left join intranet.usuarios a on a.id = w.atualizado_por
   where w.deleted_at is null
$$;

create or replace function intranet.api_salvar_wiki(p jsonb)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_id uuid;
begin
  if not intranet.is_admin() then return jsonb_build_object('ok', false, 'msg', 'Apenas administradores podem gerenciar a Base de Conhecimento.'); end if;
  if coalesce(p->>'titulo', '') = '' or coalesce(p->>'conteudo', '') = '' then return jsonb_build_object('ok', false, 'msg', 'Título e conteúdo são obrigatórios.'); end if;
  if coalesce(p->>'categoria', '') = '' then return jsonb_build_object('ok', false, 'msg', 'Selecione ou digite uma categoria.'); end if;
  if coalesce(p->>'id', '') <> '' then
    update intranet.wiki_artigos set categoria = p->>'categoria', titulo = p->>'titulo', conteudo = p->>'conteudo'
     where id = (p->>'id')::uuid and deleted_at is null returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'msg', 'Artigo não encontrado.'); end if;
  else
    insert into intranet.wiki_artigos (categoria, titulo, conteudo, criado_por, atualizado_por)
    values (p->>'categoria', p->>'titulo', p->>'conteudo', intranet.me(), intranet.me()) returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

create or replace function intranet.api_excluir_wiki(p_id uuid)
returns jsonb language plpgsql set search_path = '' as
$$
begin
  if not intranet.is_admin() then return jsonb_build_object('ok', false, 'msg', 'Apenas administradores podem remover artigos.'); end if;
  update intranet.wiki_artigos set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Artigo não encontrado.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── DRIVE ─────────────────────────
create or replace function intranet.api_drive_links()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_object_agg(setor_key, itens), '{}')
  from (select setor_key, jsonb_agg(jsonb_build_object('id', id, 'title', titulo, 'url', url, 'sub', sub, 'type', tipo)
                                    order by criado_em) itens
          from intranet.drive_links where deleted_at is null group by setor_key) x
$$;

create or replace function intranet.api_salvar_link(p_setor text, p_titulo text, p_url text, p_sub text, p_tipo text)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_id uuid;
begin
  if not intranet.is_admin() then return jsonb_build_object('ok', false, 'msg', 'Apenas administradores podem adicionar links.'); end if;
  if coalesce(p_setor, '') = '' or coalesce(p_titulo, '') = '' or coalesce(p_url, '') = '' then
    return jsonb_build_object('ok', false, 'msg', 'Parâmetros inválidos.');
  end if;
  insert into intranet.drive_setores (key, nome, ordem) values (p_setor, initcap(p_setor), 99) on conflict do nothing;
  insert into intranet.drive_links (setor_key, titulo, url, sub, tipo, criado_por)
  values (p_setor, p_titulo, p_url, coalesce(p_sub, ''), coalesce(nullif(p_tipo, ''), 'link'), intranet.me())
  returning id into v_id;
  return jsonb_build_object('ok', true, 'linkId', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

create or replace function intranet.api_excluir_link(p_id uuid)
returns jsonb language plpgsql set search_path = '' as
$$
begin
  if not intranet.is_admin() then return jsonb_build_object('ok', false, 'msg', 'Apenas administradores podem remover links.'); end if;
  update intranet.drive_links set deleted_at = now() where id = p_id and deleted_at is null;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Link não encontrado.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Arquivos por setor. storagePath vem preenchido nos uploads novos: o front gera a URL assinada.
create or replace function intranet.api_drive_arquivos()
returns jsonb language sql stable set search_path = '' as
$$
  select coalesce(jsonb_object_agg(s.key, coalesce(x.itens, '[]')), '{}')
  from intranet.drive_setores s
  left join (
    select a.setor_key, jsonb_agg(jsonb_build_object(
             'id', a.id, 'name', a.nome, 'desc', a.descricao, 'url', coalesce(a.url, ''),
             'storagePath', a.storage_path, 'uploadedBy', coalesce(u.alias, ''),
             'uploadedAt', to_char(a.enviado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'size', coalesce(a.tamanho, 0)) order by a.enviado_em desc) itens
      from intranet.drive_arquivos a left join intranet.usuarios u on u.id = a.enviado_por
     where a.deleted_at is null group by a.setor_key) x on x.setor_key = s.key
$$;

create or replace function intranet.api_excluir_arquivo(p_id uuid)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_path text;
begin
  update intranet.drive_arquivos set deleted_at = now()
   where id = p_id and deleted_at is null
  returning storage_path into v_path;
  if not found then return jsonb_build_object('ok', false, 'msg', 'Arquivo não encontrado ou sem permissão.'); end if;
  return jsonb_build_object('ok', true, 'storagePath', v_path);
end $$;

-- ───────────────────────── BUSCA GLOBAL ─────────────────────────
-- Mesmo formato do globalSearch do GS, mas sem acento/maiúscula e respeitando o RLS
create or replace function intranet.api_busca(p_q text)
returns jsonb language sql stable set search_path = '' as
$$
  with q as (select '%' || intranet.normalizar(trim(p_q)) || '%' as like_q)
  select case when char_length(trim(coalesce(p_q, ''))) < 2
    then jsonb_build_object('tasks', '[]'::jsonb, 'contacts', '[]'::jsonb, 'driveLinks', '[]'::jsonb, 'chat', '[]'::jsonb, 'wiki', '[]'::jsonb)
    else jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('id', t.id, 'numero', coalesce(t.numero, ''), 'titulo', t.titulo,
                                  'status', t.status, 'responsavel', coalesce(u.alias, '')) r
          from intranet.tarefas t left join intranet.usuarios u on u.id = t.responsavel_id, q
         where intranet.normalizar(t.titulo || ' ' || t.descricao || ' ' || coalesce(t.numero, '')) like q.like_q
         order by t.criado_em desc limit 6) z), '[]'),
    'contacts', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('id', c.id, 'sectorKey', c.setor_key, 'sectorLabel', c.setor_label, 'nome', c.nome,
                                  'cargo', c.cargo, 'telefone', c.telefone, 'email', c.email,
                                  'cargoEn', c.cargo_en, 'cargoZh', c.cargo_zh) r
          from intranet.contatos c, q
         where c.deleted_at is null and intranet.normalizar(c.nome || ' ' || c.cargo || ' ' || c.email) like q.like_q
         order by c.ordem limit 6) z), '[]'),
    'wiki', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('id', w.id, 'categoria', w.categoria, 'titulo', w.titulo) r
          from intranet.wiki_artigos w, q
         where w.deleted_at is null and intranet.normalizar(w.titulo || ' ' || w.categoria || ' ' || w.conteudo) like q.like_q
         order by w.titulo limit 6) z), '[]'),
    'driveLinks', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('id', d.id, 'sectorId', d.setor_key, 'title', d.titulo, 'url', d.url,
                                  'sub', d.sub, 'type', d.tipo) r
          from intranet.drive_links d, q
         where d.deleted_at is null and intranet.normalizar(d.titulo || ' ' || d.sub) like q.like_q
         order by d.titulo limit 6) z), '[]'),
    'chat', coalesce((select jsonb_agg(r) from (
        select jsonb_build_object('id', m.id, 'channel', c.key, 'sender', coalesce(u.alias, 'sistema'),
                                  'text', left(m.conteudo, 80),
                                  'ts', to_char(m.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) r
          from intranet.mensagens m
          join intranet.canais c on c.id = m.canal_id
          left join intranet.usuarios u on u.id = m.autor_id, q
         where m.deleted_at is null and intranet.normalizar(m.conteudo) like q.like_q
         order by m.id desc limit 6) z), '[]'))
  end
  from q
$$;

-- ───────────────────────── MEU DIA ─────────────────────────
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
      select jsonb_agg(jsonb_build_object('nome', u.nome, 'dia', extract(day from u.aniversario)::int) order by u.nome)
        from intranet.usuarios u
       where u.ativo and u.aniversario is not null
         and extract(month from u.aniversario) = extract(month from d.dia)
         and extract(day from u.aniversario) = extract(day from d.dia)), '[]'),
    'calendarShared', true,
    'calendarEvents', '[]'::jsonb,
    'calendarRunnerEmail', '',
    'calendarError', '')
  from d
$$;

-- ───────────────────────── PERMISSÕES ─────────────────────────
grant execute on all functions in schema intranet to authenticated, service_role;
revoke execute on function intranet._abrir_dm(uuid, uuid) from authenticated, public;
revoke execute on function intranet.proximo_numero(text, text) from authenticated, public;
revoke execute on function intranet.recalcular_contadores() from authenticated, public;
revoke execute on function intranet.gerar_ocorrencias(uuid) from authenticated, public;

notify pgrst, 'reload schema';

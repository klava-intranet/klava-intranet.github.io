-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0007 · TAREFAS: criar, editar, mover, excluir, comentar (fase 4)
-- Mesmas regras do GS.txt (createTask, updateTask, updateTaskStatus, deleteTask,
-- addTaskComment, deleteTaskComment), agora garantidas pelo banco.
-- Google Agenda e e-mails de aviso entram na fase 6.
-- ═══════════════════════════════════════════════════════════════════════

-- Data da i-ésima ocorrência (i começa em 0) — mesma regra de _generateOccurrences
create or replace function intranet.data_ocorrencia(p_prazo date, p_rec intranet.recorrencia, p_i int)
returns date language sql immutable parallel safe as
$$
  select case p_rec
    when 'diaria'    then p_prazo + p_i
    when 'semanal'   then p_prazo + p_i * 7
    when 'quinzenal' then p_prazo + p_i * 14
    when 'mensal'    then (p_prazo + make_interval(months => p_i))::date
    else p_prazo end
$$;

-- Se o prazo mudar, as ocorrências acompanham (mantendo o vínculo com o Calendar)
create or replace function intranet.tarefa_after_update_prazo()
returns trigger language plpgsql security definer set search_path = '' as
$$
begin
  update intranet.tarefa_ocorrencias
     set data = intranet.data_ocorrencia(new.prazo, new.recorrencia, ordem - 1)
   where tarefa_id = new.id;
  return new;
end $$;
drop trigger if exists t_tarefa_after_update_prazo on intranet.tarefas;
create trigger t_tarefa_after_update_prazo after update of prazo on intranet.tarefas
  for each row when (old.prazo is distinct from new.prazo)
  execute function intranet.tarefa_after_update_prazo();

-- ───────────────────────── CRIAR (createTask) ─────────────────────────
create or replace function intranet.api_criar_tarefa(p jsonb)
returns jsonb language plpgsql set search_path = '' as
$$
declare
  v_resp uuid; v_id uuid; v_num text; v_erros text[] := '{}';
  v_prazo date; v_rec intranet.recorrencia; v_total int := 1;
begin
  if intranet.me() is null then return jsonb_build_object('ok', false, 'msg', 'Sem acesso.'); end if;

  if coalesce(trim(p->>'titulo'), '') = '' then v_erros := array_append(v_erros, 'Título obrigatório.'::text); end if;
  if char_length(coalesce(p->>'titulo', '')) > 200 then v_erros := array_append(v_erros, 'Título muito longo.'::text); end if;
  if coalesce(p->>'responsavel', '') = '' then v_erros := array_append(v_erros, 'Responsável obrigatório.'::text); end if;
  if coalesce(p->>'unidade', '') = '' then v_erros := array_append(v_erros, 'Unidade obrigatória.'::text); end if;
  if coalesce(p->>'marca', '') = '' then v_erros := array_append(v_erros, 'Marca obrigatória.'::text); end if;
  if coalesce(p->>'prioridade', '') not in ('alta', 'media', 'baixa') then v_erros := array_append(v_erros, 'Prioridade inválida.'::text); end if;

  begin v_prazo := (p->>'prazo')::date; exception when others then v_prazo := null; end;
  if v_prazo is null then v_erros := array_append(v_erros, 'Prazo inválido.'::text); end if;

  if coalesce(p->>'recorrencia', '') <> '' then
    if p->>'recorrencia' not in ('diaria', 'semanal', 'quinzenal', 'mensal') then
      v_erros := array_append(v_erros, 'Recorrência inválida.'::text);
    else
      v_rec := (p->>'recorrencia')::intranet.recorrencia;
      begin v_total := coalesce((p->>'totalOcorrencias')::int, 1); exception when others then v_total := 0; end;
      if v_total < 1 or v_total > 52 then v_erros := array_append(v_erros, 'Total de ocorrências deve ser entre 1 e 52.'::text); end if;
    end if;
  end if;

  select id into v_resp from intranet.usuarios where alias = lower(p->>'responsavel') and ativo;
  if coalesce(p->>'responsavel', '') <> '' and v_resp is null then
    v_erros := array_append(v_erros, ('Responsável "' || (p->>'responsavel') || '" não reconhecido.')::text);
  end if;

  if array_length(v_erros, 1) > 0 then
    return jsonb_build_object('ok', false, 'msg', array_to_string(v_erros, ' | '));
  end if;

  insert into intranet.tarefas (titulo, descricao, responsavel_id, prazo, prioridade, unidade, marca, recorrencia, total_ocorrencias)
  values (trim(p->>'titulo'), trim(coalesce(p->>'descricao', '')), v_resp, v_prazo,
          (p->>'prioridade')::intranet.prioridade, p->>'unidade', p->>'marca', v_rec, case when v_rec is null then 1 else v_total end)
  returning id, numero into v_id, v_num;

  return jsonb_build_object('ok', true, 'id', v_id, 'numero', v_num,
    'occurrences', (select coalesce(jsonb_agg(to_char(data, 'YYYY-MM-DD') order by ordem), '[]')
                      from intranet.tarefa_ocorrencias where tarefa_id = v_id));
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

-- ───────────────────────── EDITAR (updateTask) ─────────────────────────
create or replace function intranet.api_editar_tarefa(p jsonb)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_resp uuid; v_ok uuid;
begin
  if coalesce(p->>'id', '') = '' then return jsonb_build_object('ok', false, 'msg', 'Parâmetros inválidos.'); end if;
  if coalesce(p->>'responsavel', '') <> '' then
    select id into v_resp from intranet.usuarios where alias = lower(p->>'responsavel') and ativo;
    if v_resp is null then return jsonb_build_object('ok', false, 'msg', 'Responsável não reconhecido.'); end if;
  end if;
  if coalesce(p->>'prioridade', '') <> '' and p->>'prioridade' not in ('alta', 'media', 'baixa') then
    return jsonb_build_object('ok', false, 'msg', 'Prioridade inválida.');
  end if;

  update intranet.tarefas set
    titulo         = coalesce(nullif(trim(p->>'titulo'), ''), titulo),
    descricao      = case when p ? 'descricao' then coalesce(p->>'descricao', '') else descricao end,
    responsavel_id = coalesce(v_resp, responsavel_id),
    prazo          = coalesce(nullif(p->>'prazo', '')::date, prazo),
    prioridade     = coalesce(nullif(p->>'prioridade', '')::intranet.prioridade, prioridade)
  where id = (p->>'id')::uuid
  returning id into v_ok;

  if v_ok is null then return jsonb_build_object('ok', false, 'msg', 'Sem permissão para editar.'); end if;
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

-- ───────────────────────── MOVER (updateTaskStatus) ─────────────────────────
create or replace function intranet.api_mover_tarefa(p_id uuid, p_status text)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_ok uuid;
begin
  if p_status not in ('todo', 'doing', 'done') then return jsonb_build_object('ok', false, 'msg', 'Status inválido.'); end if;
  update intranet.tarefas set status = p_status::intranet.task_status where id = p_id returning id into v_ok;
  if v_ok is null then return jsonb_build_object('ok', false, 'msg', 'Apenas o responsável pode mover esta tarefa.'); end if;
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

-- ───────────────────────── EXCLUIR (deleteTask) ─────────────────────────
-- Devolve os arquivos do Storage para o front apagar e os eventos do Calendar (fase 6)
create or replace function intranet.api_excluir_tarefa(p_id uuid)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_paths jsonb; v_eventos jsonb; v_ok uuid;
begin
  select coalesce(jsonb_agg(storage_path) filter (where storage_path is not null), '[]') into v_paths
    from intranet.tarefa_anexos where tarefa_id = p_id;
  select coalesce(jsonb_agg(calendar_event_id) filter (where calendar_event_id is not null), '[]') into v_eventos
    from intranet.tarefa_ocorrencias where tarefa_id = p_id;
  delete from intranet.tarefas where id = p_id returning id into v_ok;
  if v_ok is null then return jsonb_build_object('ok', false, 'msg', 'Sem permissão.'); end if;
  return jsonb_build_object('ok', true, 'storagePaths', v_paths, 'calendarEventIds', v_eventos);
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

-- ───────────────────────── COMENTÁRIOS ─────────────────────────
create or replace function intranet.api_comentar(p_tarefa uuid, p_texto text)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_id uuid;
begin
  if coalesce(trim(p_texto), '') = '' then return jsonb_build_object('ok', false, 'msg', 'Comentário vazio.'); end if;
  insert into intranet.tarefa_comentarios (tarefa_id, texto) values (p_tarefa, left(trim(p_texto), 1000))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'commentId', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

create or replace function intranet.api_excluir_comentario(p_id uuid)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_ok uuid;
begin
  update intranet.tarefa_comentarios set deleted_at = now()
   where id = p_id and deleted_at is null returning id into v_ok;
  if v_ok is null then return jsonb_build_object('ok', false, 'msg', 'Sem permissão.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ───────────────────────── ANEXOS ─────────────────────────
create or replace function intranet.api_registrar_anexo(p_tarefa uuid, p_nome text, p_path text)
returns jsonb language plpgsql set search_path = '' as
$$
declare v_id uuid;
begin
  if not exists (select 1 from intranet.tarefas where id = p_tarefa) then
    return jsonb_build_object('ok', false, 'msg', 'Tarefa não encontrada.');
  end if;
  insert into intranet.tarefa_anexos (tarefa_id, nome, storage_path) values (p_tarefa, p_nome, p_path)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'msg', sqlerrm);
end $$;

grant execute on all functions in schema intranet to authenticated, service_role;
revoke execute on function intranet._abrir_dm(uuid, uuid) from authenticated, public;
revoke execute on function intranet.proximo_numero(text, text) from authenticated, public;
revoke execute on function intranet.recalcular_contadores() from authenticated, public;
revoke execute on function intranet.gerar_ocorrencias(uuid) from authenticated, public;

notify pgrst, 'reload schema';

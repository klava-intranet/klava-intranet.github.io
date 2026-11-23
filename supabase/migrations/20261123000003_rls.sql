-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0003 · RLS, GRANTS E REALTIME
-- Antes, toda permissão era checada no GS com um "requestedBy" enviado pelo
-- próprio navegador (dava para se passar por outra pessoa). Agora quem decide
-- é o banco, a partir do login Google.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────── GRANTS ─────────────────────────
grant usage on schema intranet to authenticated, service_role;
grant usage on schema extensions to authenticated, service_role;
grant select, insert, update, delete on all tables in schema intranet to authenticated, service_role;
grant usage, select on all sequences in schema intranet to authenticated, service_role;
grant execute on all functions in schema intranet to authenticated, service_role;
revoke all on intranet.tarefa_contadores from authenticated;
revoke execute on function intranet._abrir_dm(uuid, uuid) from authenticated, public;
revoke execute on function intranet.proximo_numero(text, text) from authenticated, public;
revoke execute on function intranet.recalcular_contadores() from authenticated, public;
revoke execute on function intranet.gerar_ocorrencias(uuid) from authenticated, public;

-- ───────────────────────── RLS ON ─────────────────────────
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'intranet' loop
    execute format('alter table intranet.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ───────────────────────── USUÁRIOS ─────────────────────────
create policy usuarios_select on intranet.usuarios for select to authenticated
  using (intranet.me() is not null);
create policy usuarios_admin on intranet.usuarios for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

-- ───────────────────────── CHAT ─────────────────────────
create policy canais_select on intranet.canais for select to authenticated
  using (intranet.is_membro(id));
create policy canais_update on intranet.canais for update to authenticated
  using (tipo = 'canal' and (criado_por = intranet.me() or intranet.is_admin()));
create policy canais_delete on intranet.canais for delete to authenticated
  using (tipo = 'canal' and (criado_por = intranet.me() or intranet.is_admin()));
-- inserção de canais/DMs só pelas RPCs criar_canal / abrir_dm

create policy membros_select on intranet.canal_membros for select to authenticated
  using (intranet.is_membro(canal_id));
create policy membros_insert on intranet.canal_membros for insert to authenticated
  with check (exists (select 1 from intranet.canais c where c.id = canal_id and c.tipo = 'canal'
                      and (c.criado_por = intranet.me() or intranet.is_admin())));
create policy membros_delete on intranet.canal_membros for delete to authenticated
  using (exists (select 1 from intranet.canais c where c.id = canal_id and c.tipo = 'canal'
                 and (c.criado_por = intranet.me() or intranet.is_admin()
                      or (usuario_id = intranet.me() and c.criado_por is distinct from intranet.me()))));
-- last_read_id é atualizado pela RPC marcar_lido

create policy leituras_geral_own on intranet.leituras_geral for all to authenticated
  using (usuario_id = intranet.me()) with check (usuario_id = intranet.me());

create policy mensagens_select on intranet.mensagens for select to authenticated
  using (intranet.is_membro(canal_id));
create policy mensagens_insert on intranet.mensagens for insert to authenticated
  with check (tipo <> 'sistema' and autor_id = intranet.me() and intranet.is_membro(canal_id));
create policy mensagens_update on intranet.mensagens for update to authenticated
  using (autor_id = intranet.me() or intranet.is_admin())
  with check ((autor_id = intranet.me() and intranet.is_membro(canal_id)) or intranet.is_admin());

create policy reacoes_select on intranet.reacoes for select to authenticated
  using (exists (select 1 from intranet.mensagens m where m.id = mensagem_id and intranet.is_membro(m.canal_id)));
-- inserir/remover reação: RPC toggle_reacao

-- ───────────────────────── TAREFAS ─────────────────────────
create policy prefixos_select on intranet.marca_prefixos for select to authenticated using (intranet.me() is not null);
create policy prefixos_admin  on intranet.marca_prefixos for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

create policy tarefas_select on intranet.tarefas for select to authenticated
  using (intranet.me() is not null);
create policy tarefas_insert on intranet.tarefas for insert to authenticated
  with check (intranet.me() is not null);
create policy tarefas_update on intranet.tarefas for update to authenticated
  using (intranet.is_admin() or solicitante_id = intranet.me() or responsavel_id = intranet.me())
  with check (intranet.me() is not null);   -- permite reatribuir para outra pessoa
create policy tarefas_delete on intranet.tarefas for delete to authenticated
  using (intranet.is_admin() or solicitante_id = intranet.me());

create policy ocorrencias_select on intranet.tarefa_ocorrencias for select to authenticated
  using (intranet.me() is not null);

create policy anexos_select on intranet.tarefa_anexos for select to authenticated
  using (intranet.me() is not null);
create policy anexos_insert on intranet.tarefa_anexos for insert to authenticated
  with check (intranet.me() is not null);
create policy anexos_delete on intranet.tarefa_anexos for delete to authenticated
  using (enviado_por = intranet.me() or intranet.is_admin());

create policy comentarios_select on intranet.tarefa_comentarios for select to authenticated
  using (intranet.me() is not null);
create policy comentarios_insert on intranet.tarefa_comentarios for insert to authenticated
  with check (intranet.me() is not null);
create policy comentarios_update on intranet.tarefa_comentarios for update to authenticated
  using (autor_id = intranet.me() or intranet.is_admin());

-- ───────────────────────── DRIVE ─────────────────────────
create policy setores_select on intranet.drive_setores for select to authenticated using (intranet.me() is not null);
create policy setores_admin  on intranet.drive_setores for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

create policy uploaders_select on intranet.drive_setor_uploaders for select to authenticated using (intranet.me() is not null);
create policy uploaders_admin  on intranet.drive_setor_uploaders for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

create policy arquivos_select on intranet.drive_arquivos for select to authenticated
  using (intranet.me() is not null);
create policy arquivos_insert on intranet.drive_arquivos for insert to authenticated
  with check (intranet.pode_enviar_drive(setor_key));
create policy arquivos_update on intranet.drive_arquivos for update to authenticated
  using (enviado_por = intranet.me() or intranet.is_admin());

create policy links_select on intranet.drive_links for select to authenticated using (intranet.me() is not null);
create policy links_admin  on intranet.drive_links for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

-- ───────────────────────── CONTATOS / WIKI / CONFIG ─────────────────────────
create policy contatos_select on intranet.contatos for select to authenticated using (intranet.me() is not null);
create policy contatos_admin  on intranet.contatos for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

create policy wiki_select on intranet.wiki_artigos for select to authenticated using (intranet.me() is not null);
create policy wiki_admin  on intranet.wiki_artigos for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

create policy config_select on intranet.app_config for select to authenticated using (intranet.me() is not null);
create policy config_admin  on intranet.app_config for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

-- ───────────────────────── LOGS ─────────────────────────
create policy acesso_insert on intranet.logs_acesso for insert to authenticated
  with check (usuario_id = intranet.me());
create policy acesso_select on intranet.logs_acesso for select to authenticated
  using (intranet.is_admin());

create policy erros_insert on intranet.logs_erros for insert to authenticated
  with check (auth.uid() is not null);
create policy erros_select on intranet.logs_erros for select to authenticated
  using (intranet.is_admin());

-- ───────────────────────── REALTIME ─────────────────────────
-- Substitui o polling (3s não lidas, 5s chat, 10s tarefas, 30s notificações).
-- O Realtime respeita o RLS: cada um só recebe o que pode ver.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      intranet.mensagens, intranet.reacoes, intranet.tarefas,
      intranet.tarefa_comentarios, intranet.canais, intranet.canal_membros;
  end if;
end $$;

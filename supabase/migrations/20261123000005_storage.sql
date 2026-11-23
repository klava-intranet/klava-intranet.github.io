-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0005 · STORAGE (substitui uploads via DriveApp)
-- Buckets privados; o front gera URLs assinadas para abrir/baixar.
-- Convenção de caminhos:
--   chat/<canal_id>/<uuid>-<arquivo>
--   tarefas/<tarefa_id>/<uuid>-<arquivo>
--   drive/<setor_key>/<uuid>-<arquivo>
-- Arquivos antigos continuam no Google Drive (url preservada na migração).
-- ═══════════════════════════════════════════════════════════════════════
do $$
declare
  v_mimes text[] := array[
    'image/jpeg','image/jpg','image/png','image/gif','image/webp','image/svg+xml','application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv','application/zip','application/x-rar-compressed','application/x-zip-compressed',
    'application/octet-stream'];
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schema storage não encontrado (Postgres local) — pulando buckets.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('chat',    'chat',    false, 31457280, v_mimes),
    ('tarefas', 'tarefas', false, 31457280, v_mimes),
    ('drive',   'drive',   false, 31457280, v_mimes)
  on conflict (id) do nothing;

  -- leitura
  execute $p$create policy "intranet chat ler" on storage.objects for select to authenticated
    using (bucket_id = 'chat' and intranet.is_membro(((storage.foldername(name))[1])::uuid))$p$;
  execute $p$create policy "intranet tarefas/drive ler" on storage.objects for select to authenticated
    using (bucket_id in ('tarefas','drive') and intranet.me() is not null)$p$;

  -- envio
  execute $p$create policy "intranet chat enviar" on storage.objects for insert to authenticated
    with check (bucket_id = 'chat' and intranet.is_membro(((storage.foldername(name))[1])::uuid))$p$;
  execute $p$create policy "intranet tarefas enviar" on storage.objects for insert to authenticated
    with check (bucket_id = 'tarefas' and intranet.me() is not null)$p$;
  execute $p$create policy "intranet drive enviar" on storage.objects for insert to authenticated
    with check (bucket_id = 'drive' and intranet.pode_enviar_drive((storage.foldername(name))[1]))$p$;

  -- remoção: dono do arquivo ou admin
  execute $p$create policy "intranet remover" on storage.objects for delete to authenticated
    using (bucket_id in ('chat','tarefas','drive')
           and (owner_id = auth.uid()::text or intranet.is_admin()))$p$;
end $$;

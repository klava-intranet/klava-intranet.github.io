-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0009 · INTEGRAÇÕES (fase 6)
-- Fila de eventos do Google Agenda a apagar quando uma tarefa é excluída.
-- (os agendamentos do pg_cron ficam em supabase/setup/agendamentos.sql)
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists intranet.calendar_fila_exclusao (
  id                bigint generated always as identity primary key,
  calendar_event_id text not null,
  criado_em         timestamptz not null default now()
);
alter table intranet.calendar_fila_exclusao enable row level security;  -- só a Edge Function (service_role) mexe
grant all on intranet.calendar_fila_exclusao to service_role;

create or replace function intranet.tarefa_before_delete()
returns trigger language plpgsql security definer set search_path = '' as
$$
begin
  insert into intranet.calendar_fila_exclusao (calendar_event_id)
  select calendar_event_id from intranet.tarefa_ocorrencias
   where tarefa_id = old.id and calendar_event_id is not null;
  return old;
end $$;
drop trigger if exists t_tarefa_before_delete on intranet.tarefas;
create trigger t_tarefa_before_delete before delete on intranet.tarefas
  for each row execute function intranet.tarefa_before_delete();

-- Modelo atual da IA (continua desligada: ia_ativa = false)
update intranet.app_config set valor = '"claude-haiku-5-5"'::jsonb
 where chave = 'ia_modelo' and valor = '"claude-haiku-4-5"'::jsonb;

grant execute on function intranet.tarefa_before_delete() to service_role;
notify pgrst, 'reload schema';

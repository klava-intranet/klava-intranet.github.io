-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — AGENDAMENTOS (rodar UMA vez no SQL Editor, depois do deploy das funções)
-- Substitui os gatilhos do Apps Script:
--   • avisos de prazo ........ todo dia às 8h (Brasília)
--   • relatório semanal ...... toda segunda às 8h (Brasília)
--
-- ANTES DE RODAR: troque COLE_AQUI_O_MESMO_CRON_SECRET pelo valor que você usou em
--   npx supabase secrets set CRON_SECRET=...
-- ═══════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda URL e segredo no Vault (criptografados), fora do texto dos jobs
select vault.create_secret('https://iparjofxtdvedkxijhxc.supabase.co', 'intranet_url');
select vault.create_secret('COLE_AQUI_O_MESMO_CRON_SECRET', 'intranet_cron_secret');

create or replace function intranet.chamar_rotina(p_tipo text)
returns bigint language sql security definer set search_path = '' as
$$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'intranet_url') || '/functions/v1/rotinas',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'intranet_cron_secret')),
    body    := jsonb_build_object('tipo', p_tipo),
    timeout_milliseconds := 60000)
$$;
revoke execute on function intranet.chamar_rotina(text) from public, authenticated;

-- Horários em UTC (Brasília = UTC-3): 11:00 UTC = 08:00
select cron.schedule('intranet-avisos-prazo',      '0 11 * * *', $$ select intranet.chamar_rotina('prazos') $$);
select cron.schedule('intranet-relatorio-semanal', '0 11 * * 1', $$ select intranet.chamar_rotina('semanal') $$);

-- Conferir:            select jobname, schedule, active from cron.job;
-- Testar agora:        select intranet.chamar_rotina('semanal');
-- Ver resposta:        select status_code, content from net._http_response order by id desc limit 5;

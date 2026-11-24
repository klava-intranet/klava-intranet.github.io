-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0014 · VIGÊNCIA DOS CATÁLOGOS
-- data_encerramento: último dia em que o catálogo vale (opcional = sem prazo).
-- ═══════════════════════════════════════════════════════════════════════
alter table intranet.catalogos add column if not exists data_encerramento date;

alter table intranet.catalogos drop constraint if exists catalogos_vigencia_check;
alter table intranet.catalogos add constraint catalogos_vigencia_check
  check (data_encerramento is null or data_encerramento >= data_publicacao);

notify pgrst, 'reload schema';

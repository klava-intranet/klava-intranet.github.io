-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0013 · CATÁLOGOS ATÉ 500 MB
-- Sobe o limite do bucket "catalogos" para 500 MB.
-- ATENÇÃO: o limite GLOBAL do projeto (Storage → Settings) manda mais que este.
--   • Plano Free: o global não passa de 50 MB → arquivos maiores continuam recusados.
--   • Plano Pro: ajuste o "Global file size limit" para 500 MB (ou mais).
-- O front envia arquivos acima de 6 MB por upload retomável (TUS), com progresso.
-- ═══════════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schema storage não encontrado (Postgres local) — nada a fazer.';
    return;
  end if;
  update storage.buckets set file_size_limit = 524288000 where id = 'catalogos';
end $$;

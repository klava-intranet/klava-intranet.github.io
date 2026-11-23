-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0011 · LOGOS DOS SISTEMAS
-- logo_url aceita:
--   • caminho do próprio site   → ./logos/bling.png  (os 12 logos que vieram no repositório)
--   • URL do Storage (bucket "logos", público para leitura) → logos enviados pelo formulário
-- ═══════════════════════════════════════════════════════════════════════

alter table intranet.sistemas add column if not exists logo_url text;

-- Logos iniciais (arquivos em web/public/logos)
update intranet.sistemas s set logo_url = v.logo
  from (values
    ('bling%',          './logos/bling.png'),
    ('bitrix%',         './logos/bitrix24.png'),
    ('conta azul%',     './logos/conta-azul.png'),
    ('mercos%',         './logos/mercos.png'),
    ('shopify%',        './logos/shopify.png'),
    ('mconnect%',       './logos/mconnect.png'),
    ('looker%',         './logos/looker-studio.png'),
    ('rede%',           './logos/rede.png'),
    ('pagar%',          './logos/pagarme.png'),
    ('yampi%',          './logos/yampi.png'),
    ('appmax%',         './logos/appmax.png'),
    ('omie%',           './logos/omie.png')
  ) v(padrao, logo)
 where lower(s.nome) like v.padrao and s.logo_url is null;

-- Bucket público só para logos (não há nada sensível em logo de sistema);
-- enviar, trocar e apagar: apenas administradores
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Schema storage não encontrado (Postgres local) — pulando bucket de logos.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('logos', 'logos', true, 1048576,
          array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'])
  on conflict (id) do nothing;

  execute 'drop policy if exists "intranet logos enviar" on storage.objects';
  execute 'drop policy if exists "intranet logos alterar" on storage.objects';
  execute 'drop policy if exists "intranet logos apagar" on storage.objects';
  execute $p$create policy "intranet logos enviar" on storage.objects for insert to authenticated
    with check (bucket_id = 'logos' and intranet.is_admin())$p$;
  execute $p$create policy "intranet logos alterar" on storage.objects for update to authenticated
    using (bucket_id = 'logos' and intranet.is_admin())$p$;
  execute $p$create policy "intranet logos apagar" on storage.objects for delete to authenticated
    using (bucket_id = 'logos' and intranet.is_admin())$p$;
end $$;

notify pgrst, 'reload schema';

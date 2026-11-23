-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0004 · DADOS DE REFERÊNCIA
-- Tudo que estava fixo no GS.txt e agora vira dado editável
-- ═══════════════════════════════════════════════════════════════════════

-- Prefixos de numeração de tarefas (antes: MARCA_PREFIX_MAP)
insert into intranet.marca_prefixos (unidade, marca, prefixo) values
  ('private','COOPER SHOES','PVTCS'), ('private','FLOWFA','PVTFF'),  ('private','INSIDER','PVTIN'),
  ('private','LIVE','PVTLV'),         ('private','LIVE_KLAVA','PVTLK'),('private','MELISSA','PVTME'),
  ('private','OXER','PVTOX'),         ('private','PEGADA','PVTPG'),   ('private','RESERVA','PVTRE'),
  ('private','SCHUTZ','PVTSC'),       ('private','USAFLEX','PVTUF'),  ('private','VIA MARTE','PVTVM'),
  ('atacado','ECKO','ATCEK'),         ('atacado','FLOWFA','ATCFF'),   ('atacado','LIVE','ATCLV'),
  ('ecomm','FLOWFA ECOMM','ECMFF'),
  ('private','FLOWFA ATACADO','FLA'), ('private','LIVE! ATACADO','LIA'), ('private','ECKO ATACADO','ECA'),
  ('private','FLOWFA ONLINE','FLO'),  ('private','LIVE! ONLINE','LIO'),  ('private','ECKO ONLINE','ECO'),
  ('private','LIVE!','LIV'),          ('private','ECKO UNLTD.','ECK')
on conflict do nothing;

-- Setores do Drive (antes: DRIVE_SECTOR_NAMES). Pasta-mãe legada no Google Drive:
-- 1YzdyhjlPDqyxDEtifM7d6QqdDUGFL4vL
insert into intranet.drive_setores (key, nome, ordem) values
  ('diretoria','Diretoria',1), ('comercial','Comercial',2), ('financeiro','Financeiro',3),
  ('tesouraria','Tesouraria',4), ('design','Design',5), ('logistica','Logística',6),
  ('comex','Comex',7), ('salesops','Sales Ops',8), ('online','Online',9), ('novo','Novo',10)
on conflict do nothing;

-- Configurações (antes: PropertiesService "cfg_*")
insert into intranet.app_config (chave, valor) values
  ('ia_ativa',            'false'::jsonb),
  ('ia_modelo',           '"claude-haiku-4-5"'::jsonb),
  ('relatorio_semanal',   '{"ativo": true, "dia": "segunda", "hora": 8}'::jsonb),
  ('aviso_prazo_dias',    '[7, 3, 0]'::jsonb),
  ('upload_max_mb',       '30'::jsonb)
on conflict do nothing;

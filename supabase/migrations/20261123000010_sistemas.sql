-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0010 · SISTEMAS DISPONÍVEIS editáveis
-- Os cards da tela Sistemas saem do HTML e viram dados: todos veem,
-- só administradores incluem, editam e excluem.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists intranet.sistemas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(trim(nome)) between 1 and 60),
  url           text not null check (url ~* '^https?://'),
  descricao     text not null default '',
  descricao_en  text not null default '',
  descricao_zh  text not null default '',
  ordem         int  not null default 0,
  criado_por    uuid references intranet.usuarios(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists sistemas_ordem_idx on intranet.sistemas (ordem) where deleted_at is null;

drop trigger if exists t_sistemas_touch on intranet.sistemas;
create trigger t_sistemas_touch before update on intranet.sistemas
  for each row execute function intranet.touch_atualizado_em();

alter table intranet.sistemas enable row level security;
drop policy if exists sistemas_select on intranet.sistemas;
drop policy if exists sistemas_admin on intranet.sistemas;
create policy sistemas_select on intranet.sistemas for select to authenticated
  using (intranet.me() is not null);
create policy sistemas_admin on intranet.sistemas for all to authenticated
  using (intranet.is_admin()) with check (intranet.is_admin());

grant select, insert, update, delete on intranet.sistemas to authenticated, service_role;

-- Os 11 cards que estavam fixos no HTML (com as traduções que já existiam)
insert into intranet.sistemas (nome, url, descricao, descricao_en, descricao_zh, ordem)
select * from (values
  ('Bling ERP',     'https://www.bling.com.br',           'Gestão de pedidos e NFs',          'Order & invoice management',      '订单和发票管理',       1),
  ('Bitrix24',      'https://www.bitrix24.com.br',         'CRM e Gestão de Processos',        'CRM & Process Management',        '客户关系管理与流程管理', 2),
  ('Conta Azul',    'https://contaazul.com/',              'Sistema de controle contábil',     'Accounting control system',       '会计控制系统',         3),
  ('Mercos',        'https://app.mercos.com/login',        'Pedidos do Atacado e Indicadores', 'Wholesale orders & metrics',      '批发订单与指标',       4),
  ('Shopify',       'https://accounts.shopify.com/lookup', 'Gestão de Pedidos E-commerce',     'E-commerce order management',     '电商订单管理',         5),
  ('Mconnect',      'http://www.mconnect.com.br',          'Portal do Representante',          'Sales rep portal',                '代表门户',             6),
  ('Looker Studio', 'https://lookerstudio.google.com',     'Dashboards e Indicadores',         'Dashboards & metrics',            '仪表板与指标',         7),
  ('Rede Itaú',     'https://meu.userede.com.br/login',    'Criação de Links de Pagamento',    'Payment link creation',           '创建支付链接',         8),
  ('Pagar.me',      'https://dashboard.pagar.me/',         'Links de Pagamento e Checkout',    'Payment links & checkout',        '支付链接与结账',       9),
  ('Yampi',         'https://app.yampi.com.br/',           'Gestão Financeira do Ecomm',       'E-commerce finance management',   '电商财务管理',        10),
  ('Appmax',        'https://login.appmax.com.br/',        'Gestão dos Recebimentos Ecomm',    'E-commerce receivables management','电商收款管理',        11)
) v(nome, url, descricao, descricao_en, descricao_zh, ordem)
where not exists (select 1 from intranet.sistemas);

notify pgrst, 'reload schema';

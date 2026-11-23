# Klava Intranet v5

A intranet da Klava Brands saindo do Google Apps Script e das abas de planilha para **Postgres (Supabase) + GitHub**.

```
klava-intranet/
├── supabase/migrations/     ← o banco inteiro, versionado (aplicado em ordem)
│   ├── …0001_schema.sql            tabelas, índices, enums
│   ├── …0002_funcoes_triggers.sql  regras de negócio (numeração, status, DMs, não lidas, Meu Dia)
│   ├── …0003_rls.sql               permissões (RLS) + Realtime
│   ├── …0004_dados_referencia.sql  prefixos de marca, setores do Drive, config
│   └── …0005_storage.sql           buckets de arquivos
├── scripts/migrar_planilha.py  ← planilha atual (.xlsx) → SQL de importação
├── web/                        ← front (Vite + JS puro, mesmo visual da versão atual)
├── supabase/functions/         ← Edge Functions: google-agenda, notificar, rotinas, ia
├── docs/PLANO.md               ← fases, mapa planilha→tabela, decisões
├── docs/FASE6_INTEGRACOES.md   ← passo a passo de Google Agenda, e-mails e IA
└── _mover_para_.github/        ← workflows de deploy (renomeie para .github)
```

---

## Fase 1 — subir o banco (passo a passo)

### 1. Criar o projeto no Supabase
1. [supabase.com](https://supabase.com) → **New project** → nome `klava-intranet`, região **São Paulo (sa-east-1)**.
2. Guarde a senha do banco.

### 2. Aplicar o schema
**Opção A (SQL Editor, mais rápido):** abra cada arquivo de `supabase/migrations/` **na ordem** (0001 → 0005), cole no SQL Editor e rode.

**Opção B (CLI):**
```bash
npm i -g supabase
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

### 3. Expor o schema `intranet` na API

**Por quê:** o front conversa com o banco pela *Data API* (PostgREST). Por padrão ela só enxerga o schema `public`. Todas as tabelas e RPCs da intranet estão em `intranet`, então sem este passo o front recebe erro e nada carrega.

**Passo a passo no painel:**
1. Abra o projeto em [supabase.com/dashboard](https://supabase.com/dashboard).
2. No menu lateral, vá em **Integrations → Data API**. Em painéis mais antigos fica em **Project Settings → API → Data API Settings**.
3. Abra a aba **Settings** e confira se **Enable Data API** está ligado.
4. No campo **Exposed schemas**, clique e selecione `intranet`. Ele só aparece se as migrations do passo 2 já tiverem rodado. **Mantenha** os que já estão lá (`public`, `graphql_public`).
5. Não mexa no campo **Extra search path**: deixe `public, extensions`.
6. Clique em **Save**. A API recarrega em alguns segundos.

**Permissões:** não precisa rodar o SQL de `grant` que a documentação do Supabase sugere para schemas customizados, porque a migration `0003_rls.sql` já faz isso. Ela libera o schema só para `authenticated` (usuário logado) e `service_role` (Edge Functions). O `anon` fica de fora de propósito: quem não fez login não lê nada.

**Teste rápido** (pela linha de comando, sem login):
```bash
curl "https://SEU_PROJECT_REF.supabase.co/rest/v1/canais?select=key" \
  -H "apikey: SUA_ANON_KEY" -H "Accept-Profile: intranet"
```
| Resposta | Significado |
|---|---|
| `permission denied for schema intranet` (código `42501`) | ✅ O schema está exposto e está barrando quem não fez login, como deveria. |
| `The schema must be one of the following: public, ...` (código `PGRST106`) | ❌ O `intranet` não foi salvo no campo *Exposed schemas*. Refaça os itens 4 a 6. |
| `Could not find the table ... in the schema cache` (código `PGRST205`) | A API ainda não recarregou. Rode `notify pgrst, 'reload schema';` no SQL Editor e teste de novo. |

**Pelo CLI (opcional):** para quem roda o Supabase local, em `supabase/config.toml`, seção `[api]`:
```toml
schemas = ["public", "graphql_public", "intranet"]
extra_search_path = ["public", "extensions"]
```

### 4. Login com Google
1. No [Google Cloud Console](https://console.cloud.google.com) (projeto da Klava): **APIs & Services → Credentials → Create OAuth client ID** → *Web application*.
   - Authorized redirect URI: `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Providers → Google** → cole Client ID e Secret → Enable.
3. Supabase → **Authentication → URL Configuration**:
   - Site URL: endereço onde o front vai rodar (ex.: `https://SEU_USUARIO.github.io/klava-intranet/`)
   - Redirect URLs: o mesmo + `http://localhost:5173`

> Qualquer conta Google consegue *logar*, mas só quem está cadastrado e ativo em `intranet.usuarios` enxerga alguma coisa — o RLS barra o resto.

### 5. Importar os dados da planilha

**A. Baixar a planilha:** abra a planilha da intranet → **Arquivo → Fazer download → Microsoft Excel (.xlsx)** → salve como `Intranet.xlsx` dentro da pasta `klava-intranet`.

**B. Python (só na 1ª vez):** no PowerShell, `python --version`. Se não existir: `winget install Python.Python.3.12` (feche e abra o PowerShell depois). Em seguida: `pip install openpyxl`.

**C. Gerar o SQL:**
```powershell
cd "$HOME\Documents\Intranet - Estrutura\klava-intranet"
python scripts\migrar_planilha.py Intranet.xlsx
```
Sai o `seed_planilha.sql` + um relatório com as contagens por tabela, os avisos e o tamanho do arquivo.

**D. Carregar no Supabase:**
- **Até ~2 MB:** abra o `seed_planilha.sql` no Bloco de Notas → copie tudo → Supabase → **SQL Editor → New query** → cole → **Run**.
- **Acima de ~2 MB:** use o `psql`, porque o SQL Editor trava com arquivos grandes.
  1. Instale só as ferramentas de linha de comando do PostgreSQL ([instalador EDB](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) → marque só *Command Line Tools*) e adicione `C:\Program Files\PostgreSQL\17\bin` ao PATH.
  2. Supabase → botão **Connect** (topo) → **Session pooler** → copie a URI (é IPv4; a "Direct connection" só funciona com IPv6).
  3. Rode, trocando `[YOUR-PASSWORD]` pela senha do banco:
     ```powershell
     psql "postgresql://postgres.SEU_PROJECT_REF:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" -f seed_planilha.sql
     ```

**E. Conferir** (SQL Editor) — os números devem bater com o relatório do script:
```sql
select 'usuarios' t, count(*) from intranet.usuarios union all
select 'canais', count(*) from intranet.canais union all
select 'mensagens', count(*) from intranet.mensagens union all
select 'tarefas', count(*) from intranet.tarefas union all
select 'comentarios', count(*) from intranet.tarefa_comentarios union all
select 'drive_arquivos', count(*) from intranet.drive_arquivos union all
select 'drive_links', count(*) from intranet.drive_links union all
select 'contatos', count(*) from intranet.contatos union all
select 'wiki', count(*) from intranet.wiki_artigos;

select alias, email, papel, ativo from intranet.usuarios order by papel, alias;
```

Observações:
- Pode rodar de novo quantas vezes quiser (antes da virada final) — só entra o que é novo.
- Aliases que aparecem no chat/tarefas mas não estão na aba *Usuários* viram usuários **inativos** (preserva a autoria).
- Todo o histórico do chat entra como **lido**, ninguém abre com milhares de não lidas.
- Arquivos antigos continuam no Google Drive (o link é preservado). Uploads novos vão para o Storage.
- `Intranet.xlsx` e `seed_planilha.sql` têm dados internos: já estão no `.gitignore`, não sobem para o GitHub.

### 6. Rodar o front localmente
```bash
cd web
cp .env.example .env.local      # preencha URL e anon key (Project Settings → API)
npm install
npm run dev                     # http://localhost:5173
```
Login → se aparecer "Olá, Tadeu" e o badge de não lidas, a Fase 1 está de pé.

---

## Deploy automático (GitHub)

```bash
cd klava-intranet
git init && git add . && git commit -m "Klava Intranet v5 — fase 1"
gh repo create klava-intranet --private --source . --push
```

**Secrets do repositório** (Settings → Secrets and variables → Actions):

| Secret | Onde pegar |
|---|---|
| `SUPABASE_URL` | Project Settings → API |
| `SUPABASE_ANON_KEY` | Project Settings → API (anon/public) |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_DB_PASSWORD` | senha do passo 1 |
| `SUPABASE_PROJECT_REF` | o código do projeto na URL |

Settings → **Pages** → Source: *GitHub Actions*.

> ⚠️ Os workflows estão em `_mover_para_.github/workflows/` (não consegui gravar direto na pasta `.github`). Antes do primeiro commit, mova:
> ```powershell
> Move-Item _mover_para_.github .github
> ```

A partir daí: alterou algo em `web/` → o front publica sozinho; criou uma migration nova em `supabase/migrations/` → o banco é atualizado sozinho. Acabou o "colar no editor + nova implantação + Ctrl+Shift+R".

---

## Administração do dia a dia (sem código)

| Tarefa | Onde |
|---|---|
| Cadastrar/desativar colaborador | Table Editor → `intranet.usuarios` (`ativo = false`) |
| Tornar alguém admin | `intranet.usuarios.papel = 'admin'` |
| Quem pode subir arquivo em cada setor do Drive | `intranet.drive_setor_uploaders` |
| Prefixo de numeração de uma marca nova | `intranet.marca_prefixos` |
| Ligar a IA, horário do relatório etc. | `intranet.app_config` |

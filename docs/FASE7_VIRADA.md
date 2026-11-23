# Fase 7: virada (Apps Script → intranet nova)

São 4 etapas: **A** publicar → **B** alguns dias em paralelo → **C** Dia D → **D** depois da virada.
Até o Dia D, a equipe continua usando a intranet antiga normalmente.

---

## A. Publicar a intranet nova (hoje, ~20 min)

### A1. Repositório público ou privado?
O **GitHub Pages gratuito só publica repositórios públicos.** Conferi o código e ele não tem nada sensível: os dados ficam no banco, protegidos pelo RLS, a chave do front é pública por natureza, e os únicos e-mails e telefones são exemplos de formulário. A planilha e o SQL de importação ficam fora do Git (`.gitignore`).
- **Público + GitHub Pages:** grátis. É o caminho deste roteiro.
- **Privado:** precisa do GitHub Pro (US$ 4/mês). Os passos são os mesmos.

### A2. Preparar a pasta (PowerShell)
```powershell
cd "$HOME\Documents\Intranet - Estrutura\klava-intranet"
Move-Item _mover_para_.github .github
git --version
```
Se o `git` não existir, instale com `winget install Git.Git`, feche e abra o PowerShell, e volte para a pasta.

### A3. Primeiro commit
```powershell
git init
git add .
git status
```
**Antes de seguir, confira na lista** que **não** aparecem `Intranet.xlsx`, `seed_planilha.sql`, `web/.env.local` nem `node_modules`. Se algum aparecer, pare e me avise.
```powershell
git commit -m "Klava Intranet v5"
git branch -M main
```

### A4. Criar o repositório no GitHub
1. No [github.com/new](https://github.com/new), preencha **Repository name** = `klava-intranet`, marque **Public** e **não** marque README, .gitignore nem license. Clique em **Create repository**.
2. Copie a URL que aparecer (`https://github.com/SEU_USUARIO/klava-intranet.git`) e rode:
```powershell
git remote add origin https://github.com/SEU_USUARIO/klava-intranet.git
git push -u origin main
```

### A5. Secrets e Pages no GitHub
No repositório, vá em **Settings → Secrets and variables → Actions → New repository secret** e crie dois:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://iparjofxtdvedkxijhxc.supabase.co` |
| `SUPABASE_ANON_KEY` | a mesma **publishable key** (`sb_publishable_...`) do `web/.env.local` |

Depois vá em **Settings → Pages → Source: GitHub Actions**.
Em **Actions → Deploy front (GitHub Pages) → Run workflow**, rode o deploy. Em 1 a 2 minutos a intranet está no ar em:
```
https://SEU_USUARIO.github.io/klava-intranet/
```

### A6. Liberar o novo endereço no login
No Supabase, vá em **Authentication → URL Configuration**:
- **Site URL:** `https://SEU_USUARIO.github.io/klava-intranet/`
- **Redirect URLs:** clique em **Add URL** e coloque `https://SEU_USUARIO.github.io/klava-intranet/**`. Mantenha o `http://localhost:5173/**` para continuar testando no seu PC.

### A7. Testar no endereço publicado
Abra a URL, faça o login e confira: Meu Dia, Wiki, uma tarefa de teste e uma mensagem no chat. A partir daqui, toda alteração em `web/` que você fizer *push* publica sozinha.

---

## B. Paralelo (3 a 5 dias úteis)

**Quem testa:** você, o Luiz e mais 1 ou 2 pessoas de setores diferentes, de preferência alguém do Comex e alguém do Financeiro. O resto da equipe continua na antiga.

**Regras do paralelo:**
- **O trabalho de verdade continua na intranet antiga.** A nova serve para testar. As tarefas e mensagens criadas na antiga entram na nova na importação final do Dia D. O que for criado na nova durante o paralelo fica lá, e números de tarefa repetidos se resolvem sozinhos.
- **Cadastro de usuários continua na aba *Usuários* da planilha.** A importação do Dia D atualiza o banco a partir dela.
- **Avisos de prazo e relatório semanal continuam saindo pelo Apps Script.** O `agendamentos.sql` só roda no Dia D.

**O que conferir no paralelo:**
- [ ] Login de cada testador, inclusive no celular.
- [ ] Meu Dia mostra a agenda de cada um. Quem vir "agenda não compartilhada" precisa compartilhar a agenda com a conta-robô.
- [ ] Tarefa: criar, mover, comentar e anexar. O evento cai na agenda e o e-mail chega.
- [ ] Chat entre duas pessoas em tempo real, com arquivo, reação, @menção e 📹 Chamada.
- [ ] Drive: abrir arquivos antigos e enviar um novo.
- [ ] Idiomas EN/ZH e tema claro/escuro.

**Escolha o Dia D:** de preferência **segunda de manhã, antes das 8h**. Assim o primeiro relatório semanal já sai pelo sistema novo, e a semana começa no sistema novo.

---

## C. Dia D (~30 min, antes da equipe entrar)

Faça na ordem:

**C1. Desligar os gatilhos do Apps Script.** No editor do Apps Script, clique em **⏰ Acionadores** no menu da esquerda e exclua **todos**: `sendWeeklyReport`, `sendDeadlineNotifications` e qualquer outro que houver.

**C2. Redirecionar a intranet antiga.** No editor do Apps Script, troque o `doGet()` pelo código de `docs/apps_script_redirecionamento.gs` e coloque a URL nova em `NOVA_URL`. Depois vá em **Implantar → Gerenciar implantações → ✏️ editar → Versão: Nova versão → Implantar**.
A partir daqui ninguém grava mais nada na antiga, e quem abrir o link antigo vai parar na nova.

**C3. Importação final.**
```powershell
cd "$HOME\Documents\Intranet - Estrutura\klava-intranet"
```
1. Na planilha, vá em **Arquivo → Fazer download → .xlsx** e salve por cima do `Intranet.xlsx`.
2. Rode:
```powershell
python scripts\migrar_planilha.py Intranet.xlsx
```
3. Confira o relatório e os avisos. Depois cole o `seed_planilha.sql` no **SQL Editor** e clique em **Run**.

Ao final da importação, todas as conversas começam como lidas.

**C4. Ligar os agendamentos.** Abra `supabase/setup/agendamentos.sql`, troque `COLE_AQUI_O_MESMO_CRON_SECRET` pelo valor do `$cron` que você anotou e rode no SQL Editor. Para conferir:
```sql
select jobname, schedule, active from cron.job;
```
Devem aparecer `intranet-avisos-prazo` e `intranet-relatorio-semanal`, os dois com `active = true`.

**C5. Teste rápido no endereço publicado:** login → Meu Dia → criar e excluir uma tarefa de teste → mandar "bom dia" no #geral.

**C6. Avisar a equipe.** Modelo:
> Bom dia, pessoal! A partir de hoje a intranet está num endereço novo: **https://SEU_USUARIO.github.io/klava-intranet/**
> Entre com a sua conta Google da Klava (botão "Entrar com Google") e salve nos favoritos. No celular, use "Adicionar à tela inicial".
> Tudo continua igual: tarefas, chat, Drive, wiki e contatos. Só ficou mais rápido 🚀 Qualquer problema, me chama.

---

## D. Depois da virada

**Primeira semana:**
- Dê uma olhada nos erros uma vez por dia, no SQL Editor:
  ```sql
  select criado_em, funcao, usuario, erro from intranet.logs_erros order by id desc limit 30;
  ```
- E nos logs das Edge Functions: **Supabase → Edge Functions → (função) → Logs**.
- Na segunda seguinte, confira se o relatório semanal chegou.

**Administração do dia a dia:** a aba *Usuários* da planilha deixa de valer. A partir da virada, use o **Supabase → Table Editor → schema `intranet`**:

| Tarefa | Onde |
|---|---|
| Colaborador novo | `usuarios`: nova linha com email, alias, nome, setor (`papel` = colaborador) |
| Desligar alguém | `usuarios.ativo = false`. A pessoa perde o acesso na hora |
| Dar admin | `usuarios.papel = admin` |
| Quem sobe arquivo em cada setor do Drive | `drive_setor_uploaders` |
| Marca nova (prefixo de tarefa) | `marca_prefixos` |
| Ligar a IA | `app_config.ia_ativa = true` |

**Backup:** no plano Free do Supabase, você não consegue baixar os backups do painel. Duas opções:
- Plano **Pro (US$ 25/mês)**: backup diário automático com 7 dias de histórico.
- Fazer um dump manual uma vez por mês:
  ```powershell
  npx supabase@latest db dump --db-url "URI_DO_SESSION_POOLER" -f "backup_$(Get-Date -f yyyy-MM-dd).sql" --data-only --schema intranet
  ```

**A intranet antiga:** deixe a planilha e o projeto do Apps Script **intactos por 30 dias**. Eles servem de rede de segurança. Depois disso dá para arquivar.

### Se precisar voltar atrás (rollback)
1. **Apps Script:** vá em **Implantar → Gerenciar implantações → ✏️ editar** e escolha a **versão anterior** (a de antes do redirecionamento). A antiga volta ao ar.
2. **Apps Script:** rode uma vez `setupWeeklyReportTrigger()` e `createDeadlineTrigger()` para religar os gatilhos.
3. **Supabase (SQL Editor):**
   ```sql
   select cron.unschedule('intranet-avisos-prazo');
   select cron.unschedule('intranet-relatorio-semanal');
   ```
4. O que foi criado na intranet nova nesse meio-tempo **não volta sozinho para a planilha**. Precisa ser relançado à mão, por isso a janela de rollback é curta: no próprio Dia D.

### Automatizar migrations (opcional, mais pra frente)
As migrations 0001 a 0009 foram aplicadas pelo SQL Editor. Para passar a usar o workflow **"Migrations do banco"** do GitHub, primeiro marque essas migrations como aplicadas:
```powershell
npx supabase@latest migration repair --status applied 20261123000001 20261123000002 20261123000003 20261123000004 20261123000005 20261123000006 20261123000007 20261123000008 20261123000009 --db-url "URI_DO_SESSION_POOLER"
```
Depois cadastre os secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` e `SUPABASE_PROJECT_REF` no GitHub. Daí em diante, cada migration nova roda pelo botão **Run workflow**.

### Domínio próprio (opcional)
Para usar `intranet.klavabrands.com`:
1. Em **GitHub → Settings → Pages → Custom domain**, coloque o domínio.
2. No DNS da Klava, crie um `CNAME intranet → SEU_USUARIO.github.io`.
3. Atualize o **Site URL** e as **Redirect URLs** no Supabase (passo A6) e a `NOVA_URL` do redirecionamento.

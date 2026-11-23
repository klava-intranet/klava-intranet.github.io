# Fase 6: integrações (Google Agenda, Meet, e-mails, rotinas e IA)

Tudo que o Apps Script fazia "do lado do Google" agora roda em **Edge Functions** do Supabase:

| Função | Faz | Substitui no GS |
|---|---|---|
| `google-agenda` | Cria e atualiza os eventos das tarefas (título, horário, convidado e cor quando conclui) e apaga os eventos quando a tarefa é excluída. Também lê a agenda do dia para o **Meu Dia** e cria o **Meet** do chat | `_createRecurringCalendarEvents`, `_updateCalendarEvent`, `_getCalendarEventsToday`, `createMeetCall` |
| `notificar` | E-mail de nova tarefa atribuída e de menção (@) | `_notifyTaskAssigned`, `notifyMention` |
| `rotinas` | Aviso de prazo (7, 3 e 0 dias) todo dia às 8h e relatório semanal toda segunda às 8h | `sendDeadlineNotifications`, `sendWeeklyReport` e os gatilhos |
| `ia` | "Pergunte à Intranet" | `askIntranetAI` |

Enquanto algo não estiver configurado, a intranet funciona normalmente: a função só avisa "integração não configurada".

---

## Passo 1: escolher a conta-robô

Use **a mesma conta que hoje publica o Apps Script**, provavelmente `tadeu@klavabrands.com`. Assim:
- os eventos das tarefas continuam saindo da mesma agenda de hoje;
- quem já compartilhou a própria agenda com essa conta (para o Meu Dia) não precisa fazer nada de novo.

## Passo 2: ativar as APIs no Google Cloud
No mesmo projeto do Google Cloud em que você criou o login:
1. Vá em **APIs & Services → Library**, procure **Google Calendar API** e clique em **Enable**.
2. Na mesma tela, procure **Gmail API** e clique em **Enable**. É ela que envia os e-mails pela conta-robô, do mesmo jeito que o MailApp fazia, sem precisar mexer em DNS.
3. Vá em **Google Auth Platform → Clients**, abra o cliente `Supabase Intranet` e, em **Authorized redirect URIs**, adicione:
   ```
   https://developers.google.com/oauthplayground
   ```
   Depois clique em **Save**.

## Passo 3: gerar o refresh token da conta-robô
1. Abra o [OAuth Playground](https://developers.google.com/oauthplayground).
2. Clique na engrenagem ⚙️ no canto superior direito, marque **Use your own OAuth credentials** e cole o **Client ID** e o **Client secret** do cliente `Supabase Intranet`.
3. Na caixa **"Input your own scopes"** da esquerda, cole os dois escopos separados por espaço:
   ```
   https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send
   ```
4. Clique em **Authorize APIs**, entre com a **conta-robô** e permita o acesso.
5. Clique em **Exchange authorization code for tokens** e copie o **Refresh token** (começa com `1//`).

> Como o app é *Internal*, esse token não expira sozinho. Ele só deixa de valer se a senha da conta for trocada ou se o acesso for revogado. Se isso acontecer, repita este passo.

## Passo 4: publicar as funções (PowerShell)
```powershell
cd "$HOME\Documents\Intranet - Estrutura\klava-intranet"
npx supabase@latest login
```
O comando acima abre o navegador para autorizar. Depois rode:
```powershell
$ref = "iparjofxtdvedkxijhxc"
foreach ($f in "google-agenda","notificar","rotinas","ia") {
  npx supabase@latest functions deploy $f --project-ref $ref --no-verify-jwt --use-api
}
```
> O `--no-verify-jwt` é intencional: cada função confere o login por conta própria (ou o segredo do cron, no caso de `rotinas`).

## Passo 5: guardar os segredos
Troque os valores e rode tudo numa linha só:
```powershell
npx supabase@latest secrets set --project-ref iparjofxtdvedkxijhxc GOOGLE_CLIENT_ID="...apps.googleusercontent.com" GOOGLE_CLIENT_SECRET="GOCSPX-..." GOOGLE_REFRESH_TOKEN="1//..." GOOGLE_AGENDA_CONTA="tadeu@klavabrands.com" CRON_SECRET="$([guid]::NewGuid())"
```
Para ver o `CRON_SECRET` que foi gerado (você vai precisar dele no passo 7): **Supabase → Edge Functions → Secrets**.

**Opcionais:**
- **IA:** `ANTHROPIC_API_KEY="sk-ant-..."`
- **Resend no lugar do Gmail:** `RESEND_API_KEY="re_..."` e `EMAIL_REMETENTE="Klava Intranet <intranet@klavabrands.com>"`. Para isso o domínio precisa estar verificado no Resend.

## Passo 6: banco de dados
No **SQL Editor**, rode `supabase/migrations/20261123000009_integracoes.sql`.

## Passo 7: agendamentos (só na virada, fase 7)
O arquivo `supabase/setup/agendamentos.sql` liga os avisos de prazo e o relatório semanal.
**Rode só no dia da virada.** Antes disso, o Apps Script ainda manda os dele, e a equipe receberia os e-mails em dobro.
1. Abra o arquivo e troque `COLE_AQUI_O_MESMO_CRON_SECRET` pelo valor do passo 5.
2. Rode no SQL Editor.
3. Para testar na hora: `select intranet.chamar_rotina('semanal');` O relatório deve chegar no e-mail dos admins.

## Passo 8: ligar a IA (quando quiser)
```sql
update intranet.app_config set valor = 'true' where chave = 'ia_ativa';
```
O modelo padrão é o `claude-haiku-5-5`. Para trocar: `update intranet.app_config set valor = '"outro-modelo"' where chave = 'ia_modelo';`
A IA só lê o que a pessoa que pergunta já pode ver (as DMs dos outros ficam de fora).

---

## Checklist de teste
- [ ] **Tarefa nova:** aparece o evento na agenda da conta-robô, o responsável recebe o convite e o e-mail "[Klava] Nova tarefa".
- [ ] **Mover para Concluído:** o título do evento muda para `[CONCLUÍDO]` e a cor fica verde.
- [ ] **Mudar o prazo:** o evento muda de dia.
- [ ] **Excluir a tarefa:** o evento some da agenda.
- [ ] **Meu Dia:** mostra os compromissos de hoje. Se aparecer "agenda não compartilhada", a pessoa precisa compartilhar a agenda com a conta-robô.
- [ ] **Chat → 📹 Chamada:** cria o Meet, posta o link no canal e os membros recebem o convite.
- [ ] **@menção no chat:** a pessoa mencionada recebe o e-mail.

Se algo falhar, o erro aparece em **Supabase → Edge Functions → (função) → Logs**.

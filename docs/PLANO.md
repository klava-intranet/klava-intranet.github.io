# Plano de migração: Intranet Klava (Apps Script → Supabase + GitHub)

## Fases

| # | Fase | Entrega | Status |
|---|---|---|---|
| 1 | **Fundação** | Repo, schema completo, RLS, Realtime, Storage, script de migração, front com login Google | ✅ pronto |
| 2 | **Migração de dados** | `migrar_planilha.py` rodado na planilha real, contagens conferidas | ✅ pronto |
| 3 | **Módulos de leitura** | Início/Meu Dia, Setores, Sistemas, BIs, Contatos e Wiki (CRUD admin), Drive (links + arquivos no Storage), i18n PT/EN/ZH, busca global | ✅ pronto |
| 4 | **Tarefas** | Criar (recorrência e numeração), editar, mover, excluir, comentar, anexar (Storage), kanban ao vivo (Realtime) | ✅ pronto |
| 5 | **Chat** | Canais (criar/editar/sair/excluir), DMs sincronizadas entre computadores, reações, arquivos no Storage, não lidas no servidor, mensagens ao vivo (Realtime) | ✅ pronto |
| 6 | **Integrações** | Edge Functions: Google Agenda/Meet, e-mails (Gmail da conta-robô ou Resend), avisos de prazo e relatório semanal (pg_cron), IA. Guia em `docs/FASE6_INTEGRACOES.md` | ✅ código pronto, falta configurar as credenciais |
| 7 | **Virada** | Publicar no GitHub Pages → alguns dias em paralelo → planilha só leitura → importação final → ligar os agendamentos → desligar o Apps Script | ⏳ |

## Como o front foi migrado

O front da versão Apps Script continua **igual** (mesmo HTML, CSS e JS), para ninguém estranhar:

```
web/index.html            ← INDEX.txt (+ tela de login e botão Sair)
web/src/legado/estilo.css ← ESTILO.txt
web/public/legado/app.js  ← SCRIPT.txt (só 3 linhas ajustadas, marcadas com "v5")
web/src/shim/gas.js       ← camada de compatibilidade: google.script.run.X() → Supabase
web/src/main.js           ← login Google → instala a camada → carrega app.js → liga o Realtime
```

Cada `google.script.run.X()` do SCRIPT vira uma RPC `intranet.api_*` ou uma chamada de Edge Function, que devolve **o mesmo formato** que o GS devolvia. Agora que tudo está migrado, o `app.js` pode ser quebrado em módulos aos poucos, sem pressa.

**Os 3 ajustes no app.js** corrigem um bug da versão antiga: depois de enviar uma mensagem, o front usava um ID provisório maior que o das mensagens seguintes. Com isso, as respostas dos outros só apareciam de novo umas 2h40 depois, ou ao trocar de canal.

## De → Para (abas da planilha)

| Aba | Tabela(s) | O que mudou |
|---|---|---|
| Usuários | `usuarios` | + `papel` (admin/colaborador) no lugar do `cfg_admins` fixo; `auth_id` liga ao login Google |
| Canais | `canais` + `canal_membros` | membros viram linhas (antes: "a,b,c" numa célula) |
| Chat | `mensagens` | `id` interno + `legacy_id` (horário em ms, que é o ID que o front enxerga); o autor é sempre quem está logado |
| (nova) | `canal_membros.last_read_id`, `leituras_geral` | "não lidas" no servidor (antes: localStorage, que se perdia ao trocar de computador) |
| Reações | `reacoes` | chave única (mensagem, usuário, emoji) |
| Tarefas | `tarefas` + `tarefa_ocorrencias` + `tarefa_anexos` | anexos e CalendarEventIds saem do JSON na célula |
| Comentarios | `tarefa_comentarios` | exclusão lógica (`deleted_at`) |
| Drive_Arquivos | `drive_arquivos` | arquivo antigo = `google_file_id`; arquivo novo = `storage_path` |
| Drive_Links | `drive_links` | |
| Contatos | `contatos` | |
| Wiki | `wiki_artigos` | busca sem acento |
| Logs_Acesso / Logs_Erros | `logs_acesso` / `logs_erros` | só admin lê |
| PropertiesService | `app_config` | `ia_ativa`, `ia_modelo`, `relatorio_semanal`, `aviso_prazo_dias`… |
| Código fixo (MARCA_PREFIX_MAP, DRIVE_UPLOADERS, DRIVE_SECTOR_NAMES) | `marca_prefixos`, `drive_setor_uploaders`, `drive_setores` | editável sem deploy |
| (nova) | `calendar_fila_exclusao` | eventos do Google a apagar quando uma tarefa é excluída |

## De → Para (funções do GS.txt)

| GS.txt | Novo |
|---|---|
| `getGoogleUser`, `isAdmin` | RPC `perfil()` |
| `getInitialData` | `api_tarefas` + `api_usuarios` + `api_drive_links` + `api_canais` |
| `getContacts` / `saveContact` / `deleteContact` | `api_contatos` / `api_salvar_contato` / `api_excluir_contato` |
| `getWikiArticles` / `saveWikiArticle` / `deleteWikiArticle` | `api_wiki` / `api_salvar_wiki` / `api_excluir_wiki` |
| `getDriveLinks` / `saveDriveLink` / `deleteDriveLink` | `api_drive_links` / `api_salvar_link` / `api_excluir_link` |
| `getDriveFiles` / `uploadDriveFile` / `deleteDriveFile` | `api_drive_arquivos` + Storage (bucket `drive`) / `api_excluir_arquivo` |
| `globalSearch` | `api_busca` (sem acento, respeita o RLS) |
| `getMyDayData` / `getMyPendingTasks` | `api_meu_dia` + `google-agenda` (agenda_dia) / `api_pendentes` |
| `getTasks` / `getDashboardData` / `getTaskComments` | `api_tarefas` / `api_dashboard` / `api_comentarios` |
| `createTask` | `api_criar_tarefa` (numeração por trigger, atômica) → `google-agenda` + `notificar` |
| `updateTask` / `updateTaskStatus` / `deleteTask` | `api_editar_tarefa` / `api_mover_tarefa` / `api_excluir_tarefa` → `google-agenda` |
| `addTaskComment` / `deleteTaskComment` / `uploadTaskFile` | `api_comentar` / `api_excluir_comentario` / Storage (bucket `tarefas`) + `api_registrar_anexo` |
| `getChatMessages` / `getChatMessagesBefore` (polling 5 s) | `api_mensagens` / `api_mensagens_antes` + Realtime |
| `getUnreadCounts` (polling 3 s) | `api_nao_lidas` em cache, atualizada pelo Realtime |
| `sendChatMessage` / `uploadChatFile` | `api_enviar` (abre a DM se precisar) / Storage (bucket `chat`) |
| `getUserChannels` / `createChannel` / `editChannel` / `leaveChannel` / `deleteChannel` | `api_canais` / `api_criar_canal` / `api_editar_canal` / `api_sair_canal` / `api_excluir_canal` |
| `getReactions` / `saveReaction` | `api_reacoes` / `api_reagir` |
| `_createRecurringCalendarEvents`, `_updateCalendarEvent` | Edge Function `google-agenda` (sincronizar_tarefa) |
| `_getCalendarEventsToday` | `google-agenda` (agenda_dia) |
| `createMeetCall` | `google-agenda` (meet) |
| `_notifyTaskAssigned`, `notifyMention` | Edge Function `notificar` |
| `sendDeadlineNotifications`, `sendWeeklyReport` + gatilhos | `pg_cron` → Edge Function `rotinas` |
| `askIntranetAI` | Edge Function `ia` (liga/desliga em `app_config.ia_ativa`) |
| `getTasksCached`, CacheService | desnecessário (consultas indexadas) |

## Decisões

- **Postgres puro no schema `intranet`.** Se a intranet for para outro servidor (ou virar módulo do PHOBOS), sai com um `pg_dump`.
- **Segurança no banco, não no navegador.** O GS confiava no `requestedBy` que o próprio front enviava, então dava para editar ou apagar coisas se passando por outra pessoa. Com RLS, o banco sabe quem está logado, e quem não está cadastrado ou está inativo não vê nada.
- **Mesmo visual de antes.** O front antigo roda intacto sobre uma camada de compatibilidade, sem reescrever em framework.
- **Tempo real.** O Realtime avisa quando há mensagem ou tarefa nova; o polling antigo só consulta o banco quando chega aviso (ou a cada 30 s, por segurança).
- **Google via conta-robô.** É a mesma conta que hoje publica o Apps Script, com refresh token guardado como secret. Assim, quem já compartilhou a agenda com ela continua aparecendo no Meu Dia sem fazer nada.
- **E-mail pelo Gmail da conta-robô** (como o MailApp fazia, sem DNS). Se `RESEND_API_KEY` estiver configurado, passa a usar o Resend.
- **Integração nunca trava a ação principal:** se o Google falhar, a tarefa é criada do mesmo jeito e o erro vai para o log da função.
- **Arquivos:** os novos vão para o Supabase Storage (privado, com URL assinada de 12 h); os antigos continuam no Google Drive.
- **IA desligada** (`app_config.ia_ativa = false`) até decidir o custo. Quando ligada, ela só vê o que quem pergunta já pode ver.

## Migrations

| Arquivo | Conteúdo |
|---|---|
| `0001_schema` | tabelas, índices, enums |
| `0002_funcoes_triggers` | identidade, numeração, ocorrências, DMs, não lidas, Meu Dia |
| `0003_rls` | permissões (RLS), grants, publicação do Realtime |
| `0004_dados_referencia` | prefixos de marca, setores do Drive, config |
| `0005_storage` | buckets `chat`, `tarefas`, `drive` |
| `0006_api_legado` | RPCs no formato do front (fase 3) |
| `0007_tarefas_escrita` | criar/editar/mover/excluir/comentar/anexar tarefas |
| `0008_chat` | chat completo + `legacy_id` automático |
| `0009_integracoes` | fila de exclusão de eventos do Google |
| `setup/agendamentos.sql` | pg_cron dos avisos e do relatório (**rodar só na virada**) |

## Testes feitos (Postgres 16 local + Chrome, com login e Google simulados)

- As migrations aplicam do zero sem erro, e a importação da planilha roda 2× sem duplicar nada.
- Usuário comum: vê só os próprios canais e DMs; não manda mensagem como outra pessoa; não escreve em DM alheia; não edita contato, wiki nem link.
- Tarefas: o número segue a sequência do prefixo; as ocorrências acompanham a mudança de prazo; só o responsável (ou um admin) move; não dá para pular de "a fazer" direto para "concluído"; ao excluir, os eventos do Google vão para a fila.
- Chat: depois de enviar, as respostas dos outros continuam aparecendo (bug antigo corrigido); ler o canal marca como lido; o criador do canal não pode sair.
- Front: todas as páginas abrem sem erro; criar, mover, comentar e anexar tarefa pela interface; enviar mensagem, arquivo e reação.
- Edge Functions: o verificador de tipos do Deno passa; o e-mail sai com assunto e texto acentuados e com emoji corretos.

/**
 * Camada de compatibilidade google.script.run → Supabase
 *
 * O front da versão Apps Script (public/legado/app.js) continua chamando
 * google.script.run.withSuccessHandler(fn).getContacts() etc.
 * Aqui cada uma dessas funções vira uma consulta ao Supabase que devolve
 * exatamente o mesmo formato que o GS.txt devolvia.
 *
 * O "requestedBy"/"alias" que o front manda é ignorado de propósito:
 * quem decide permissão é o banco (RLS), a partir do login.
 *
 * Migração por fases: o que ainda não foi migrado responde com aviso.
 */
import { sb } from '../lib/supabase.js';

let perfil = null;

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

const emMigracao = (fase, oque) => async () => {
  throw new Error(`${oque} ainda está em migração (${fase}). Por enquanto use a intranet antiga para isso.`);
};

// ───────────── Edge Functions (Google Agenda, Meet, e-mails, IA) ─────────────
async function funcao(nome, body) {
  const { data, error } = await sb.functions.invoke(nome, { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); msg = j.msg || msg; } catch (e) {}
    throw new Error(msg);
  }
  return data;
}
// Integração não pode travar a ação principal: roda em segundo plano e só registra falhas
const emSegundoPlano = (nome, body) =>
  funcao(nome, body)
    .then((r) => { if (r && r.ok === false) console.warn(`[${nome}]`, r.msg); return r; })
    .catch((e) => console.warn(`[${nome}]`, e.message));

// ───────────── helpers de arquivo ─────────────
function base64ParaBlob(b64, mime) {
  const limpo = b64.includes(',') ? b64.split(',')[1] : b64;
  const bin = atob(limpo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

function nomeSeguro(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-120);
}

const URL_VALIDADE_S = 60 * 60 * 12; // links assinados valem 12h

async function assinarArquivos(porSetor) {
  const paths = [];
  Object.values(porSetor).forEach((lista) => lista.forEach((f) => f.storagePath && paths.push(f.storagePath)));
  if (!paths.length) return porSetor;
  const { data, error } = await sb.storage.from('drive').createSignedUrls(paths, URL_VALIDADE_S);
  if (error) { console.warn('assinar arquivos', error); return porSetor; }
  const mapa = Object.fromEntries(data.map((d) => [d.path, d.signedUrl]));
  Object.values(porSetor).forEach((lista) => lista.forEach((f) => { if (f.storagePath) f.url = mapa[f.storagePath] || ''; }));
  return porSetor;
}

// URLs assinadas ficam em cache (o kanban recarrega a cada 10 s)
const cacheUrls = new Map(); // "bucket/path" → { url, expira }
async function assinarPaths(bucket, paths) {
  const agora = Date.now();
  const faltando = [...new Set(paths)].filter((p) => !(cacheUrls.get(bucket + '/' + p)?.expira > agora + 60_000));
  if (faltando.length) {
    const { data, error } = await sb.storage.from(bucket).createSignedUrls(faltando, URL_VALIDADE_S);
    if (error) console.warn('assinar', bucket, error);
    (data || []).forEach((d) => d.signedUrl && cacheUrls.set(bucket + '/' + d.path, { url: d.signedUrl, expira: agora + URL_VALIDADE_S * 1000 }));
  }
  return (p) => cacheUrls.get(bucket + '/' + p)?.url || '';
}

// Anexos novos (Storage) ganham URL assinada; antigos (Google Drive) já têm URL
async function prepararTarefas(tarefas) {
  const lista = tarefas || [];
  const paths = [];
  lista.forEach((t) => { try { JSON.parse(t.anexos || '[]').forEach((a) => a.path && paths.push(a.path)); } catch (e) {} });
  if (!paths.length) return lista;
  const url = await assinarPaths('tarefas', paths);
  lista.forEach((t) => {
    try {
      const anexos = JSON.parse(t.anexos || '[]').map((a) => (a.path ? { ...a, url: url(a.path) } : a));
      t.anexos = JSON.stringify(anexos);
    } catch (e) {}
  });
  return lista;
}

// ───────────── Chat: cache + Realtime ─────────────
// O front antigo pergunta "tem mensagem nova?" a cada 3–5 s. Com o Realtime ligado,
// só vamos ao banco quando chega aviso de mensagem nova (ou a cada 30 s, por segurança).
const chat = { rtOk: false, versao: 0, vistoCanal: {}, buscaCanal: {}, naoLidas: null, naoLidasVersao: -1, naoLidasEm: 0 };
const FOLGA_MS = 30_000;

async function linhasChat(msgs, comCanal) {
  const paths = msgs.filter((m) => m.path).map((m) => m.path);
  const url = paths.length ? await assinarPaths('chat', paths) : () => '';
  return msgs.map((m) => {
    const arq = m.path ? url(m.path) : m.url;
    return comCanal ? [m.id, m.ts, m.alias, m.text, comCanal, m.type, arq] : [m.id, m.ts, m.alias, m.text, m.type, arq];
  });
}

// DMs ficam na barra lateral em qualquer computador (antes só no navegador onde foram abertas)
async function sincronizarDMs() {
  try {
    const dms = await rpc('api_minhas_dms');
    const chave = 'klava-dms-' + perfil.alias;
    const salvas = JSON.parse(localStorage.getItem(chave) || '[]').map((e) => (typeof e === 'string' ? { chKey: e, createdBy: perfil.alias } : e));
    const tem = new Set(salvas.map((e) => e.chKey));
    dms.forEach((d) => { if (!tem.has(d.chKey)) salvas.push({ chKey: d.chKey, createdBy: d.createdBy || perfil.alias }); });
    localStorage.setItem(chave, JSON.stringify(salvas));
  } catch (e) { console.warn('sincronizarDMs', e); }
}

// ───────────── API (mesmos nomes do GS.txt) ─────────────
const API = {
  // Usuário / início
  getGoogleUser: async () => ({ email: perfil.email, alias: perfil.alias }),
  getInitialData: async () => {
    const [tasks, users, driveLinks, channels] = await Promise.all([
      rpc('api_tarefas').then(prepararTarefas), rpc('api_usuarios'), rpc('api_drive_links'), rpc('api_canais'), sincronizarDMs(),
    ]);
    return { ok: true, tasks, users, channels, driveLinks, isAdmin: perfil.papel === 'admin', ts: Date.now() };
  },
  recordAccessLog: async () => {
    await sb.from('logs_acesso').insert({ usuario_id: perfil.id, email: perfil.email, acao: 'Acesso à Home' });
    return null;
  },
  getActiveUsers: () => rpc('api_usuarios'),

  // Meu Dia
  getMyDayData: async (_alias, _lastSeen, dateStr) => {
    const [d, agenda] = await Promise.all([
      rpc('api_meu_dia', { p_data: dateStr || null }),
      funcao('google-agenda', { acao: 'agenda_dia', data: dateStr || null })
        .catch((e) => ({ calendarShared: false, calendarEvents: [], calendarRunnerEmail: '', calendarError: e.message })),
    ]);
    return { ...d, ...agenda, date: d.date };
  },
  getMyPendingTasks: () => rpc('api_pendentes'),

  // Tarefas (fase 4). Agenda Google e e-mail de aviso entram na fase 6.
  getTasks: async () => prepararTarefas(await rpc('api_tarefas')),
  getDashboardData: () => rpc('api_dashboard'),
  getTaskComments: (taskId) => rpc('api_comentarios', { p_tarefa: taskId }),
  createTask: async (data) => {
    const r = await rpc('api_criar_tarefa', { p: data });
    if (r.ok) {
      emSegundoPlano('google-agenda', { acao: 'sincronizar_tarefa', tarefa_id: r.id });
      emSegundoPlano('notificar', { acao: 'tarefa_atribuida', tarefa_id: r.id });
    }
    return r;
  },
  updateTask: async (data) => {
    const r = await rpc('api_editar_tarefa', { p: data });
    if (r.ok) emSegundoPlano('google-agenda', { acao: 'sincronizar_tarefa', tarefa_id: data.id });
    return r;
  },
  updateTaskStatus: async (data) => {
    const r = await rpc('api_mover_tarefa', { p_id: data.id, p_status: data.status });
    if (r.ok) emSegundoPlano('google-agenda', { acao: 'sincronizar_tarefa', tarefa_id: data.id });
    return r;
  },
  deleteTask: async (taskId) => {
    const r = await rpc('api_excluir_tarefa', { p_id: taskId });
    if (r.ok && r.storagePaths?.length) await sb.storage.from('tarefas').remove(r.storagePaths); // melhor esforço
    if (r.ok && r.calendarEventIds?.length) emSegundoPlano('google-agenda', { acao: 'processar_fila' });
    return r;
  },
  uploadTaskFile: async (taskId, fileName, mimeType, base64Data) => {
    if (!taskId || !fileName || !base64Data) throw new Error('Parâmetros inválidos.');
    const blob = base64ParaBlob(base64Data, mimeType);
    const path = `${taskId}/${crypto.randomUUID()}-${nomeSeguro(fileName)}`;
    const up = await sb.storage.from('tarefas').upload(path, blob, { contentType: blob.type, upsert: false });
    if (up.error) throw new Error('Erro no upload: ' + up.error.message);
    const r = await rpc('api_registrar_anexo', { p_tarefa: taskId, p_nome: fileName, p_path: path });
    if (!r.ok) { await sb.storage.from('tarefas').remove([path]); throw new Error(r.msg); }
    return (await assinarPaths('tarefas', [path]))(path); // o GS devolvia a URL do arquivo
  },
  addTaskComment: (taskId, _alias, text) => rpc('api_comentar', { p_tarefa: taskId, p_texto: text }),
  deleteTaskComment: (commentId) => rpc('api_excluir_comentario', { p_id: commentId }),

  // Contatos
  getContacts: () => rpc('api_contatos'),
  saveContact: (data) => rpc('api_salvar_contato', { p: data }),
  deleteContact: (id) => rpc('api_excluir_contato', { p_id: id }),

  // Wiki
  getWikiArticles: () => rpc('api_wiki'),
  saveWikiArticle: (data) => rpc('api_salvar_wiki', { p: data }),
  deleteWikiArticle: (id) => rpc('api_excluir_wiki', { p_id: id }),

  // Drive — links
  getDriveLinks: () => rpc('api_drive_links'),
  saveDriveLink: (sectorId, title, url, sub, type) =>
    rpc('api_salvar_link', { p_setor: sectorId, p_titulo: title, p_url: url, p_sub: sub || '', p_tipo: type || 'link' }),
  deleteDriveLink: (id) => rpc('api_excluir_link', { p_id: id }),

  // Drive — arquivos (novos vão para o Supabase Storage; antigos seguem no Google Drive)
  getDriveFiles: async () => assinarArquivos(await rpc('api_drive_arquivos')),
  uploadDriveFile: async (sectorId, fileName, mimeType, base64Data, description, _uploadedBy, fileSize) => {
    if (!sectorId) return { ok: false, msg: 'Setor não informado.' };
    if (!fileName) return { ok: false, msg: 'Nome do arquivo não informado.' };
    if (!base64Data || base64Data.length < 10) return { ok: false, msg: 'Arquivo vazio ou corrompido.' };
    if (!(await rpc('pode_enviar_drive', { p_setor: sectorId }))) return { ok: false, msg: 'Sem permissão para enviar neste setor.' };

    const blob = base64ParaBlob(base64Data, mimeType);
    if (blob.size > 30 * 1024 * 1024) return { ok: false, msg: 'Arquivo maior que 30 MB.' };
    const path = `${sectorId}/${crypto.randomUUID()}-${nomeSeguro(fileName)}`;

    const up = await sb.storage.from('drive').upload(path, blob, { contentType: blob.type, upsert: false });
    if (up.error) return { ok: false, msg: 'Erro no upload: ' + up.error.message };

    const { data, error } = await sb.from('drive_arquivos').insert({
      setor_key: sectorId, nome: fileName, descricao: description || '', mime_type: blob.type,
      tamanho: fileSize || blob.size, storage_path: path,
    }).select('id').single();
    if (error) {
      await sb.storage.from('drive').remove([path]);
      return { ok: false, msg: error.message };
    }
    const signed = await sb.storage.from('drive').createSignedUrl(path, URL_VALIDADE_S);
    return { ok: true, fileId: data.id, url: signed.data?.signedUrl || '' };
  },
  deleteDriveFile: async (fileId) => {
    const r = await rpc('api_excluir_arquivo', { p_id: fileId });
    if (r.ok && r.storagePath) await sb.storage.from('drive').remove([r.storagePath]);
    return r;
  },

  // Busca global
  globalSearch: (query) => rpc('api_busca', { p_q: query }),

  // IA — liga/desliga em app_config.ia_ativa (começa desligada por causa do custo)
  askIntranetAI: (question) => funcao('ia', { pergunta: question }),

  // Chat (fase 5)
  getUserChannels: () => rpc('api_canais'),
  getChatMessages: async (channel, lastMessageId, pageSize) => {
    const agora = Date.now();
    const semNovidade = lastMessageId > 0 && chat.rtOk && chat.vistoCanal[channel] === chat.versao
      && agora - (chat.buscaCanal[channel] || 0) < FOLGA_MS;
    if (semNovidade) return [];
    const versao = chat.versao;
    const msgs = await rpc('api_mensagens', { p_key: channel, p_depois: lastMessageId || 0, p_limite: pageSize || 60 });
    chat.vistoCanal[channel] = versao; chat.buscaCanal[channel] = agora;
    if (msgs.length) chat.naoLidasVersao = -1; // ler marca como lido no banco
    return linhasChat(msgs);
  },
  getChatMessagesBefore: async (channel, oldestId, pageSize) =>
    linhasChat(await rpc('api_mensagens_antes', { p_key: channel, p_antes: oldestId, p_limite: pageSize || 60 })),
  getUnreadCounts: async () => {
    const fresco = chat.rtOk && chat.naoLidasVersao === chat.versao && Date.now() - chat.naoLidasEm < FOLGA_MS;
    if (fresco && chat.naoLidas) return chat.naoLidas;
    const versao = chat.versao;
    chat.naoLidas = await rpc('api_nao_lidas');
    chat.naoLidasVersao = versao; chat.naoLidasEm = Date.now();
    return chat.naoLidas;
  },
  sendChatMessage: async (channel, alias, text) => {
    const m = await rpc('api_enviar', { p_key: channel, p_texto: text, p_sistema: alias === 'sistema' });
    return (await linhasChat([m], channel))[0];
  },
  uploadChatFile: async (channel, _alias, fileName, mimeType, base64Data) => {
    const canalId = await rpc('api_canal_id', { p_key: channel });
    const blob = base64ParaBlob(base64Data, mimeType);
    const path = `${canalId}/${crypto.randomUUID()}-${nomeSeguro(fileName)}`;
    const up = await sb.storage.from('chat').upload(path, blob, { contentType: blob.type, upsert: false });
    if (up.error) throw new Error('Erro no upload: ' + up.error.message);
    try {
      const m = await rpc('api_enviar', { p_key: channel, p_texto: fileName, p_arquivo_path: path });
      return (await linhasChat([m], channel))[0];
    } catch (e) {
      await sb.storage.from('chat').remove([path]);
      throw e;
    }
  },
  createChannel: (name, description, members) => rpc('api_criar_canal', { p_nome: name, p_descricao: description || '', p_membros: members || '' }),
  editChannel: (key, name, description, members) => rpc('api_editar_canal', { p_key: key, p_nome: name, p_descricao: description || '', p_membros: members || '' }),
  deleteChannel: (key) => rpc('api_excluir_canal', { p_key: key }),
  leaveChannel: (key) => rpc('api_sair_canal', { p_key: key }),
  getReactions: (channel) => rpc('api_reacoes', { p_key: channel }),
  saveReaction: (msgId, emoji) => rpc('api_reagir', { p_legacy: msgId, p_emoji: emoji }),
  notifyMention: async (alias, _sender, message, channel) => {
    emSegundoPlano('notificar', { acao: 'mencao', alias, canal_key: channel, texto: message });
    return { ok: true };
  },
  createMeetCall: (channelKey, _alias, label) => funcao('google-agenda', { acao: 'meet', channel_key: channelKey, label }),
};

// ───────────── google.script.run ─────────────
function criarRunner(estado = {}) {
  return new Proxy({}, {
    get(_, prop) {
      if (prop === 'withSuccessHandler') return (fn) => criarRunner({ ...estado, ok: fn });
      if (prop === 'withFailureHandler') return (fn) => criarRunner({ ...estado, falha: fn });
      if (prop === 'withUserObject') return (obj) => criarRunner({ ...estado, user: obj });
      return (...args) => {
        Promise.resolve()
          .then(() => {
            const impl = API[prop];
            if (!impl) throw new Error(`Função "${String(prop)}" ainda não foi migrada.`);
            return impl(...args);
          })
          .then(
            (res) => estado.ok && estado.ok(res, estado.user),
            (err) => {
              console.warn(`[gas] ${String(prop)}:`, err);
              sb.from('logs_erros').insert({ funcao: String(prop), usuario: perfil?.alias, erro: String(err.message || err).slice(0, 300) }).then(() => {});
              if (estado.falha) estado.falha(err, estado.user);
              else alert(err.message || err);
            },
          );
      };
    },
  });
}

// Realtime: kanban, badge de tarefas, mensagens, não lidas e reações atualizam na hora
export function iniciarRealtime() {
  const timers = {};
  const depois = (nome, fn, ms = 300) => { clearTimeout(timers[nome]); timers[nome] = setTimeout(fn, ms); };
  const visivel = (id) => { const el = document.getElementById(id); return el && el.style.display !== 'none'; };

  const tarefas = () => depois('tarefas', () => {
    if (visivel('page-tarefas') && window.loadTasks) window.loadTasks();
    if (window.checkTaskNotifications) window.checkTaskNotifications();
  });
  const mensagens = () => {
    chat.versao++;
    depois('chat', () => {
      if (window._chatPageOpen && window.loadMessages) window.loadMessages();
      if (window.checkUnreadMessages) window.checkUnreadMessages();
    }, 150);
  };
  const reacoes = () => depois('reacoes', () => { if (window._chatPageOpen && window.loadReactions) window.loadReactions(); });

  sb.channel('intranet-ao-vivo')
    .on('postgres_changes', { event: '*', schema: 'intranet', table: 'tarefas' }, tarefas)
    .on('postgres_changes', { event: 'INSERT', schema: 'intranet', table: 'tarefa_comentarios' }, tarefas)
    .on('postgres_changes', { event: 'INSERT', schema: 'intranet', table: 'mensagens' }, mensagens)
    .on('postgres_changes', { event: '*', schema: 'intranet', table: 'reacoes' }, reacoes)
    .on('postgres_changes', { event: '*', schema: 'intranet', table: 'canal_membros' }, () => depois('canais', () => window.loadUserChannels && window.loadUserChannels()))
    .subscribe((status) => {
      chat.rtOk = status === 'SUBSCRIBED';
      if (!chat.rtOk) chat.versao++; // caiu: volta a consultar o banco normalmente
    });
}

export function instalarShim(p) {
  perfil = p;
  window.google = { script: { run: criarRunner() } };
}

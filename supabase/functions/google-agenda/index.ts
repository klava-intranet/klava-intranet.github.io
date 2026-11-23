// ═══════════════════════════════════════════════════════════════════════
// google-agenda — Google Agenda e Meet da intranet (substitui CalendarApp do GS)
//
// Ações (POST { acao, ... }):
//   sincronizar_tarefa { tarefa_id }  cria/atualiza os eventos de todas as ocorrências
//                                     (título, horário, convidado e status) — idempotente
//   processar_fila                    apaga os eventos de tarefas excluídas
//   agenda_dia { data }               compromissos do dia na agenda do usuário (Meu Dia)
//   meet { channel_key, label }       cria a videochamada e posta o link no chat
// ═══════════════════════════════════════════════════════════════════════
import { admin, dataBR, HttpErro, servir, TZ, usuario } from '../_shared/comum.ts';
import { CAL, contaRobo, gapi, GoogleErro, googleConfigurado } from '../_shared/google.ts';

const EMOJI: Record<string, string> = { alta: '🔴', media: '🟡', baixa: '🟢' };
const PREFIXO: Record<string, string> = { todo: '[TAREFA]', doing: '[EM ANDAMENTO]', done: '[CONCLUÍDO]' };
const COR_CONCLUIDO = '2'; // verde-sálvia, como no GS

type Tarefa = {
  id: string; numero: string; titulo: string; descricao: string; prazo: string; prioridade: string;
  unidade: string; marca: string; status: string; total_ocorrencias: number; concluido_em: string | null;
  solicitante_id: string | null; responsavel_id: string;
  solicitante: { alias: string; email: string } | null;
  responsavel: { alias: string; email: string } | null;
  tarefa_ocorrencias: { ordem: number; data: string; calendar_event_id: string | null }[];
};

async function carregarTarefa(id: string): Promise<Tarefa> {
  const { data, error } = await admin()
    .from('tarefas')
    .select(`id, numero, titulo, descricao, prazo, prioridade, unidade, marca, status, total_ocorrencias, concluido_em,
             solicitante_id, responsavel_id,
             solicitante:usuarios!tarefas_solicitante_id_fkey(alias, email),
             responsavel:usuarios!tarefas_responsavel_id_fkey(alias, email),
             tarefa_ocorrencias(ordem, data, calendar_event_id)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpErro(404, 'Tarefa não encontrada.');
  return data as unknown as Tarefa;
}

function eventoDaTarefa(t: Tarefa, oc: { ordem: number; data: string }) {
  const total = t.tarefa_ocorrencias.length;
  const titulo = `${PREFIXO[t.status] ?? '[TAREFA]'} [${t.numero}] ${EMOJI[t.prioridade] ?? ''} ${t.titulo}` +
    (total > 1 ? ` [${oc.ordem}/${total}]` : '');
  const linhas = [
    '📋 TAREFA KLAVA', `Nº: ${t.numero}`, `ID: ${t.id}`, `Título: ${t.titulo}`, `Prioridade: ${t.prioridade}`,
    `Unidade: ${t.unidade}`, `Marca: ${t.marca}`, `Solicitante: ${t.solicitante?.alias ?? '—'}`,
    `Responsável: ${t.responsavel?.alias ?? '—'}`, `Prazo: ${dataBR(oc.data)}`,
  ];
  let descricao = linhas.join('\n') + (t.descricao ? '\n\n' + t.descricao : '');
  if (t.status === 'done' && t.concluido_em) {
    descricao += '\n\n✅ Concluído em: ' + new Date(t.concluido_em).toLocaleString('pt-BR', { timeZone: TZ });
  }
  return {
    summary: titulo,
    description: descricao,
    start: { dateTime: `${oc.data}T09:00:00`, timeZone: TZ },
    end: { dateTime: `${oc.data}T10:00:00`, timeZone: TZ },
    attendees: t.responsavel?.email ? [{ email: t.responsavel.email }] : [],
    colorId: t.status === 'done' ? COR_CONCLUIDO : undefined,
  };
}

async function sincronizarTarefa(t: Tarefa) {
  const db = admin();
  let criados = 0, atualizados = 0;
  for (const oc of [...t.tarefa_ocorrencias].sort((a, b) => a.ordem - b.ordem)) {
    const ev = eventoDaTarefa(t, oc);
    let id = oc.calendar_event_id;
    if (id) {
      try {
        const atual = await gapi<{ attendees?: { email: string }[]; status?: string }>('GET', `${CAL}/calendars/primary/events/${encodeURIComponent(id)}`);
        if (atual.status === 'cancelled') throw new GoogleErro(410, 'cancelado');
        const trocouConvidado = (atual.attendees?.[0]?.email ?? '') !== (ev.attendees[0]?.email ?? '');
        await gapi('PATCH', `${CAL}/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=${trocouConvidado ? 'all' : 'none'}`, ev);
        atualizados++;
        continue;
      } catch (e) {
        if (!(e instanceof GoogleErro && (e.status === 404 || e.status === 410))) throw e;
        id = null; // apagado na mão no Google: recria
      }
    }
    const novo = await gapi<{ id: string }>('POST', `${CAL}/calendars/primary/events?sendUpdates=all`, ev);
    await db.from('tarefa_ocorrencias').update({ calendar_event_id: novo.id }).eq('tarefa_id', t.id).eq('ordem', oc.ordem);
    criados++;
  }
  return { criados, atualizados };
}

async function processarFila() {
  const db = admin();
  const { data } = await db.from('calendar_fila_exclusao').select('id, calendar_event_id').limit(200);
  let apagados = 0;
  for (const item of data ?? []) {
    try {
      await gapi('DELETE', `${CAL}/calendars/primary/events/${encodeURIComponent(item.calendar_event_id)}?sendUpdates=all`);
      apagados++;
    } catch (e) {
      if (!(e instanceof GoogleErro && (e.status === 404 || e.status === 410))) { console.error(e); continue; }
    }
    await db.from('calendar_fila_exclusao').delete().eq('id', item.id);
  }
  return { apagados };
}

async function agendaDia(email: string, data: string) {
  const runnerEmail = contaRobo();
  try {
    const q = new URLSearchParams({
      timeMin: `${data}T00:00:00-03:00`, timeMax: `${data}T23:59:59-03:00`,
      singleEvents: 'true', orderBy: 'startTime', maxResults: '50',
    });
    const r = await gapi<{ items?: any[] }>('GET', `${CAL}/calendars/${encodeURIComponent(email)}/events?${q}`);
    const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    const events = (r.items ?? []).filter((e) => e.status !== 'cancelled').map((e) => ({
      title: e.summary ?? '(sem título)',
      hora: e.start?.dateTime ? hora.format(new Date(e.start.dateTime)) : 'Dia todo',
      link: e.htmlLink ?? '',
      taskId: (/\nID:\s*([^\n]+)/.exec(e.description ?? '')?.[1] ?? '').trim(),
    }));
    return { calendarShared: true, calendarEvents: events, calendarRunnerEmail: runnerEmail, calendarError: '' };
  } catch (e) {
    const naoCompartilhado = e instanceof GoogleErro && (e.status === 404 || e.status === 403);
    return {
      calendarShared: false, calendarEvents: [], calendarRunnerEmail: runnerEmail,
      calendarError: naoCompartilhado ? '' : (e instanceof Error ? e.message : String(e)),
    };
  }
}

servir(async (req, body) => {
  const acao = String(body.acao ?? '');
  const { sb, perfil } = await usuario(req);
  if (!googleConfigurado()) {
    if (acao === 'agenda_dia') {
      return { calendarShared: false, calendarEvents: [], calendarRunnerEmail: '', calendarError: 'Integração com o Google ainda não configurada.' };
    }
    return { ok: false, msg: 'Integração com o Google ainda não configurada.' };
  }

  if (acao === 'sincronizar_tarefa') {
    const t = await carregarTarefa(String(body.tarefa_id));
    const pode = perfil.papel === 'admin' || t.solicitante_id === perfil.id || t.responsavel_id === perfil.id;
    if (!pode) throw new HttpErro(403, 'Sem permissão.');
    return { ok: true, ...(await sincronizarTarefa(t)) };
  }

  if (acao === 'processar_fila') return { ok: true, ...(await processarFila()) };

  if (acao === 'agenda_dia') {
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(body.data ?? '')) ? String(body.data) : new Date().toISOString().slice(0, 10);
    return agendaDia(perfil.email, data);
  }

  if (acao === 'meet') {
    const key = String(body.channel_key ?? '');
    // garante que o usuário participa do canal (e cria a DM, se for o caso)
    const { data: canalId, error } = await sb.rpc('api_canal_id', { p_key: key });
    if (error || !canalId) throw new HttpErro(403, 'Canal inexistente ou sem acesso.');

    let convidados: string[] = [];
    if (key !== 'geral') {
      const { data: membros } = await admin().from('canal_membros').select('usuarios(email)').eq('canal_id', canalId);
      convidados = (membros ?? []).map((m: any) => m.usuarios?.email).filter((e: string) => e && e !== perfil.email);
    }
    const label = String(body.label || key);
    const agora = new Date();
    const ev = await gapi<{ id: string; hangoutLink?: string }>(
      'POST', `${CAL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
        summary: `📹 Klava Meet — ${label} (${perfil.alias})`,
        description: `Chamada de vídeo — ${label}\nIniciada por: ${perfil.alias}`,
        start: { dateTime: agora.toISOString() },
        end: { dateTime: new Date(agora.getTime() + 3600_000).toISOString() },
        attendees: [{ email: perfil.email }, ...convidados.map((email) => ({ email }))],
        conferenceData: { createRequest: { requestId: 'klava-' + agora.getTime(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      });
    const meetUrl = ev.hangoutLink ?? '';
    if (!meetUrl) throw new Error('O Google não devolveu o link do Meet.');
    await sb.from('mensagens').insert({ canal_id: canalId, tipo: 'videocall', conteudo: meetUrl, arquivo_url: meetUrl });
    return { ok: true, meetUrl, eventId: ev.id };
  }

  throw new HttpErro(400, 'Ação desconhecida: ' + acao);
});

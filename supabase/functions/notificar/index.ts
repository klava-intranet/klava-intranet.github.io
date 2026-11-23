// ═══════════════════════════════════════════════════════════════════════
// notificar — e-mails disparados por ações do usuário (substitui MailApp do GS)
//   tarefa_atribuida { tarefa_id }               (_notifyTaskAssigned)
//   mencao { alias, canal_key, texto }           (notifyMention)
// ═══════════════════════════════════════════════════════════════════════
import { admin, dataBR, HttpErro, servir, usuario } from '../_shared/comum.ts';
import { enviarEmail } from '../_shared/email.ts';

const PRIO: Record<string, string> = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' };
const REC: Record<string, string> = { diaria: 'Diária', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' };

servir(async (req, body) => {
  const { sb, perfil } = await usuario(req);
  const acao = String(body.acao ?? '');

  if (acao === 'tarefa_atribuida') {
    const { data: t } = await admin()
      .from('tarefas')
      .select(`id, numero, titulo, prazo, prioridade, unidade, marca, recorrencia, total_ocorrencias, solicitante_id,
               solicitante:usuarios!tarefas_solicitante_id_fkey(alias),
               responsavel:usuarios!tarefas_responsavel_id_fkey(alias, email, ativo)`)
      .eq('id', String(body.tarefa_id))
      .maybeSingle();
    if (!t) throw new HttpErro(404, 'Tarefa não encontrada.');
    const tt = t as any;
    if (tt.solicitante_id !== perfil.id && perfil.papel !== 'admin') throw new HttpErro(403, 'Sem permissão.');
    const resp = tt.responsavel;
    if (!resp?.email || !resp.ativo || resp.alias === tt.solicitante?.alias) return { ok: true, enviado: false };

    const rec = tt.recorrencia && tt.total_ocorrencias > 1 ? `\nRecorrência: ${REC[tt.recorrencia] ?? tt.recorrencia} · ${tt.total_ocorrencias} vezes` : '';
    await enviarEmail({
      para: [resp.email],
      assunto: `[Klava] Nova tarefa — ${tt.numero || tt.titulo}`,
      texto: `Olá, ${resp.alias}!\n\nUma nova tarefa foi atribuída a você:\n\n` +
        `Número: ${tt.numero}\nTítulo: ${tt.titulo}\nPrioridade: ${PRIO[tt.prioridade] ?? tt.prioridade}\n` +
        `Unidade: ${tt.unidade}\nMarca: ${tt.marca}\nPrazo: ${dataBR(tt.prazo)}\nSolicitante: ${tt.solicitante?.alias ?? '—'}${rec}\n\n` +
        `— Klava Brands Group`,
    });
    return { ok: true, enviado: true };
  }

  if (acao === 'mencao') {
    const alvo = String(body.alias ?? '').toLowerCase();
    const key = String(body.canal_key ?? '');
    const texto = String(body.texto ?? '');
    if (!alvo || alvo === perfil.alias) return { ok: true, enviado: false };
    // quem menciona precisa participar do canal
    const { error } = await sb.rpc('api_canal_id', { p_key: key });
    if (error) throw new HttpErro(403, 'Sem acesso ao canal.');
    const { data: u } = await admin().from('usuarios').select('alias, email, ativo').eq('alias', alvo).maybeSingle();
    if (!u?.email || !u.ativo) return { ok: true, enviado: false };

    const onde = key === 'geral' ? '#geral' : key.startsWith('dm:') ? 'mensagem direta' : '#' + key.replace('canal:', '');
    await enviarEmail({
      para: [u.email],
      assunto: `[Klava Intranet] ${perfil.alias} mencionou você`,
      texto: `Olá, ${u.alias}!\n\n${perfil.alias} mencionou você em ${onde}:\n\n"${texto.slice(0, 300)}${texto.length > 300 ? '…' : ''}"\n\n— Klava Brands Group`,
    });
    return { ok: true, enviado: true };
  }

  throw new HttpErro(400, 'Ação desconhecida: ' + acao);
});

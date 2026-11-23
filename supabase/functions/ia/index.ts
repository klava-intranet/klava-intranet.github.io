// ═══════════════════════════════════════════════════════════════════════
// ia — "Pergunte à Intranet" (substitui askIntranetAI do GS)
// Só responde se app_config.ia_ativa = true e o secret ANTHROPIC_API_KEY existir.
// O contexto é lido COMO O USUÁRIO (RLS): a IA só vê o que ele já pode ver.
// ═══════════════════════════════════════════════════════════════════════
import { config, HttpErro, servir, usuario } from '../_shared/comum.ts';

servir(async (req, body) => {
  const { sb, perfil } = await usuario(req);
  const pergunta = String(body.pergunta ?? '').trim();
  if (!pergunta) return { ok: false, msg: 'Digite uma pergunta.' };
  if (pergunta.length > 1000) return { ok: false, msg: 'Pergunta muito longa.' };

  if (!(await config<boolean>('ia_ativa', false))) {
    return { ok: false, msg: 'A IA da intranet está desligada. Um administrador pode ligar em app_config (ia_ativa = true).' };
  }
  const chave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!chave) return { ok: false, msg: 'Chave da API Anthropic não configurada (secret ANTHROPIC_API_KEY).' };
  const modelo = await config<string>('ia_modelo', 'claude-haiku-5-5');

  const [wiki, tarefas, links, msgs] = await Promise.all([
    sb.from('wiki_artigos').select('categoria, titulo, conteudo').is('deleted_at', null),
    sb.from('tarefas').select('numero, titulo, status, prazo, prioridade, solicitante:usuarios!tarefas_solicitante_id_fkey(alias), responsavel:usuarios!tarefas_responsavel_id_fkey(alias)')
      .order('criado_em', { ascending: false }).limit(60),
    sb.from('drive_links').select('setor_key, titulo, url').is('deleted_at', null).limit(60),
    sb.from('mensagens').select('conteudo, canais(key), autor:usuarios(alias)').is('deleted_at', null)
      .order('id', { ascending: false }).limit(150),
  ]);

  const partes: string[] = [];
  if (wiki.data?.length) partes.push('--- BASE DE CONHECIMENTO (Wiki) ---\n' + wiki.data.map((w) => `[${w.categoria}] ${w.titulo}\n${String(w.conteudo).slice(0, 600)}`).join('\n\n'));
  if (tarefas.data?.length) partes.push('--- TAREFAS (mais recentes) ---\n' + (tarefas.data as any[]).map((t) =>
    `#${t.numero} | ${t.titulo} | responsável: ${t.responsavel?.alias ?? ''} | solicitante: ${t.solicitante?.alias ?? ''} | status: ${t.status} | prazo: ${t.prazo} | prioridade: ${t.prioridade}`).join('\n'));
  if (links.data?.length) partes.push('--- LINKS DO DRIVE ---\n' + links.data.map((l) => `[${l.setor_key}] ${l.titulo} — ${l.url}`).join('\n'));
  if (msgs.data?.length) partes.push('--- MENSAGENS RECENTES DO CHAT ---\n' + (msgs.data as any[]).reverse()
    .map((m) => `[${m.canais?.key ?? '?'}] ${m.autor?.alias ?? 'sistema'}: ${String(m.conteudo).slice(0, 140)}`).join('\n'));

  const sistema = 'Você é o assistente interno da intranet da Klava Brands. Responda a pergunta do usuário usando APENAS as informações fornecidas abaixo (base de conhecimento/wiki, tarefas, links do Drive e mensagens do chat). ' +
    'Se a resposta não estiver claramente nos dados fornecidos, diga isso diretamente — nunca invente informação. ' +
    'Priorize informações da Base de Conhecimento (Wiki) quando disponíveis, por serem mais confiáveis e oficiais. ' +
    'Sempre que possível, cite a fonte de forma natural no texto (ex: "segundo o artigo \'Nome\' da Wiki", "na tarefa #045", "no link do Drive \'Nome\'", "numa mensagem de Fulano no chat"). ' +
    `Quem pergunta é ${perfil.nome} (${perfil.alias}). Responda em português do Brasil, de forma direta, objetiva e sem formatação markdown (texto simples).\n\n` +
    partes.join('\n\n');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo, max_tokens: 700, system: sistema, messages: [{ role: 'user', content: pergunta }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpErro(502, j?.error?.message ?? `Erro HTTP ${r.status}`);
  const texto = (j.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
  return { ok: true, answer: texto };
});

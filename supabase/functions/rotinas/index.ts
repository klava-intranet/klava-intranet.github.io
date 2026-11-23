// ═══════════════════════════════════════════════════════════════════════
// rotinas — tarefas agendadas (pg_cron → esta função). Substitui os gatilhos do GS.
//   { tipo: 'prazos' }   todo dia 8h: avisa prazos em 7, 3 e 0 dias  (sendDeadlineNotifications)
//   { tipo: 'semanal' }  segunda 8h: relatório para os admins          (sendWeeklyReport)
// Protegida pelo header x-cron-secret (secret CRON_SECRET).
// ═══════════════════════════════════════════════════════════════════════
import { admin, config, dataBR, HttpErro, hojeSP, servir } from '../_shared/comum.ts';
import { enviarEmail } from '../_shared/email.ts';

const DIA = 86_400_000;
const SETORES: Record<string, string> = {
  diretoria: 'Diretoria', comercial: 'Comercial Atacado', financeiro: 'Financeiro', tesouraria: 'Tesouraria',
  design: 'Design e Projetos', logistica: 'Logística', comex: 'Importação/Comex', salesops: 'Sales Ops.', online: 'Online', novo: 'Novo',
};

function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DIA);
}

async function avisosDePrazo() {
  const dias = await config<number[]>('aviso_prazo_dias', [7, 3, 0]);
  const hoje = hojeSP();
  const { data } = await admin()
    .from('tarefas')
    .select('numero, titulo, prazo, status, responsavel:usuarios!tarefas_responsavel_id_fkey(alias, email, ativo)')
    .neq('status', 'done');
  let enviados = 0;
  for (const t of (data ?? []) as any[]) {
    const faltam = diasEntre(hoje, t.prazo);
    if (!dias.includes(faltam) || !t.responsavel?.email || !t.responsavel.ativo) continue;
    const quando = faltam === 0 ? 'vence HOJE' : `vence em ${faltam} dias`;
    await enviarEmail({
      para: [t.responsavel.email],
      assunto: faltam === 0 ? `[Klava] ⏰ Tarefa vence HOJE — ${t.numero || t.titulo}` : `[Klava] ⏰ Prazo em ${faltam} dias — ${t.numero || t.titulo}`,
      texto: `A tarefa "${t.titulo}" ${quando} (${dataBR(t.prazo)}).\n\nNúmero: ${t.numero || '—'}\n` +
        `Status atual: ${t.status === 'todo' ? 'A Fazer' : 'Em Andamento'}\n\n— Klava Brands Group`,
    });
    enviados++;
  }
  return { enviados };
}

async function relatorioSemanal() {
  const cfg = await config<{ ativo?: boolean }>('relatorio_semanal', { ativo: true });
  if (cfg.ativo === false) return { enviado: false, motivo: 'desligado em app_config' };

  const db = admin();
  const agora = Date.now();
  const semana = new Date(agora - 7 * DIA).toISOString();
  const inatividade = new Date(agora - 14 * DIA).toISOString();
  const hoje = hojeSP();

  const [{ data: tarefas }, { data: arquivos }, { data: links }, { data: admins }] = await Promise.all([
    db.from('tarefas').select('numero, titulo, prazo, status, criado_em, responsavel:usuarios!tarefas_responsavel_id_fkey(alias)'),
    db.from('drive_arquivos').select('setor_key, enviado_em').is('deleted_at', null),
    db.from('drive_links').select('setor_key, criado_em').is('deleted_at', null),
    db.from('usuarios').select('email').eq('papel', 'admin').eq('ativo', true),
  ]);

  const ts = (tarefas ?? []) as any[];
  const atrasadas = ts.filter((t) => t.status !== 'done' && t.prazo < hoje);
  const novas = ts.filter((t) => t.criado_em >= semana).length;
  const abertas = ts.filter((t) => t.status !== 'done').length;
  const concluidas = ts.length - abertas;
  const uploads = (arquivos ?? []).filter((a: any) => a.enviado_em >= semana).length;
  const linksSemana = (links ?? []).filter((l: any) => l.criado_em >= semana).length;
  const ultima: Record<string, string> = {};
  [...(arquivos ?? []).map((a: any) => [a.setor_key, a.enviado_em]), ...(links ?? []).map((l: any) => [l.setor_key, l.criado_em])]
    .forEach(([s, d]) => { if (!ultima[s] || d > ultima[s]) ultima[s] = d; });
  const parados = Object.keys(SETORES).filter((s) => !ultima[s] || ultima[s] < inatividade);

  const td = 'padding:6px 10px;border-bottom:1px solid #eee;';
  const linhas = atrasadas.slice(0, 15).map((t) =>
    `<tr><td style="${td}">#${t.numero}</td><td style="${td}">${t.titulo}</td><td style="${td}">${t.responsavel?.alias ?? ''}</td></tr>`).join('');
  const card = (n: number, rotulo: string, cor: string, fundo: string) =>
    `<td style="background:${fundo};padding:16px;text-align:center;border-radius:6px;width:33%;"><div style="font-size:28px;font-weight:bold;color:${cor};">${n}</div><div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:1px;">${rotulo}</div></td>`;

  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#333;">
    <h2 style="color:#1a1a1a;">📊 Relatório Semanal — Klava Intranet</h2>
    <p style="color:#666;">Resumo de ${dataBR(hojeSP(new Date(agora - 7 * DIA)))} a ${dataBR(hoje)}.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;"><tr>
      ${card(atrasadas.length, 'Tarefas Atrasadas', '#e05555', '#faf5f5')}<td style="width:12px;"></td>
      ${card(novas, 'Tarefas Novas', '#4caf7d', '#f5faf6')}<td style="width:12px;"></td>
      ${card(uploads + linksSemana, 'Itens no Drive', '#3b82f6', '#f5f7fa')}
    </tr></table>
    ${linhas
      ? `<h3 style="color:#1a1a1a;margin-top:24px;">⚠️ Tarefas Atrasadas</h3><table style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="background:#f5f5f5;"><th style="padding:6px 10px;text-align:left;">Nº</th><th style="padding:6px 10px;text-align:left;">Título</th><th style="padding:6px 10px;text-align:left;">Responsável</th></tr>${linhas}</table>${atrasadas.length > 15 ? `<p style="font-size:11px;color:#999;">+ ${atrasadas.length - 15} outras não listadas aqui.</p>` : ''}`
      : '<h3 style="color:#1a1a1a;margin-top:24px;">✅ Nenhuma tarefa atrasada no momento.</h3>'}
    <h3 style="color:#1a1a1a;margin-top:24px;">📁 Setores sem atividade no Drive (14+ dias)</h3>
    <p style="color:#666;">${parados.length ? parados.map((s) => SETORES[s]).join(', ') : 'Nenhum — todos os setores tiveram atividade recente 👍'}</p>
    <h3 style="color:#1a1a1a;margin-top:24px;">📈 Panorama geral</h3>
    <ul style="color:#666;"><li>${abertas} tarefas em aberto no total</li><li>${concluidas} tarefas concluídas no total</li><li>${uploads} arquivos enviados esta semana</li><li>${linksSemana} links adicionados esta semana</li></ul>
    <p style="color:#aaa;font-size:11px;margin-top:30px;border-top:1px solid #eee;padding-top:12px;">Relatório automático gerado pela Klava Intranet, toda segunda-feira.</p>
  </div>`;

  await enviarEmail({
    para: (admins ?? []).map((a: any) => a.email),
    assunto: `📊 Relatório Semanal — Klava Intranet (${dataBR(hoje)})`,
    html,
  });
  return { enviado: true, atrasadas: atrasadas.length };
}

servir(async (req, body) => {
  const segredo = Deno.env.get('CRON_SECRET');
  if (!segredo || req.headers.get('x-cron-secret') !== segredo) throw new HttpErro(401, 'Não autorizado.');
  if (body.tipo === 'prazos') return { ok: true, ...(await avisosDePrazo()) };
  if (body.tipo === 'semanal') return { ok: true, ...(await relatorioSemanal()) };
  throw new HttpErro(400, 'tipo deve ser "prazos" ou "semanal"');
});

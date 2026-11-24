/**
 * Setores → Staff: cadastro de todos os funcionários da Klava.
 * Todos veem; só admin cadastra, edita e exclui (RLS no banco).
 * O aniversariante do dia no Início (Meu Dia) sai daqui (intranet.staff_aniversariantes).
 */
import { sb } from '../lib/supabase.js';

const SETORES = ['Comercial', 'Sales Ops', 'Design', 'Financeiro', 'Tesouraria', 'On Line', 'Logística', 'Comex', 'Diretoria'];
const UNIDADES = ['RJ', 'RS', 'Remoto'];
const VINCULOS = ['CLT', 'PJ', 'Estágio', 'Temporário', 'Representante'];

const TXT = {
  pt: { abaOrg: 'Organograma', abaStaff: 'Staff', cadastrar: '+ Cadastrar', novo: 'Cadastrar funcionário', editar: 'Editar funcionário',
        nome: 'Nome completo', colNome: 'Nome', colFone: 'Telefone', apelido: 'Como é chamado', setor: 'Setor', cargo: 'Cargo', unidade: 'Unidade', vinculo: 'Vínculo',
        email: 'E-mail', telefone: 'Telefone / WhatsApp', aniversario: 'Aniversário', dia: 'Dia', mes: 'Mês', admissao: 'Data de admissão',
        ativo: 'Ativo (desmarque quando sair da empresa)', acesso: 'Acesso à intranet (entra com o e-mail acima)', novoSetor: '+ Novo setor…', nomeSetor: 'Nome do novo setor:', comAcesso: 'acessa a intranet',
        erroEmailAcesso: 'Para liberar o acesso, cadastre o e-mail (conta Google da Klava).', acessoLiberado: (a) => `Acesso liberado. Usuário: ${a}`, salvar: 'Salvar', excluir: 'Excluir cadastro', confirmaExcluir: 'Excluir o cadastro de',
        todosSetores: 'Todos os setores', todasUnid: 'Todas as unidades', buscar: 'Buscar nome, cargo, e-mail…', inativos: 'Mostrar inativos',
        pessoas: (n) => `${n} pessoa${n === 1 ? '' : 's'}`, vazio: 'Nenhum funcionário cadastrado ainda.', nada: 'Ninguém encontrado com esse filtro.',
        anivMes: 'Aniversariantes do mês', hoje: 'hoje', semAniv: 'Ninguém faz aniversário este mês.', inativo: 'inativo',
        erroNome: 'Informe o nome.', erroSetor: 'Informe o setor.', erroAniv: 'Informe dia e mês do aniversário (ou deixe os dois vazios).',
        erroData: 'Esse dia não existe nesse mês.', semAnivCad: 'Sem aniversário cadastrado', escolha: '—',
        meses: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'] },
  en: { abaOrg: 'Org chart', abaStaff: 'Staff', cadastrar: '+ Add', novo: 'Add employee', editar: 'Edit employee',
        nome: 'Full name', colNome: 'Name', colFone: 'Phone', apelido: 'Goes by', setor: 'Department', cargo: 'Role', unidade: 'Office', vinculo: 'Contract',
        email: 'E-mail', telefone: 'Phone / WhatsApp', aniversario: 'Birthday', dia: 'Day', mes: 'Month', admissao: 'Hire date',
        ativo: 'Active (uncheck when they leave)', acesso: 'Intranet access (signs in with the e-mail above)', novoSetor: '+ New department…', nomeSetor: 'New department name:', comAcesso: 'uses the intranet',
        erroEmailAcesso: 'To grant access, enter the e-mail (Klava Google account).', acessoLiberado: (a) => `Access granted. User: ${a}`, salvar: 'Save', excluir: 'Delete record', confirmaExcluir: 'Delete the record of',
        todosSetores: 'All departments', todasUnid: 'All offices', buscar: 'Search name, role, e-mail…', inativos: 'Show inactive',
        pessoas: (n) => `${n} ${n === 1 ? 'person' : 'people'}`, vazio: 'No employees yet.', nada: 'No one matches this filter.',
        anivMes: 'Birthdays this month', hoje: 'today', semAniv: 'No birthdays this month.', inativo: 'inactive',
        erroNome: 'Enter the name.', erroSetor: 'Enter the department.', erroAniv: 'Enter both day and month (or leave both empty).',
        erroData: 'That day does not exist in that month.', semAnivCad: 'No birthday on file', escolha: '—',
        meses: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
  zh: { abaOrg: '组织架构', abaStaff: '员工', cadastrar: '+ 新增', novo: '新增员工', editar: '编辑员工',
        nome: '全名', colNome: '姓名', colFone: '电话', apelido: '常用称呼', setor: '部门', cargo: '职位', unidade: '办公地点', vinculo: '合同类型',
        email: '邮箱', telefone: '电话 / WhatsApp', aniversario: '生日', dia: '日', mes: '月', admissao: '入职日期',
        ativo: '在职（离职时取消勾选）', acesso: '内网访问权限（使用上方邮箱登录）', novoSetor: '+ 新部门…', nomeSetor: '新部门名称：', comAcesso: '可访问内网',
        erroEmailAcesso: '开通访问前请先填写邮箱（Klava Google 账号）。', acessoLiberado: (a) => `已开通访问。用户名：${a}`, salvar: '保存', excluir: '删除记录', confirmaExcluir: '删除以下员工的记录',
        todosSetores: '所有部门', todasUnid: '所有地点', buscar: '搜索姓名、职位、邮箱…', inativos: '显示离职人员',
        pessoas: (n) => `${n} 人`, vazio: '暂无员工记录。', nada: '没有符合筛选条件的人员。',
        anivMes: '本月生日', hoje: '今天', semAniv: '本月没有人过生日。', inativo: '离职',
        erroNome: '请输入姓名。', erroSetor: '请输入部门。', erroAniv: '请同时填写生日的日和月（或都留空）。',
        erroData: '该月没有这一天。', semAnivCad: '未登记生日', escolha: '—',
        meses: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'] },
};

const $ = (id) => document.getElementById(id);
const lang = () => (['pt', 'en', 'zh'].includes(window.currentLang) ? window.currentLang : 'pt');
const tx = (k) => TXT[lang()][k] ?? TXT.pt[k];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).split('-').map(Number);
const ddmm = (s) => (s.aniv_dia ? `${String(s.aniv_dia).padStart(2, '0')}/${String(s.aniv_mes).padStart(2, '0')}` : '');
const iniciais = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

let perfil = null;
let lista = [];
let carregado = false;
let comAcesso = new Set();
let aba = 'org';
const filtro = { setor: '', unid: '', q: '', inativos: false };
const ehAdmin = () => perfil?.papel === 'admin';

async function carregar() {
  const [{ data, error }, acessos] = await Promise.all([
    sb.from('staff').select('*').order('nome'),
    sb.rpc('staff_com_acesso'),
  ]);
  if (error) { console.error('staff', error); return; }
  lista = data;
  comAcesso = new Set(acessos.data || []);
  carregado = true;
  render();
}

// ───────────── Tela ─────────────
function renderAbas() {
  document.querySelectorAll('#setores-abas [data-setaba]').forEach((b) => {
    b.textContent = tx(b.dataset.setaba === 'org' ? 'abaOrg' : 'abaStaff');
    b.classList.toggle('on', b.dataset.setaba === aba);
  });
  $('setores-org').hidden = aba !== 'org';
  $('setores-staff').hidden = aba !== 'staff';
  $('page-setores').classList.toggle('staff-on', aba === 'staff');
}

// uma linha da tabela (no celular cada linha vira um bloco empilhado)
function linha(s) {
  const [, hm, hd] = hojeSP();
  const ehHoje = s.ativo && s.aniv_mes === hm && s.aniv_dia === hd;
  const fone = s.telefone ? s.telefone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '') : '';
  return `<tr class="${s.ativo ? '' : 'inativo'}${ehHoje ? ' aniv-hoje' : ''}">
    <td class="stf-c-nome" data-rot="${esc(tx('colNome'))}">
      <div class="stf-nome">${esc(s.apelido || s.nome)}${s.ativo ? '' : ` <span class="stf-tag">${tx('inativo')}</span>`}</div>
      ${s.apelido ? `<div class="stf-sub">${esc(s.nome)}</div>` : ''}
      ${ehAdmin() && comAcesso.has(s.id) ? `<div class="stf-acesso">🔑 ${tx('comAcesso')}</div>` : ''}
    </td>
    <td data-rot="${esc(tx('setor'))}">${esc(s.setor)}</td>
    <td data-rot="${esc(tx('cargo'))}"${s.cargo ? '' : ' class="vazio"'}>${esc(s.cargo || '—')}</td>
    <td class="stf-c-md stf-c-unid${s.unidade ? '' : ' vazio'}" data-rot="${esc(tx('unidade'))}">${esc(s.unidade || '—')}</td>
    <td class="stf-c-lg${s.vinculo ? '' : ' vazio'}" data-rot="${esc(tx('vinculo'))}">${esc(s.vinculo || '—')}</td>
    <td class="stf-c-aniv${s.aniv_dia ? '' : ' vazio'}" data-rot="${esc(tx('aniversario'))}">${s.aniv_dia ? `🎂 ${ddmm(s)}${ehHoje ? ` <b>${tx('hoje')}</b>` : ''}` : '<span class="stf-mudo">—</span>'}</td>
    <td class="stf-c-email${s.email ? '' : ' vazio'}" data-rot="${esc(tx('email'))}">${s.email ? `<a href="mailto:${esc(s.email)}" title="${esc(s.email)}">${esc(s.email)}</a>` : '—'}</td>
    <td class="stf-c-md stf-c-fone${s.telefone ? '' : ' vazio'}" data-rot="${esc(tx('colFone'))}">${s.telefone ? `<a href="https://wa.me/55${esc(fone)}" target="_blank" rel="noopener">${esc(s.telefone)}</a>` : '—'}</td>
    ${ehAdmin() ? `<td class="stf-c-acao"><button type="button" class="cat-acao" data-stf-editar="${s.id}" title="${tx('editar')}">✏️</button></td>` : ''}
  </tr>`;
}

const ORDENS = {
  nome: (s) => normal(s.apelido || s.nome),
  setor: (s) => `${normal(s.setor)} ${normal(s.apelido || s.nome)}`,
  cargo: (s) => normal(s.cargo || '~'),
  aniversario: (s) => (s.aniv_mes ? s.aniv_mes * 100 + s.aniv_dia : 9999),
};
let ordem = { campo: 'setor', asc: true };

function render() {
  renderAbas();
  const box = $('setores-staff');
  if (aba !== 'staff' || !box) return;
  if (!carregado) { box.innerHTML = '<div class="stf-vazio">…</div>'; return; }

  const setores = [...new Set(lista.map((s) => s.setor))].sort((a, b) => a.localeCompare(b, 'pt'));
  const opt = (v, r, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(r)}</option>`;
  const q = normal(filtro.q);
  const vis = lista.filter((s) => (s.ativo || (ehAdmin() && filtro.inativos))
    && (!filtro.setor || s.setor === filtro.setor) && (!filtro.unid || s.unidade === filtro.unid)
    && (!q || normal(`${s.nome} ${s.apelido} ${s.cargo} ${s.email} ${s.setor}`).includes(q)));

  const [, hm, hd] = hojeSP();
  const doMes = lista.filter((s) => s.ativo && s.aniv_mes === hm).sort((a, b) => a.aniv_dia - b.aniv_dia);
  const anivs = doMes.length
    ? doMes.map((s) => `<span class="stf-aniv${s.aniv_dia === hd ? ' hoje' : ''}${s.aniv_dia < hd ? ' passou' : ''}">🎂 <b>${String(s.aniv_dia).padStart(2, '0')}</b> ${esc(s.apelido || s.nome)}</span>`).join('')
    : `<span class="stf-mudo">${tx('semAniv')}</span>`;

  const chave = ORDENS[ordem.campo];
  vis.sort((x, y) => { const a = chave(x), b = chave(y); return (a < b ? -1 : a > b ? 1 : 0) * (ordem.asc ? 1 : -1); });
  const th = (campo, rot, cls = '') => {
    const seta = ORDENS[campo] ? (ordem.campo === campo ? (ordem.asc ? ' ▲' : ' ▼') : '') : '';
    return `<th class="${cls}"${ORDENS[campo] ? ` data-stf-ordem="${campo}"` : ''}>${rot}${seta}</th>`;
  };
  const corpo = !lista.length ? `<div class="stf-vazio">${tx('vazio')}</div>`
    : !vis.length ? `<div class="stf-vazio">${tx('nada')}</div>`
    : `<table class="stf-tabela"><thead><tr>
        ${th('nome', tx('colNome'), 'stf-c-nome')}${th('setor', tx('setor'))}${th('cargo', tx('cargo'))}
        ${th('unidade', tx('unidade'), 'stf-c-md stf-c-unid')}${th('vinculo', tx('vinculo'), 'stf-c-lg')}${th('aniversario', tx('aniversario'), 'stf-c-aniv')}
        ${th('email', tx('email'), 'stf-c-email')}${th('telefone', tx('colFone'), 'stf-c-md stf-c-fone')}${ehAdmin() ? '<th class="stf-c-acao"></th>' : ''}
      </tr></thead><tbody>${vis.map(linha).join('')}</tbody></table>`;

  const foco = document.activeElement?.dataset?.stfFiltro;
  box.innerHTML = `
    <div class="stf-topo-barra">
      <div class="stf-total">${TXT[lang()].pessoas(lista.filter((s) => s.ativo).length)}</div>
      ${ehAdmin() ? `<button class="kanban-new-btn" data-stf-acao="novo">${tx('cadastrar')}</button>` : ''}
    </div>
    <div class="stf-anivs"><div class="stf-anivs-t">${tx('anivMes')} · ${tx('meses')[hm - 1]}</div><div class="stf-anivs-l">${anivs}</div></div>
    <div class="cat-filtros">
      <select class="channel-form-input" data-stf-filtro="setor">${opt('', tx('todosSetores'), filtro.setor)}${setores.map((s) => opt(s, s, filtro.setor)).join('')}</select>
      <select class="channel-form-input" data-stf-filtro="unid">${opt('', tx('todasUnid'), filtro.unid)}${UNIDADES.map((u) => opt(u, u, filtro.unid)).join('')}</select>
      <input type="search" class="channel-form-input" data-stf-filtro="q" value="${esc(filtro.q)}" placeholder="${esc(tx('buscar'))}">
      ${ehAdmin() ? `<label class="stf-check"><input type="checkbox" data-stf-filtro="inativos"${filtro.inativos ? ' checked' : ''}> ${tx('inativos')}</label>` : ''}
    </div>
    ${corpo}`;
  if (foco === 'q') { const i = box.querySelector('[data-stf-filtro="q"]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

// ───────────── Modal ─────────────
function abrirModal(s) {
  const r = s || { ativo: true, setor: filtro.setor || '' };
  const setores = [...new Set([...SETORES, ...lista.map((x) => x.setor)])].sort((a, b) => a.localeCompare(b, 'pt'));
  const sel = (nome, valores, atual, rot = (v) => v) => `<select class="channel-form-input" name="${nome}"><option value="">${tx('escolha')}</option>${valores.map((v) => `<option value="${esc(v)}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(rot(v))}</option>`).join('')}</select>`;
  const campo = (rot, html) => `<div class="channel-form-field"><label class="channel-form-label">${rot}</label>${html}</div>`;
  const inp = (nome, val, extra = '') => `<input class="channel-form-input" name="${nome}" value="${esc(val ?? '')}" ${extra}>`;
  fecharModal();
  const m = document.createElement('div');
  m.className = 'chat-modal open';
  m.id = 'staff-modal';
  m.innerHTML = `<div class="chat-modal-box stf-modal-box">
    <button type="button" class="chat-modal-close" data-stf-acao="fechar">×</button>
    <div class="chat-modal-title">${s ? tx('editar') : tx('novo')}</div>
    <form id="staff-form" autocomplete="off">
      <input type="hidden" name="id" value="${esc(r.id || '')}">
      ${campo(tx('nome') + ' *', inp('nome', r.nome, 'maxlength="120"'))}
      <div class="stf-g2">
        ${campo(tx('apelido'), inp('apelido', r.apelido, 'maxlength="40"'))}
        ${campo(tx('setor') + ' *', `<select class="channel-form-input" name="setor"><option value="">${tx('escolha')}</option>${setores.map((x) => `<option value="${esc(x)}"${x === r.setor ? ' selected' : ''}>${esc(x)}</option>`).join('')}<option value="__novo">${tx('novoSetor')}</option></select>`)}
      </div>
      <div class="stf-g2">
        ${campo(tx('cargo'), inp('cargo', r.cargo, 'maxlength="80"'))}
        ${campo(tx('unidade'), sel('unidade', UNIDADES, r.unidade))}
      </div>
      <div class="stf-g2">
        ${campo(tx('vinculo'), sel('vinculo', VINCULOS, r.vinculo))}
        ${campo(tx('admissao'), inp('data_admissao', r.data_admissao, 'type="date"'))}
      </div>
      <div class="stf-g2">
        ${campo(tx('email'), inp('email', r.email, 'type="email" placeholder="nome@klavabrands.com"'))}
        ${campo(tx('telefone'), inp('telefone', r.telefone, 'inputmode="tel" placeholder="(21) 99999-9999"'))}
      </div>
      ${campo(tx('aniversario'), `<div class="stf-g2">${sel('aniv_dia', Array.from({ length: 31 }, (_, i) => i + 1), r.aniv_dia, (v) => `${tx('dia')} ${v}`)}${sel('aniv_mes', Array.from({ length: 12 }, (_, i) => i + 1), r.aniv_mes, (v) => tx('meses')[v - 1])}</div>`)}
      <label class="stf-check"><input type="checkbox" name="ativo"${r.ativo ? ' checked' : ''}> ${tx('ativo')}</label>
      <label class="stf-check"><input type="checkbox" name="acesso"${s && comAcesso.has(s.id) ? ' checked' : ''}> ${tx('acesso')}</label>
      <button type="button" class="channel-create-btn" data-stf-acao="salvar">${tx('salvar')}</button>
      ${s ? `<button type="button" class="sistema-excluir-btn" data-stf-acao="excluir">${tx('excluir')}</button>` : ''}
    </form></div>`;
  document.body.appendChild(m);
  m.addEventListener('click', (e) => { if (e.target === m) fecharModal(); else cliques(e); });
  const selSetor = m.querySelector('[name=setor]');
  let anterior = selSetor.value;
  selSetor.onchange = () => {
    if (selSetor.value !== '__novo') { anterior = selSetor.value; return; }
    const novo = (prompt(tx('nomeSetor')) || '').trim().slice(0, 60);
    if (!novo) { selSetor.value = anterior; return; }
    const existe = [...selSetor.options].find((o) => o.value.toLowerCase() === novo.toLowerCase());
    if (!existe) selSetor.querySelector('option[value="__novo"]').insertAdjacentHTML('beforebegin', `<option value="${esc(novo)}">${esc(novo)}</option>`);
    selSetor.value = existe ? existe.value : novo;
    anterior = selSetor.value;
  };
  setTimeout(() => m.querySelector('[name=nome]').focus(), 50);
}
const fecharModal = () => $('staff-modal')?.remove();

async function salvar() {
  const f = $('staff-form');
  const g = (n) => f[n].value.trim();
  const reg = {
    nome: g('nome'), apelido: g('apelido') || null, setor: g('setor'), cargo: g('cargo') || null,
    unidade: g('unidade') || null, vinculo: g('vinculo') || null, data_admissao: g('data_admissao') || null,
    email: g('email') || null, telefone: g('telefone') || null,
    aniv_dia: g('aniv_dia') ? Number(g('aniv_dia')) : null, aniv_mes: g('aniv_mes') ? Number(g('aniv_mes')) : null,
    ativo: f.ativo.checked,
  };
  if (!reg.nome) return alert(tx('erroNome'));
  if (!reg.setor) return alert(tx('erroSetor'));
  if ((reg.aniv_dia == null) !== (reg.aniv_mes == null)) return alert(tx('erroAniv'));
  if (reg.aniv_dia && reg.aniv_dia > new Date(2024, reg.aniv_mes, 0).getDate()) return alert(tx('erroData'));
  const querAcesso = f.acesso.checked && reg.ativo;
  if (querAcesso && !reg.email) return alert(tx('erroEmailAcesso'));
  const btn = f.querySelector('[data-stf-acao="salvar"]');
  btn.disabled = true;
  const id = g('id');
  const r = id ? await sb.from('staff').update(reg).eq('id', id).select('id') : await sb.from('staff').insert(reg).select('id');
  btn.disabled = false;
  if (r.error || !r.data?.length) return alert('Erro: ' + (r.error?.message || 'sem permissão.'));
  const staffId = r.data[0].id;
  const tinha = comAcesso.has(staffId);
  if (querAcesso !== tinha && (querAcesso || reg.ativo)) { // inativo já perde o acesso pelo banco
    const a = await sb.rpc('staff_acesso', { p_staff: staffId, p_liberar: querAcesso });
    if (a.error) alert('Erro: ' + a.error.message);
    else if (querAcesso) alert(TXT[lang()].acessoLiberado(a.data?.alias || ''));
  }
  fecharModal();
  atualizarMeuDia();
  carregar();
}

async function excluir() {
  const f = $('staff-form');
  const s = lista.find((x) => x.id === f.id.value);
  if (!s || !confirm(`${tx('confirmaExcluir')} ${s.nome}?`)) return;
  const r = await sb.from('staff').delete().eq('id', s.id).select('id');
  if (r.error || !r.data?.length) return alert('Erro: ' + (r.error?.message || 'sem permissão.'));
  fecharModal();
  atualizarMeuDia();
  carregar();
}

// o widget "Meu Dia" do Início guarda o dia em cache: limpa para mostrar o aniversariante na hora
function atualizarMeuDia() {
  try { Object.keys(localStorage).filter((k) => /meu.?dia|myday/i.test(k)).forEach((k) => localStorage.removeItem(k)); } catch { /* sem storage */ }
  if (typeof window.loadMeuDia === 'function') window.loadMeuDia();
}

function cliques(e) {
  const t = e.target.closest('[data-stf-acao],[data-stf-editar],[data-setaba],[data-stf-ordem]');
  if (!t) return;
  if (t.dataset.stfOrdem) {
    const c = t.dataset.stfOrdem;
    ordem = { campo: c, asc: ordem.campo === c ? !ordem.asc : true };
    return render();
  }
  if (t.dataset.setaba) { aba = t.dataset.setaba; if (aba === 'staff' && !carregado) carregar(); return render(); }
  if (t.dataset.stfEditar) return abrirModal(lista.find((s) => s.id === t.dataset.stfEditar));
  switch (t.dataset.stfAcao) {
    case 'novo': return abrirModal(null);
    case 'fechar': return fecharModal();
    case 'salvar': return salvar();
    case 'excluir': return excluir();
    default:
  }
}

export function iniciarStaff(p) {
  perfil = p;
  const pag = $('page-setores');
  pag.addEventListener('click', cliques);
  let t = null;
  const filtrar = (e) => {
    const k = e.target.dataset.stfFiltro;
    if (!k) return;
    filtro[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    clearTimeout(t);
    t = setTimeout(render, k === 'q' ? 200 : 0);
  };
  pag.addEventListener('input', filtrar);
  pag.addEventListener('change', (e) => { if (e.target.type !== 'search') filtrar(e); });

  const showPage = window.showPage;
  window.showPage = function (pageId) { showPage(pageId); if (pageId === 'setores') { renderAbas(); if (aba === 'staff') carregar(); } };
  const setLanguage = window.setLanguage;
  window.setLanguage = function (l) { setLanguage(l); render(); };

  sb.channel('staff-ao-vivo')
    .on('postgres_changes', { event: '*', schema: 'intranet', table: 'staff' }, () => { if (carregado && pag.style.display !== 'none') carregar(); })
    .subscribe();
  renderAbas();
}

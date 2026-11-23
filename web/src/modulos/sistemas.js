/**
 * Tela "Sistemas Disponíveis"
 * Cards vêm da tabela intranet.sistemas. Todos veem; admins incluem, editam e excluem
 * (o banco garante isso pelo RLS — esconder o botão é só conforto visual).
 */
import { sb } from '../lib/supabase.js';

const TXT = {
  pt: { incluir: '+ Incluir', novo: 'Incluir Sistema', editar: 'Editar Sistema', salvar: 'Salvar', salvando: 'Salvando…',
        excluir: 'Excluir sistema', confirmaExcluir: 'Excluir o sistema', nome: 'Nome', url: 'Link', desc: 'Descrição',
        descEn: 'Descrição em Inglês', descZh: 'Descrição em Chinês', dica: 'Se as traduções ficarem vazias, aparece a descrição em português.',
        vazio: 'Nenhum sistema cadastrado.', erroNome: 'Informe o nome.', erroUrl: 'Informe um link começando com https://', editarTitulo: 'Editar' },
  en: { incluir: '+ Add', novo: 'Add System', editar: 'Edit System', salvar: 'Save', salvando: 'Saving…',
        excluir: 'Delete system', confirmaExcluir: 'Delete the system', nome: 'Name', url: 'Link', desc: 'Description (Portuguese)',
        descEn: 'Description in English', descZh: 'Description in Chinese', dica: 'If translations are empty, the Portuguese description is shown.',
        vazio: 'No systems registered.', erroNome: 'Enter the name.', erroUrl: 'Enter a link starting with https://', editarTitulo: 'Edit' },
  zh: { incluir: '+ 添加', novo: '添加系统', editar: '编辑系统', salvar: '保存', salvando: '保存中…',
        excluir: '删除系统', confirmaExcluir: '删除系统', nome: '名称', url: '链接', desc: '描述（葡萄牙语）',
        descEn: '英文描述', descZh: '中文描述', dica: '如果翻译为空，将显示葡萄牙语描述。',
        vazio: '暂无系统。', erroNome: '请输入名称。', erroUrl: '请输入以 https:// 开头的链接', editarTitulo: '编辑' },
};

const $ = (id) => document.getElementById(id);
const lang = () => (['pt', 'en', 'zh'].includes(window.currentLang) ? window.currentLang : 'pt');
const tx = (k) => TXT[lang()][k] ?? TXT.pt[k];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let ehAdmin = false;
let lista = [];
let carregado = false;

function descricao(s) {
  if (lang() === 'en' && s.descricao_en) return s.descricao_en;
  if (lang() === 'zh' && s.descricao_zh) return s.descricao_zh;
  return s.descricao;
}

function render() {
  const grid = $('sistemas-grid');
  if (!grid) return;
  const add = $('sistema-add-btn');
  if (add) { add.style.display = ehAdmin ? '' : 'none'; add.textContent = tx('incluir'); }

  if (!lista.length) { grid.innerHTML = `<div class="sistema-vazio">${tx('vazio')}</div>`; return; }
  grid.innerHTML = lista.map((s) => `
    <a href="${esc(s.url)}" target="_blank" rel="noopener" class="card card-sistema">
      ${ehAdmin ? `<button type="button" class="card-sistema-editar" data-id="${s.id}" title="${tx('editarTitulo')}" aria-label="${tx('editarTitulo')} ${esc(s.nome)}">✏️</button>` : ''}
      <h3>${esc(s.nome)}</h3><p>${esc(descricao(s))}</p>
    </a>`).join('');
}

async function carregar() {
  const { data, error } = await sb.from('sistemas').select('*').is('deleted_at', null).order('ordem').order('nome');
  if (error) { console.error('sistemas', error); return; }
  lista = data;
  carregado = true;
  render();
}

// ───────────── Modal ─────────────
function rotulosModal() {
  document.querySelectorAll('#sistema-form-modal [data-sis]').forEach((el) => { el.textContent = tx(el.dataset.sis); });
  $('sistema-form-excluir').textContent = tx('excluir');
}

function abrirModal(s) {
  rotulosModal();
  $('sistema-form-titulo').textContent = s ? tx('editar') : tx('novo');
  $('sistema-form-id').value = s?.id ?? '';
  $('sistema-form-nome').value = s?.nome ?? '';
  $('sistema-form-url').value = s?.url ?? 'https://';
  $('sistema-form-desc').value = s?.descricao ?? '';
  $('sistema-form-desc-en').value = s?.descricao_en ?? '';
  $('sistema-form-desc-zh').value = s?.descricao_zh ?? '';
  $('sistema-form-excluir').style.display = s ? '' : 'none';
  $('sistema-form-salvar').textContent = tx('salvar');
  $('sistema-form-modal').classList.add('open');
  setTimeout(() => $('sistema-form-nome').focus(), 50);
}
const fecharModal = () => $('sistema-form-modal').classList.remove('open');

async function salvar() {
  const id = $('sistema-form-id').value;
  const reg = {
    nome: $('sistema-form-nome').value.trim(),
    url: $('sistema-form-url').value.trim(),
    descricao: $('sistema-form-desc').value.trim(),
    descricao_en: $('sistema-form-desc-en').value.trim(),
    descricao_zh: $('sistema-form-desc-zh').value.trim(),
  };
  if (!reg.nome) return alert(tx('erroNome'));
  if (!/^https?:\/\/\S+\.\S+/i.test(reg.url)) return alert(tx('erroUrl'));

  const btn = $('sistema-form-salvar');
  btn.disabled = true; btn.textContent = tx('salvando');
  let r;
  if (id) {
    r = await sb.from('sistemas').update(reg).eq('id', id).select('id');
  } else {
    reg.ordem = Math.max(0, ...lista.map((s) => s.ordem)) + 1;
    r = await sb.from('sistemas').insert(reg).select('id');
  }
  btn.disabled = false; btn.textContent = tx('salvar');
  if (r.error || !r.data?.length) return alert('Erro: ' + (r.error?.message || 'sem permissão.'));
  fecharModal();
  carregar();
}

async function excluir() {
  const id = $('sistema-form-id').value;
  const s = lista.find((x) => x.id === id);
  if (!s || !confirm(`${tx('confirmaExcluir')} "${s.nome}"?`)) return;
  const r = await sb.from('sistemas').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id');
  if (r.error || !r.data?.length) return alert('Erro: ' + (r.error?.message || 'sem permissão.'));
  fecharModal();
  carregar();
}

// ───────────── Inicialização ─────────────
export function iniciarSistemas(perfil) {
  ehAdmin = perfil?.papel === 'admin';

  $('sistema-add-btn').onclick = () => abrirModal(null);
  $('sistema-form-fechar').onclick = fecharModal;
  $('sistema-form-salvar').onclick = salvar;
  $('sistema-form-excluir').onclick = excluir;
  $('sistema-form-modal').addEventListener('click', (e) => { if (e.target.id === 'sistema-form-modal') fecharModal(); });

  // lápis no card: edita sem abrir o link
  $('sistemas-grid').addEventListener('click', (e) => {
    const b = e.target.closest('.card-sistema-editar');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    abrirModal(lista.find((s) => s.id === b.dataset.id));
  });

  // carrega ao abrir a tela e re-renderiza ao trocar idioma
  const showPage = window.showPage;
  window.showPage = function (pageId) { showPage(pageId); if (pageId === 'sistemas') carregar(); };
  const setLanguage = window.setLanguage;
  window.setLanguage = function (l) { setLanguage(l); if (carregado) render(); };
}

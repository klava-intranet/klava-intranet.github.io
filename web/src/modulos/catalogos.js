/**
 * Tela "Catálogos" — catálogos das marcas com data de publicação.
 * Qualquer colaborador insere; quem enviou (ou admin) edita e exclui. O banco garante (RLS).
 * Arquivos no bucket privado "catalogos": ao abrir, gera um link assinado de 1 h.
 */
import { sb } from '../lib/supabase.js';
import { uploadRetomavel } from '../lib/upload-grande.js';

const LIMITE_MB = 500;
const UPLOAD_SIMPLES_MB = 6; // acima disso usa upload retomável (pedaços de 6 MB, com progresso)
const DIAS_NOVO = 15;
const MARCAS_PADRAO = ['Ecko', 'Flowfa', 'Live!', 'Oneflip', 'Varejinho'];

const TXT = {
  pt: { nav: 'Catálogos', titulo: 'Catálogos', inserir: '+ Inserir', novo: 'Inserir Catálogo', editar: 'Editar Catálogo',
        marca: 'Marca', tituloCampo: 'Título / Coleção', data: 'Data de publicação', arquivo: 'Arquivo',
        escolher: 'Escolher arquivo', trocar: 'Trocar arquivo', dicaArquivo: `PDF, imagem, PowerPoint ou ZIP — até ${LIMITE_MB} MB.`,
        salvar: 'Salvar', enviando: 'Enviando…', excluir: 'Excluir catálogo', confirmaExcluir: 'Excluir o catálogo',
        todas: 'Todas as marcas', buscar: 'Buscar catálogo…', vazio: 'Nenhum catálogo ainda. Clique em "+ Inserir" para enviar o primeiro.',
        nada: 'Nenhum catálogo encontrado com esse filtro.', publicado: 'Publicado em', publica: 'Publica em', novoSelo: 'Novo', breve: 'Em breve',
        erroMarca: 'Informe a marca.', erroData: 'Informe a data de publicação.', erroArquivo: 'Escolha o arquivo do catálogo.',
        erroTamanho: `O arquivo passa de ${LIMITE_MB} MB.`, abrindo: 'Abrindo…', semTitulo: 'Catálogo',
        fim: 'Encerramento da vigência', dicaFim: 'Deixe o encerramento vazio se o catálogo não tiver prazo.',
        erroFim: 'O encerramento não pode ser antes da publicação.', vigenteAte: 'Vigente até', encerradoEm: 'Encerrado em',
        semPrazo: 'Sem prazo de encerramento', encerrado: 'Encerrado', encerraHoje: 'Encerra hoje', encerraEm: (n) => `Encerra em ${n} dia${n > 1 ? 's' : ''}`,
        sitVigentes: 'Vigentes', sitEncerrados: 'Encerrados', sitTodos: 'Todos', nadaSituacao: 'Nenhum catálogo nesta situação.' },
  en: { nav: 'Catalogs', titulo: 'Catalogs', inserir: '+ Add', novo: 'Add Catalog', editar: 'Edit Catalog',
        marca: 'Brand', tituloCampo: 'Title / Collection', data: 'Publication date', arquivo: 'File',
        escolher: 'Choose file', trocar: 'Replace file', dicaArquivo: `PDF, image, PowerPoint or ZIP — up to ${LIMITE_MB} MB.`,
        salvar: 'Save', enviando: 'Uploading…', excluir: 'Delete catalog', confirmaExcluir: 'Delete the catalog',
        todas: 'All brands', buscar: 'Search catalogs…', vazio: 'No catalogs yet. Click "+ Add" to upload the first one.',
        nada: 'No catalogs match this filter.', publicado: 'Published on', publica: 'Publishes on', novoSelo: 'New', breve: 'Soon',
        erroMarca: 'Enter the brand.', erroData: 'Enter the publication date.', erroArquivo: 'Choose the catalog file.',
        erroTamanho: `The file exceeds ${LIMITE_MB} MB.`, abrindo: 'Opening…', semTitulo: 'Catalog',
        fim: 'Validity end date', dicaFim: 'Leave the end date empty if the catalog has no deadline.',
        erroFim: 'The end date cannot be before the publication date.', vigenteAte: 'Valid until', encerradoEm: 'Ended on',
        semPrazo: 'No end date', encerrado: 'Ended', encerraHoje: 'Ends today', encerraEm: (n) => `Ends in ${n} day${n > 1 ? 's' : ''}`,
        sitVigentes: 'Active', sitEncerrados: 'Ended', sitTodos: 'All', nadaSituacao: 'No catalogs in this status.' },
  zh: { nav: '产品目录', titulo: '产品目录', inserir: '+ 上传', novo: '上传目录', editar: '编辑目录',
        marca: '品牌', tituloCampo: '标题 / 系列', data: '发布日期', arquivo: '文件',
        escolher: '选择文件', trocar: '更换文件', dicaArquivo: `PDF、图片、PowerPoint 或 ZIP — 最大 ${LIMITE_MB} MB。`,
        salvar: '保存', enviando: '上传中…', excluir: '删除目录', confirmaExcluir: '删除目录',
        todas: '所有品牌', buscar: '搜索目录…', vazio: '暂无目录。点击"+ 上传"上传第一个。',
        nada: '没有符合筛选条件的目录。', publicado: '发布于', publica: '将于', novoSelo: '新', breve: '即将',
        erroMarca: '请输入品牌。', erroData: '请输入发布日期。', erroArquivo: '请选择目录文件。',
        erroTamanho: `文件超过 ${LIMITE_MB} MB。`, abrindo: '打开中…', semTitulo: '目录',
        fim: '有效期结束日期', dicaFim: '如目录没有期限，请留空。',
        erroFim: '结束日期不能早于发布日期。', vigenteAte: '有效期至', encerradoEm: '已于',
        semPrazo: '无结束日期', encerrado: '已结束', encerraHoje: '今天结束', encerraEm: (n) => `${n} 天后结束`,
        sitVigentes: '有效', sitEncerrados: '已结束', sitTodos: '全部', nadaSituacao: '此状态下没有目录。' },
};

const $ = (id) => document.getElementById(id);
const lang = () => (['pt', 'en', 'zh'].includes(window.currentLang) ? window.currentLang : 'pt');
const tx = (k) => TXT[lang()][k] ?? TXT.pt[k];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dataLocal = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(lang() === 'zh' ? 'zh-CN' : lang() === 'en' ? 'en-GB' : 'pt-BR');
const tamanho = (b) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let perfil = null;
let lista = [];
let carregado = false;
let arquivoNovo = null;

const ext = (nome) => (nome.split('.').pop() || '').toLowerCase();
function tipoExt(nome) {
  const e = ext(nome);
  if (['jpg', 'jpeg', 'png', 'webp'].includes(e)) return 'img';
  if (e === 'zip') return 'zip';
  if (['ppt', 'pptx'].includes(e)) return 'ppt';
  return '';
}
const DIAS_AVISO_FIM = 15;
const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
// 'breve' | 'vigente' | 'encerrado'
function situacao(c) {
  const h = hoje();
  if (c.data_encerramento && c.data_encerramento < h) return 'encerrado';
  if (c.data_publicacao > h) return 'breve';
  return 'vigente';
}
const podeEditar = (c) => perfil?.papel === 'admin' || c.enviado_por === perfil?.id;

// ───────────── Tela ─────────────
function preencherMarcas() {
  const marcas = [...new Set([...MARCAS_PADRAO, ...lista.map((c) => c.marca)])].sort((a, b) => a.localeCompare(b, 'pt'));
  $('catalogo-marcas').innerHTML = marcas.map((m) => `<option value="${esc(m)}">`).join('');
  const sel = $('catalogo-filtro-marca');
  const atual = sel.value;
  const comCatalogo = [...new Set(lista.map((c) => c.marca))].sort((a, b) => a.localeCompare(b, 'pt'));
  sel.innerHTML = `<option value="">${tx('todas')}</option>` + comCatalogo.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  sel.value = comCatalogo.includes(atual) ? atual : '';

  const sit = $('catalogo-filtro-situacao');
  const sitAtual = sit.value || 'vigentes';
  sit.innerHTML = ['vigentes', 'encerrados', 'todos']
    .map((v) => `<option value="${v}">${tx('sit' + v[0].toUpperCase() + v.slice(1))}</option>`).join('');
  sit.value = sitAtual;
}

function card(c) {
  const h = hoje();
  const sit = situacao(c);
  const futuro = sit === 'breve';
  const faltam = c.data_encerramento ? diasEntre(h, c.data_encerramento) : null;
  let selo = '';
  if (sit === 'encerrado') selo = `<span class="cat-selo encerrado">${tx('encerrado')}</span>`;
  else if (futuro) selo = `<span class="cat-selo breve">${tx('breve')}</span>`;
  else if (faltam !== null && faltam <= DIAS_AVISO_FIM) selo = `<span class="cat-selo encerra">${faltam === 0 ? tx('encerraHoje') : TXT[lang()].encerraEm(faltam)}</span>`;
  else if (diasEntre(c.data_publicacao, h) <= DIAS_NOVO) selo = `<span class="cat-selo novo">${tx('novoSelo')}</span>`;
  const vigencia = !c.data_encerramento ? tx('semPrazo')
    : `${sit === 'encerrado' ? tx('encerradoEm') : tx('vigenteAte')} ${dataLocal(c.data_encerramento)}`;
  const acoes = podeEditar(c)
    ? `<div class="cat-acoes"><button type="button" class="cat-acao" data-editar="${c.id}" title="${tx('editar')}">✏️</button></div>` : '';
  return `
    <div class="cat-card${sit === 'encerrado' ? ' cat-encerrado' : ''}" data-abrir="${c.id}" title="${esc(c.arquivo_nome)}">
      <div class="cat-card-topo">
        <div class="cat-ext ${tipoExt(c.arquivo_nome)}">${esc(ext(c.arquivo_nome).toUpperCase().slice(0, 4))}</div>
        <div class="cat-info">
          ${selo}
          <div class="cat-nome">${esc(c.titulo || `${tx('semTitulo')} ${c.marca}`)}</div>
          <div class="cat-data">${futuro ? tx('publica') : tx('publicado')} ${dataLocal(c.data_publicacao)}</div>
          <div class="cat-vigencia">${vigencia}</div>
        </div>
      </div>
      <div class="cat-rodape"><span>${tamanho(c.tamanho)}${c.autor ? ' · ' + esc(c.autor) : ''}</span>${acoes}</div>
    </div>`;
}

function render() {
  const box = $('catalogos-lista');
  if (!box) return;
  $('catalogo-add-btn').textContent = tx('inserir');
  $('catalogo-busca').placeholder = tx('buscar');
  if (!lista.length) { box.innerHTML = `<div class="drive-empty" style="margin-top:20px;">${tx('vazio')}</div>`; return; }

  const marca = $('catalogo-filtro-marca').value;
  const sit = $('catalogo-filtro-situacao').value || 'vigentes';
  const q = normal($('catalogo-busca').value.trim());
  const ordemSit = { breve: 0, vigente: 1, encerrado: 2 };
  const filtrados = lista
    .filter((c) => (!marca || c.marca === marca)
      && (sit === 'todos' || (sit === 'encerrados') === (situacao(c) === 'encerrado'))
      && (!q || normal(`${c.marca} ${c.titulo} ${c.arquivo_nome}`).includes(q)))
    .sort((a, b) => ordemSit[situacao(a)] - ordemSit[situacao(b)]); // estável: mantém publicação mais recente primeiro
  if (!filtrados.length) {
    const msg = sit !== 'todos' && !q && !marca ? tx('nadaSituacao') : tx('nada');
    box.innerHTML = `<div class="drive-empty" style="margin-top:20px;">${msg}</div>`;
    return;
  }

  const grupos = {};
  filtrados.forEach((c) => (grupos[c.marca] ||= []).push(c));
  box.innerHTML = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'pt')).map((m) => `
    <div class="section-title">${esc(m)}</div>
    <div class="cat-grid">${grupos[m].map(card).join('')}</div>`).join('');
}

async function carregar() {
  const { data, error } = await sb.from('catalogos')
    .select('*, usuarios!catalogos_enviado_por_fkey(alias)')
    .is('deleted_at', null)
    .order('data_publicacao', { ascending: false })
    .order('criado_em', { ascending: false });
  if (error) { console.error('catalogos', error); return; }
  lista = data.map((c) => ({ ...c, autor: c.usuarios?.alias || '' }));
  carregado = true;
  preencherMarcas();
  render();
}

async function abrir(id) {
  const c = lista.find((x) => x.id === id);
  if (!c) return;
  const janela = window.open('', '_blank'); // abre já (o navegador bloqueia pop-up aberto depois de esperar)
  if (janela) janela.document.write(`<p style="font-family:sans-serif;padding:24px">${tx('abrindo')}</p>`);
  const { data, error } = await sb.storage.from('catalogos').createSignedUrl(c.arquivo_path, 3600);
  if (error) { janela?.close(); return alert('Erro: ' + error.message); }
  if (janela) janela.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}

// ───────────── Modal ─────────────
function textosModal() {
  document.querySelectorAll('#catalogo-form-modal [data-cat]').forEach((el) => { el.textContent = tx(el.dataset.cat); });
  $('catalogo-form-excluir').textContent = tx('excluir');
  $('catalogo-form-salvar').textContent = tx('salvar');
}

function abrirModal(c) {
  textosModal();
  arquivoNovo = null;
  $('catalogo-form-arquivo').value = '';
  $('catalogo-form-titulo').textContent = c ? tx('editar') : tx('novo');
  $('catalogo-form-id').value = c?.id ?? '';
  $('catalogo-form-marca').value = c?.marca ?? ($('catalogo-filtro-marca').value || '');
  $('catalogo-form-nome').value = c?.titulo ?? '';
  $('catalogo-form-data').value = c?.data_publicacao ?? hoje();
  $('catalogo-form-fim').value = c?.data_encerramento ?? '';
  $('catalogo-form-arquivo-nome').textContent = c ? `${c.arquivo_nome} (${tamanho(c.tamanho)})` : '';
  $('catalogo-form-escolher').textContent = c ? tx('trocar') : tx('escolher');
  $('catalogo-form-excluir').style.display = c && podeEditar(c) ? '' : 'none';
  $('catalogo-form-modal').classList.add('open');
  setTimeout(() => $('catalogo-form-marca').focus(), 50);
}
const fecharModal = () => { if ($('catalogo-form-salvar').disabled) return; $('catalogo-form-modal').classList.remove('open'); };

function escolherArquivo(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (f.size > LIMITE_MB * 1024 * 1024) { alert(tx('erroTamanho')); e.target.value = ''; return; }
  arquivoNovo = f;
  $('catalogo-form-arquivo-nome').textContent = `${f.name} (${tamanho(f.size)})`;
}

const slug = (s) => normal(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'marca';
const nomeSeguro = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-120);

async function salvar() {
  const id = $('catalogo-form-id').value;
  const atual = lista.find((x) => x.id === id);
  const reg = {
    marca: $('catalogo-form-marca').value.trim(),
    titulo: $('catalogo-form-nome').value.trim(),
    data_publicacao: $('catalogo-form-data').value,
    data_encerramento: $('catalogo-form-fim').value || null,
  };
  if (!reg.marca) return alert(tx('erroMarca'));
  if (!reg.data_publicacao) return alert(tx('erroData'));
  if (reg.data_encerramento && reg.data_encerramento < reg.data_publicacao) return alert(tx('erroFim'));
  if (!id && !arquivoNovo) return alert(tx('erroArquivo'));

  const btn = $('catalogo-form-salvar');
  btn.disabled = true; btn.textContent = tx('enviando');
  let pathNovo = null;
  try {
    if (arquivoNovo) {
      pathNovo = `${slug(reg.marca)}/${crypto.randomUUID()}-${nomeSeguro(arquivoNovo.name)}`;
      if (arquivoNovo.size > UPLOAD_SIMPLES_MB * 1024 * 1024) {
        await uploadRetomavel('catalogos', pathNovo, arquivoNovo, (pct) => { btn.textContent = `${tx('enviando')} ${pct}%`; });
      } else {
        const up = await sb.storage.from('catalogos').upload(pathNovo, arquivoNovo, { contentType: arquivoNovo.type || undefined, upsert: false });
        if (up.error) throw new Error(up.error.message);
      }
      Object.assign(reg, { arquivo_path: pathNovo, arquivo_nome: arquivoNovo.name, mime_type: arquivoNovo.type || null, tamanho: arquivoNovo.size });
    }
    const r = id
      ? await sb.from('catalogos').update(reg).eq('id', id).select('id')
      : await sb.from('catalogos').insert(reg).select('id');
    if (r.error || !r.data?.length) throw new Error(r.error?.message || 'sem permissão.');
    if (pathNovo && atual?.arquivo_path) sb.storage.from('catalogos').remove([atual.arquivo_path]).catch(() => {});
  } catch (e) {
    if (pathNovo) sb.storage.from('catalogos').remove([pathNovo]).catch(() => {});
    btn.disabled = false; btn.textContent = tx('salvar');
    return alert('Erro: ' + e.message);
  }
  btn.disabled = false; btn.textContent = tx('salvar');
  fecharModal();
  carregar();
}

async function excluir() {
  const c = lista.find((x) => x.id === $('catalogo-form-id').value);
  if (!c || !confirm(`${tx('confirmaExcluir')} "${c.titulo || c.arquivo_nome}"?`)) return;
  const r = await sb.from('catalogos').update({ deleted_at: new Date().toISOString() }).eq('id', c.id).select('id');
  if (r.error || !r.data?.length) return alert('Erro: ' + (r.error?.message || 'sem permissão.'));
  sb.storage.from('catalogos').remove([c.arquivo_path]).catch(() => {});
  fecharModal();
  carregar();
}

// ───────────── Inicialização ─────────────
export function iniciarCatalogos(p) {
  perfil = p;

  // traduções do menu e do título (entram no dicionário do front antigo)
  ['pt', 'en', 'zh'].forEach((l) => {
    if (!window.translations?.[l]) return;
    window.translations[l]['nav-catalogs'] = TXT[l].nav;
    window.translations[l]['cat-title'] = TXT[l].titulo;
  });
  if (window.applyTranslations) window.applyTranslations(window.currentLang || 'pt');

  $('catalogo-add-btn').onclick = () => abrirModal(null);
  $('catalogo-form-fechar').onclick = fecharModal;
  $('catalogo-form-salvar').onclick = salvar;
  $('catalogo-form-excluir').onclick = excluir;
  $('catalogo-form-escolher').onclick = () => $('catalogo-form-arquivo').click();
  $('catalogo-form-arquivo').onchange = escolherArquivo;
  $('catalogo-form-modal').addEventListener('click', (e) => { if (e.target.id === 'catalogo-form-modal') fecharModal(); });
  $('catalogo-filtro-marca').onchange = render;
  $('catalogo-filtro-situacao').onchange = render;
  $('catalogo-busca').oninput = render;

  $('catalogos-lista').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-editar]');
    if (ed) { e.stopPropagation(); return abrirModal(lista.find((c) => c.id === ed.dataset.editar)); }
    const ab = e.target.closest('[data-abrir]');
    if (ab) abrir(ab.dataset.abrir);
  });

  const showPage = window.showPage;
  window.showPage = function (pageId) { showPage(pageId); if (pageId === 'catalogos') carregar(); };
  const setLanguage = window.setLanguage;
  window.setLanguage = function (l) { setLanguage(l); if (carregado) { preencherMarcas(); render(); } };

  // catálogo novo de outra pessoa aparece na hora
  sb.channel('catalogos-ao-vivo')
    .on('postgres_changes', { event: '*', schema: 'intranet', table: 'catalogos' }, () => {
      const pag = $('page-catalogos');
      if (pag && pag.style.display !== 'none') carregar();
    })
    .subscribe();
}

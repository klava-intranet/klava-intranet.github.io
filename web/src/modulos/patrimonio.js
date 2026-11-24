/**
 * Tela "Patrimônio" — inventário de equipamentos, móveis e ativos da Klava.
 *
 * Abas: Painel · Bens · Inventário · Conciliação · Cadastros (admin)
 * Acesso pela função intranet.pat_papel(): admin | inventariante | consulta | null (não vê o módulo).
 * Placas Klava: código de barras + 6 dígitos (000599). Digitar "599" vira "000599".
 * Fotos no bucket privado "patrimonio" (comprimidas para ~1100 px).
 * Histórico de movimentações é gravado pelo banco (gatilho), não pelo front.
 */
import { sb } from '../lib/supabase.js';

const TOTAL_PLACAS = 1000;
const MAX_FOTOS = 3;
const LIMITE_IMOBILIZADO = 1200; // Lucro Real: abaixo disso pode ir direto para despesa
const UNIDADES = ['RJ', 'RS', 'Terceiros'];
const CONSERVACAO = ['Novo', 'Bom', 'Regular', 'Ruim', 'Inservível'];
const SITUACOES = ['Ativo', 'Em manutenção', 'Emprestado', 'Baixado'];
const CLASSES = ['Imobilizado', 'Bem de controle'];
const TIPOS_PESSOA = ['Colaborador', 'Representante', 'Terceiro'];
const MARCAS = ['Klava', 'Ecko', 'Flowfa', 'Live!', 'Oneflip', 'Varejinho'];

// ───────────── Textos (PT/EN/ZH) ─────────────
const TXT = {
  pt: {
    nav: 'Patrimônio', titulo: 'Patrimônio',
    abaPainel: 'Painel', abaBens: 'Bens', abaInv: 'Inventário', abaConc: 'Conciliação', abaCad: 'Cadastros',
    carregando: 'Carregando…', semAcesso: 'Você não tem acesso ao Patrimônio.',
    bensAtivos: 'Bens ativos', valorAquis: 'Valor de aquisição', valorResid: 'Valor residual', placasUsadas: 'Placas usadas',
    semDoc: 'Sem documento', semFoto: 'Sem foto', porUnidade: 'Por unidade', porCategoria: 'Por categoria',
    iniciarPlaq: 'Iniciar plaquetagem', novaCamp: 'Nova campanha', lerPlaca: 'Ler placa', cadastrarBem: '+ Cadastrar bem',
    exportar: 'Exportar planilha', buscarBem: 'Buscar por placa, descrição, série…', todasUnid: 'Todas as unidades',
    todasCat: 'Todas as categorias', todasSit: 'Todas as situações', ativosSit: 'Em uso (sem baixados)',
    nenhumBem: 'Nenhum bem cadastrado ainda. Comece pela plaquetagem no Painel.', nadaFiltro: 'Nenhum bem com esse filtro.',
    fichaNova: 'Cadastrar bem', fichaEditar: 'Ficha do bem', placa: 'Placa', descricao: 'Descrição', categoria: 'Categoria',
    classe: 'Classe', fabricante: 'Fabricante', modelo: 'Modelo', serie: 'Nº de série', marcaKlava: 'Marca Klava',
    local: 'Local', responsavel: 'Responsável', centroCusto: 'Centro de custo', conservacao: 'Conservação', situacao: 'Situação',
    motivoBaixa: 'Motivo da baixa', dataAquis: 'Data de aquisição', fornecedor: 'Fornecedor', nf: 'Nº da NF',
    valor: 'Valor de aquisição (R$)', vidaUtil: 'Vida útil (anos)', taxa: 'Taxa anual (%)', garantia: 'Garantia até',
    contaContabil: 'Conta contábil', semDocCampo: 'Sem nota fiscal (valor estimado)', obs: 'Observações', fotos: 'Fotos',
    addFoto: '+ Foto', secIdent: 'Identificação', secLocal: 'Onde está', secValor: 'Aquisição e valor', historico: 'Histórico',
    salvar: 'Salvar', salvando: 'Salvando…', salvarProxima: 'Salvar e ler próxima', excluir: 'Excluir bem', escolha: '— escolha —',
    novoItem: '+ Novo…', nomeNovoLocal: 'Nome da sala / setor:', nomeNovaPessoa: 'Nome do responsável:',
    erroPlaca: 'Informe a placa.', erroDesc: 'Informe a descrição.', erroCat: 'Escolha a categoria.', erroLocal: 'Escolha o local.',
    erroBaixa: 'Informe o motivo da baixa.', placaDup: (p) => `A placa ${p} já está cadastrada. Abrindo a ficha dela.`,
    placaForaPadrao: (p) => `A placa "${p}" foge do padrão de 6 números (ex.: 000599). Salvar mesmo assim?`,
    abaixoCorte: `Valor até R$ ${LIMITE_IMOBILIZADO.toLocaleString('pt-BR')} costuma ir para despesa. Classificar como "Bem de controle"?`,
    confirmaExcluir: 'Excluir este bem definitivamente? Para bens que saíram da empresa, prefira Situação = Baixado.',
    depAcum: 'Depreciação acumulada', residual: 'Valor residual', mov: { Cadastro: 'Cadastro', 'Transferência': 'Transferência', Baixa: 'Baixa', 'Reativação': 'Reativação' },
    plaqTitulo: 'Plaquetagem', plaqEscolhaLocal: 'Em qual sala você vai colar as placas?', plaqComecar: 'Começar',
    plaqDica: 'Cole a placa, leia com a câmera e complete a ficha. A próxima ficha já vem com a sala, o responsável e a categoria da anterior.',
    plaqAtiva: (l, n) => `Plaquetagem em ${l} · ${n} cadastrado${n === 1 ? '' : 's'} nesta sessão`, plaqEncerrar: 'Encerrar plaquetagem',
    scanTitulo: 'Aponte para o código de barras da placa', scanDigite: 'ou digite o nº da placa (ex.: 599)', scanOk: 'OK',
    scanLanterna: 'Lanterna', scanFechar: 'Fechar', scanErroCam: 'Não consegui abrir a câmera. Digite o número da placa.',
    campNome: 'Nome da campanha', campUnidade: 'Unidade', campCriar: 'Abrir campanha', campAberta: 'Aberta', campEncerrada: 'Encerrada',
    campNenhuma: 'Nenhuma campanha de inventário ainda.', campVoltar: '← Campanhas', campLer: 'Ler com a câmera',
    campEncerrar: 'Encerrar campanha', campConfEncerrar: 'Encerrar a campanha? O que não foi lido vira "não encontrado".',
    esperados: 'Esperados', encontrados: 'Encontrados', divergentes: 'Local divergente', sobras: 'Sem cadastro', pendentes: 'Não lidos',
    naoEncontrados: 'Não encontrados', lidas: 'Leituras', cadastrar: 'Cadastrar', corrigirLocal: 'Abrir ficha',
    resEncontrado: 'Encontrado', resDivergente: 'Local divergente', resSobra: 'Sem cadastro', jaLida: '(já lida)',
    nada: 'Nada aqui.', concTitulo: 'Imobilizado: sistema × contabilidade', concDica: 'Informe o saldo líquido de cada conta no balancete. A diferença mostra o que falta explicar.',
    qtd: 'Qtd', saldoContabil: 'Saldo contábil', diferenca: 'Diferença', candidatosBaixa: 'Candidatos a baixa (não encontrados na última campanha encerrada)',
    semDocLista: 'Bens sem nota fiscal', cadCategorias: 'Categorias', cadLocais: 'Locais', cadPessoas: 'Responsáveis', cadEquipe: 'Equipe do patrimônio',
    adicionar: 'Adicionar', remover: 'Remover', inativar: 'Inativar', reativar: 'Reativar', inativo: 'inativo',
    equipeDica: 'Admins da intranet já têm acesso total. Inventariante cadastra bens e faz leituras; consulta só vê e exporta.',
    papelInv: 'Inventariante', papelCons: 'Consulta', usuario: 'Usuário', tipo: 'Tipo', nome: 'Nome', unidade: 'Unidade',
    salvo: 'Salvo', erro: 'Erro', ehRep: 'É um representante comercial? (OK = sim, Cancelar = colaborador)', modoConsulta: 'Modo consulta: você pode ver e exportar.',
  },
  en: {
    nav: 'Assets', titulo: 'Assets',
    abaPainel: 'Overview', abaBens: 'Assets', abaInv: 'Inventory', abaConc: 'Reconciliation', abaCad: 'Settings',
    carregando: 'Loading…', semAcesso: 'You do not have access to Assets.',
    bensAtivos: 'Active assets', valorAquis: 'Acquisition value', valorResid: 'Net book value', placasUsadas: 'Tags used',
    semDoc: 'No invoice', semFoto: 'No photo', porUnidade: 'By site', porCategoria: 'By category',
    iniciarPlaq: 'Start tagging', novaCamp: 'New count', lerPlaca: 'Scan tag', cadastrarBem: '+ Add asset',
    exportar: 'Export spreadsheet', buscarBem: 'Search tag, description, serial…', todasUnid: 'All sites',
    todasCat: 'All categories', todasSit: 'All statuses', ativosSit: 'In use (no disposals)',
    nenhumBem: 'No assets yet. Start tagging from the Overview.', nadaFiltro: 'No assets match this filter.',
    fichaNova: 'Add asset', fichaEditar: 'Asset record', placa: 'Tag', descricao: 'Description', categoria: 'Category',
    classe: 'Class', fabricante: 'Manufacturer', modelo: 'Model', serie: 'Serial no.', marcaKlava: 'Klava brand',
    local: 'Location', responsavel: 'Custodian', centroCusto: 'Cost center', conservacao: 'Condition', situacao: 'Status',
    motivoBaixa: 'Disposal reason', dataAquis: 'Acquisition date', fornecedor: 'Supplier', nf: 'Invoice no.',
    valor: 'Acquisition value (R$)', vidaUtil: 'Useful life (years)', taxa: 'Annual rate (%)', garantia: 'Warranty until',
    contaContabil: 'Ledger account', semDocCampo: 'No invoice (estimated value)', obs: 'Notes', fotos: 'Photos',
    addFoto: '+ Photo', secIdent: 'Identification', secLocal: 'Where it is', secValor: 'Acquisition and value', historico: 'History',
    salvar: 'Save', salvando: 'Saving…', salvarProxima: 'Save and scan next', excluir: 'Delete asset', escolha: '— choose —',
    novoItem: '+ New…', nomeNovoLocal: 'Room / department name:', nomeNovaPessoa: 'Custodian name:',
    erroPlaca: 'Enter the tag.', erroDesc: 'Enter the description.', erroCat: 'Choose the category.', erroLocal: 'Choose the location.',
    erroBaixa: 'Enter the disposal reason.', placaDup: (p) => `Tag ${p} is already registered. Opening its record.`,
    placaForaPadrao: (p) => `Tag "${p}" does not follow the 6-digit pattern (e.g. 000599). Save anyway?`,
    abaixoCorte: `Values up to R$ ${LIMITE_IMOBILIZADO.toLocaleString('pt-BR')} are usually expensed. Classify as "Bem de controle"?`,
    confirmaExcluir: 'Delete this asset permanently? For assets that left the company, prefer Status = Baixado.',
    depAcum: 'Accumulated depreciation', residual: 'Net book value', mov: { Cadastro: 'Created', 'Transferência': 'Transfer', Baixa: 'Disposal', 'Reativação': 'Reactivated' },
    plaqTitulo: 'Tagging', plaqEscolhaLocal: 'Which room are you tagging?', plaqComecar: 'Start',
    plaqDica: 'Stick the tag, scan it and complete the record. The next record keeps the room, custodian and category of the previous one.',
    plaqAtiva: (l, n) => `Tagging in ${l} · ${n} added this session`, plaqEncerrar: 'Stop tagging',
    scanTitulo: 'Point at the tag barcode', scanDigite: 'or type the tag number (e.g. 599)', scanOk: 'OK',
    scanLanterna: 'Flashlight', scanFechar: 'Close', scanErroCam: 'Could not open the camera. Type the tag number.',
    campNome: 'Count name', campUnidade: 'Site', campCriar: 'Open count', campAberta: 'Open', campEncerrada: 'Closed',
    campNenhuma: 'No inventory counts yet.', campVoltar: '← Counts', campLer: 'Scan with camera',
    campEncerrar: 'Close count', campConfEncerrar: 'Close this count? Anything not scanned becomes "not found".',
    esperados: 'Expected', encontrados: 'Found', divergentes: 'Wrong site', sobras: 'Not registered', pendentes: 'Not scanned',
    naoEncontrados: 'Not found', lidas: 'Scans', cadastrar: 'Register', corrigirLocal: 'Open record',
    resEncontrado: 'Found', resDivergente: 'Wrong site', resSobra: 'Not registered', jaLida: '(already scanned)',
    nada: 'Nothing here.', concTitulo: 'Fixed assets: system × accounting', concDica: 'Enter the net balance of each account from the trial balance. The difference shows what still needs explaining.',
    qtd: 'Qty', saldoContabil: 'Ledger balance', diferenca: 'Difference', candidatosBaixa: 'Disposal candidates (not found in the last closed count)',
    semDocLista: 'Assets without invoice', cadCategorias: 'Categories', cadLocais: 'Locations', cadPessoas: 'Custodians', cadEquipe: 'Assets team',
    adicionar: 'Add', remover: 'Remove', inativar: 'Deactivate', reativar: 'Reactivate', inativo: 'inactive',
    equipeDica: 'Intranet admins already have full access. Counters add assets and scan; viewers only view and export.',
    papelInv: 'Counter', papelCons: 'Viewer', usuario: 'User', tipo: 'Type', nome: 'Name', unidade: 'Site',
    salvo: 'Saved', erro: 'Error', ehRep: 'Is this a sales representative? (OK = yes, Cancel = employee)', modoConsulta: 'View mode: you can view and export.',
  },
  zh: {
    nav: '固定资产', titulo: '固定资产',
    abaPainel: '概览', abaBens: '资产', abaInv: '盘点', abaConc: '对账', abaCad: '设置',
    carregando: '加载中…', semAcesso: '您没有固定资产模块的权限。',
    bensAtivos: '在用资产', valorAquis: '购置价值', valorResid: '账面净值', placasUsadas: '已用标签',
    semDoc: '无发票', semFoto: '无照片', porUnidade: '按地点', porCategoria: '按类别',
    iniciarPlaq: '开始贴标', novaCamp: '新建盘点', lerPlaca: '扫描标签', cadastrarBem: '+ 新增资产',
    exportar: '导出表格', buscarBem: '搜索标签、描述、序列号…', todasUnid: '所有地点',
    todasCat: '所有类别', todasSit: '所有状态', ativosSit: '在用（不含报废）',
    nenhumBem: '暂无资产。请从概览页开始贴标。', nadaFiltro: '没有符合筛选条件的资产。',
    fichaNova: '新增资产', fichaEditar: '资产卡片', placa: '标签', descricao: '描述', categoria: '类别',
    classe: '分类', fabricante: '制造商', modelo: '型号', serie: '序列号', marcaKlava: 'Klava 品牌',
    local: '位置', responsavel: '保管人', centroCusto: '成本中心', conservacao: '状况', situacao: '状态',
    motivoBaixa: '报废原因', dataAquis: '购置日期', fornecedor: '供应商', nf: '发票号',
    valor: '购置价值 (R$)', vidaUtil: '使用年限', taxa: '年折旧率 (%)', garantia: '保修至',
    contaContabil: '会计科目', semDocCampo: '无发票（估值）', obs: '备注', fotos: '照片',
    addFoto: '+ 照片', secIdent: '识别信息', secLocal: '存放位置', secValor: '购置与价值', historico: '历史',
    salvar: '保存', salvando: '保存中…', salvarProxima: '保存并扫描下一个', excluir: '删除资产', escolha: '— 请选择 —',
    novoItem: '+ 新增…', nomeNovoLocal: '房间 / 部门名称：', nomeNovaPessoa: '保管人姓名：',
    erroPlaca: '请输入标签。', erroDesc: '请输入描述。', erroCat: '请选择类别。', erroLocal: '请选择位置。',
    erroBaixa: '请输入报废原因。', placaDup: (p) => `标签 ${p} 已登记，正在打开其卡片。`,
    placaForaPadrao: (p) => `标签 "${p}" 不符合 6 位数字格式（例如 000599）。仍要保存吗？`,
    abaixoCorte: `价值不超过 R$ ${LIMITE_IMOBILIZADO.toLocaleString('pt-BR')} 通常计入费用。归类为 "Bem de controle"？`,
    confirmaExcluir: '永久删除此资产？已离开公司的资产建议将状态设为 Baixado。',
    depAcum: '累计折旧', residual: '账面净值', mov: { Cadastro: '登记', 'Transferência': '转移', Baixa: '报废', 'Reativação': '重新启用' },
    plaqTitulo: '贴标', plaqEscolhaLocal: '您要在哪个房间贴标？', plaqComecar: '开始',
    plaqDica: '贴上标签，用相机扫描并填写卡片。下一张卡片会沿用上一个的房间、保管人和类别。',
    plaqAtiva: (l, n) => `正在 ${l} 贴标 · 本次已登记 ${n} 个`, plaqEncerrar: '结束贴标',
    scanTitulo: '对准标签条形码', scanDigite: '或输入标签号（例如 599）', scanOk: '确定',
    scanLanterna: '手电筒', scanFechar: '关闭', scanErroCam: '无法打开相机，请输入标签号。',
    campNome: '盘点名称', campUnidade: '地点', campCriar: '开始盘点', campAberta: '进行中', campEncerrada: '已结束',
    campNenhuma: '暂无盘点。', campVoltar: '← 盘点列表', campLer: '用相机扫描',
    campEncerrar: '结束盘点', campConfEncerrar: '结束此盘点？未扫描的资产将标记为"未找到"。',
    esperados: '应有', encontrados: '已找到', divergentes: '地点不符', sobras: '未登记', pendentes: '未扫描',
    naoEncontrados: '未找到', lidas: '扫描记录', cadastrar: '登记', corrigirLocal: '打开卡片',
    resEncontrado: '已找到', resDivergente: '地点不符', resSobra: '未登记', jaLida: '（已扫描）',
    nada: '暂无内容。', concTitulo: '固定资产：系统 × 会计', concDica: '请输入试算表中各科目的净余额，差额显示尚需解释的部分。',
    qtd: '数量', saldoContabil: '账面余额', diferenca: '差额', candidatosBaixa: '待报废（上次已结束盘点中未找到）',
    semDocLista: '无发票资产', cadCategorias: '类别', cadLocais: '位置', cadPessoas: '保管人', cadEquipe: '资产团队',
    adicionar: '添加', remover: '移除', inativar: '停用', reativar: '启用', inativo: '已停用',
    equipeDica: '内网管理员已拥有全部权限。盘点员可登记资产和扫描；查看者仅可查看和导出。',
    papelInv: '盘点员', papelCons: '查看者', usuario: '用户', tipo: '类型', nome: '名称', unidade: '地点',
    salvo: '已保存', erro: '错误', ehRep: '是销售代表吗？（确定 = 是，取消 = 员工）', modoConsulta: '查看模式：可查看和导出。',
  },
};

// ───────────── Utilidades ─────────────
const $ = (id) => document.getElementById(id);
const lang = () => (['pt', 'en', 'zh'].includes(window.currentLang) ? window.currentLang : 'pt');
const tx = (k) => TXT[lang()][k] ?? TXT.pt[k];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const locale = () => (lang() === 'zh' ? 'zh-CN' : lang() === 'en' ? 'en-GB' : 'pt-BR');
const dataBR = (iso) => (iso ? new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString(locale()) : '');
const moeda = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(/\./g, '').replace(',', '.')));
export const normPlaca = (s) => {
  const t = String(s || '').trim().toUpperCase().replace(/\s+/g, '');
  return /^\d{1,6}$/.test(t) ? t.padStart(6, '0') : t;
};
const placaOk = (s) => /^\d{6}$/.test(s);

function toast(msg, tipo = '') {
  let box = $('pat-toast');
  if (!box) { box = document.createElement('div'); box.id = 'pat-toast'; document.body.appendChild(box); }
  box.textContent = msg;
  box.className = 'pat-toast on ' + tipo;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { box.className = 'pat-toast'; }, 2600);
}
const falha = (e) => alert(`${tx('erro')}: ${e?.message || e}`);

// ───────────── Estado ─────────────
let perfil = null;
let papel = null; // admin | inventariante | consulta
const D = { categorias: [], locais: [], pessoas: [], bens: [], campanhas: [], leituras: [], equipe: [], usuarios: [] };
const UI = { aba: 'painel', campanha: null, campAba: 'lidas', filtro: { unid: '', cat: '', sit: 'ativos', q: '' } };
let plaq = null; // { local_id, responsavel_id, categoria_id, classe, n }
let carregado = false;
const fotoUrl = new Map(); // path → signed url

const podeEditar = () => papel === 'admin' || papel === 'inventariante';
const ehAdmin = () => papel === 'admin';
const byId = (t, id) => D[t].find((x) => x.id === id);
const nomeLocal = (id) => { const l = byId('locais', id); return l ? `${l.unidade} · ${l.nome}` : '—'; };
const unidadeDe = (b) => byId('locais', b.local_id)?.unidade || '';
const ativo = (b) => b.situacao !== 'Baixado';

// depreciação linear mensal (só Imobilizado), limitada ao valor de aquisição
function depreciacao(b) {
  const v = Number(b.valor_aquisicao) || 0;
  const taxa = Number(b.taxa_anual) || 0;
  if (b.classe !== 'Imobilizado' || !v || !taxa || !b.data_aquisicao) return { dep: 0, res: v };
  const [ay, am, ad] = b.data_aquisicao.split('-').map(Number);
  const [hy, hm, hd] = hoje().split('-').map(Number);
  let meses = (hy - ay) * 12 + (hm - am) - (hd < ad ? 1 : 0);
  meses = Math.max(0, meses);
  const dep = Math.min(v, (v * taxa) / 100 / 12 * meses);
  return { dep, res: v - dep };
}

// ───────────── Dados ─────────────
async function q(promessa) { const { data, error } = await promessa; if (error) throw error; return data; }
async function carregar() {
  const [categorias, locais, pessoas, bens, campanhas, leituras, equipe] = await Promise.all([
    q(sb.from('pat_categorias').select('*').order('ordem').order('nome')),
    q(sb.from('pat_locais').select('*').order('unidade').order('nome')),
    q(sb.from('pat_pessoas').select('*').order('nome')),
    q(sb.from('pat_bens').select('*').order('plaqueta')),
    q(sb.from('pat_campanhas').select('*').order('aberta_em', { ascending: false })),
    q(sb.from('pat_leituras').select('*').order('lido_em', { ascending: false })),
    q(sb.from('pat_equipe').select('*')),
  ]);
  Object.assign(D, { categorias, locais, pessoas, bens, campanhas, leituras, equipe });
  if (ehAdmin() && !D.usuarios.length) {
    D.usuarios = await q(sb.from('usuarios').select('id, alias, nome, ativo').eq('ativo', true).order('nome'));
  }
  carregado = true;
}
async function recarregar() { try { await carregar(); render(); } catch (e) { falha(e); } }

async function urlsFotos(paths) {
  const faltam = [...new Set(paths)].filter((p) => p && !fotoUrl.has(p));
  if (!faltam.length) return;
  const { data } = await sb.storage.from('patrimonio').createSignedUrls(faltam, 3600);
  (data || []).forEach((r) => { if (r.signedUrl) fotoUrl.set(r.path, r.signedUrl); });
}
function pintarFotos(raiz) {
  raiz.querySelectorAll('img[data-foto]').forEach((img) => {
    const u = fotoUrl.get(img.dataset.foto);
    if (u && img.src !== u) img.src = u;
  });
}

// ───────────── Tela principal ─────────────
function render() {
  const box = $('pat-conteudo');
  if (!box) return;
  document.querySelectorAll('#pat-abas [data-aba]').forEach((b) => {
    b.textContent = tx('aba' + { painel: 'Painel', bens: 'Bens', inventario: 'Inv', conciliacao: 'Conc', cadastros: 'Cad' }[b.dataset.aba]);
    b.classList.toggle('on', b.dataset.aba === UI.aba);
    b.hidden = b.dataset.aba === 'cadastros' && !ehAdmin();
  });
  renderPlaqBarra();
  if (!carregado) { box.innerHTML = `<div class="pat-vazio">${tx('carregando')}</div>`; return; }
  const v = { painel: vPainel, bens: vBens, inventario: vInventario, conciliacao: vConciliacao, cadastros: vCadastros }[UI.aba] || vPainel;
  box.innerHTML = v();
  pintarFotos(box);
}

function renderPlaqBarra() {
  const bar = $('pat-plaq-barra');
  if (!bar) return;
  if (!plaq) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `<span>${esc(TXT[lang()].plaqAtiva(nomeLocal(plaq.local_id), plaq.n))}</span>
    <div><button class="pat-btn" data-acao="plaq-ler">${tx('lerPlaca')}</button>
    <button class="pat-btn sec" data-acao="plaq-fim">${tx('plaqEncerrar')}</button></div>`;
}

// ───────────── Painel ─────────────
function stat(rotulo, valor, sub = '') {
  return `<div class="pat-stat"><div class="pat-stat-v">${valor}</div><div class="pat-stat-r">${rotulo}</div>${sub ? `<div class="pat-stat-s">${sub}</div>` : ''}</div>`;
}
function vPainel() {
  const at = D.bens.filter(ativo);
  const imob = at.filter((b) => b.classe === 'Imobilizado');
  const aquis = imob.reduce((s, b) => s + (Number(b.valor_aquisicao) || 0), 0);
  const resid = imob.reduce((s, b) => s + depreciacao(b).res, 0);
  const usadas = D.bens.filter((b) => placaOk(b.plaqueta)).length;
  const pct = Math.min(100, Math.round((usadas / TOTAL_PLACAS) * 100));
  const grupo = (lista, chave) => {
    const g = {};
    lista.forEach((b) => { const k = chave(b) || '—'; (g[k] ||= { n: 0, v: 0 }); g[k].n++; g[k].v += Number(b.valor_aquisicao) || 0; });
    return Object.entries(g).sort((a, b) => b[1].n - a[1].n)
      .map(([k, x]) => `<div class="pat-linha"><span>${esc(k)}</span><span>${x.n}</span><span>${moeda(x.v)}</span></div>`).join('')
      || `<div class="pat-vazio">${tx('nada')}</div>`;
  };
  const botoes = podeEditar()
    ? `<div class="pat-acoes-topo"><button class="kanban-new-btn" data-acao="plaq-iniciar">${tx('iniciarPlaq')}</button>
       <button class="pat-btn" data-acao="camp-nova">${tx('novaCamp')}</button>
       <button class="pat-btn" data-acao="ler-placa">${tx('lerPlaca')}</button></div>`
    : `<div class="pat-dica">${tx('modoConsulta')}</div>`;
  return `${botoes}
    <div class="pat-stats">
      ${stat(tx('bensAtivos'), at.length)}
      ${stat(tx('valorAquis'), moeda(aquis), 'Imobilizado')}
      ${stat(tx('valorResid'), moeda(resid), 'Imobilizado')}
      ${stat(tx('placasUsadas'), `${usadas} / ${TOTAL_PLACAS}`, `<div class="pat-barra"><div style="width:${pct}%"></div></div>`)}
      ${stat(tx('semDoc'), at.filter((b) => b.sem_documento).length)}
      ${stat(tx('semFoto'), at.filter((b) => !b.fotos?.length).length)}
    </div>
    <div class="pat-duas">
      <div><div class="section-title">${tx('porUnidade')}</div>${grupo(at, unidadeDe)}</div>
      <div><div class="section-title">${tx('porCategoria')}</div>${grupo(at, (b) => byId('categorias', b.categoria_id)?.nome)}</div>
    </div>`;
}

// ───────────── Bens ─────────────
function filtrarBens() {
  const f = UI.filtro;
  const qq = normal(f.q);
  return D.bens.filter((b) => (!f.unid || unidadeDe(b) === f.unid)
    && (!f.cat || b.categoria_id === f.cat)
    && (f.sit === '' || (f.sit === 'ativos' ? ativo(b) : b.situacao === f.sit))
    && (!qq || normal(`${b.plaqueta} ${b.descricao} ${b.serie} ${b.modelo} ${b.fabricante} ${byId('pessoas', b.responsavel_id)?.nome || ''}`).includes(qq)));
}
function itemBem(b) {
  const foto = b.fotos?.[0];
  const resp = byId('pessoas', b.responsavel_id)?.nome;
  return `<div class="pat-item${ativo(b) ? '' : ' baixado'}" data-bem="${b.id}">
    <div class="pat-thumb">${foto ? `<img data-foto="${esc(foto)}" alt="">` : '▦'}</div>
    <div class="pat-item-bd">
      <div class="pat-item-t"><b>${esc(b.plaqueta)}</b> ${esc(b.descricao)}</div>
      <div class="pat-item-s">${esc(nomeLocal(b.local_id))}${resp ? ' · ' + esc(resp) : ''}</div>
    </div>
    <div class="pat-item-rt">${b.valor_aquisicao != null ? moeda(b.valor_aquisicao) : ''}
      <span class="pat-tag ${b.situacao === 'Ativo' ? '' : 'alerta'}">${esc(b.situacao)}</span></div>
  </div>`;
}
function vBens() {
  const f = UI.filtro;
  const lista = filtrarBens();
  const vis = lista.slice(0, 300);
  queueMicrotask(async () => { await urlsFotos(vis.map((b) => b.fotos?.[0])); pintarFotos($('pat-conteudo')); });
  const opt = (v, r, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(r)}</option>`;
  return `<div class="pat-acoes-topo">
      ${podeEditar() ? `<button class="kanban-new-btn" data-acao="bem-novo">${tx('cadastrarBem')}</button>
      <button class="pat-btn" data-acao="ler-placa">${tx('lerPlaca')}</button>` : ''}
      <button class="pat-btn" data-acao="exportar">${tx('exportar')}</button></div>
    <div class="cat-filtros">
      <select class="channel-form-input" data-filtro="unid">${opt('', tx('todasUnid'), f.unid)}${UNIDADES.map((u) => opt(u, u, f.unid)).join('')}</select>
      <select class="channel-form-input" data-filtro="cat">${opt('', tx('todasCat'), f.cat)}${D.categorias.map((c) => opt(c.id, c.nome, f.cat)).join('')}</select>
      <select class="channel-form-input" data-filtro="sit">${opt('ativos', tx('ativosSit'), f.sit)}${opt('', tx('todasSit'), f.sit)}${SITUACOES.map((s) => opt(s, s, f.sit)).join('')}</select>
      <input type="search" class="channel-form-input" data-filtro="q" value="${esc(f.q)}" placeholder="${esc(tx('buscarBem'))}">
    </div>
    <div class="pat-contagem">${lista.length} · ${moeda(lista.reduce((s, b) => s + (Number(b.valor_aquisicao) || 0), 0))}</div>
    <div class="pat-lista">${!D.bens.length ? `<div class="pat-vazio">${tx('nenhumBem')}</div>`
      : !lista.length ? `<div class="pat-vazio">${tx('nadaFiltro')}</div>` : vis.map(itemBem).join('')}</div>`;
}

// ───────────── Ficha do bem ─────────────
let fichaFotos = []; // [{path?} | {file, url}]
let fichaFotosRemovidas = [];

function opts(lista, sel, rot = (x) => x, val = (x) => x, comNovo = false) {
  return `<option value="">${tx('escolha')}</option>` + lista.map((x) => `<option value="${esc(val(x))}"${val(x) === sel ? ' selected' : ''}>${esc(rot(x))}</option>`).join('')
    + (comNovo ? `<option value="__novo">${tx('novoItem')}</option>` : '');
}
function campo(rot, html, cls = '') { return `<div class="channel-form-field ${cls}"><label class="channel-form-label">${rot}</label>${html}</div>`; }
const inp = (nome, val, extra = '') => `<input class="channel-form-input" name="${nome}" value="${esc(val ?? '')}" ${extra}>`;

function abrirFicha(b, padrao = {}) {
  const novo = !b;
  const r = b || { situacao: 'Ativo', conservacao: 'Bom', classe: 'Imobilizado', fotos: [], ...padrao };
  const ro = !podeEditar();
  fichaFotos = (r.fotos || []).map((p) => ({ path: p }));
  fichaFotosRemovidas = [];
  const locaisAtivos = D.locais.filter((l) => l.ativo || l.id === r.local_id);
  const pessoasAtivas = D.pessoas.filter((p) => p.ativo || p.id === r.responsavel_id);
  const { dep, res } = depreciacao(r);
  const m = modal('pat-ficha', `
    <div class="chat-modal-title">${novo ? tx('fichaNova') : tx('fichaEditar')}${!novo ? ` · ${esc(r.plaqueta)}` : ''}</div>
    <form id="pat-ficha-form" autocomplete="off"${ro ? ' class="ro"' : ''}>
      <input type="hidden" name="id" value="${esc(r.id || '')}">
      <div class="pat-sec">${tx('secIdent')}</div>
      <div class="pat-grid2">
        ${campo(tx('placa') + ' *', `<div class="pat-placa-campo">${inp('plaqueta', r.plaqueta, 'inputmode="numeric" maxlength="20" placeholder="000599"')}
          ${ro ? '' : `<button type="button" class="pat-btn ic" data-acao="ficha-scan" title="${tx('lerPlaca')}">▥</button>`}</div>`)}
        ${campo(tx('categoria') + ' *', `<select class="channel-form-input" name="categoria_id">${opts(D.categorias.filter((c) => c.ativo || c.id === r.categoria_id), r.categoria_id, (c) => c.nome, (c) => c.id)}</select>`)}
      </div>
      ${campo(tx('descricao') + ' *', inp('descricao', r.descricao, 'maxlength="200" placeholder="Ex.: Notebook Dell Latitude 3440"'))}
      <div class="pat-grid3">
        ${campo(tx('fabricante'), inp('fabricante', r.fabricante))}
        ${campo(tx('modelo'), inp('modelo', r.modelo))}
        ${campo(tx('serie'), inp('serie', r.serie))}
      </div>
      <div class="pat-grid3">
        ${campo(tx('classe'), `<select class="channel-form-input" name="classe">${CLASSES.map((c) => `<option${c === r.classe ? ' selected' : ''}>${c}</option>`).join('')}</select>`)}
        ${campo(tx('conservacao'), `<select class="channel-form-input" name="conservacao">${CONSERVACAO.map((c) => `<option${c === r.conservacao ? ' selected' : ''}>${c}</option>`).join('')}</select>`)}
        ${campo(tx('marcaKlava'), `<input class="channel-form-input" name="marca_klava" list="pat-marcas" value="${esc(r.marca_klava || '')}"><datalist id="pat-marcas">${MARCAS.map((x) => `<option value="${x}">`).join('')}</datalist>`)}
      </div>
      ${campo(tx('fotos'), `<div class="pat-fotos" id="pat-fotos"></div>
        <input type="file" id="pat-foto-input" accept="image/*" capture="environment" hidden>`)}
      <div class="pat-sec">${tx('secLocal')}</div>
      <div class="pat-grid2">
        ${campo(tx('local') + ' *', `<select class="channel-form-input" name="local_id">${opts(locaisAtivos, r.local_id, (l) => `${l.unidade} · ${l.nome}`, (l) => l.id, !ro)}</select>`)}
        ${campo(tx('responsavel'), `<select class="channel-form-input" name="responsavel_id">${opts(pessoasAtivas, r.responsavel_id, (p) => p.tipo === 'Colaborador' ? p.nome : `${p.nome} (${p.tipo})`, (p) => p.id, !ro)}</select>`)}
      </div>
      <div class="pat-grid2">
        ${campo(tx('situacao'), `<select class="channel-form-input" name="situacao">${SITUACOES.map((s) => `<option${s === r.situacao ? ' selected' : ''}>${s}</option>`).join('')}</select>`)}
        ${campo(tx('centroCusto'), inp('centro_custo', r.centro_custo))}
      </div>
      ${campo(tx('motivoBaixa') + ' *', inp('motivo_baixa', r.motivo_baixa, 'placeholder="Venda, doação, descarte, perda, furto…"'), 'pat-baixa')}
      <div class="pat-sec">${tx('secValor')}</div>
      <div class="pat-grid3">
        ${campo(tx('dataAquis'), inp('data_aquisicao', r.data_aquisicao, 'type="date"'))}
        ${campo(tx('valor'), inp('valor_aquisicao', r.valor_aquisicao != null ? String(r.valor_aquisicao).replace('.', ',') : '', 'inputmode="decimal" placeholder="0,00"'))}
        ${campo(tx('garantia'), inp('garantia_ate', r.garantia_ate, 'type="date"'))}
      </div>
      <div class="pat-grid3">
        ${campo(tx('fornecedor'), inp('fornecedor', r.fornecedor))}
        ${campo(tx('nf'), inp('nf_numero', r.nf_numero))}
        ${campo(tx('contaContabil'), inp('conta_contabil', r.conta_contabil))}
      </div>
      <div class="pat-grid3">
        ${campo(tx('vidaUtil'), inp('vida_util_anos', r.vida_util_anos, 'inputmode="decimal"'))}
        ${campo(tx('taxa'), inp('taxa_anual', r.taxa_anual, 'inputmode="decimal"'))}
        <label class="pat-check"><input type="checkbox" name="sem_documento"${r.sem_documento ? ' checked' : ''}> ${tx('semDocCampo')}</label>
      </div>
      ${!novo && r.classe === 'Imobilizado' && r.valor_aquisicao ? `<div class="pat-dep">${tx('depAcum')}: <b>${moeda(dep)}</b> · ${tx('residual')}: <b>${moeda(res)}</b></div>` : ''}
      ${campo(tx('obs'), `<textarea class="channel-form-input" name="observacoes" rows="2">${esc(r.observacoes || '')}</textarea>`)}
      ${!novo ? `<div class="pat-sec">${tx('historico')}</div><div id="pat-historico" class="pat-historico">…</div>` : ''}
      ${ro ? '' : `<button type="button" class="channel-create-btn" data-acao="ficha-salvar">${tx('salvar')}</button>
        ${plaq && novo ? `<button type="button" class="channel-create-btn destaque" data-acao="ficha-salvar-prox">${tx('salvarProxima')}</button>` : ''}
        ${!novo && ehAdmin() ? `<button type="button" class="sistema-excluir-btn" data-acao="ficha-excluir">${tx('excluir')}</button>` : ''}`}
    </form>`, 'larga');
  const f = $('pat-ficha-form');
  if (ro) f.querySelectorAll('input,select,textarea').forEach((el) => { if (el.type !== 'hidden') el.disabled = true; });
  const mostrarBaixa = () => { m.querySelector('.pat-baixa').hidden = f.situacao.value !== 'Baixado'; };
  f.situacao.onchange = mostrarBaixa; mostrarBaixa();
  f.categoria_id.onchange = () => { // herda taxa/vida/classe/conta da categoria
    const c = byId('categorias', f.categoria_id.value);
    if (!c) return;
    f.taxa_anual.value = c.taxa_anual ?? ''; f.vida_util_anos.value = c.vida_util_anos ?? '';
    f.classe.value = c.classe_padrao; if (c.conta_contabil && !f.conta_contabil.value) f.conta_contabil.value = c.conta_contabil;
  };
  if (novo && r.categoria_id && !r.taxa_anual) f.categoria_id.onchange();
  f.plaqueta.onblur = () => { f.plaqueta.value = normPlaca(f.plaqueta.value); };
  ['local_id', 'responsavel_id'].forEach((n) => { f[n].onchange = () => novoCadastroRapido(f[n], n); });
  $('pat-foto-input').onchange = adicionarFoto;
  desenharFotos();
  if (!novo) carregarHistorico(r.id);
  if (novo && !r.plaqueta) setTimeout(() => f.plaqueta.focus(), 60);
  else if (novo) setTimeout(() => f.descricao.focus(), 60);
}

async function novoCadastroRapido(sel, nome) {
  if (sel.value !== '__novo') return;
  sel.value = '';
  try {
    if (nome === 'local_id') {
      const unid = prompt(`${tx('unidade')} (RJ, RS, Terceiros):`, 'RJ');
      if (!unid || !UNIDADES.includes(unid.trim())) return;
      const n = prompt(tx('nomeNovoLocal'));
      if (!n?.trim()) return;
      const [l] = await q(sb.from('pat_locais').insert({ unidade: unid.trim(), nome: n.trim() }).select());
      D.locais.push(l);
      sel.querySelector('option[value="__novo"]').insertAdjacentHTML('beforebegin', `<option value="${l.id}">${esc(l.unidade)} · ${esc(l.nome)}</option>`);
      sel.value = l.id;
    } else {
      const n = prompt(tx('nomeNovaPessoa'));
      if (!n?.trim()) return;
      const tipo = confirm(tx('ehRep')) ? 'Representante' : 'Colaborador';
      const [p] = await q(sb.from('pat_pessoas').insert({ nome: n.trim(), tipo }).select());
      D.pessoas.push(p);
      sel.querySelector('option[value="__novo"]').insertAdjacentHTML('beforebegin', `<option value="${p.id}">${esc(p.nome)}</option>`);
      sel.value = p.id;
    }
  } catch (e) { falha(e); }
}

async function carregarHistorico(bemId) {
  const box = $('pat-historico');
  try {
    const movs = await q(sb.from('pat_movimentacoes').select('*, usuarios(alias)').eq('bem_id', bemId).order('criado_em', { ascending: false }));
    if (!box) return;
    box.innerHTML = movs.map((m) => {
      const de = m.de_local && m.de_local !== m.para_local ? `${nomeLocal(m.de_local)} → ` : '';
      const resp = m.para_resp ? ` · ${esc(byId('pessoas', m.para_resp)?.nome || '')}` : '';
      return `<div class="pat-mov"><span>${new Date(m.criado_em).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}</span>
        <b>${esc(tx('mov')[m.tipo] || m.tipo)}</b> <span>${esc(de + nomeLocal(m.para_local))}${resp}${m.obs ? ' · ' + esc(m.obs) : ''}${m.usuarios?.alias ? ' · ' + esc(m.usuarios.alias) : ''}</span></div>`;
    }).join('') || tx('nada');
  } catch (e) { if (box) box.textContent = e.message; }
}

// fotos da ficha
async function desenharFotos() {
  const box = $('pat-fotos');
  if (!box) return;
  await urlsFotos(fichaFotos.filter((f) => f.path).map((f) => f.path));
  const ro = !podeEditar();
  box.innerHTML = fichaFotos.map((f, i) => `<div class="pat-foto"><img src="${esc(f.url || fotoUrl.get(f.path) || '')}" alt="">
      ${ro ? '' : `<button type="button" data-acao="foto-remover" data-i="${i}">×</button>`}</div>`).join('')
    + (!ro && fichaFotos.length < MAX_FOTOS ? `<button type="button" class="pat-foto add" data-acao="foto-add">${tx('addFoto')}</button>` : '');
}
async function comprimir(file, max = 1100) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob((b) => ok(b || file), 'image/jpeg', 0.8));
}
async function adicionarFoto(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || fichaFotos.length >= MAX_FOTOS) return;
  const blob = await comprimir(file);
  fichaFotos.push({ file: blob, url: URL.createObjectURL(blob) });
  desenharFotos();
}

// salvar
function lerFicha() {
  const f = $('pat-ficha-form');
  const g = (n) => f[n].value.trim();
  return {
    id: g('id'),
    reg: {
      plaqueta: normPlaca(g('plaqueta')), descricao: g('descricao'), categoria_id: g('categoria_id') || null,
      classe: g('classe'), fabricante: g('fabricante') || null, modelo: g('modelo') || null, serie: g('serie') || null,
      marca_klava: g('marca_klava') || null, local_id: g('local_id') || null, responsavel_id: g('responsavel_id') || null,
      centro_custo: g('centro_custo') || null, conservacao: g('conservacao'), situacao: g('situacao'),
      motivo_baixa: g('motivo_baixa') || null, data_aquisicao: g('data_aquisicao') || null, fornecedor: g('fornecedor') || null,
      nf_numero: g('nf_numero') || null, valor_aquisicao: num(g('valor_aquisicao')), vida_util_anos: num(g('vida_util_anos')),
      taxa_anual: num(g('taxa_anual')), garantia_ate: g('garantia_ate') || null, conta_contabil: g('conta_contabil') || null,
      sem_documento: f.sem_documento.checked, observacoes: g('observacoes') || null,
    },
  };
}
async function salvarFicha(proxima) {
  const { id, reg } = lerFicha();
  if (!reg.plaqueta) return alert(tx('erroPlaca'));
  if (!reg.descricao) return alert(tx('erroDesc'));
  if (!reg.categoria_id) return alert(tx('erroCat'));
  if (!reg.local_id) return alert(tx('erroLocal'));
  if (reg.situacao === 'Baixado' && !reg.motivo_baixa) return alert(tx('erroBaixa'));
  const dup = D.bens.find((b) => b.plaqueta === reg.plaqueta && b.id !== id);
  if (dup) { alert(TXT[lang()].placaDup(reg.plaqueta)); fecharModal('pat-ficha'); return abrirFicha(dup); }
  if (!placaOk(reg.plaqueta) && !confirm(TXT[lang()].placaForaPadrao(reg.plaqueta))) return;
  if (reg.classe === 'Imobilizado' && reg.valor_aquisicao != null && reg.valor_aquisicao <= LIMITE_IMOBILIZADO
      && confirm(tx('abaixoCorte'))) reg.classe = 'Bem de controle';

  const botoes = document.querySelectorAll('#pat-ficha [data-acao^="ficha-salvar"]');
  botoes.forEach((b) => { b.disabled = true; });
  const enviados = [];
  try {
    const fotos = [];
    for (const f of fichaFotos) {
      if (f.path) { fotos.push(f.path); continue; }
      const path = `${reg.plaqueta}/${crypto.randomUUID()}.jpg`;
      const up = await sb.storage.from('patrimonio').upload(path, f.file, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw new Error(up.error.message);
      enviados.push(path); fotos.push(path);
    }
    reg.fotos = fotos;
    const r = id
      ? await sb.from('pat_bens').update(reg).eq('id', id).select()
      : await sb.from('pat_bens').insert(reg).select();
    if (r.error || !r.data?.length) throw new Error(r.error?.message || 'sem permissão.');
    if (fichaFotosRemovidas.length) sb.storage.from('patrimonio').remove(fichaFotosRemovidas).catch(() => {});
  } catch (e) {
    if (enviados.length) sb.storage.from('patrimonio').remove(enviados).catch(() => {});
    botoes.forEach((b) => { b.disabled = false; });
    const msg = /duplicate key|pat_bens_plaqueta_key/.test(e.message) ? TXT[lang()].placaDup(reg.plaqueta) : e.message;
    return alert(`${tx('erro')}: ${msg}`);
  }
  if (plaq && !id) {
    plaq.n++; plaq.local_id = reg.local_id; plaq.responsavel_id = reg.responsavel_id;
    plaq.categoria_id = reg.categoria_id; plaq.classe = reg.classe;
  }
  fecharModal('pat-ficha');
  toast(tx('salvo'), 'ok');
  await recarregar();
  if (proxima) plaqLer();
}
async function excluirBem() {
  const { id } = lerFicha();
  const b = byId('bens', id);
  if (!b || !confirm(tx('confirmaExcluir'))) return;
  const r = await sb.from('pat_bens').delete().eq('id', id).select('id');
  if (r.error || !r.data?.length) return falha(r.error || 'sem permissão.');
  if (b.fotos?.length) sb.storage.from('patrimonio').remove(b.fotos).catch(() => {});
  fecharModal('pat-ficha');
  recarregar();
}

// ───────────── Leitor de placa (câmera) ─────────────
let leitor = null;
let ultimoCodigo = { c: '', t: 0 };
async function abrirScanner(titulo, aoLer, continuo = false) {
  const m = modal('pat-scan', `
    <div class="chat-modal-title">${esc(titulo)}</div>
    <div id="pat-scan-video" class="pat-scan-video"></div>
    <div id="pat-scan-res" class="pat-scan-res"></div>
    <div class="pat-scan-manual">
      <input class="channel-form-input" id="pat-scan-digitar" inputmode="numeric" placeholder="${esc(tx('scanDigite'))}">
      <button type="button" class="pat-btn" id="pat-scan-ok">${tx('scanOk')}</button>
      <button type="button" class="pat-btn sec" id="pat-scan-lanterna" hidden>${tx('scanLanterna')}</button>
    </div>`, 'scan', pararScanner);
  const entregar = async (codigo) => {
    const c = normPlaca(codigo);
    if (!c) return;
    const agora = Date.now();
    if (c === ultimoCodigo.c && agora - ultimoCodigo.t < 2500) return; // mesma placa ainda na frente da câmera
    ultimoCodigo = { c, t: agora };
    if (navigator.vibrate) navigator.vibrate(60);
    if (!continuo) { await pararScanner(); fecharModal('pat-scan', true); }
    aoLer(c);
  };
  const dig = $('pat-scan-digitar');
  $('pat-scan-ok').onclick = () => { const v = dig.value; dig.value = ''; ultimoCodigo = { c: '', t: 0 }; entregar(v); };
  dig.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('pat-scan-ok').click(); } };
  try {
    const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import('html5-qrcode');
    if (!m.isConnected) return;
    leitor = new Html5Qrcode('pat-scan-video', {
      verbose: false,
      formatsToSupport: [F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.EAN_13, F.EAN_8, F.QR_CODE],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    });
    await leitor.start({ facingMode: 'environment' },
      { fps: 12, qrbox: (w, h) => ({ width: Math.min(w * 0.9, 340), height: Math.min(h * 0.5, 130) }), aspectRatio: 1.333 },
      (txt) => entregar(txt), () => {});
    try {
      const caps = leitor.getRunningTrackCapabilities?.();
      if (caps?.torch) {
        const bt = $('pat-scan-lanterna'); bt.hidden = false;
        let on = false;
        bt.onclick = () => { on = !on; leitor.applyVideoConstraints({ advanced: [{ torch: on }] }).catch(() => {}); };
      }
    } catch { /* sem lanterna */ }
  } catch (e) {
    console.warn('câmera', e);
    const v = $('pat-scan-video'); if (v) v.innerHTML = `<div class="pat-vazio">${tx('scanErroCam')}</div>`;
    dig.focus();
  }
}
async function pararScanner() {
  const l = leitor; leitor = null;
  if (l) { try { if (l.isScanning) await l.stop(); l.clear(); } catch { /* já parado */ } }
}
function scanResultado(html, cls) { const r = $('pat-scan-res'); if (r) { r.className = 'pat-scan-res on ' + cls; r.innerHTML = html; } }

// ler placa avulsa: abre a ficha (ou cadastra se for nova)
function lerPlacaAvulsa() {
  abrirScanner(tx('scanTitulo'), (placa) => {
    const b = D.bens.find((x) => x.plaqueta === placa);
    if (b) abrirFicha(b); else if (podeEditar()) abrirFicha(null, { plaqueta: placa }); else toast(`${placa}: ${tx('resSobra')}`, 'erro');
  });
}

// ───────────── Plaquetagem ─────────────
function plaqIniciar() {
  const ativos = D.locais.filter((l) => l.ativo);
  modal('pat-plaq', `
    <div class="chat-modal-title">${tx('plaqTitulo')}</div>
    <div class="pat-dica">${tx('plaqDica')}</div>
    ${campo(tx('plaqEscolhaLocal'), `<select class="channel-form-input" id="pat-plaq-local">${opts(ativos, plaq?.local_id || '', (l) => `${l.unidade} · ${l.nome}`, (l) => l.id, true)}</select>`)}
    ${campo(tx('responsavel'), `<select class="channel-form-input" id="pat-plaq-resp">${opts(D.pessoas.filter((p) => p.ativo), plaq?.responsavel_id || '', (p) => p.nome, (p) => p.id)}</select>`)}
    <button type="button" class="channel-create-btn" data-acao="plaq-comecar">${tx('plaqComecar')}</button>`);
  $('pat-plaq-local').onchange = () => novoCadastroRapido($('pat-plaq-local'), 'local_id');
}
function plaqComecar() {
  const local = $('pat-plaq-local').value;
  if (!local || local === '__novo') return alert(tx('erroLocal'));
  plaq = { local_id: local, responsavel_id: $('pat-plaq-resp').value || null, categoria_id: null, classe: 'Imobilizado', n: 0 };
  fecharModal('pat-plaq');
  render();
  plaqLer();
}
function plaqLer() {
  if (!plaq) return;
  abrirScanner(`${tx('plaqTitulo')} · ${nomeLocal(plaq.local_id)}`, (placa) => {
    const b = D.bens.find((x) => x.plaqueta === placa);
    if (b) { toast(TXT[lang()].placaDup(placa)); return abrirFicha(b); }
    const cat = byId('categorias', plaq.categoria_id);
    abrirFicha(null, {
      plaqueta: placa, local_id: plaq.local_id, responsavel_id: plaq.responsavel_id, categoria_id: plaq.categoria_id,
      classe: plaq.classe, taxa_anual: cat?.taxa_anual, vida_util_anos: cat?.vida_util_anos, conta_contabil: cat?.conta_contabil,
    });
  });
}

// ───────────── Inventário (campanhas) ─────────────
function statsCamp(c) {
  const esperados = D.bens.filter((b) => ativo(b) && unidadeDe(b) === c.unidade);
  const ls = D.leituras.filter((l) => l.campanha_id === c.id);
  const lidos = new Set(ls.map((l) => l.bem_id).filter(Boolean));
  const pend = esperados.filter((b) => !lidos.has(b.id));
  return {
    esperados, ls, pend,
    enc: ls.filter((l) => l.resultado === 'encontrado'),
    div: ls.filter((l) => l.resultado === 'local_divergente'),
    sob: ls.filter((l) => l.resultado === 'sobra' && !l.bem_id),
  };
}
function vInventario() {
  if (UI.campanha) return vCampanha(byId('campanhas', UI.campanha));
  const lista = D.campanhas.map((c) => {
    const s = statsCamp(c);
    const pct = s.esperados.length ? Math.round(((s.esperados.length - s.pend.length) / s.esperados.length) * 100) : 0;
    return `<div class="pat-item" data-camp="${c.id}"><div class="pat-thumb">⌗</div>
      <div class="pat-item-bd"><div class="pat-item-t"><b>${esc(c.nome)}</b></div>
        <div class="pat-item-s">${esc(c.unidade)} · ${dataBR(c.aberta_em)}${c.encerrada_em ? ' → ' + dataBR(c.encerrada_em) : ''} · ${s.esperados.length - s.pend.length}/${s.esperados.length}</div>
        <div class="pat-barra"><div style="width:${pct}%"></div></div></div>
      <div class="pat-item-rt"><span class="pat-tag ${c.status === 'Aberta' ? 'ok' : ''}">${c.status === 'Aberta' ? tx('campAberta') : tx('campEncerrada')}</span></div></div>`;
  }).join('');
  return `${podeEditar() ? `<div class="pat-acoes-topo"><button class="kanban-new-btn" data-acao="camp-nova">${tx('novaCamp')}</button></div>` : ''}
    <div class="pat-lista">${lista || `<div class="pat-vazio">${tx('campNenhuma')}</div>`}</div>`;
}
function vCampanha(c) {
  if (!c) { UI.campanha = null; return vInventario(); }
  const s = statsCamp(c);
  const aberta = c.status === 'Aberta';
  const abas = [['lidas', tx('lidas'), s.ls.length], ['pend', aberta ? tx('pendentes') : tx('naoEncontrados'), s.pend.length],
    ['sob', tx('sobras'), s.sob.length], ['div', tx('divergentes'), s.div.length]];
  let corpo = '';
  const linhaLeitura = (l) => {
    const b = byId('bens', l.bem_id);
    const rot = { encontrado: tx('resEncontrado'), local_divergente: tx('resDivergente'), sobra: tx('resSobra') }[l.resultado];
    const cls = { encontrado: 'ok', local_divergente: 'alerta', sobra: 'erro' }[l.resultado];
    const acao = l.resultado === 'sobra' && !l.bem_id && podeEditar() && aberta
      ? `<button class="pat-btn mini" data-acao="sobra-cadastrar" data-placa="${esc(l.plaqueta)}">${tx('cadastrar')}</button>`
      : b ? `<button class="pat-btn mini" data-bem-abrir="${b.id}">${tx('corrigirLocal')}</button>` : '';
    return `<div class="pat-item"><div class="pat-item-bd"><div class="pat-item-t"><b>${esc(l.plaqueta)}</b> ${esc(b?.descricao || '')}</div>
      <div class="pat-item-s">${b ? esc(nomeLocal(b.local_id)) + ' · ' : ''}${new Date(l.lido_em).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}</div></div>
      <div class="pat-item-rt"><span class="pat-tag ${cls}">${rot}</span>${acao}</div></div>`;
  };
  if (UI.campAba === 'lidas') corpo = s.ls.map(linhaLeitura).join('');
  if (UI.campAba === 'sob') corpo = s.sob.map(linhaLeitura).join('');
  if (UI.campAba === 'div') corpo = s.div.map(linhaLeitura).join('');
  if (UI.campAba === 'pend') corpo = s.pend.map(itemBem).join('');
  return `<div class="pat-acoes-topo"><button class="pat-btn sec" data-acao="camp-voltar">${tx('campVoltar')}</button>
      ${aberta && podeEditar() ? `<button class="kanban-new-btn" data-acao="camp-ler">${tx('campLer')}</button>
      <button class="pat-btn" data-acao="camp-encerrar">${tx('campEncerrar')}</button>` : ''}</div>
    <div class="section-title" style="margin-top:0">${esc(c.nome)}${c.nome.includes(c.unidade) ? '' : ' · ' + esc(c.unidade)} · ${aberta ? tx('campAberta') : tx('campEncerrada')}</div>
    <div class="pat-stats">${stat(tx('esperados'), s.esperados.length)}${stat(tx('encontrados'), s.enc.length)}
      ${stat(aberta ? tx('pendentes') : tx('naoEncontrados'), s.pend.length)}${stat(tx('sobras'), s.sob.length)}${stat(tx('divergentes'), s.div.length)}</div>
    ${aberta && podeEditar() ? `<div class="pat-scan-manual inline"><input class="channel-form-input" id="pat-camp-digitar" inputmode="numeric" placeholder="${esc(tx('scanDigite'))}">
      <button class="pat-btn" data-acao="camp-digitar">${tx('scanOk')}</button></div>` : ''}
    <div class="pat-subabas">${abas.map(([k, r, n]) => `<button class="${UI.campAba === k ? 'on' : ''}" data-campaba="${k}">${r} (${n})</button>`).join('')}</div>
    <div class="pat-lista">${corpo || `<div class="pat-vazio">${tx('nada')}</div>`}</div>`;
}
function campNova() {
  const ano = hoje().slice(0, 4);
  modal('pat-camp', `
    <div class="chat-modal-title">${tx('novaCamp')}</div>
    ${campo(tx('campUnidade'), `<select class="channel-form-input" id="pat-camp-unid">${UNIDADES.map((u) => `<option>${u}</option>`).join('')}</select>`)}
    ${campo(tx('campNome'), `<input class="channel-form-input" id="pat-camp-nome" value="Inventário ${ano} – RJ">`)}
    <button type="button" class="channel-create-btn" data-acao="camp-criar">${tx('campCriar')}</button>`);
  $('pat-camp-unid').onchange = (e) => { $('pat-camp-nome').value = `Inventário ${ano} – ${e.target.value}`; };
}
async function campCriar() {
  const reg = { unidade: $('pat-camp-unid').value, nome: $('pat-camp-nome').value.trim() };
  if (!reg.nome) return;
  try {
    const [c] = await q(sb.from('pat_campanhas').insert(reg).select());
    fecharModal('pat-camp');
    UI.aba = 'inventario'; UI.campanha = c.id; UI.campAba = 'lidas';
    await recarregar();
  } catch (e) { falha(e); }
}
async function registrarLeitura(placa) {
  try {
    const r = await q(sb.rpc('pat_ler', { p_campanha: UI.campanha, p_plaqueta: placa }));
    const rot = { encontrado: tx('resEncontrado'), local_divergente: tx('resDivergente'), sobra: tx('resSobra') }[r.resultado];
    const cls = { encontrado: 'ok', local_divergente: 'alerta', sobra: 'erro' }[r.resultado];
    const html = `<b>${esc(r.plaqueta)}</b> · ${rot}${r.repetida ? ' ' + tx('jaLida') : ''}${r.descricao ? `<br>${esc(r.descricao)}` : ''}${r.unidade_bem && r.resultado === 'local_divergente' ? ` (${esc(r.unidade_bem)})` : ''}`;
    scanResultado(html, cls);
    if (!$('pat-scan')) toast(`${r.plaqueta} · ${rot}`, cls);
    await carregar(); render();
  } catch (e) { scanResultado(esc(e.message), 'erro'); if (!$('pat-scan')) falha(e); }
}
async function campEncerrar() {
  if (!confirm(tx('campConfEncerrar'))) return;
  try {
    await q(sb.from('pat_campanhas').update({ status: 'Encerrada', encerrada_em: new Date().toISOString() }).eq('id', UI.campanha).select('id'));
    UI.campAba = 'pend';
    recarregar();
  } catch (e) { falha(e); }
}

// ───────────── Conciliação ─────────────
function vConciliacao() {
  const imob = D.bens.filter((b) => ativo(b) && b.classe === 'Imobilizado');
  const cards = D.categorias.filter((c) => c.classe_padrao === 'Imobilizado').map((c) => {
    const bs = imob.filter((b) => b.categoria_id === c.id);
    const aq = bs.reduce((s, b) => s + (Number(b.valor_aquisicao) || 0), 0);
    const dep = bs.reduce((s, b) => s + depreciacao(b).dep, 0);
    const res = aq - dep;
    const dif = res - (Number(c.saldo_contabil) || 0);
    return `<div class="pat-conc">
      <div class="pat-conc-t">${esc(c.nome)}${c.conta_contabil ? ` <span>${esc(c.conta_contabil)}</span>` : ''}</div>
      <div class="pat-conc-l"><span>${tx('qtd')}</span><b>${bs.length}</b></div>
      <div class="pat-conc-l"><span>${tx('valorAquis')}</span><b>${moeda(aq)}</b></div>
      <div class="pat-conc-l"><span>${tx('depAcum')}</span><b>${moeda(dep)}</b></div>
      <div class="pat-conc-l"><span>${tx('residual')}</span><b>${moeda(res)}</b></div>
      <div class="pat-conc-l"><span>${tx('saldoContabil')}</span>${ehAdmin()
        ? `<input class="channel-form-input pat-saldo" data-saldo="${c.id}" inputmode="decimal" value="${String(c.saldo_contabil ?? 0).replace('.', ',')}">`
        : `<b>${moeda(c.saldo_contabil)}</b>`}</div>
      <div class="pat-conc-l dif ${Math.abs(dif) < 0.01 ? 'ok' : 'alerta'}"><span>${tx('diferenca')}</span><b>${moeda(dif)}</b></div>
    </div>`;
  }).join('');
  const candidatos = UNIDADES.map((u) => D.campanhas.find((c) => c.unidade === u && c.status === 'Encerrada'))
    .filter(Boolean).flatMap((c) => statsCamp(c).pend);
  const semDoc = D.bens.filter((b) => ativo(b) && b.sem_documento);
  return `<div class="pat-acoes-topo"><button class="pat-btn" data-acao="exportar">${tx('exportar')}</button></div>
    <div class="section-title" style="margin-top:0">${tx('concTitulo')}</div>
    <div class="pat-dica">${tx('concDica')}</div>
    <div class="pat-conc-grid">${cards}</div>
    <div class="section-title">${tx('candidatosBaixa')} (${candidatos.length})</div>
    <div class="pat-lista">${candidatos.map(itemBem).join('') || `<div class="pat-vazio">${tx('nada')}</div>`}</div>
    <div class="section-title">${tx('semDocLista')} (${semDoc.length})</div>
    <div class="pat-lista">${semDoc.map(itemBem).join('') || `<div class="pat-vazio">${tx('nada')}</div>`}</div>`;
}
async function salvarSaldo(el) {
  try {
    await q(sb.from('pat_categorias').update({ saldo_contabil: num(el.value) || 0 }).eq('id', el.dataset.saldo).select('id'));
    toast(tx('salvo'), 'ok');
    recarregar();
  } catch (e) { falha(e); }
}

// ───────────── Cadastros (admin) ─────────────
function vCadastros() {
  const cats = D.categorias.map((c) => `<div class="pat-cad-linha" data-cat="${c.id}">
      <input class="channel-form-input" data-k="nome" value="${esc(c.nome)}">
      <select class="channel-form-input" data-k="classe_padrao">${CLASSES.map((x) => `<option${x === c.classe_padrao ? ' selected' : ''}>${x}</option>`).join('')}</select>
      <input class="channel-form-input" data-k="vida_util_anos" inputmode="decimal" placeholder="${tx('vidaUtil')}" value="${esc(c.vida_util_anos ?? '')}">
      <input class="channel-form-input" data-k="taxa_anual" inputmode="decimal" placeholder="${tx('taxa')}" value="${esc(c.taxa_anual ?? '')}">
      <input class="channel-form-input" data-k="conta_contabil" placeholder="${tx('contaContabil')}" value="${esc(c.conta_contabil ?? '')}">
    </div>`).join('');
  const locais = D.locais.map((l) => `<div class="pat-item mini${l.ativo ? '' : ' baixado'}"><div class="pat-item-bd"><b>${esc(l.unidade)}</b> · ${esc(l.nome)}${l.ativo ? '' : ` (${tx('inativo')})`}</div>
      <button class="pat-btn mini" data-toggle="pat_locais" data-id="${l.id}" data-ativo="${l.ativo}">${l.ativo ? tx('inativar') : tx('reativar')}</button></div>`).join('');
  const pessoas = D.pessoas.map((p) => `<div class="pat-item mini${p.ativo ? '' : ' baixado'}"><div class="pat-item-bd">${esc(p.nome)} <span class="pat-item-s">· ${esc(p.tipo)}${p.ativo ? '' : ` (${tx('inativo')})`}</span></div>
      <button class="pat-btn mini" data-toggle="pat_pessoas" data-id="${p.id}" data-ativo="${p.ativo}">${p.ativo ? tx('inativar') : tx('reativar')}</button></div>`).join('');
  const equipe = D.equipe.map((e) => {
    const u = D.usuarios.find((x) => x.id === e.usuario_id);
    return `<div class="pat-item mini"><div class="pat-item-bd">${esc(u?.nome || e.usuario_id)} <span class="pat-item-s">· ${e.papel === 'inventariante' ? tx('papelInv') : tx('papelCons')}</span></div>
      <button class="pat-btn mini" data-equipe-rm="${e.usuario_id}">${tx('remover')}</button></div>`;
  }).join('');
  const livres = D.usuarios.filter((u) => !D.equipe.some((e) => e.usuario_id === u.id));
  return `
    <div class="section-title" style="margin-top:0">${tx('cadEquipe')}</div>
    <div class="pat-dica">${tx('equipeDica')}</div>
    <div class="pat-lista">${equipe || `<div class="pat-vazio">${tx('nada')}</div>`}</div>
    <div class="pat-cad-add"><select class="channel-form-input" id="pat-eq-user">${opts(livres, '', (u) => u.nome, (u) => u.id)}</select>
      <select class="channel-form-input" id="pat-eq-papel"><option value="inventariante">${tx('papelInv')}</option><option value="consulta">${tx('papelCons')}</option></select>
      <button class="pat-btn" data-acao="equipe-add">${tx('adicionar')}</button></div>

    <div class="section-title">${tx('cadLocais')}</div>
    <div class="pat-lista">${locais}</div>
    <div class="pat-cad-add"><select class="channel-form-input" id="pat-loc-unid">${UNIDADES.map((u) => `<option>${u}</option>`).join('')}</select>
      <input class="channel-form-input" id="pat-loc-nome" placeholder="${esc(tx('nomeNovoLocal'))}">
      <button class="pat-btn" data-acao="local-add">${tx('adicionar')}</button></div>

    <div class="section-title">${tx('cadPessoas')}</div>
    <div class="pat-lista">${pessoas}</div>
    <div class="pat-cad-add"><input class="channel-form-input" id="pat-pes-nome" placeholder="${esc(tx('nome'))}">
      <select class="channel-form-input" id="pat-pes-tipo">${TIPOS_PESSOA.map((t) => `<option>${t}</option>`).join('')}</select>
      <button class="pat-btn" data-acao="pessoa-add">${tx('adicionar')}</button></div>

    <div class="section-title">${tx('cadCategorias')}</div>
    <div class="pat-cad-cats">${cats}</div>`;
}
async function cadAcao(fn) { try { await fn(); toast(tx('salvo'), 'ok'); await recarregar(); } catch (e) { falha(e); } }

// ───────────── Exportação (CSV que o Excel abre) ─────────────
function exportar() {
  const cols = [
    ['Placa', (b) => b.plaqueta], ['Descrição', (b) => b.descricao], ['Categoria', (b) => byId('categorias', b.categoria_id)?.nome],
    ['Classe', (b) => b.classe], ['Fabricante', (b) => b.fabricante], ['Modelo', (b) => b.modelo], ['Nº série', (b) => b.serie],
    ['Marca Klava', (b) => b.marca_klava], ['Unidade', unidadeDe], ['Local', (b) => byId('locais', b.local_id)?.nome],
    ['Responsável', (b) => byId('pessoas', b.responsavel_id)?.nome], ['Centro de custo', (b) => b.centro_custo],
    ['Conservação', (b) => b.conservacao], ['Situação', (b) => b.situacao], ['Motivo baixa', (b) => b.motivo_baixa],
    ['Data aquisição', (b) => dataBR(b.data_aquisicao)], ['Fornecedor', (b) => b.fornecedor], ['NF', (b) => b.nf_numero],
    ['Sem documento', (b) => (b.sem_documento ? 'Sim' : 'Não')], ['Valor aquisição', (b) => b.valor_aquisicao],
    ['Taxa anual %', (b) => b.taxa_anual], ['Vida útil anos', (b) => b.vida_util_anos],
    ['Depreciação acumulada', (b) => depreciacao(b).dep.toFixed(2)], ['Valor residual', (b) => depreciacao(b).res.toFixed(2)],
    ['Conta contábil', (b) => b.conta_contabil], ['Garantia até', (b) => dataBR(b.garantia_ate)], ['Observações', (b) => b.observacoes],
  ];
  const cel = (v) => {
    if (v == null) return '';
    const s = typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lista = UI.aba === 'bens' ? filtrarBens() : D.bens;
  const csv = [cols.map((c) => c[0]).join(';'), ...lista.map((b) => cols.map(([, f]) => cel(f(b))).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `patrimonio-klava-${hoje()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ───────────── Modais genéricos ─────────────
const aoFechar = new Map();
function modal(id, html, cls = '', onClose = null) {
  fecharModal(id, true);
  const m = document.createElement('div');
  m.className = 'chat-modal open pat-modal';
  m.id = id;
  m.innerHTML = `<div class="chat-modal-box pat-modal-box ${cls}"><button type="button" class="chat-modal-close" data-fechar="${id}">×</button>${html}</div>`;
  document.body.appendChild(m);
  if (onClose) aoFechar.set(id, onClose);
  m.addEventListener('click', (e) => { if (e.target === m) fecharModal(id); });
  return m;
}
function fecharModal(id, silencioso = false) {
  const m = $(id);
  const cb = aoFechar.get(id); aoFechar.delete(id);
  if (cb) cb();
  if (m) m.remove();
  if (!silencioso && id === 'pat-scan' && UI.campanha) recarregar();
}

// ───────────── Eventos ─────────────
function cliques(e) {
  const t = e.target.closest('[data-acao],[data-bem],[data-camp],[data-campaba],[data-bem-abrir],[data-fechar],[data-toggle],[data-equipe-rm],[data-aba]');
  if (!t) return;
  const d = t.dataset;
  if (d.fechar) return fecharModal(d.fechar);
  if (d.aba && t.closest('#pat-abas')) { UI.aba = d.aba; UI.campanha = null; return render(); }
  if (d.bem) return abrirFicha(byId('bens', d.bem));
  if (d.bemAbrir) return abrirFicha(byId('bens', d.bemAbrir));
  if (d.camp) { UI.campanha = d.camp; UI.campAba = 'lidas'; return render(); }
  if (d.campaba) { UI.campAba = d.campaba; return render(); }
  if (d.toggle) return cadAcao(() => q(sb.from(d.toggle).update({ ativo: d.ativo !== 'true' }).eq('id', d.id).select('id')));
  if (d.equipeRm) return cadAcao(() => q(sb.from('pat_equipe').delete().eq('usuario_id', d.equipeRm).select('usuario_id')));
  switch (d.acao) {
    case 'plaq-iniciar': return plaqIniciar();
    case 'plaq-comecar': return plaqComecar();
    case 'plaq-ler': return plaqLer();
    case 'plaq-fim': plaq = null; return render();
    case 'ler-placa': return lerPlacaAvulsa();
    case 'bem-novo': return abrirFicha(null, plaq ? { local_id: plaq.local_id, responsavel_id: plaq.responsavel_id } : {});
    case 'exportar': return exportar();
    case 'ficha-salvar': return salvarFicha(false);
    case 'ficha-salvar-prox': return salvarFicha(true);
    case 'ficha-excluir': return excluirBem();
    case 'ficha-scan': {
      const f = $('pat-ficha-form');
      const box = $('pat-ficha'); box.style.display = 'none';
      return abrirScanner(tx('scanTitulo'), (c) => { f.plaqueta.value = c; box.style.display = ''; });
    }
    case 'foto-add': return $('pat-foto-input').click();
    case 'foto-remover': {
      const [f] = fichaFotos.splice(Number(d.i), 1);
      if (f?.path) fichaFotosRemovidas.push(f.path);
      return desenharFotos();
    }
    case 'camp-nova': return campNova();
    case 'camp-criar': return campCriar();
    case 'camp-voltar': UI.campanha = null; return render();
    case 'camp-ler': {
      const c = byId('campanhas', UI.campanha);
      return abrirScanner(`${c.nome}`, registrarLeitura, true);
    }
    case 'camp-digitar': { const i = $('pat-camp-digitar'); const v = i.value; i.value = ''; if (v.trim()) registrarLeitura(v); return; }
    case 'camp-encerrar': return campEncerrar();
    case 'sobra-cadastrar': {
      const c = byId('campanhas', UI.campanha);
      const local = D.locais.find((l) => l.unidade === c?.unidade && l.ativo);
      return abrirFicha(null, { plaqueta: d.placa, local_id: local?.id });
    }
    case 'equipe-add': {
      const u = $('pat-eq-user').value; if (!u) return;
      return cadAcao(() => q(sb.from('pat_equipe').insert({ usuario_id: u, papel: $('pat-eq-papel').value }).select('usuario_id')));
    }
    case 'local-add': {
      const nome = $('pat-loc-nome').value.trim(); if (!nome) return;
      return cadAcao(() => q(sb.from('pat_locais').insert({ unidade: $('pat-loc-unid').value, nome }).select('id')));
    }
    case 'pessoa-add': {
      const nome = $('pat-pes-nome').value.trim(); if (!nome) return;
      return cadAcao(() => q(sb.from('pat_pessoas').insert({ nome, tipo: $('pat-pes-tipo').value }).select('id')));
    }
    default:
  }
}
function mudancas(e) {
  const el = e.target;
  if (el.dataset.filtro) {
    UI.filtro[el.dataset.filtro] = el.value;
    if (el.dataset.filtro === 'q') { clearTimeout(mudancas.t); mudancas.t = setTimeout(() => { render(); const i = document.querySelector('[data-filtro="q"]'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }, 250); return; }
    return render();
  }
  if (el.dataset.saldo && e.type === 'change') return salvarSaldo(el);
  const linha = el.closest('[data-cat]');
  if (linha && e.type === 'change' && el.dataset.k) {
    const k = el.dataset.k;
    const v = ['vida_util_anos', 'taxa_anual'].includes(k) ? num(el.value) : el.value.trim() || (k === 'nome' ? null : null);
    if (k === 'nome' && !v) return;
    return cadAcao(() => q(sb.from('pat_categorias').update({ [k]: v }).eq('id', linha.dataset.cat).select('id')));
  }
}

// ───────────── Inicialização ─────────────
async function abrirPagina() {
  if (!papel) return;
  render();
  try { await carregar(); } catch (e) { falha(e); }
  render();
}

export async function iniciarPatrimonio(p) {
  perfil = p;
  const { data } = await sb.rpc('pat_papel');
  papel = data || null;

  ['pt', 'en', 'zh'].forEach((l) => {
    if (!window.translations?.[l]) return;
    window.translations[l]['nav-assets'] = TXT[l].nav;
    window.translations[l]['pat-title'] = TXT[l].titulo;
  });
  if (window.applyTranslations) window.applyTranslations(window.currentLang || 'pt');

  if (!papel) return; // fora da equipe: o menu continua escondido
  document.querySelectorAll('.pat-so-equipe').forEach((el) => { el.hidden = false; });

  const pag = $('page-patrimonio');
  pag.addEventListener('click', cliques);
  pag.addEventListener('input', (e) => { if (e.target.dataset.filtro === 'q') mudancas(e); });
  pag.addEventListener('change', mudancas);
  pag.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'pat-camp-digitar') { e.preventDefault(); $('pat-camp-digitar').nextElementSibling.click(); } });
  document.body.addEventListener('click', (e) => { if (e.target.closest('.pat-modal')) cliques(e); });

  const showPage = window.showPage;
  window.showPage = function (pageId) {
    showPage(pageId);
    if (pageId === 'patrimonio') { if (location.hash !== '#patrimonio') history.replaceState(null, '', '#patrimonio'); abrirPagina(); }
    else if (location.hash === '#patrimonio') history.replaceState(null, '', location.pathname + location.search);
  };
  const setLanguage = window.setLanguage;
  window.setLanguage = function (l) { setLanguage(l); if (carregado) render(); };

  // leitura ou cadastro em outro aparelho aparece aqui
  let t = null;
  sb.channel('patrimonio-ao-vivo')
    .on('postgres_changes', { event: '*', schema: 'intranet', table: 'pat_bens' }, () => agendar())
    .on('postgres_changes', { event: '*', schema: 'intranet', table: 'pat_leituras' }, () => agendar())
    .on('postgres_changes', { event: '*', schema: 'intranet', table: 'pat_campanhas' }, () => agendar())
    .subscribe();
  function agendar() {
    clearTimeout(t);
    t = setTimeout(async () => {
      if (pag.style.display === 'none' || !carregado || document.querySelector('.pat-modal #pat-ficha-form')) return;
      try { await carregar(); render(); } catch { /* tenta de novo na próxima mudança */ }
    }, 900);
  }

  // link direto (atalho no celular): .../#patrimonio
  if (location.hash === '#patrimonio') window.showPage('patrimonio');
}

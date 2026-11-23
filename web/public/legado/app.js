/* KLAVA INTRANET — JavaScript v4.2.3 — COMPLETO */

/* ═══ TEMA ═══ */
var _currentTheme='auto';
function initTheme(){ var s=localStorage.getItem('klava-theme')||'auto'; _currentTheme=s; applyTheme(s); }
function applyTheme(mode){ var body=document.body,html=document.documentElement,btn=document.getElementById('theme-toggle'),meta=document.getElementById('meta-theme-color'); if(mode==='light'){ body.classList.add('light-mode'); html.classList.remove('force-dark'); if(btn) btn.textContent='☀️'; if(meta) meta.content='#f4f4f0'; } else if(mode==='dark'){ body.classList.remove('light-mode'); html.classList.add('force-dark'); if(btn) btn.textContent='🌙'; if(meta) meta.content='#0a0a0a'; } else { body.classList.remove('light-mode'); html.classList.remove('force-dark'); var dark=window.matchMedia('(prefers-color-scheme: dark)').matches; if(btn) btn.textContent=dark?'🌙':'☀️'; if(meta) meta.content=dark?'#0a0a0a':'#f4f4f0'; } }
function toggleTheme(){ _currentTheme=_currentTheme==='auto'?'dark':_currentTheme==='dark'?'light':'auto'; localStorage.setItem('klava-theme',_currentTheme); applyTheme(_currentTheme); }
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(){ if(_currentTheme==='auto') applyTheme('auto'); });

/* ═══ PERSISTÊNCIA lastSeenMap ═══ */
function _saveLastSeenMap(){ if(!currentUserAlias) return; try{ localStorage.setItem('klava-lastseen-'+currentUserAlias,JSON.stringify(_lastSeenMap)); }catch(e){} }
function _loadLastSeenMap(){ if(!currentUserAlias) return; try{ var s=localStorage.getItem('klava-lastseen-'+currentUserAlias); if(s) _lastSeenMap=JSON.parse(s); }catch(e){} }

/* ═══ EMOJI PICKER ═══ */
var _reactions={}, _emojiPickerMsgId=null;
var _allEmojis=['👍','👎','❤️','🔥','😂','😮','😢','🎉','✅','❌','👏','🙏','💪','🤝','⚡','🚀','💡','🔔','📌','📋','✏️','🗑️','🔍','💰','📈','📉','⏰','🏆','⚠️','🛑','💬','📧','📞','🤔','😅','🥳','😎','🤩','😴','🤯','🫡','👀','🫶','💯','🆗','🆙','🆕','🔄'];
function initEmojiPicker(){ renderEmojiGrid(_allEmojis); document.addEventListener('click',function(e){ var p=document.getElementById('emoji-picker'); if(p&&p.classList.contains('open')&&!p.contains(e.target)&&!e.target.classList.contains('reaction-add-btn')){ p.classList.remove('open'); _emojiPickerMsgId=null; } }); }
function renderEmojiGrid(emojis){ var g=document.getElementById('emoji-grid'); if(!g) return; g.innerHTML=''; emojis.forEach(function(em){ var s=document.createElement('span'); s.className='emoji-opt'; s.textContent=em; s.onclick=function(){ pickEmoji(em); }; g.appendChild(s); }); }
function filterEmojis(term){ if(!term.trim()){ renderEmojiGrid(_allEmojis); return; } renderEmojiGrid(_allEmojis.filter(function(e){ return e.includes(term.trim()); })); }
function openEmojiPicker(msgId,btn){ _emojiPickerMsgId=msgId; var p=document.getElementById('emoji-picker'),s=document.getElementById('emoji-search'); if(!p) return; var r=btn.getBoundingClientRect(); p.style.left=Math.min(r.left,window.innerWidth-296)+'px'; p.style.top=(r.top-260<0?r.bottom+4:r.top-260)+'px'; if(s) s.value=''; renderEmojiGrid(_allEmojis); p.classList.add('open'); if(s) setTimeout(function(){ s.focus(); },50); }
function pickEmoji(emoji){ document.getElementById('emoji-picker').classList.remove('open'); if(!_emojiPickerMsgId||!currentUserAlias) return; toggleReaction(_emojiPickerMsgId,emoji); _emojiPickerMsgId=null; }
function toggleReaction(msgId,emoji){ if(!_reactions[msgId]) _reactions[msgId]={}; if(!_reactions[msgId][emoji]) _reactions[msgId][emoji]=[]; var list=_reactions[msgId][emoji],idx=list.indexOf(currentUserAlias); if(idx===-1) list.push(currentUserAlias); else list.splice(idx,1); if(!list.length) delete _reactions[msgId][emoji]; updateReactionBar(msgId); if(typeof google!=='undefined'&&google.script&&google.script.run) google.script.run.withFailureHandler(function(){}).saveReaction(msgId,emoji,currentUserAlias,activeChannel); }
function updateReactionBar(msgId){ var bar=document.getElementById('reactions-'+msgId); if(!bar) return; var data=_reactions[msgId]||{}; bar.innerHTML=''; Object.keys(data).forEach(function(emoji){ var list=data[emoji]; if(!list.length) return; var pill=document.createElement('span'); var reacted=list.indexOf(currentUserAlias)!==-1; pill.className='reaction-pill'+(reacted?' reacted':''); pill.title=list.join(', '); pill.onclick=function(){ toggleReaction(msgId,emoji); }; pill.innerHTML=emoji+' <span class="reaction-count">'+list.length+'</span>'; bar.appendChild(pill); }); var addBtn=document.createElement('button'); addBtn.className='reaction-add-btn'; addBtn.textContent='＋'; addBtn.title=t('reaction-add-title'); (function(mid,b){ b.onclick=function(e){ e.stopPropagation(); openEmojiPicker(mid,b); }; })(msgId,addBtn); bar.appendChild(addBtn); }
function loadReactions(){ if(!activeChannel||typeof google==='undefined') return; google.script.run.withSuccessHandler(function(data){ if(!data) return; _reactions=data; Object.keys(data).forEach(function(mid){ updateReactionBar(mid); }); }).withFailureHandler(function(){}).getReactions(activeChannel); }

/* ═══ MODAIS ═══ */
function openModal(id){ var e=document.getElementById('modal-'+id); if(e) e.classList.add('open'); }
function closeModal(id){ var e=document.getElementById('modal-'+id); if(e) e.classList.remove('open'); }
function closeModalOutside(ev,id){ var e=document.getElementById('modal-'+id); if(e&&ev.target===e) e.classList.remove('open'); }

/* ═══ GLOBAIS ═══ */
var currentUserEmail='', currentUserAlias='', _isAdmin=false;
var activeChannel='geral', lastMessageId=0, openDMs=[], pendingFile=null;
var chatPollInterval=null, reactionPollInterval=null, _taskPollTimer=null;
var _lastSeenMap={}, _unreadMap={}, _unreadTimer=null, _chatPageOpen=false;
var _notifiedChannels={}, _dmCreators={};
var _chatOldestMsgId=null, _chatHasMore=true, _chatLoadingMore=false;
var _namedChannels=[], _channelMembers=[], _channelsCreatedByMe=[];
var _editChannelKey='', _editChannelMembers=[];
var _dashLoaded=false, _dashData=null, _dashLastLoad=0, DASH_TTL_MS=120000;
var _allTasks=[], _activeFilter='todas', _taskPriority='';
var _taskPendingFiles=[], _attachCurrentId='', _kanbanSearchTerm='', _cardDetailTaskId='';
var _taskRecurrence='', _taskRecurrenceEnabled=false;
var _editTaskPriority='', _editTaskId='';
var _driveFiles={}, _driveLinks={}, _driveLoaded=false;
var _driveUploadSector=null, _driveUploadFile=null, _driveSearchTerm='';
var _driveLinkSector=null, _driveLinkType='link';
var _cdmComments={};
var knownUsers=['thiago','diego','franklin','nelia','luiz','raphael','luciano','aurea','valeria','nayanna','lethicia','tadeu','reinaldo'];
var mentionUsers=[{alias:'thiago',name:'Thiago Dal Pizzol'},{alias:'diego',name:'Diego Mariano'},{alias:'franklin',name:'Franklin Grion'},{alias:'nelia',name:'Nélia'},{alias:'luiz',name:'Luiz Otávio Monteiro'},{alias:'raphael',name:'Raphael Magalhães'},{alias:'luciano',name:'Luciano Marin'},{alias:'aurea',name:'Áurea Bezerra'},{alias:'valeria',name:'Valéria Bassi'},{alias:'nayanna',name:'Nayanna Oliveira'},{alias:'lethicia',name:'Lethicia Caglieris'},{alias:'tadeu',name:'Tadeu Ferreira'},{alias:'reinaldo',name:'Reinaldo de Oliveira'},{alias:'luiza',name:'Luiza Krull'}];
var mentionIndex=-1, mentionActive=false;

/* ═══ USUÁRIO ═══ */
function getUser(){
  if(typeof google==='undefined'||!google.script||!google.script.run){ document.getElementById('user-display').innerHTML='<span>'+t('greeting-visitor')+'</span>'; currentUserAlias='visitante'; return; }
  google.script.run
    .withSuccessHandler(function(r){
      if(!r||!r.alias||r.alias==='visitante'){ document.getElementById('user-display').innerHTML='<span>'+t('greeting-visitor')+'</span>'; currentUserAlias='visitante'; return; }
      currentUserEmail=r.email||''; currentUserAlias=r.alias;
      document.querySelector('.user-alias').innerText=currentUserAlias;
      _loadLastSeenMap();
      google.script.run
        .withSuccessHandler(function(init){
          if(!init||!init.ok){ startUnreadPolling(); loadUserChannels(); initTheme(); setTimeout(_loadDMsFromStorage,300); loadMeuDia(); startTaskNotifications(); return; }
          _isAdmin=init.isAdmin||false;
          _allTasks=init.tasks||[];
          if(init.users&&init.users.length){ _populateUserSelects(init.users); }
          if(init.channels&&init.channels.length){ _namedChannels=init.channels; _namedChannels.forEach(function(ch){ if(ch.createdBy===currentUserAlias&&_channelsCreatedByMe.indexOf(ch.key)===-1) _channelsCreatedByMe.push(ch.key); }); renderNamedChannelsSidebar(); }
          if(init.driveLinks) _driveLinks=init.driveLinks;
          startUnreadPolling(); initTheme(); setTimeout(_loadDMsFromStorage,300); loadMeuDia(); startTaskNotifications();
          if(_allTasks.length) renderKanban(_allTasks);
          google.script.run.withFailureHandler(function(){}).recordAccessLog();
        })
        .withFailureHandler(function(){ startUnreadPolling(); loadUserChannels(); initTheme(); setTimeout(_loadDMsFromStorage,300); loadMeuDia(); startTaskNotifications(); })
        .getInitialData(currentUserAlias);
    })
    .withFailureHandler(function(){ document.getElementById('user-display').innerHTML='<span>'+t('greeting-visitor')+'</span>'; currentUserAlias='visitante'; })
    .getGoogleUser();
}

function _populateUserSelects(users){
  ['task-responsavel','edit-task-responsavel'].forEach(function(selId){ var sel=document.getElementById(selId); if(!sel) return; var cur=sel.value; sel.innerHTML='<option value="">'+t('select-default')+'</option>'; users.forEach(function(u){ var o=document.createElement('option'); o.value=u; o.textContent=u; sel.appendChild(o); }); if(cur) sel.value=cur; });
  knownUsers=users;
  var knownNames={thiago:'Thiago Dal Pizzol',diego:'Diego Mariano',franklin:'Franklin Grion',nelia:'Nélia',luiz:'Luiz Otávio Monteiro',raphael:'Raphael Magalhães',luciano:'Luciano Marin',aurea:'Áurea Bezerra',valeria:'Valéria Bassi',nayanna:'Nayanna Oliveira',lethicia:'Lethicia Caglieris',tadeu:'Tadeu Ferreira',reinaldo:'Reinaldo de Oliveira',luiza:'Luiza Krull'};
  mentionUsers=users.map(function(a){ return {alias:a,name:knownNames[a]||a}; });
}

/* ═══ i18n ═══ */
function localeTag(lang){ lang=lang||currentLang; return lang==='zh'?'zh-CN':lang==='en'?'en-GB':'pt-BR'; }
var currentLang=(function(){ try{ var s=localStorage.getItem('klava-lang'); if(s==='en'||s==='zh'||s==='pt') return s; }catch(e){} return 'pt'; })();
function t(k){ return (translations[currentLang]&&translations[currentLang][k]!==undefined)?translations[currentLang][k]:((translations.pt&&translations.pt[k]!==undefined)?translations.pt[k]:k); }
function applyTranslations(lang){
  document.querySelectorAll('[data-i18n]').forEach(function(el){ var k=el.getAttribute('data-i18n'); if(translations[lang]&&translations[lang][k]!==undefined) el.innerHTML=translations[lang][k]; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){ var k=el.getAttribute('data-i18n-placeholder'); if(translations[lang]&&translations[lang][k]!==undefined) el.setAttribute('placeholder',translations[lang][k]); });
  document.querySelectorAll('[data-i18n-title]').forEach(function(el){ var k=el.getAttribute('data-i18n-title'); if(translations[lang]&&translations[lang][k]!==undefined) el.setAttribute('title',translations[lang][k]); });
}
function setLanguage(lang){
  currentLang=lang;
  try{ localStorage.setItem('klava-lang',lang); }catch(e){}
  var htmlEl=document.documentElement; if(htmlEl) htmlEl.setAttribute('lang',localeTag(lang));
  document.querySelectorAll('.lang-btn').forEach(function(b){ b.classList.remove('active'); });
  var activeBtn=document.getElementById('btn-'+lang); if(activeBtn) activeBtn.classList.add('active');
  applyTranslations(lang);
  cwLoadToday(); _cwUpdateLabel();
  if(_allTasks.length) renderKanban(_allTasks);
  DRIVE_SECTORS=getDriveSectors(); if(_driveLoaded) renderDriveSectors();
  if(_dashData) renderDashboard(_dashData); else if(_dashLoaded){ _dashLoaded=false; initDashboard(); }
  if(typeof _namedChannels!=='undefined'&&_namedChannels.length) renderNamedChannelsSidebar();
  if(typeof _contactsLoaded!=='undefined'&&_contactsLoaded) renderContatos();
  if(typeof _wikiLoaded!=='undefined'&&_wikiLoaded) renderWiki();
  if(_lastMeuDiaData) renderMeuDia(_lastMeuDiaData);
  if(typeof _chatPageOpen!=='undefined'&&_chatPageOpen){
    var subEl=document.getElementById('chat-ch-sub');
    if(subEl) subEl.textContent=(activeChannel.indexOf('dm:')===0)?t('chat-direct-message-sub'):t('chat-team-channel-sub');
    var emptyMsgEl=document.querySelector('#chat-messages .chat-empty span:last-child');
    if(emptyMsgEl) emptyMsgEl.textContent=t('chat-empty');
  }
  if(typeof _cardDetailTaskId!=='undefined'&&_cardDetailTaskId){
    var openModalEl=document.getElementById('card-detail-modal');
    if(openModalEl&&openModalEl.classList.contains('open')){ var curTask=_allTasks.find(function(x){ return x.id===_cardDetailTaskId; }); if(curTask) populateCardDetail(curTask); }
  }
}

var translations={
  pt:{"greeting-hi":"OLÁ","greeting-visitor":"OLÁ, VISITANTE","nav-home":"Início","nav-sectors":"Setores","nav-drive":"Drive","nav-systems":"Sistemas","nav-bi":"BIs e Dashboards","nav-dashboard":"Dashboard","nav-tasks":"Tarefas","nav-contact":"Contato","nav-chat":"Chat","theme-toggle-title":"Alternar tema","apps-hub-title":"Apps","hero-title":"Construindo<br>marcas que<br><em>importam</em>","hero-subtitle":"Bem-vindo à central de inteligência da Klava.","cw-title":"Câmbio","cw-loading":"carregando...","cw-history":"Histórico 7 dias","cw-source":"Fonte: AwesomeAPI · cotação comercial","cw-updated-prefix":"atualizado","cw-unavailable":"não foi possível carregar","cw-today-suffix":"hoje","sectors-title":"Setores","dept-comercial":"COMERCIAL","dept-salesops":"SALES OPS.","dept-design":"DESIGN","dept-financeiro":"FINANCEIRO","dept-tesouraria":"TESOURARIA","dept-online":"ON LINE","dept-novo":"NOVO","dept-logistica":"LOGÍSTICA","item-atacado-live":"Atacado Live!","item-atacado-ecko":"Atacado Ecko","item-atacado-flowfa":"Atacado Flowfa","item-pos-venda":"Pós Venda","item-estoque-virtual":"Estoque Virtual","item-dashboards":"Dashboards","item-criacao":"Criação","item-projetos":"Projetos","item-contas":"Contas a Receber/Pagar","item-cobranca":"Cobrança","item-fluxo":"Fluxo de Caixa","item-dre":"DRE / Relatórios","item-conciliacao":"Conciliação","item-exec-financeira":"Execução Financeira","item-folha":"Folha de Pgto","item-flowfa-online":"Flowfa on line","item-marketing":"Marketing","item-branding":"Branding","item-marketplace":"Marketplace","item-trafego":"Tráfego","item-frete":"Frete","item-estoque-fisico2":"Estoque Físico","item-log-reversa2":"Logística Reversa","dept-projetos":"PROJETOS","item-collabs":"Collabs","item-criativos":"Criativos","item-estoque-fisico":"Estoque Físico","item-log-reversa":"Logística Reversa","item-private-label":"Private Label","item-repasses":"Repasses","drive-title":"Arquivos e Documentos","drive-search-placeholder":"Buscar arquivo…","drive-add-link":"+ Link","drive-upload-btn":"+ Enviar arquivo","drive-upload-submit-btn":"Enviar Arquivo","drive-uploading-dots":"Enviando…","drive-btn-open":"Abrir","drive-btn-delete":"Excluir","drive-btn-remove-link":"Remover link","drive-no-links":"Nenhum link adicionado","drive-no-files":"Nenhum arquivo enviado ainda","drive-subsection-files":"Arquivos","drive-loading":"Carregando arquivos…","drive-error":"Erro ao carregar.","sec-diretoria":"Diretoria","sec-comercial":"Comercial Atacado","sec-financeiro":"Financeiro","sec-tesouraria":"Tesouraria","sec-design":"Design e Projetos","sec-logistica":"Logística","sec-comex":"Importação / Comex","sec-salesops-label":"Sales Ops.","sec-online":"Online","sec-novo":"Novo","drive-upload-modal-title-default":"📁 Enviar Arquivo","drive-upload-modal-title-to":"📁 Enviar para","drive-file-label":"Arquivo","drive-file-max":"(máx. 30 MB)","drive-drop-label":"Clique para selecionar ou arraste aqui","drive-desc-label":"Descrição","optional-label":"(opcional)","drive-desc-placeholder":"Ex: Relatório mensal…","drive-uploading-progress":"Enviando arquivo para o Drive…","drive-link-modal-title-default":"🔗 Adicionar Link","drive-link-modal-title-to":"🔗 Adicionar Link —","drive-link-title-label":"Título","drive-link-title-placeholder":"Ex: LIVE Total…","drive-link-url-label":"URL","drive-link-url-placeholder":"https://docs.google.com/…","drive-link-sub-label":"Subtítulo","drive-link-sub-placeholder":"Ex: Planilha, Dashboard…","drive-link-type-label":"Tipo","link-type-sheet":"📊 Planilha","link-type-doc":"📝 Documento","link-type-dash":"📈 Dashboard","link-type-link":"🔗 Link","link-type-slides":"📋 Slides","link-type-folder":"📁 Pasta","drive-link-saving":"Salvando…","drive-link-add-btn":"Adicionar Link","sys-title":"Sistemas Disponíveis","sys-bling":"Gestão de pedidos e NFs","sys-bitrix":"CRM e Gestão de Processos","sys-contaazul":"Sistema de controle contábil","sys-mercos":"Pedidos do Atacado e Indicadores","sys-shopify":"Gestão de Pedidos E-commerce","sys-vendas":"Portal do Representante","sys-looker":"Dashboards e Indicadores","sys-rede":"Criação de Links de Pagamento","sys-pagarme":"Links de Pagamento e Checkout","sys-financ":"Gestão Financeira do Ecomm","sys-receb":"Gestão dos Recebimentos Ecomm","contact-title":"Canais de Contato","sec-board":"DIRETORIA","sec-wholesale":"COMERCIAL ATACADO","sec-finance":"FINANCEIRO","sec-design-title":"DESIGN E PROJETOS","sec-logistics":"LOGÍSTICA","sec-import":"PROCESSO DE IMPORTAÇÃO","sec-salesops":"SALES OPS.","role-ceo":"CEO","role-coo":"COO","role-sales-dir":"Diretor Comercial de Atacado","role-fin-coord":"Coordenador Financeiro","role-fin-analyst":"Analista Financeiro","role-fin-senior":"Analista Senior","role-proj-shoes":"Diretor de Projetos - Calçados","role-proj-bags":"Diretor de Projetos - Bolsas","role-log-coord":"Coordenadora de Logística","role-comex":"Coordenadora de Comex","role-comex-intern":"Estagiária","role-pos-vendas":"Coordenador de Pós Venda","role-billing-analyst":"Analista de Faturamento","bi-title":"BIs e Dashboards","bi-perf":"PERFORMANCE","bi-atac":"ATACADO","bi-link-sub":"VENDAS · FATURAMENTO · ESTOQUE","tasks-title":"Tarefas","tasks-col-todo":"A Fazer","tasks-col-doing":"Em Andamento","tasks-col-done":"Concluído","tasks-prio-high":"Alta","tasks-prio-mid":"Média","tasks-prio-low":"Baixa","kanban-filter-label":"Filtrar:","filter-all":"Todas","filter-mine":"Minhas","filter-requested":"Solicitadas por mim","filter-high-priority":"Alta prioridade","filter-recurring":"🔁 Recorrentes","kanban-search-placeholder":"Buscar por número ou título…","kanban-new-task-btn":"+ Nova Tarefa","kanban-empty":"Nenhuma tarefa","kanban-search-results":"resultado","task-modal-title-new":"Nova Tarefa","edit-task-title":"Editar Tarefa","task-field-unit":"Unidade de Negócio","select-default":"Selecione...","unit-private":"PRIVATE LABEL","unit-atacado":"ATACADO","unit-ecomm":"ECOMM","task-field-brand":"Marca / Cliente","task-brand-select-first":"Selecione a unidade primeiro...","task-brand-custom-option":"+ Outro cliente (digitar)","task-brand-custom-placeholder":"Digite o nome do cliente…","task-brand-prefix-note":"Prefixo gerado automaticamente.","task-field-title":"Título","task-title-placeholder":"Título da tarefa","task-field-desc":"Descrição","task-desc-placeholder":"Descreva a tarefa...","task-field-responsible":"Responsável","task-field-deadline":"Prazo","task-field-deadline-first":"Prazo (1ª ocorrência)","task-field-priority":"Prioridade","recurrence-toggle-label":"🔁 Tarefa Recorrente","recurrence-frequency-label":"Frequência","recurrence-daily":"Diária","recurrence-weekly":"Semanal","recurrence-biweekly":"Quinzenal","recurrence-monthly":"Mensal","recurrence-repeat-label":"Repetir","recurrence-times-label":"vezes","recurrence-preview-default":"Selecione a frequência e o prazo para ver as datas","recurrence-preview-need-deadline":"Defina o prazo para ver as datas","task-attach-label":"Anexos","task-attach-optional":"(opcional · máx. 5)","task-attach-click":"Clique para adicionar arquivos","task-uploading-attachments":"Enviando anexos...","task-create-btn":"Criar Tarefa","save-changes-btn":"Salvar Alterações","delete-btn":"Excluir","saving-dots":"Salvando...","creating-dots":"Criando...","kanban-card-to":"Para:","kanban-card-from":"De:","task-overdue-prefix":"Atrasado","attachments-label":"Anexos","attachment-singular":"anexo","attachment-plural":"anexos","card-detail-desc-title":"Descrição","card-detail-info-title":"Informações","card-detail-field-responsavel":"Responsável","card-detail-field-solicitante":"Solicitante","card-detail-field-prazo":"Prazo","card-detail-field-priority":"Prioridade","card-detail-field-created":"Criado em","card-detail-field-id":"ID interno","card-detail-recurrence-title":"🔁 Ocorrências Programadas","card-detail-attach-title":"Anexos","card-detail-no-attach":"Nenhum anexo","card-detail-no-attach-yet":"Nenhum anexo ainda","card-detail-add-attach-btn":"+ Adicionar anexo","uploading-dots":"Enviando...","card-detail-comments-title":"Comentários","cdm-comments-empty":"Nenhum comentário ainda","card-detail-comment-placeholder":"Escreva um comentário…","card-detail-comment-send":"Enviar","occurrence-label":"Ocorrência","card-action-start":"Iniciar","card-action-complete":"Concluir","card-action-manage-attach":"📎 Gerenciar Anexos","attach-modal-title":"📎 Anexos","attach-add-more-btn":"+ Adicionar mais arquivos","chat-sidebar-title":"Canais","chat-team-channels":"Canais da Equipe","chat-direct-messages":"Mensagens Diretas","chat-create-channel-title":"Criar canal","chat-new-conversation-title":"Nova conversa","chat-general-label":"geral","chat-general-desc":"Canal geral da empresa","chat-company-channel-sub":"Canal da empresa · todos os membros","chat-team-channel-sub":"Canal da equipe","chat-direct-message-sub":"Mensagem direta","video-call-label":"Chamada","video-call-start-title":"Iniciar videochamada","video-call-creating":"Criando...","chat-empty":"Nenhuma mensagem ainda","chat-uploading-file":"Enviando arquivo...","chat-input-placeholder":"Mensagem… (use @ para mencionar)","chat-send-btn":"ENVIAR","chat-load-more":"↑ CARREGAR MENSAGENS ANTERIORES","chat-video-call-started":"iniciou uma chamada","chat-video-call-join":"Entrar","dm-toast-unread-suffix":"mensagens não lidas","meet-toast-default-title":"Chamada iniciada","meet-toast-desc":"Link enviado no chat. Participantes receberam convite por e-mail.","meet-toast-join":"🔗 Entrar na chamada agora","dm-modal-title":"Nova Mensagem Direta","dm-search-placeholder":"Pesquisar...","create-channel-title":"🏷 Criar Canal","channel-name-label":"Nome do Canal","channel-name-placeholder":"ex: design-ecko…","channel-desc-label-optional":"Descrição (opcional)","channel-desc-placeholder":"Sobre o que é este canal?","channel-members-label":"Membros","channel-member-search-placeholder":"Adicionar membro…","channel-create-btn":"Criar Canal","edit-channel-title":"✏️ Editar Canal","edit-channel-title-view":"ℹ️ Detalhes do Canal","channel-desc-label":"Descrição","leave-channel-btn":"Sair do Canal","leaving-dots":"Saindo...","delete-channel-btn":"Excluir Canal","deleting-dots":"Excluindo...","owner-note":"Você é o criador · apenas você pode editar ou excluir este canal","edit-channel-btn-title":"Editar canal","todos-added":"Todos adicionados","delete-conversation-title":"Excluir conversa","emoji-search-placeholder":"Buscar emoji…","reaction-add-title":"Reagir","bi-modal-title":"BIs e Dashboards","dash-loading":"Carregando indicadores…","dash-error":"Erro ao carregar. Tente novamente.","dash-no-data":"Sem dados","dash-kpi-total":"Total de Tarefas","dash-kpi-done":"Concluídas","dash-kpi-overdue":"Atrasadas","dash-kpi-high":"Alta Prioridade","dash-kpi-chat":"Mensagens Chat","dash-kpi-comments":"Comentários","dash-chart-by-person":"Tarefas por responsável","dash-chart-status":"Status das tarefas","dash-chart-prio":"Distribuição por prioridade","dash-chart-completion":"Conclusão por responsável (%)","loading":"Carregando…","saving":"Salvando","confirm-permanent":"Esta ação é permanente e não pode ser desfeita.","error-prefix":"Erro","error-unknown":"desconhecido","alert-login-required":"Faça login para iniciar uma chamada.","alert-channel-name-required":"Nome do canal obrigatório.","alert-channel-member-required":"Adicione ao menos um membro.","alert-name-empty":"O nome não pode estar vazio.","alert-file-required":"Selecione um arquivo.","alert-file-too-large-30":"Arquivo muito grande. Limite: 30 MB.","alert-file-too-large-10":"maior que 10MB.","alert-attach-limit":"Limite de 5 arquivos.","alert-title-required":"Título obrigatório.","alert-url-required":"URL obrigatória.","alert-responsible-required":"Responsável obrigatório.","alert-deadline-required":"Prazo obrigatório.","alert-priority-required":"Prioridade obrigatória.","alert-unit-required":"Unidade obrigatória.","alert-client-required":"Informe o nome do cliente.","alert-frequency-required":"Selecione a frequência.","alert-task-created":"✅ Tarefa criada!","alert-task-created-events":"eventos gerados no Calendar.","confirm-delete-conversation":"Excluir a conversa com","confirm-leave-channel":"Sair do canal","confirm-delete-channel":"⚠️ Excluir o canal","confirm-remove-link":"Remover link","confirm-delete-comment":"Excluir este comentário?","confirm-delete-task-prefix":"⚠️ Excluir","system-channel-created-1":"Canal","system-channel-created-2":"criado por","alert-send-error":"Erro ao enviar: ","alert-send-file-error":"Erro ao enviar arquivo: ","alert-file-too-large-10-limit":"Arquivo muito grande. Limite: 10 MB.","chat-empty-full":"Nenhuma mensagem ainda","card-detail-no-attach-empty":"Nenhum anexo ainda","loading-caps":"CARREGANDO...","contact-add-btn":"+ Adicionar Contato","contact-form-title-new":"Novo Contato","contact-form-title-edit":"Editar Contato","contact-field-name":"Nome","contact-field-role":"Cargo","contact-field-sector":"Setor","contact-field-phone":"Telefone (WhatsApp)","contact-field-email":"E-mail","contact-name-placeholder":"Nome completo","contact-role-placeholder":"Ex: Coordenador Financeiro","contact-phone-placeholder":"+55 11 91234-5678","contact-email-placeholder":"nome@klavabrands.com","contact-sector-custom-option":"+ Outro setor (digitar)","contact-sector-custom-placeholder":"Digite o nome do setor…","contact-save-btn":"Salvar Contato","contact-edit-btn":"Editar","confirm-delete-contact-prefix":"Excluir o contato","alert-contact-name-required":"Nome obrigatório.","alert-contact-role-required":"Cargo obrigatório.","alert-contact-sector-required":"Selecione um setor.","no-contacts":"Nenhum contato cadastrado","contact-field-role-en":"Cargo em Inglês","contact-field-role-zh":"Cargo em Chinês","contact-role-translation-hint":"Se preenchido, será exibido quando o usuário escolher EN/ZH.","global-search-placeholder":"Buscar em tudo…","global-search-no-results":"Nenhum resultado encontrado","global-search-hint":"Digite ao menos 2 letras","global-search-section-tasks":"Tarefas","global-search-section-contacts":"Contatos","global-search-section-drive":"Drive","global-search-section-chat":"Chat","notif-enable-btn":"Ativar notificações","notif-enabled-toast":"Notificações ativadas","notif-blocked-toast":"Notificações bloqueadas no navegador","meu-dia-title":"Meu Dia","meu-dia-tasks-today":"Tarefas do dia","meu-dia-no-tasks-today":"Nenhuma tarefa vence neste dia 🎉","meu-dia-unread":"Mensagens não lidas","meu-dia-no-unread":"Tudo em dia","meu-dia-birthdays":"Aniversariantes do dia","meu-dia-no-birthdays":"Nenhum aniversário neste dia","meu-dia-view-messages":"Ver mensagens","meu-dia-loading":"Carregando seu dia…","meu-dia-calendar-events":"Compromissos do dia","meu-dia-no-calendar-events":"Nenhum compromisso neste dia","meu-dia-calendar-not-shared":"Compartilhe seu Google Calendar (permissão \"Ver todos os detalhes do evento\") com:","notif-blocked-explain":"O navegador bloqueia notificações dentro do Apps Script. As notificações no app (som + aviso na tela) continuam funcionando normalmente.","ai-ask-btn-title":"Pergunte à Intranet","ai-ask-title":"🤖 Pergunte à Intranet","ai-ask-subtitle":"Busca em tarefas, Drive e chat, e responde com IA.","ai-ask-placeholder":"Ex: Qual o status do contrato da Ecko?","ai-ask-submit-btn":"Perguntar","ai-ask-thinking":"Pensando…","ai-ask-empty-question":"Digite uma pergunta.","nav-wiki":"Wiki","wiki-title":"Base de Conhecimento","wiki-add-btn":"+ Novo Artigo","wiki-search-placeholder":"Buscar artigo…","wiki-empty":"Nenhum artigo cadastrado ainda","wiki-form-title-new":"Novo Artigo","wiki-form-title-edit":"Editar Artigo","wiki-field-title":"Título","wiki-title-placeholder":"Ex: Processo de Importação","wiki-field-category":"Categoria","wiki-category-placeholder":"Ex: Processos, Políticas, Onboarding…","wiki-field-content":"Conteúdo","wiki-content-placeholder":"Escreva o conteúdo do artigo…","wiki-save-btn":"Salvar Artigo","wiki-edit-btn":"Editar","confirm-delete-wiki-prefix":"Excluir o artigo","alert-wiki-title-required":"Título obrigatório.","alert-wiki-content-required":"Conteúdo obrigatório.","alert-wiki-category-required":"Selecione ou digite uma categoria.","wiki-last-updated":"Atualizado em","global-search-section-wiki":"Base de Conhecimento","meu-dia-today-label":"Hoje"},
  en:{"greeting-hi":"HELLO","greeting-visitor":"HELLO, VISITOR","nav-home":"Home","nav-sectors":"Sectors","nav-drive":"Drive","nav-systems":"Systems","nav-bi":"BIs & Dashboards","nav-dashboard":"Dashboard","nav-tasks":"Tasks","nav-contact":"Contact","nav-chat":"Chat","theme-toggle-title":"Toggle theme","apps-hub-title":"Apps","hero-title":"Building<br>brands that<br><em>matter</em>","hero-subtitle":"Welcome to Klava's intelligence hub.","cw-title":"Exchange Rate","cw-loading":"loading...","cw-history":"Last 7 days","cw-source":"Source: AwesomeAPI · commercial rate","cw-updated-prefix":"updated","cw-unavailable":"couldn't load","cw-today-suffix":"today","sectors-title":"Sectors","dept-comercial":"SALES","dept-salesops":"SALES OPS.","dept-design":"DESIGN","dept-financeiro":"FINANCE","dept-tesouraria":"TREASURY","dept-online":"ONLINE","dept-novo":"NEW","dept-logistica":"LOGISTICS","item-atacado-live":"Wholesale Live!","item-atacado-ecko":"Wholesale Ecko","item-atacado-flowfa":"Wholesale Flowfa","item-pos-venda":"After-sales","item-estoque-virtual":"Virtual Stock","item-dashboards":"Dashboards","item-criacao":"Creative","item-projetos":"Projects","item-contas":"Accounts Receivable/Payable","item-cobranca":"Collections","item-fluxo":"Cash Flow","item-dre":"Income Statement / Reports","item-conciliacao":"Reconciliation","item-exec-financeira":"Financial Execution","item-folha":"Payroll","item-flowfa-online":"Flowfa Online","item-marketing":"Marketing","item-branding":"Branding","item-marketplace":"Marketplace","item-trafego":"Traffic","item-frete":"Freight","item-estoque-fisico2":"Physical Stock","item-log-reversa2":"Reverse Logistics","dept-projetos":"PROJECTS","item-collabs":"Collabs","item-criativos":"Creatives","item-estoque-fisico":"Physical Stock","item-log-reversa":"Reverse Logistics","item-private-label":"Private Label","item-repasses":"Transfers","drive-title":"Files & Documents","drive-search-placeholder":"Search file…","drive-add-link":"+ Link","drive-upload-btn":"+ Upload file","drive-upload-submit-btn":"Upload File","drive-uploading-dots":"Uploading…","drive-btn-open":"Open","drive-btn-delete":"Delete","drive-btn-remove-link":"Remove link","drive-no-links":"No links added","drive-no-files":"No files uploaded yet","drive-subsection-files":"Files","drive-loading":"Loading files…","drive-error":"Failed to load.","sec-diretoria":"Board","sec-comercial":"Wholesale Sales","sec-financeiro":"Finance","sec-tesouraria":"Treasury","sec-design":"Design & Projects","sec-logistica":"Logistics","sec-comex":"Import / Foreign Trade","sec-salesops-label":"Sales Ops.","sec-online":"Online","sec-novo":"New","drive-upload-modal-title-default":"📁 Upload File","drive-upload-modal-title-to":"📁 Upload to","drive-file-label":"File","drive-file-max":"(max. 30 MB)","drive-drop-label":"Click to select or drag here","drive-desc-label":"Description","optional-label":"(optional)","drive-desc-placeholder":"E.g.: Monthly report…","drive-uploading-progress":"Uploading file to Drive…","drive-link-modal-title-default":"🔗 Add Link","drive-link-modal-title-to":"🔗 Add Link —","drive-link-title-label":"Title","drive-link-title-placeholder":"E.g.: LIVE Total…","drive-link-url-label":"URL","drive-link-url-placeholder":"https://docs.google.com/…","drive-link-sub-label":"Subtitle","drive-link-sub-placeholder":"E.g.: Spreadsheet, Dashboard…","drive-link-type-label":"Type","link-type-sheet":"📊 Spreadsheet","link-type-doc":"📝 Document","link-type-dash":"📈 Dashboard","link-type-link":"🔗 Link","link-type-slides":"📋 Slides","link-type-folder":"📁 Folder","drive-link-saving":"Saving…","drive-link-add-btn":"Add Link","sys-title":"Available Systems","sys-bling":"Order & invoice management","sys-bitrix":"CRM & Process Management","sys-contaazul":"Accounting control system","sys-mercos":"Wholesale orders & metrics","sys-shopify":"E-commerce order management","sys-vendas":"Sales rep portal","sys-looker":"Dashboards & metrics","sys-rede":"Payment link creation","sys-pagarme":"Payment links & checkout","sys-financ":"E-commerce finance management","sys-receb":"E-commerce receivables management","contact-title":"Contact Channels","sec-board":"BOARD","sec-wholesale":"WHOLESALE SALES","sec-finance":"FINANCE","sec-design-title":"DESIGN & PROJECTS","sec-logistics":"LOGISTICS","sec-import":"IMPORT PROCESS","sec-salesops":"SALES OPS.","role-ceo":"CEO","role-coo":"COO","role-sales-dir":"Wholesale Sales Director","role-fin-coord":"Finance Coordinator","role-fin-analyst":"Financial Analyst","role-fin-senior":"Senior Analyst","role-proj-shoes":"Projects Director - Footwear","role-proj-bags":"Projects Director - Bags","role-log-coord":"Logistics Coordinator","role-comex":"Foreign Trade Coordinator","role-comex-intern":"Intern","role-pos-vendas":"After-sales Coordinator","role-billing-analyst":"Billing Analyst","bi-title":"BIs & Dashboards","bi-perf":"PERFORMANCE","bi-atac":"WHOLESALE","bi-link-sub":"SALES · BILLING · STOCK","tasks-title":"Tasks","tasks-col-todo":"To Do","tasks-col-doing":"In Progress","tasks-col-done":"Done","tasks-prio-high":"High","tasks-prio-mid":"Medium","tasks-prio-low":"Low","kanban-filter-label":"Filter:","filter-all":"All","filter-mine":"Mine","filter-requested":"Requested by me","filter-high-priority":"High priority","filter-recurring":"🔁 Recurring","kanban-search-placeholder":"Search by number or title…","kanban-new-task-btn":"+ New Task","kanban-empty":"No tasks","kanban-search-results":"result","task-modal-title-new":"New Task","edit-task-title":"Edit Task","task-field-unit":"Business Unit","select-default":"Select...","unit-private":"PRIVATE LABEL","unit-atacado":"WHOLESALE","unit-ecomm":"E-COMMERCE","task-field-brand":"Brand / Client","task-brand-select-first":"Select the unit first...","task-brand-custom-option":"+ Other client (type)","task-brand-custom-placeholder":"Type the client name…","task-brand-prefix-note":"Prefix generated automatically.","task-field-title":"Title","task-title-placeholder":"Task title","task-field-desc":"Description","task-desc-placeholder":"Describe the task...","task-field-responsible":"Assignee","task-field-deadline":"Deadline","task-field-deadline-first":"Deadline (1st occurrence)","task-field-priority":"Priority","recurrence-toggle-label":"🔁 Recurring Task","recurrence-frequency-label":"Frequency","recurrence-daily":"Daily","recurrence-weekly":"Weekly","recurrence-biweekly":"Biweekly","recurrence-monthly":"Monthly","recurrence-repeat-label":"Repeat","recurrence-times-label":"times","recurrence-preview-default":"Select frequency and deadline to see dates","recurrence-preview-need-deadline":"Set the deadline to see the dates","task-attach-label":"Attachments","task-attach-optional":"(optional · max. 5)","task-attach-click":"Click to add files","task-uploading-attachments":"Uploading attachments...","task-create-btn":"Create Task","save-changes-btn":"Save Changes","delete-btn":"Delete","saving-dots":"Saving...","creating-dots":"Creating...","kanban-card-to":"To:","kanban-card-from":"From:","task-overdue-prefix":"Overdue","attachments-label":"Attachments","attachment-singular":"attachment","attachment-plural":"attachments","card-detail-desc-title":"Description","card-detail-info-title":"Information","card-detail-field-responsavel":"Assignee","card-detail-field-solicitante":"Requester","card-detail-field-prazo":"Deadline","card-detail-field-priority":"Priority","card-detail-field-created":"Created on","card-detail-field-id":"Internal ID","card-detail-recurrence-title":"🔁 Scheduled Occurrences","card-detail-attach-title":"Attachments","card-detail-no-attach":"No attachments","card-detail-no-attach-yet":"No attachments yet","card-detail-add-attach-btn":"+ Add attachment","uploading-dots":"Uploading...","card-detail-comments-title":"Comments","cdm-comments-empty":"No comments yet","card-detail-comment-placeholder":"Write a comment…","card-detail-comment-send":"Send","occurrence-label":"Occurrence","card-action-start":"Start","card-action-complete":"Complete","card-action-manage-attach":"📎 Manage Attachments","attach-modal-title":"📎 Attachments","attach-add-more-btn":"+ Add more files","chat-sidebar-title":"Channels","chat-team-channels":"Team Channels","chat-direct-messages":"Direct Messages","chat-create-channel-title":"Create channel","chat-new-conversation-title":"New conversation","chat-general-label":"general","chat-general-desc":"Company general channel","chat-company-channel-sub":"Company channel · all members","chat-team-channel-sub":"Team channel","chat-direct-message-sub":"Direct message","video-call-label":"Call","video-call-start-title":"Start video call","video-call-creating":"Creating...","chat-empty":"No messages yet","chat-uploading-file":"Uploading file...","chat-input-placeholder":"Message… (use @ to mention)","chat-send-btn":"SEND","chat-load-more":"↑ LOAD PREVIOUS MESSAGES","chat-video-call-started":"started a call","chat-video-call-join":"Join","dm-toast-unread-suffix":"unread messages","meet-toast-default-title":"Call started","meet-toast-desc":"Link sent in chat. Participants received an email invite.","meet-toast-join":"🔗 Join the call now","dm-modal-title":"New Direct Message","dm-search-placeholder":"Search...","create-channel-title":"🏷 Create Channel","channel-name-label":"Channel Name","channel-name-placeholder":"e.g.: design-ecko…","channel-desc-label-optional":"Description (optional)","channel-desc-placeholder":"What is this channel about?","channel-members-label":"Members","channel-member-search-placeholder":"Add member…","channel-create-btn":"Create Channel","edit-channel-title":"✏️ Edit Channel","edit-channel-title-view":"ℹ️ Channel Details","channel-desc-label":"Description","leave-channel-btn":"Leave Channel","leaving-dots":"Leaving...","delete-channel-btn":"Delete Channel","deleting-dots":"Deleting...","owner-note":"You are the creator · only you can edit or delete this channel","edit-channel-btn-title":"Edit channel","todos-added":"Everyone added","delete-conversation-title":"Delete conversation","emoji-search-placeholder":"Search emoji…","reaction-add-title":"React","bi-modal-title":"BIs & Dashboards","dash-loading":"Loading metrics…","dash-error":"Failed to load. Try again.","dash-no-data":"No data","dash-kpi-total":"Total Tasks","dash-kpi-done":"Completed","dash-kpi-overdue":"Overdue","dash-kpi-high":"High Priority","dash-kpi-chat":"Chat Messages","dash-kpi-comments":"Comments","dash-chart-by-person":"Tasks by assignee","dash-chart-status":"Task status","dash-chart-prio":"Priority breakdown","dash-chart-completion":"Completion by assignee (%)","loading":"Loading…","saving":"Saving","confirm-permanent":"This action is permanent and cannot be undone.","error-prefix":"Error","error-unknown":"unknown","alert-login-required":"Please log in to start a call.","alert-channel-name-required":"Channel name is required.","alert-channel-member-required":"Add at least one member.","alert-name-empty":"The name cannot be empty.","alert-file-required":"Select a file.","alert-file-too-large-30":"File too large. Limit: 30 MB.","alert-file-too-large-10":"larger than 10MB.","alert-attach-limit":"Limit of 5 files.","alert-title-required":"Title is required.","alert-url-required":"URL is required.","alert-responsible-required":"Assignee is required.","alert-deadline-required":"Deadline is required.","alert-priority-required":"Priority is required.","alert-unit-required":"Business unit is required.","alert-client-required":"Enter the client name.","alert-frequency-required":"Select the frequency.","alert-task-created":"✅ Task created!","alert-task-created-events":"events created in Calendar.","confirm-delete-conversation":"Delete the conversation with","confirm-leave-channel":"Leave the channel","confirm-delete-channel":"⚠️ Delete the channel","confirm-remove-link":"Remove link","confirm-delete-comment":"Delete this comment?","confirm-delete-task-prefix":"⚠️ Delete","system-channel-created-1":"Channel","system-channel-created-2":"created by","alert-send-error":"Failed to send: ","alert-send-file-error":"Failed to send file: ","alert-file-too-large-10-limit":"File too large. Limit: 10 MB.","chat-empty-full":"No messages yet","card-detail-no-attach-empty":"No attachments yet","loading-caps":"LOADING...","contact-add-btn":"+ Add Contact","contact-form-title-new":"New Contact","contact-form-title-edit":"Edit Contact","contact-field-name":"Name","contact-field-role":"Role","contact-field-sector":"Sector","contact-field-phone":"Phone (WhatsApp)","contact-field-email":"Email","contact-name-placeholder":"Full name","contact-role-placeholder":"E.g.: Finance Coordinator","contact-phone-placeholder":"+55 11 91234-5678","contact-email-placeholder":"name@klavabrands.com","contact-sector-custom-option":"+ Other sector (type)","contact-sector-custom-placeholder":"Type the sector name…","contact-save-btn":"Save Contact","contact-edit-btn":"Edit","confirm-delete-contact-prefix":"Delete contact","alert-contact-name-required":"Name is required.","alert-contact-role-required":"Role is required.","alert-contact-sector-required":"Select a sector.","no-contacts":"No contacts yet","contact-field-role-en":"Role in English","contact-field-role-zh":"Role in Chinese","contact-role-translation-hint":"If filled in, shown when the user selects EN/ZH.","global-search-placeholder":"Search everything…","global-search-no-results":"No results found","global-search-hint":"Type at least 2 letters","global-search-section-tasks":"Tasks","global-search-section-contacts":"Contacts","global-search-section-drive":"Drive","global-search-section-chat":"Chat","notif-enable-btn":"Enable notifications","notif-enabled-toast":"Notifications enabled","notif-blocked-toast":"Notifications blocked by browser","meu-dia-title":"My Day","meu-dia-tasks-today":"Tasks for the day","meu-dia-no-tasks-today":"No tasks due this day 🎉","meu-dia-unread":"Unread messages","meu-dia-no-unread":"All caught up","meu-dia-birthdays":"Birthdays this day","meu-dia-no-birthdays":"No birthdays this day","meu-dia-view-messages":"View messages","meu-dia-loading":"Loading your day…","meu-dia-calendar-events":"Events for the day","meu-dia-no-calendar-events":"No events this day","meu-dia-calendar-not-shared":"Share your Google Calendar (\"See all event details\" permission) with:","notif-blocked-explain":"Your browser blocks notifications inside Apps Script. In-app alerts (sound + on-screen toast) keep working normally.","ai-ask-btn-title":"Ask the Intranet","ai-ask-title":"🤖 Ask the Intranet","ai-ask-subtitle":"Searches tasks, Drive and chat, and answers with AI.","ai-ask-placeholder":"E.g.: What's the status of the Ecko contract?","ai-ask-submit-btn":"Ask","ai-ask-thinking":"Thinking…","ai-ask-empty-question":"Type a question.","nav-wiki":"Wiki","wiki-title":"Knowledge Base","wiki-add-btn":"+ New Article","wiki-search-placeholder":"Search article…","wiki-empty":"No articles yet","wiki-form-title-new":"New Article","wiki-form-title-edit":"Edit Article","wiki-field-title":"Title","wiki-title-placeholder":"E.g.: Import Process","wiki-field-category":"Category","wiki-category-placeholder":"E.g.: Processes, Policies, Onboarding…","wiki-field-content":"Content","wiki-content-placeholder":"Write the article content…","wiki-save-btn":"Save Article","wiki-edit-btn":"Edit","confirm-delete-wiki-prefix":"Delete the article","alert-wiki-title-required":"Title is required.","alert-wiki-content-required":"Content is required.","alert-wiki-category-required":"Select or type a category.","wiki-last-updated":"Updated on","global-search-section-wiki":"Knowledge Base","meu-dia-today-label":"Today"},
  zh:{"greeting-hi":"你好","greeting-visitor":"你好，访客","nav-home":"首页","nav-sectors":"部门","nav-drive":"云盘","nav-systems":"系统","nav-bi":"商业智能与仪表板","nav-dashboard":"仪表板","nav-tasks":"任务","nav-contact":"联系我们","nav-chat":"聊天","theme-toggle-title":"切换主题","apps-hub-title":"应用","hero-title":"打造<br>意义非凡的<br><em>品牌</em>","hero-subtitle":"欢迎来到 Klava 智能中心。","cw-title":"汇率","cw-loading":"加载中...","cw-history":"近7天历史","cw-source":"数据来源：AwesomeAPI · 商业汇率","cw-updated-prefix":"更新于","cw-unavailable":"无法加载","cw-today-suffix":"今日","sectors-title":"部门","dept-comercial":"商务部","dept-salesops":"销售运营部","dept-design":"设计部","dept-financeiro":"财务部","dept-tesouraria":"资金部","dept-online":"线上部","dept-novo":"新部门","dept-logistica":"物流部","item-atacado-live":"批发 Live!","item-atacado-ecko":"批发 Ecko","item-atacado-flowfa":"批发 Flowfa","item-pos-venda":"售后","item-estoque-virtual":"虚拟库存","item-dashboards":"仪表板","item-criacao":"创意","item-projetos":"项目","item-contas":"应收/应付账款","item-cobranca":"催收","item-fluxo":"现金流","item-dre":"损益表/报告","item-conciliacao":"对账","item-exec-financeira":"财务执行","item-folha":"工资单","item-flowfa-online":"Flowfa 线上","item-marketing":"市场营销","item-branding":"品牌","item-marketplace":"电商平台","item-trafego":"流量","item-frete":"运费","item-estoque-fisico2":"实物库存","item-log-reversa2":"逆向物流","dept-projetos":"项目部","item-collabs":"联名合作","item-criativos":"创意物料","item-estoque-fisico":"实物库存","item-log-reversa":"逆向物流","item-private-label":"自有品牌","item-repasses":"转账","drive-title":"文件与文档","drive-search-placeholder":"搜索文件…","drive-add-link":"+ 链接","drive-upload-btn":"+ 上传文件","drive-upload-submit-btn":"上传文件","drive-uploading-dots":"上传中…","drive-btn-open":"打开","drive-btn-delete":"删除","drive-btn-remove-link":"删除链接","drive-no-links":"暂无链接","drive-no-files":"暂无上传文件","drive-subsection-files":"文件","drive-loading":"正在加载文件…","drive-error":"加载失败。","sec-diretoria":"董事会","sec-comercial":"批发商务","sec-financeiro":"财务","sec-tesouraria":"资金部","sec-design":"设计与项目","sec-logistica":"物流","sec-comex":"进口/外贸","sec-salesops-label":"销售运营","sec-online":"线上","sec-novo":"新","drive-upload-modal-title-default":"📁 上传文件","drive-upload-modal-title-to":"📁 上传至","drive-file-label":"文件","drive-file-max":"（最大 30 MB）","drive-drop-label":"点击选择或拖拽到此处","drive-desc-label":"描述","optional-label":"（可选）","drive-desc-placeholder":"例如：月度报告…","drive-uploading-progress":"正在上传文件到云盘…","drive-link-modal-title-default":"🔗 添加链接","drive-link-modal-title-to":"🔗 添加链接 —","drive-link-title-label":"标题","drive-link-title-placeholder":"例如：LIVE Total…","drive-link-url-label":"网址","drive-link-url-placeholder":"https://docs.google.com/…","drive-link-sub-label":"副标题","drive-link-sub-placeholder":"例如：表格、仪表板…","drive-link-type-label":"类型","link-type-sheet":"📊 表格","link-type-doc":"📝 文档","link-type-dash":"📈 仪表板","link-type-link":"🔗 链接","link-type-slides":"📋 幻灯片","link-type-folder":"📁 文件夹","drive-link-saving":"保存中…","drive-link-add-btn":"添加链接","sys-title":"可用系统","sys-bling":"订单和发票管理","sys-bitrix":"客户关系管理与流程管理","sys-contaazul":"会计控制系统","sys-mercos":"批发订单与指标","sys-shopify":"电商订单管理","sys-vendas":"代表门户","sys-looker":"仪表板与指标","sys-rede":"创建支付链接","sys-pagarme":"支付链接与结账","sys-financ":"电商财务管理","sys-receb":"电商收款管理","contact-title":"联系渠道","sec-board":"董事会","sec-wholesale":"批发商务","sec-finance":"财务","sec-design-title":"设计与项目","sec-logistics":"物流","sec-import":"进口流程","sec-salesops":"销售运营","role-ceo":"首席执行官","role-coo":"首席运营官","role-sales-dir":"批发销售总监","role-fin-coord":"财务协调员","role-fin-analyst":"财务分析师","role-fin-senior":"高级分析师","role-proj-shoes":"项目总监 - 鞋类","role-proj-bags":"项目总监 - 箱包","role-log-coord":"物流协调员","role-comex":"外贸协调员","role-comex-intern":"实习生","role-pos-vendas":"售后协调员","role-billing-analyst":"账单分析师","bi-title":"商业智能与仪表板","bi-perf":"绩效","bi-atac":"批发","bi-link-sub":"销售 · 账单 · 库存","tasks-title":"任务","tasks-col-todo":"待办","tasks-col-doing":"进行中","tasks-col-done":"已完成","tasks-prio-high":"高","tasks-prio-mid":"中","tasks-prio-low":"低","kanban-filter-label":"筛选：","filter-all":"全部","filter-mine":"我的","filter-requested":"我发起的","filter-high-priority":"高优先级","filter-recurring":"🔁 周期性","kanban-search-placeholder":"按编号或标题搜索…","kanban-new-task-btn":"+ 新建任务","kanban-empty":"暂无任务","kanban-search-results":"个结果","task-modal-title-new":"新建任务","edit-task-title":"编辑任务","task-field-unit":"业务单元","select-default":"请选择...","unit-private":"自有品牌","unit-atacado":"批发","unit-ecomm":"电商","task-field-brand":"品牌/客户","task-brand-select-first":"请先选择单元...","task-brand-custom-option":"+ 其他客户（输入）","task-brand-custom-placeholder":"输入客户名称…","task-brand-prefix-note":"前缀自动生成。","task-field-title":"标题","task-title-placeholder":"任务标题","task-field-desc":"描述","task-desc-placeholder":"描述任务...","task-field-responsible":"负责人","task-field-deadline":"截止日期","task-field-deadline-first":"截止日期（首次）","task-field-priority":"优先级","recurrence-toggle-label":"🔁 周期性任务","recurrence-frequency-label":"频率","recurrence-daily":"每日","recurrence-weekly":"每周","recurrence-biweekly":"每两周","recurrence-monthly":"每月","recurrence-repeat-label":"重复","recurrence-times-label":"次","recurrence-preview-default":"选择频率和截止日期以查看日期","recurrence-preview-need-deadline":"设置截止日期以查看日期","task-attach-label":"附件","task-attach-optional":"（可选 · 最多5个）","task-attach-click":"点击添加文件","task-uploading-attachments":"正在上传附件...","task-create-btn":"创建任务","save-changes-btn":"保存更改","delete-btn":"删除","saving-dots":"保存中...","creating-dots":"创建中...","kanban-card-to":"收件人：","kanban-card-from":"发起人：","task-overdue-prefix":"已逾期","attachments-label":"附件","attachment-singular":"个附件","attachment-plural":"个附件","card-detail-desc-title":"描述","card-detail-info-title":"信息","card-detail-field-responsavel":"负责人","card-detail-field-solicitante":"申请人","card-detail-field-prazo":"截止日期","card-detail-field-priority":"优先级","card-detail-field-created":"创建于","card-detail-field-id":"内部编号","card-detail-recurrence-title":"🔁 计划中的发生次数","card-detail-attach-title":"附件","card-detail-no-attach":"暂无附件","card-detail-no-attach-yet":"暂无附件","card-detail-add-attach-btn":"+ 添加附件","uploading-dots":"上传中...","card-detail-comments-title":"评论","cdm-comments-empty":"暂无评论","card-detail-comment-placeholder":"写评论…","card-detail-comment-send":"发送","occurrence-label":"第","card-action-start":"开始","card-action-complete":"完成","card-action-manage-attach":"📎 管理附件","attach-modal-title":"📎 附件","attach-add-more-btn":"+ 添加更多文件","chat-sidebar-title":"频道","chat-team-channels":"团队频道","chat-direct-messages":"私信","chat-create-channel-title":"创建频道","chat-new-conversation-title":"新对话","chat-general-label":"通用","chat-general-desc":"公司通用频道","chat-company-channel-sub":"公司频道 · 全体成员","chat-team-channel-sub":"团队频道","chat-direct-message-sub":"私信","video-call-label":"通话","video-call-start-title":"发起视频通话","video-call-creating":"创建中...","chat-empty":"暂无消息","chat-uploading-file":"正在上传文件...","chat-input-placeholder":"消息…（使用 @ 提及）","chat-send-btn":"发送","chat-load-more":"↑ 加载更早的消息","chat-video-call-started":"发起了通话","chat-video-call-join":"加入","dm-toast-unread-suffix":"条未读消息","meet-toast-default-title":"通话已开始","meet-toast-desc":"链接已发送到聊天中。参会者已收到邮件邀请。","meet-toast-join":"🔗 立即加入通话","dm-modal-title":"新建私信","dm-search-placeholder":"搜索...","create-channel-title":"🏷 创建频道","channel-name-label":"频道名称","channel-name-placeholder":"例如：design-ecko…","channel-desc-label-optional":"描述（可选）","channel-desc-placeholder":"这个频道是关于什么的？","channel-members-label":"成员","channel-member-search-placeholder":"添加成员…","channel-create-btn":"创建频道","edit-channel-title":"✏️ 编辑频道","edit-channel-title-view":"ℹ️ 频道详情","channel-desc-label":"描述","leave-channel-btn":"退出频道","leaving-dots":"退出中...","delete-channel-btn":"删除频道","deleting-dots":"删除中...","owner-note":"您是创建者 · 只有您可以编辑或删除此频道","edit-channel-btn-title":"编辑频道","todos-added":"所有人已添加","delete-conversation-title":"删除对话","emoji-search-placeholder":"搜索表情…","reaction-add-title":"反应","bi-modal-title":"商业智能与仪表板","dash-loading":"正在加载指标…","dash-error":"加载失败，请重试。","dash-no-data":"暂无数据","dash-kpi-total":"任务总数","dash-kpi-done":"已完成","dash-kpi-overdue":"已逾期","dash-kpi-high":"高优先级","dash-kpi-chat":"聊天消息数","dash-kpi-comments":"评论数","dash-chart-by-person":"按负责人分类任务","dash-chart-status":"任务状态","dash-chart-prio":"优先级分布","dash-chart-completion":"按负责人完成率（%）","loading":"加载中…","saving":"保存中","confirm-permanent":"此操作不可撤销。","error-prefix":"错误","error-unknown":"未知","alert-login-required":"请登录以发起通话。","alert-channel-name-required":"频道名称为必填项。","alert-channel-member-required":"请至少添加一位成员。","alert-name-empty":"名称不能为空。","alert-file-required":"请选择一个文件。","alert-file-too-large-30":"文件过大，限制为 30 MB。","alert-file-too-large-10":"大于 10MB。","alert-attach-limit":"最多 5 个文件。","alert-title-required":"标题为必填项。","alert-url-required":"网址为必填项。","alert-responsible-required":"负责人为必填项。","alert-deadline-required":"截止日期为必填项。","alert-priority-required":"优先级为必填项。","alert-unit-required":"业务单元为必填项。","alert-client-required":"请输入客户名称。","alert-frequency-required":"请选择频率。","alert-task-created":"✅ 任务已创建！","alert-task-created-events":"个日历事件已创建。","confirm-delete-conversation":"删除与以下用户的对话：","confirm-leave-channel":"退出频道","confirm-delete-channel":"⚠️ 删除频道","confirm-remove-link":"删除链接","confirm-delete-comment":"删除此评论？","confirm-delete-task-prefix":"⚠️ 删除","system-channel-created-1":"频道","system-channel-created-2":"由...创建：","alert-send-error":"发送失败：","alert-send-file-error":"发送文件失败：","alert-file-too-large-10-limit":"文件过大，限制为 10 MB。","chat-empty-full":"暂无消息","card-detail-no-attach-empty":"暂无附件","loading-caps":"加载中...","contact-add-btn":"+ 添加联系人","contact-form-title-new":"新建联系人","contact-form-title-edit":"编辑联系人","contact-field-name":"姓名","contact-field-role":"职位","contact-field-sector":"部门","contact-field-phone":"电话（WhatsApp）","contact-field-email":"电子邮件","contact-name-placeholder":"姓名","contact-role-placeholder":"例如：财务协调员","contact-phone-placeholder":"+55 11 91234-5678","contact-email-placeholder":"name@klavabrands.com","contact-sector-custom-option":"+ 其他部门（输入）","contact-sector-custom-placeholder":"输入部门名称…","contact-save-btn":"保存联系人","contact-edit-btn":"编辑","confirm-delete-contact-prefix":"删除联系人","alert-contact-name-required":"姓名为必填项。","alert-contact-role-required":"职位为必填项。","alert-contact-sector-required":"请选择部门。","no-contacts":"暂无联系人","contact-field-role-en":"英文职位","contact-field-role-zh":"中文职位","contact-role-translation-hint":"填写后，用户选择英文/中文时会显示。","global-search-placeholder":"全局搜索…","global-search-no-results":"未找到结果","global-search-hint":"请输入至少2个字符","global-search-section-tasks":"任务","global-search-section-contacts":"联系人","global-search-section-drive":"云盘","global-search-section-chat":"聊天","notif-enable-btn":"启用通知","notif-enabled-toast":"通知已启用","notif-blocked-toast":"浏览器已阻止通知","meu-dia-title":"我的一天","meu-dia-tasks-today":"当日任务","meu-dia-no-tasks-today":"这一天没有到期任务🎉","meu-dia-unread":"未读消息","meu-dia-no-unread":"全部已读","meu-dia-birthdays":"当日生日","meu-dia-no-birthdays":"这一天没有生日","meu-dia-view-messages":"查看消息","meu-dia-loading":"正在加载今日概览…","meu-dia-calendar-events":"当日日程","meu-dia-no-calendar-events":"这一天没有日程","meu-dia-calendar-not-shared":"请将您的谷歌日历共享给以下账号（权限：\"查看所有活动详情\"）：","notif-blocked-explain":"浏览器阻止了 Apps Script 内的通知。应用内提醒（声音+屏幕提示）仍正常工作。","ai-ask-btn-title":"问智能助手","ai-ask-title":"🤖 问智能助手","ai-ask-subtitle":"在任务、云盘和聊天中搜索，并用AI回答。","ai-ask-placeholder":"例如：Ecko 合同的状态如何？","ai-ask-submit-btn":"提问","ai-ask-thinking":"思考中…","ai-ask-empty-question":"请输入问题。","nav-wiki":"知识库","wiki-title":"知识库","wiki-add-btn":"+ 新文章","wiki-search-placeholder":"搜索文章…","wiki-empty":"暂无文章","wiki-form-title-new":"新建文章","wiki-form-title-edit":"编辑文章","wiki-field-title":"标题","wiki-title-placeholder":"例如：进口流程","wiki-field-category":"分类","wiki-category-placeholder":"例如：流程、政策、入职…","wiki-field-content":"内容","wiki-content-placeholder":"撰写文章内容…","wiki-save-btn":"保存文章","wiki-edit-btn":"编辑","confirm-delete-wiki-prefix":"删除文章","alert-wiki-title-required":"标题为必填项。","alert-wiki-content-required":"内容为必填项。","alert-wiki-category-required":"请选择或输入分类。","wiki-last-updated":"更新于","global-search-section-wiki":"知识库","meu-dia-today-label":"今天"}
};

/* ═══ NAVEGAÇÃO ═══ */
function showPage(pageId){
  if(pageId!=='chat'){ _chatPageOpen=false; if(chatPollInterval){ clearInterval(chatPollInterval); chatPollInterval=null; } if(reactionPollInterval){ clearInterval(reactionPollInterval); reactionPollInterval=null; } }
  document.querySelectorAll('.page-content').forEach(function(p){ p.style.display='none'; p.classList.remove('page-show'); });
  var target=document.getElementById('page-'+pageId); if(!target) return;
  if(pageId==='hero') target.style.display='grid';
  else if(pageId==='chat'){ target.style.display='flex'; target.classList.add('page-show'); initChat(); }
  else if(pageId==='drive'){ target.style.display='flex'; initDrive(); }
  else if(pageId==='dashboard'){ target.style.display='flex'; target.style.flexDirection='column'; initDashboard(); }
  else if(pageId==='tarefas'){ target.style.display='flex'; target.style.flexDirection='column'; loadTasks(); if(!_taskPollTimer) _taskPollTimer=setInterval(loadTasks,10000); }
  else if(pageId==='contato'){ if(_taskPollTimer){ clearInterval(_taskPollTimer); _taskPollTimer=null; } target.style.display='flex'; initContatos(); }
  else if(pageId==='bi'){ if(_taskPollTimer){ clearInterval(_taskPollTimer); _taskPollTimer=null; } target.style.display='flex'; target.style.flexDirection='column'; initBI(); }
  else if(pageId==='wiki'){ if(_taskPollTimer){ clearInterval(_taskPollTimer); _taskPollTimer=null; } target.style.display='flex'; initWiki(); }
  else { if(_taskPollTimer){ clearInterval(_taskPollTimer); _taskPollTimer=null; } target.style.display='flex'; }
  if(pageId==='chat') clearNavChatBadge();
}

/* ═══ BI KLAVA (embutido) ═══ */
// Link /exec da implantação do projeto "BI Klava — Dashboard". Trocar só aqui.
var URL_BI_KLAVA = 'https://script.google.com/a/macros/klavabrands.com/s/AKfycbxPYH3SBF_rGgWSSqxoIqKdLSEsfHJHpreOSO4N8LAk0jF-DrpU-n_OyEM0UqGbDer9sg/exec';
var _biCarregado = false;
function _temaAtualIntranet(){
  if(_currentTheme==='light') return 'claro';
  if(_currentTheme==='dark') return 'escuro';
  return (window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'escuro':'claro';
}
function initBI(){
  var frame=document.getElementById('bi-frame'), aviso=document.getElementById('bi-frame-aviso'), aba=document.getElementById('bi-abrir-aba');
  if(!frame) return;
  if(!/^https:\/\/script\.google\.com\/.+\/exec$/.test(URL_BI_KLAVA)){ aviso.textContent='Configure URL_BI_KLAVA no script.html com o link /exec do BI.'; return; }
  var url=URL_BI_KLAVA+'?tema='+_temaAtualIntranet();
  aba.href=url;
  if(_biCarregado) return;            // carrega uma vez só; depois só mostra/esconde
  _biCarregado=true;
  frame.onload=function(){ aviso.style.display='none'; frame.style.display='block'; };
  frame.src=url;
}

/* ═══ APPS HUB ═══ */
function toggleAppsHub(){ document.getElementById('apps-hub-dropdown').classList.toggle('open'); }
function closeAppsHub(){ document.getElementById('apps-hub-dropdown').classList.remove('open'); }
document.addEventListener('click',function(e){ var btn=document.getElementById('apps-hub-btn'),drop=document.getElementById('apps-hub-dropdown'); if(drop&&btn&&!drop.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)) closeAppsHub(); });

/* ═══ NOTIFICAÇÕES ═══ */
function startUnreadPolling(){ if(_unreadTimer) return; setTimeout(checkUnreadMessages,1500); _unreadTimer=setInterval(checkUnreadMessages,3000); document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') checkUnreadMessages(); }); window.addEventListener('focus',function(){ checkUnreadMessages(); }); }

function checkUnreadMessages(){
  if(!currentUserAlias||currentUserAlias==='visitante') return;
  if(typeof google==='undefined'||!google.script||!google.script.run) return;
  google.script.run
    .withSuccessHandler(function(result){
      if(!result) return;
      var totalUnread=0;
      Object.keys(result).forEach(function(ch){
        var info=result[ch],n=info.count||0;
        if(ch===activeChannel&&_chatPageOpen){ n=0; if(info.msgId&&info.msgId>(_lastSeenMap[ch]||0)){ _lastSeenMap[ch]=info.msgId; _saveLastSeenMap(); } }
        totalUnread+=n; _unreadMap[ch]=n; updateSidebarBadge(ch,n);
        if(ch.indexOf('dm:')===0&&n>0){ var parts=ch.replace('dm:','').split('_'),partner=parts.find(function(p){ return p!==currentUserAlias; })||parts[0]; if(openDMs.indexOf(ch)===-1){ openDMs.push(ch); _dmCreators[ch]=info.sender; addDMToSidebar(ch,partner,info.sender); _saveDMsToStorage(); } var ln=_notifiedChannels[ch]||0; if(info.msgId&&info.msgId>ln&&ch!==activeChannel){ _notifiedChannels[ch]=info.msgId; showDMToast(ch,info.sender,partner,info.preview,n); } }
        if(ch.indexOf('canal:')===0&&n>0){ var ln2=_notifiedChannels[ch]||0; if(info.msgId&&info.msgId>ln2&&ch!==activeChannel){ _notifiedChannels[ch]=info.msgId; showDMToast(ch,info.sender,ch.replace('canal:','#'),info.preview,n); } }
      });
      if(!_chatPageOpen&&totalUnread>0) showNavChatBadge(totalUnread);
      else if(totalUnread===0){ var lnk=document.getElementById('nav-chat-link'); if(lnk){ var b=lnk.querySelector('.nav-badge'); if(b) b.style.display='none'; } }
    })
    .withFailureHandler(function(){})
    .getUnreadCounts(currentUserAlias,_lastSeenMap);
}

/* ═══ TOASTS ═══ */
var _dmToastTimers={};
function showDMToast(chKey,sender,label,preview,count){
  if(_chatPageOpen&&activeChannel===chKey&&document.hasFocus()) return;
  _fireBrowserNotification(sender,(preview||'').substring(0,80),function(){ showPage('chat'); setTimeout(function(){ selectChannel(chKey,chKey.indexOf('dm:')===0?'@':'#',label); },150); });
  var container=document.getElementById('dm-toast-container'); if(!container) return;
  var tid='dm-toast-'+chKey.replace(/[^a-zA-Z0-9]/g,'-');
  var ex=document.getElementById(tid); if(ex) ex.parentNode.removeChild(ex);
  var initials=(sender||'?').substring(0,2).toUpperCase(), isDM=chKey.indexOf('dm:')===0, channelLabel=isDM?t('chat-direct-message-sub'):label;
  var toast=document.createElement('div'); toast.className='dm-toast'; toast.id=tid;
  var bar=document.createElement('div'); bar.className='dm-toast-bar'; toast.appendChild(bar);
  var body=document.createElement('div'); body.className='dm-toast-body';
  body.innerHTML='<div class="dm-toast-avatar">'+escHtml(initials)+'</div><div class="dm-toast-content"><div class="dm-toast-sender">'+escHtml(sender)+'</div><div class="dm-toast-channel">'+escHtml(channelLabel)+'</div><div class="dm-toast-preview">'+escHtml((preview||'').substring(0,60))+'</div></div><button class="dm-toast-close">✕</button>';
  body.querySelector('.dm-toast-close').onclick=function(e){ closeDMToast(tid,e); };
  (function(k,l,dm){ body.addEventListener('click',function(e){ if(e.target.classList.contains('dm-toast-close')) return; closeDMToast(tid,null); showPage('chat'); setTimeout(function(){ selectChannel(k,dm?'@':'#',l); },150); }); })(chKey,label,isDM);
  toast.appendChild(body);
  if(count>1){ var ce=document.createElement('div'); ce.className='dm-toast-count'; ce.textContent=count+' '+t('dm-toast-unread-suffix'); toast.appendChild(ce); }
  container.appendChild(toast); _playNotifSound();
  clearTimeout(_dmToastTimers[tid]); _dmToastTimers[tid]=setTimeout(function(){ closeDMToast(tid,null); },6000);
}
function closeDMToast(tid,e){ if(e){ e.preventDefault(); e.stopPropagation(); } var el=document.getElementById(tid); if(!el) return; el.classList.add('hide'); setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); },300); clearTimeout(_dmToastTimers[tid]); }
function _playNotifSound(){ try{ var ctx=new(window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.setValueAtTime(880,ctx.currentTime); osc.frequency.setValueAtTime(1100,ctx.currentTime+0.1); gain.gain.setValueAtTime(0.15,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3); osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.3); }catch(e){} }
function showNavChatBadge(count){ var link=document.getElementById('nav-chat-link'); if(!link) return; var badge=link.querySelector('.nav-badge'); if(!badge){ badge=document.createElement('span'); badge.className='nav-badge'; link.appendChild(badge); } badge.textContent=count>99?'99+':String(count); badge.style.display='flex'; }
function clearNavChatBadge(){ _chatPageOpen=true; var link=document.getElementById('nav-chat-link'); if(!link) return; var badge=link.querySelector('.nav-badge'); if(badge) badge.style.display='none'; }
function updateSidebarBadge(channelKey,count){ var safeKey=channelKey.replace(/[^a-zA-Z0-9]/g,'-'),el=document.getElementById('ch-'+safeKey); if(!el) return; var existing=el.querySelector('.chat-unread-count'); if(count>0&&channelKey!==activeChannel){ el.classList.add('has-unread'); if(!existing){ var badge=document.createElement('span'); badge.className='chat-unread-count'; el.appendChild(badge); existing=badge; } existing.textContent=count>99?'99+':String(count); } else { el.classList.remove('has-unread'); if(existing) existing.remove(); } }

/* ═══ CHAT ═══ */
function initChat(){ _chatPageOpen=true; clearNavChatBadge(); if(chatPollInterval) return; if(!currentUserAlias){ setTimeout(initChat,500); return; } loadMessages(); loadReactions(); chatPollInterval=setInterval(loadMessages,5000); if(!reactionPollInterval) reactionPollInterval=setInterval(loadReactions,30000); }
function processMessageContent(text){ if(!text) return ''; return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/@([a-zA-Z0-9._-]+)/g,'<span class="mention-tag">@$1</span>'); }
function formatTime(ts){ if(!ts) return ''; var d=new Date(ts); return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0'); }

function loadMessages(){
  var ch=activeChannel;
  if(typeof google==='undefined'||!google.script||!google.script.run) return;
  google.script.run
    .withSuccessHandler(function(rows){ if(ch!==activeChannel) return; var c=document.getElementById('chat-messages'); if(c&&c.querySelector('[style*="skeletonPulse"]')) c.innerHTML=''; renderMessages(rows,ch); })
    .withFailureHandler(function(e){ console.error('loadMessages:',e); })
    .getChatMessages(ch,lastMessageId,60);
}

function renderMessages(rows,channel){
  if(channel!==activeChannel||!rows||!rows.length){ var c=document.getElementById('chat-messages'); if(c&&!c.querySelector('.chat-msg-group')&&!c.querySelector('.chat-empty')) c.innerHTML='<div class="chat-empty" id="chat-empty" style="display:flex"><span class="chat-empty-icon">💬</span><span>'+t('chat-empty-full')+'</span></div>'; return; }
  var container=document.getElementById('chat-messages'), empty=document.getElementById('chat-empty'); if(empty) empty.style.display='none';
  var wasAtBottom=container.scrollHeight-container.scrollTop-container.clientHeight<60;
  rows.forEach(function(row){
    var id=row[0]; if(id<=lastMessageId) return;
    lastMessageId=id; if(_chatOldestMsgId===null||id<_chatOldestMsgId) _chatOldestMsgId=id;
    _lastSeenMap[activeChannel]=id; _saveLastSeenMap(); _unreadMap[activeChannel]=0; updateSidebarBadge(activeChannel,0);
    var alias=row[2],message=row[3],msgType=row[4]||'text',fileUrl=row[5]||'';
    var isMe=(alias===currentUserAlias),isSys=(alias==='sistema');
    var group=document.createElement('div'); group.className='chat-msg-group '+(isMe?'from-me':'from-other'); group.dataset.msgId=id;
    if(!isSys){ var meta=document.createElement('div'); meta.className='chat-msg-meta'; if(!isMe){ var au=document.createElement('span'); au.className='chat-msg-author'; au.textContent=alias; meta.appendChild(au); } var tm=document.createElement('span'); tm.className='chat-msg-time'; tm.textContent=formatTime(row[1]); meta.appendChild(tm); group.appendChild(meta); }
    var bubble=document.createElement('div'); bubble.className='chat-msg-bubble'+(isMe?' is-me':'')+(isSys?' is-system':'');
    if(msgType==='videocall'){ var cd=document.createElement('div'); cd.className='video-call-message'; cd.innerHTML='<span style="font-size:20px;">📹</span><span class="video-call-message-text">'+escHtml(alias)+' '+t('chat-video-call-started')+'</span><a class="video-call-message-link" href="'+escHtml(fileUrl)+'" target="_blank">'+t('chat-video-call-join')+'</a>'; bubble.appendChild(cd); }
    else if(msgType==='file'){ var ext=message.split('.').pop().toLowerCase(); if(['jpg','jpeg','png','gif','webp'].indexOf(ext)!==-1&&fileUrl){ var img=document.createElement('img'); img.className='chat-img-preview'; img.src=fileUrl; img.alt=message; img.onclick=function(){ window.open(fileUrl,'_blank'); }; bubble.appendChild(img); } else { var lk=document.createElement('a'); lk.className='chat-file-link'; lk.href=fileUrl||'#'; lk.target='_blank'; lk.innerHTML='<span class="chat-file-icon">📄</span><span>'+escHtml(message)+'</span>'; bubble.appendChild(lk); } }
    else { bubble.innerHTML=processMessageContent(message); }
    group.appendChild(bubble);
    if(!isSys){ var rb=document.createElement('div'); rb.className='msg-reactions'; rb.id='reactions-'+id; var ab=document.createElement('button'); ab.className='reaction-add-btn'; ab.textContent='＋'; ab.title=t('reaction-add-title'); (function(mid,b){ b.onclick=function(e){ e.stopPropagation(); openEmojiPicker(mid,b); }; })(id,ab); rb.appendChild(ab); group.appendChild(rb); if(_reactions[id]) updateReactionBar(id); }
    container.appendChild(group);
  });
  if(_chatHasMore&&rows.length>=60&&!document.getElementById('load-more-btn')) _addLoadMoreButton(container);
  if(wasAtBottom) container.scrollTop=container.scrollHeight;
}

function _buildChatSkeleton(){ var rows=''; for(var i=0;i<5;i++){ var w=[40,65,55,80,45][i],isMe=i%2===0; rows+='<div class="chat-msg-group '+(isMe?'from-me':'from-other')+'" style="opacity:0.4"><div style="width:'+w+'%;height:36px;background:var(--border2);border-radius:8px;animation:skeletonPulse 1.4s ease-in-out infinite;animation-delay:'+(i*0.12)+'s"></div></div>'; } return rows; }

function _addLoadMoreButton(container){ var btn=document.createElement('button'); btn.id='load-more-btn'; btn.style.cssText='display:block;width:100%;padding:10px;margin-bottom:12px;background:transparent;border:1px dashed var(--border2);color:var(--text3);font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all 0.2s;'; btn.textContent=t('chat-load-more'); btn.onmouseover=function(){ this.style.borderColor='var(--text)'; this.style.color='var(--text)'; }; btn.onmouseout=function(){ this.style.borderColor='var(--border2)'; this.style.color='var(--text3)'; }; btn.onclick=loadMoreMessages; container.insertBefore(btn,container.firstChild); }

function loadMoreMessages(){
  if(_chatLoadingMore||!_chatHasMore||!_chatOldestMsgId) return;
  _chatLoadingMore=true; var btn=document.getElementById('load-more-btn'); if(btn) btn.textContent=t('loading-caps');
  var ch=activeChannel;
  if(typeof google==='undefined'||!google.script||!google.script.run) return;
  google.script.run
    .withSuccessHandler(function(rows){
      _chatLoadingMore=false;
      if(!rows||!rows.length){ _chatHasMore=false; var b=document.getElementById('load-more-btn'); if(b) b.parentNode.removeChild(b); return; }
      if(rows.length<60) _chatHasMore=false;
      var container=document.getElementById('chat-messages'), scrollBottom=container.scrollHeight-container.scrollTop;
      var btn2=document.getElementById('load-more-btn'); if(btn2) btn2.parentNode.removeChild(btn2);
      var fragment=document.createDocumentFragment();
      rows.forEach(function(row){ var id=row[0]; if(id<_chatOldestMsgId) _chatOldestMsgId=id; var alias=row[2],message=row[3],msgType=row[4]||'text',fileUrl=row[5]||''; var isMe=(alias===currentUserAlias),isSys=(alias==='sistema'); var group=document.createElement('div'); group.className='chat-msg-group '+(isMe?'from-me':'from-other'); group.dataset.msgId=id; if(!isSys){ var meta=document.createElement('div'); meta.className='chat-msg-meta'; if(!isMe){ var a2=document.createElement('span'); a2.className='chat-msg-author'; a2.textContent=alias; meta.appendChild(a2); } var t2=document.createElement('span'); t2.className='chat-msg-time'; t2.textContent=formatTime(row[1]); meta.appendChild(t2); group.appendChild(meta); } var bubble=document.createElement('div'); bubble.className='chat-msg-bubble'+(isMe?' is-me':'')+(isSys?' is-system':''); if(msgType==='file'){ bubble.innerHTML='<a class="chat-file-link" href="'+escHtml(fileUrl)+'" target="_blank"><span class="chat-file-icon">📄</span><span>'+escHtml(message)+'</span></a>'; } else if(msgType!=='videocall'){ bubble.innerHTML=processMessageContent(message); } group.appendChild(bubble); fragment.appendChild(group); });
      if(_chatHasMore){ var nb=document.createElement('button'); nb.id='load-more-btn'; nb.style.cssText='display:block;width:100%;padding:10px;margin-bottom:12px;background:transparent;border:1px dashed var(--border2);color:var(--text3);font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;'; nb.textContent=t('chat-load-more'); nb.onclick=loadMoreMessages; container.insertBefore(nb,container.firstChild); }
      container.insertBefore(fragment,container.children[_chatHasMore?1:0]);
      container.scrollTop=container.scrollHeight-scrollBottom;
    })
    .withFailureHandler(function(){ _chatLoadingMore=false; var b=document.getElementById('load-more-btn'); if(b) b.textContent=t('chat-load-more'); })
    .getChatMessagesBefore(ch,_chatOldestMsgId,60);
}

function sendMessage(){
  var input=document.getElementById('chat-input'),text=input.value.trim();
  if(pendingFile){ sendFile(text); return; } if(!text) return;
  if(!currentUserAlias){ setTimeout(sendMessage,600); return; }
  var btn=document.querySelector('.chat-send-btn');
  input.value=''; autoResizeInput(input); closeMentionBox(); btn.disabled=true;
  var tempId=Date.now()+9999999, _prevLastId=lastMessageId; /* v5: guarda o último ID real para não travar o chat */
  renderMessages([[tempId,new Date().toISOString(),currentUserAlias,text,activeChannel,'text','']],activeChannel);
  if(typeof google!=='undefined'&&google.script&&google.script.run){
    google.script.run
      .withSuccessHandler(function(newRow){
        btn.disabled=false;
        if(newRow&&newRow[0]){ var tmpEl=document.querySelector('[data-msg-id="'+tempId+'"]'); if(tmpEl) tmpEl.dataset.msgId=newRow[0]; if(lastMessageId===tempId||newRow[0]>lastMessageId) lastMessageId=newRow[0]; /* v5 */ if(_chatOldestMsgId===null||newRow[0]<_chatOldestMsgId) _chatOldestMsgId=newRow[0]; }
        var mentions=text.match(/@([a-zA-Z0-9._-]+)/g); if(mentions) mentions.forEach(function(m){ var a=m.slice(1); if(a!==currentUserAlias) google.script.run.withFailureHandler(function(){}).notifyMention(a,currentUserAlias,text,activeChannel); });
      })
      .withFailureHandler(function(e){ btn.disabled=false; if(lastMessageId===tempId) lastMessageId=_prevLastId; /* v5 */ var tmpEl=document.querySelector('[data-msg-id="'+tempId+'"]'); if(tmpEl) tmpEl.parentNode.removeChild(tmpEl); input.value=text; autoResizeInput(input); alert(t('alert-send-error')+(e.message||e)); })
      .sendChatMessage(activeChannel,currentUserAlias,text);
  } else { btn.disabled=false; }
}

function onFileSelected(event){ var file=event.target.files[0]; if(!file) return; if(file.size>10*1024*1024){ alert(t('alert-file-too-large-10-limit')); event.target.value=''; return; } pendingFile=file; document.getElementById('chat-file-preview-name').textContent=file.name; document.getElementById('chat-file-preview').classList.add('visible'); }
function clearFileSelection(){ pendingFile=null; document.getElementById('chat-file-input').value=''; document.getElementById('chat-file-preview').classList.remove('visible'); document.getElementById('chat-file-preview-name').textContent=''; }
function sendFile(caption){ if(!pendingFile||!currentUserAlias) return; var btn=document.querySelector('.chat-send-btn'),progress=document.getElementById('upload-progress'),input=document.getElementById('chat-input'); btn.disabled=true; progress.classList.add('visible'); var reader=new FileReader(); reader.onload=function(e){ var base64=e.target.result.split(',')[1],fileName=pendingFile.name,mimeType=pendingFile.type||'application/octet-stream'; clearFileSelection(); input.value=''; autoResizeInput(input); if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(newRow){ btn.disabled=false; progress.classList.remove('visible'); if(newRow) renderMessages([newRow],activeChannel); }).withFailureHandler(function(err){ btn.disabled=false; progress.classList.remove('visible'); alert(t('alert-send-file-error')+(err.message||err)); }).uploadChatFile(activeChannel,currentUserAlias,fileName,mimeType,base64); } else { btn.disabled=false; progress.classList.remove('visible'); } }; reader.readAsDataURL(pendingFile); }
function handleChatKey(e){ if(handleMentionKey(e)) return; if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } }
function handleChatInput(e){ autoResizeInput(e.target); handleMentionInput(e.target); }
function autoResizeInput(el){ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }

function selectChannel(ch,icon,sub){
  activeChannel=ch; lastMessageId=0; _chatPageOpen=true;
  _chatOldestMsgId=null; _chatHasMore=true; _chatLoadingMore=false;
  _unreadMap[ch]=0; _notifiedChannels[ch]=0; updateSidebarBadge(ch,0);
  var toastId='dm-toast-'+ch.replace(/[^a-zA-Z0-9]/g,'-'); closeDMToast(toastId,null);
  document.querySelectorAll('.chat-channel-item').forEach(function(el){ el.classList.remove('active'); });
  var safeKey=ch.replace(/[^a-zA-Z0-9]/g,'-'),el=document.getElementById('ch-'+safeKey);
  if(el){ el.classList.add('active'); el.classList.remove('has-unread'); var badge=el.querySelector('.chat-unread-count'); if(badge) badge.remove(); }
  var nameEl=document.getElementById('chat-ch-name'),subEl=document.getElementById('chat-ch-sub'),iconEl=document.getElementById('chat-ch-icon');
  if(nameEl) nameEl.textContent=sub||ch; if(subEl) subEl.textContent=icon==='@'?t('chat-direct-message-sub'):t('chat-team-channel-sub'); if(iconEl) iconEl.textContent=icon||'#';
  document.getElementById('chat-messages').innerHTML=_buildChatSkeleton();
  _reactions={}; loadMessages(); loadReactions();
}

/* ═══ CANAIS NOMEADOS ═══ */
function loadUserChannels(){ if(!currentUserAlias||currentUserAlias==='visitante') return; if(typeof google==='undefined'||!google.script||!google.script.run) return; google.script.run.withSuccessHandler(function(channels){ _namedChannels=channels||[]; _namedChannels.forEach(function(ch){ if(ch.createdBy===currentUserAlias&&_channelsCreatedByMe.indexOf(ch.key)===-1) _channelsCreatedByMe.push(ch.key); }); renderNamedChannelsSidebar(); }).withFailureHandler(function(){}).getUserChannels(currentUserAlias); }
function renderNamedChannelsSidebar(){ var list=document.getElementById('named-channel-list'); if(!list) return; list.innerHTML=''; _namedChannels.forEach(function(ch){ var item=document.createElement('div'); item.className='chat-channel-item'; var safeKey=ch.key.replace(/[^a-zA-Z0-9]/g,'-'); item.id='ch-'+safeKey; var icon=document.createElement('span'); icon.className='ch-icon'; icon.style.opacity='0.5'; icon.textContent='#'; var label=document.createElement('span'); label.className='ch-label'; label.textContent=ch.name; var cnt=document.createElement('span'); cnt.style.cssText='font-size:9px;color:#2a2a2a;margin-left:4px;'; cnt.textContent=ch.members.length; var editBtn=document.createElement('button'); editBtn.className='ch-edit-btn'; editBtn.title=t('edit-channel-btn-title'); editBtn.textContent='⚙'; editBtn.addEventListener('click',function(e){ e.stopPropagation(); openEditChannelModal(ch.key); }); item.appendChild(icon); item.appendChild(label); item.appendChild(cnt); item.appendChild(editBtn); item.addEventListener('click',(function(c){ return function(){ selectChannel(c.key,'#',c.name); }; })(ch)); list.appendChild(item); if(_unreadMap[ch.key]) updateSidebarBadge(ch.key,_unreadMap[ch.key]); }); }
function openCreateChannelModal(){ _channelMembers=[]; document.getElementById('channel-name-input').value=''; document.getElementById('channel-desc-input').value=''; document.getElementById('channel-member-search').value=''; renderChannelMemberTags(); renderChannelMemberList(knownUsers); document.getElementById('create-channel-modal').classList.add('open'); }
function closeCreateChannelModal(){ document.getElementById('create-channel-modal').classList.remove('open'); }
function renderChannelMemberTags(){ var div=document.getElementById('channel-member-tags'); div.innerHTML=''; _channelMembers.forEach(function(m,i){ var tag=document.createElement('span'); tag.className='channel-member-tag'; tag.innerHTML=escHtml(m)+'<span class="channel-member-tag-remove" onclick="removeChannelMember('+i+')">✕</span>'; div.appendChild(tag); }); }
function renderChannelMemberList(list){ var div=document.getElementById('channel-member-list'); div.innerHTML=''; list.filter(function(u){ return u!==currentUserAlias&&_channelMembers.indexOf(u)===-1; }).forEach(function(u){ var btn=document.createElement('button'); btn.className='dm-user-opt'; btn.textContent=u; btn.onclick=function(){ addChannelMember(u); }; div.appendChild(btn); }); if(!div.innerHTML) div.innerHTML='<p style="color:#333;font-size:11px;padding:8px;text-align:center;">'+t('todos-added')+'</p>'; }
function addChannelMember(u){ if(_channelMembers.indexOf(u)===-1) _channelMembers.push(u); renderChannelMemberTags(); renderChannelMemberList(knownUsers); }
function removeChannelMember(i){ _channelMembers.splice(i,1); renderChannelMemberTags(); renderChannelMemberList(knownUsers); }
function filterChannelMembers(){ var term=document.getElementById('channel-member-search').value.toLowerCase(); renderChannelMemberList(knownUsers.filter(function(u){ return u.toLowerCase().indexOf(term)!==-1; })); }
function submitCreateChannel(){ var name=document.getElementById('channel-name-input').value.trim(); if(!name){ alert(t('alert-channel-name-required')); return; } if(_channelMembers.length===0){ alert(t('alert-channel-member-required')); return; } var btn=document.getElementById('channel-create-btn'); btn.disabled=true; btn.textContent=t('creating-dots'); if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('channel-create-btn'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:t('error-unknown'))); return; } closeCreateChannelModal(); _namedChannels.push({key:result.channelKey,name:result.name,description:'',members:result.members}); _channelsCreatedByMe.push(result.channelKey); renderNamedChannelsSidebar(); selectChannel(result.channelKey,'#',result.name); google.script.run.sendChatMessage(result.channelKey,'sistema','🎉 '+t('system-channel-created-1')+' "'+result.name+'" '+t('system-channel-created-2')+' '+currentUserAlias+'.'); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('channel-create-btn'); alert(t('error-prefix')+': '+e.message); }).createChannel(name,document.getElementById('channel-desc-input').value.trim(),_channelMembers.join(','),currentUserAlias); } else { btn.disabled=false; btn.textContent=t('channel-create-btn'); closeCreateChannelModal(); } }
function openEditChannelModal(channelKey){ var ch=_namedChannels.find(function(c){ return c.key===channelKey; }); if(!ch) return; _editChannelKey=channelKey; _editChannelMembers=ch.members.slice(); document.getElementById('edit-channel-name').value=ch.name||''; document.getElementById('edit-channel-desc').value=ch.description||''; document.getElementById('edit-channel-member-search').value=''; var isCreator=_channelsCreatedByMe.indexOf(channelKey)!==-1; document.getElementById('edit-channel-save-btn').style.display=isCreator?'block':'none'; document.getElementById('edit-channel-delete-btn').style.display=isCreator?'block':'none'; document.getElementById('edit-channel-leave-btn').style.display=isCreator?'none':'block'; document.getElementById('edit-channel-owner-note').style.display=isCreator?'block':'none'; document.getElementById('edit-channel-modal-title').textContent=isCreator?t('edit-channel-title'):t('edit-channel-title-view'); document.getElementById('edit-channel-name').disabled=!isCreator; document.getElementById('edit-channel-desc').disabled=!isCreator; document.getElementById('edit-channel-member-search').style.display=isCreator?'':'none'; renderEditChannelMemberTags(isCreator); renderEditChannelMemberList(knownUsers,isCreator); document.getElementById('edit-channel-modal').classList.add('open'); }
function closeEditChannelModal(){ document.getElementById('edit-channel-modal').classList.remove('open'); _editChannelKey=''; _editChannelMembers=[]; }
function renderEditChannelMemberTags(editable){ var div=document.getElementById('edit-channel-member-tags'); div.innerHTML=''; _editChannelMembers.forEach(function(m,i){ var tag=document.createElement('span'); tag.className='channel-member-tag'; tag.innerHTML=escHtml(m); if(editable&&m!==currentUserAlias) tag.innerHTML+='<span class="channel-member-tag-remove" onclick="removeEditChannelMember('+i+')">✕</span>'; div.appendChild(tag); }); }
function renderEditChannelMemberList(list,editable){ var div=document.getElementById('edit-channel-member-list'); div.innerHTML=''; if(!editable){ div.style.display='none'; return; } div.style.display=''; list.filter(function(u){ return _editChannelMembers.indexOf(u)===-1; }).forEach(function(u){ var btn=document.createElement('button'); btn.className='dm-user-opt'; btn.textContent=u; btn.onclick=function(){ addEditChannelMember(u); }; div.appendChild(btn); }); if(!div.innerHTML) div.innerHTML='<p style="color:#333;font-size:11px;padding:8px;text-align:center;">'+t('todos-added')+'</p>'; }
function addEditChannelMember(u){ if(_editChannelMembers.indexOf(u)===-1) _editChannelMembers.push(u); renderEditChannelMemberTags(true); renderEditChannelMemberList(knownUsers,true); }
function removeEditChannelMember(i){ _editChannelMembers.splice(i,1); renderEditChannelMemberTags(true); renderEditChannelMemberList(knownUsers,true); }
function filterEditChannelMembers(){ var term=document.getElementById('edit-channel-member-search').value.toLowerCase(); renderEditChannelMemberList(knownUsers.filter(function(u){ return u.toLowerCase().indexOf(term)!==-1; }),true); }
function submitEditChannel(){ var name=document.getElementById('edit-channel-name').value.trim(); if(!name){ alert(t('alert-name-empty')); return; } var btn=document.getElementById('edit-channel-save-btn'); btn.disabled=true; btn.textContent=t('saving-dots'); var desc=document.getElementById('edit-channel-desc').value.trim(); if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('save-changes-btn'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } var idx=_namedChannels.findIndex(function(c){ return c.key===_editChannelKey; }); if(idx!==-1){ _namedChannels[idx].name=result.name; _namedChannels[idx].members=result.members; _namedChannels[idx].description=desc; } renderNamedChannelsSidebar(); if(activeChannel===_editChannelKey){ var ne=document.getElementById('chat-ch-name'); if(ne) ne.textContent=result.name; } closeEditChannelModal(); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('save-changes-btn'); alert(t('error-prefix')+': '+e.message); }).editChannel(_editChannelKey,name,desc,_editChannelMembers.join(','),currentUserAlias); } else { btn.disabled=false; btn.textContent=t('save-changes-btn'); closeEditChannelModal(); } }
function confirmLeaveChannel(){ var ch=_namedChannels.find(function(c){ return c.key===_editChannelKey; }); if(!confirm(t('confirm-leave-channel')+' "'+(ch?ch.name:_editChannelKey)+'"?')) return; var btn=document.getElementById('edit-channel-leave-btn'); btn.disabled=true; btn.textContent=t('leaving-dots'); if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('leave-channel-btn'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } _namedChannels=_namedChannels.filter(function(c){ return c.key!==_editChannelKey; }); renderNamedChannelsSidebar(); if(activeChannel===_editChannelKey) selectChannel('geral','#',t('chat-general-desc')); closeEditChannelModal(); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('leave-channel-btn'); alert(t('error-prefix')+': '+e.message); }).leaveChannel(_editChannelKey,currentUserAlias); } }
function confirmDeleteChannel(){ var ch=_namedChannels.find(function(c){ return c.key===_editChannelKey; }); if(!confirm(t('confirm-delete-channel')+' "'+(ch?ch.name:_editChannelKey)+'"?\n'+t('confirm-permanent'))) return; var btn=document.getElementById('edit-channel-delete-btn'); btn.disabled=true; btn.textContent=t('deleting-dots'); if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('delete-channel-btn'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } _namedChannels=_namedChannels.filter(function(c){ return c.key!==_editChannelKey; }); renderNamedChannelsSidebar(); if(activeChannel===_editChannelKey) selectChannel('geral','#',t('chat-general-desc')); closeEditChannelModal(); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('delete-channel-btn'); alert(t('error-prefix')+': '+e.message); }).deleteChannel(_editChannelKey,currentUserAlias); } }

/* ═══ DM ═══ */
function openDmModal(){ document.getElementById('dm-search').value=''; renderDmList(knownUsers); document.getElementById('dm-modal').classList.add('open'); }
function closeDmModal(){ document.getElementById('dm-modal').classList.remove('open'); }
function renderDmList(list){ var div=document.getElementById('dm-user-list'); div.innerHTML=''; list.filter(function(u){ return u!==currentUserAlias; }).forEach(function(u){ var btn=document.createElement('button'); btn.className='dm-user-opt'; btn.textContent=u; btn.onclick=function(){ startDM(u); closeDmModal(); }; div.appendChild(btn); }); }
function filterDmUsers(){ var term=document.getElementById('dm-search').value.toLowerCase(); renderDmList(knownUsers.filter(function(u){ return u.toLowerCase().includes(term); })); }
function _saveDMsToStorage(){ try{ localStorage.setItem('klava-dms-'+currentUserAlias,JSON.stringify(openDMs.map(function(k){ return {chKey:k,createdBy:_dmCreators[k]||currentUserAlias}; }))); }catch(e){} }
function _loadDMsFromStorage(){ try{ var saved=localStorage.getItem('klava-dms-'+currentUserAlias); if(!saved) return; JSON.parse(saved).forEach(function(entry){ var chKey=typeof entry==='string'?entry:entry.chKey,createdBy=typeof entry==='string'?currentUserAlias:(entry.createdBy||currentUserAlias); if(!openDMs.includes(chKey)){ openDMs.push(chKey); _dmCreators[chKey]=createdBy; var parts=chKey.replace('dm:','').split('_'),partner=parts.find(function(p){ return p!==currentUserAlias; })||parts[1]||parts[0]; addDMToSidebar(chKey,partner,createdBy); } }); }catch(e){} }
function startDM(partner){ var pair=[currentUserAlias,partner].sort(),chKey='dm:'+pair[0]+'_'+pair[1]; if(!openDMs.includes(chKey)){ openDMs.push(chKey); _dmCreators[chKey]=currentUserAlias; addDMToSidebar(chKey,partner,currentUserAlias); _saveDMsToStorage(); } selectChannel(chKey,'@',partner); }
function addDMToSidebar(chKey,label,createdBy){ var dmList=document.getElementById('dm-list'); if(!dmList) return; var safeKey=chKey.replace(/[^a-zA-Z0-9]/g,'-'); if(document.getElementById('ch-'+safeKey)) return; if(createdBy) _dmCreators[chKey]=createdBy; var item=document.createElement('div'); item.className='chat-channel-item'; item.id='ch-'+safeKey; item.style.cssText='position:relative;'; var icon=document.createElement('span'); icon.className='ch-icon'; icon.textContent='●'; var lbl=document.createElement('span'); lbl.className='ch-label'; lbl.textContent=label; item.appendChild(icon); item.appendChild(lbl); var isCreator=(_dmCreators[chKey]===currentUserAlias)||(!_dmCreators[chKey]&&createdBy===currentUserAlias); if(isCreator){ var delBtn=document.createElement('button'); delBtn.className='ch-edit-btn'; delBtn.title=t('delete-conversation-title'); delBtn.textContent='✕'; delBtn.style.cssText='font-size:11px;'; (function(k,l){ delBtn.onclick=function(e){ e.stopPropagation(); if(!confirm(t('confirm-delete-conversation')+' '+l+'?')) return; var sk=k.replace(/[^a-zA-Z0-9]/g,'-'),el2=document.getElementById('ch-'+sk); if(el2) el2.parentNode.removeChild(el2); openDMs=openDMs.filter(function(x){ return x!==k; }); delete _dmCreators[k]; _saveDMsToStorage(); if(activeChannel===k) selectChannel('geral','#',t('chat-general-desc')); }; })(chKey,label); item.appendChild(delBtn); } item.addEventListener('click',(function(k,l){ return function(){ selectChannel(k,'@',l); }; })(chKey,label)); dmList.appendChild(item); if(_unreadMap[chKey]) updateSidebarBadge(chKey,_unreadMap[chKey]); }

/* ═══ VIDEOCHAMADA ═══ */
function startVideoCall(){ if(!currentUserAlias||currentUserAlias==='visitante'){ alert(t('alert-login-required')); return; } var btn=document.getElementById('video-call-btn'); if(btn){ btn.disabled=true; btn.innerHTML='📹 <span>'+t('video-call-creating')+'</span>'; } var channelLabel=document.getElementById('chat-ch-name')?document.getElementById('chat-ch-name').textContent:activeChannel; if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ if(btn){ btn.disabled=false; btn.innerHTML='📹 <span>'+t('video-call-label')+'</span>'; } if(!result||!result.ok){ alert(t('error-prefix')+' ('+t('video-call-label')+'): '+(result?result.msg:t('error-unknown'))); return; } showMeetToast(result.meetUrl,channelLabel); loadMessages(); }).withFailureHandler(function(e){ if(btn){ btn.disabled=false; btn.innerHTML='📹 <span>'+t('video-call-label')+'</span>'; } alert(t('error-prefix')+' ('+t('video-call-label')+'): '+(e.message||e)); }).createMeetCall(activeChannel,currentUserAlias,channelLabel); } else { if(btn){ btn.disabled=false; btn.innerHTML='📹 <span>'+t('video-call-label')+'</span>'; } showMeetToast('https://meet.google.com/new',channelLabel); } }
function showMeetToast(meetUrl,channelLabel){ var toast=document.getElementById('meet-toast'),link=document.getElementById('meet-toast-link'),title=document.getElementById('meet-toast-title'); if(!toast) return; if(title) title.textContent='📹 '+(channelLabel||t('meet-toast-default-title')); if(link) link.href=meetUrl; toast.style.display='block'; clearTimeout(window._meetToastTimer); window._meetToastTimer=setTimeout(closeMeetToast,30000); }
function closeMeetToast(){ var toast=document.getElementById('meet-toast'); if(toast) toast.style.display='none'; clearTimeout(window._meetToastTimer); }

/* ═══ MENÇÕES ═══ */
function handleMentionInput(input){ var before=input.value.substring(0,input.selectionStart),match=before.match(/@([a-zA-Z0-9._-]*)$/); if(!match){ closeMentionBox(); return; } var q=match[1].toLowerCase(),filtered=mentionUsers.filter(function(u){ return u.alias.toLowerCase().indexOf(q)===0||u.name.toLowerCase().indexOf(q)!==-1; }); if(!filtered.length){ closeMentionBox(); return; } mentionActive=true; mentionIndex=-1; renderMentionBox(filtered,input); }
function renderMentionBox(users,input){ var box=document.getElementById('mention-box'),rect=input.getBoundingClientRect(); box.style.left=rect.left+'px'; box.style.bottom=(window.innerHeight-rect.top+6)+'px'; box.style.top='auto'; box.style.display='block'; box.innerHTML=''; users.forEach(function(u){ var opt=document.createElement('div'); opt.className='mention-option'; opt.innerHTML='<strong>@'+u.alias+'</strong><span>'+u.name+'</span>'; opt.addEventListener('mousedown',function(e){ e.preventDefault(); insertMention(u.alias,input); }); box.appendChild(opt); }); }
function insertMention(alias,input){ var before=input.value.substring(0,input.selectionStart),after=input.value.substring(input.selectionStart),newBefore=before.replace(/@([a-zA-Z0-9._-]*)$/,'@'+alias+' '); input.value=newBefore+after; input.setSelectionRange(newBefore.length,newBefore.length); input.focus(); closeMentionBox(); autoResizeInput(input); }
function closeMentionBox(){ mentionActive=false; mentionIndex=-1; var box=document.getElementById('mention-box'); if(box){ box.style.display='none'; box.innerHTML=''; } }
function handleMentionKey(e){ if(!mentionActive) return false; var opts=document.getElementById('mention-box').querySelectorAll('.mention-option'); if(!opts.length) return false; if(e.key==='ArrowDown'){ e.preventDefault(); mentionIndex=Math.min(mentionIndex+1,opts.length-1); opts.forEach(function(o,i){ o.classList.toggle('selected',i===mentionIndex); }); return true; } if(e.key==='ArrowUp'){ e.preventDefault(); mentionIndex=Math.max(mentionIndex-1,0); opts.forEach(function(o,i){ o.classList.toggle('selected',i===mentionIndex); }); return true; } if(e.key==='Enter'||e.key==='Tab'){ var tgt=mentionIndex>=0?opts[mentionIndex]:opts[0]; if(tgt){ e.preventDefault(); tgt.dispatchEvent(new Event('mousedown')); return true; } } if(e.key==='Escape'){ closeMentionBox(); return true; } return false; }
document.addEventListener('click',function(e){ if(e.target.id!=='chat-input') closeMentionBox(); });

/* ═══ CÂMBIO ═══ */
(function(){
  var _panelOpen=false,_histLoaded=false,_charts={};
  window.cwToggle=function(){ _panelOpen=!_panelOpen; document.getElementById('cw-panel').classList.toggle('open',_panelOpen); document.getElementById('cw-arrow').classList.toggle('open',_panelOpen); if(_panelOpen&&!_histLoaded) cwLoadHistory(); };
  var _cwLastUpdated=null;
  window._cwUpdateLabel=function(){ var el=document.getElementById('cw-updated'); if(!el||!_cwLastUpdated) return; var locale=currentLang==='zh'?'zh-CN':currentLang==='en'?'en-GB':'pt-BR'; el.textContent=t('cw-updated-prefix')+': '+_cwLastUpdated.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}); };
  async function cwLoadToday(){ try{ var r=await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,CNY-BRL'); if(!r.ok) throw new Error(r.status); var d=await r.json(); var usd={bid:parseFloat(d.USDBRL.bid),pct:parseFloat(d.USDBRL.pctChange)},cny={bid:parseFloat(d.CNYBRL.bid),pct:parseFloat(d.CNYBRL.pctChange)}; function cc(v){ return v>0?'up':v<0?'dn':''; } function ct(v){ return(v>0?'+':'')+v.toFixed(2)+'% hoje'; } document.getElementById('cw-coins').innerHTML='<div class="cw-coin"><span class="cw-coin-name">USD / BRL</span><span class="cw-coin-val">R$&nbsp;'+usd.bid.toFixed(2)+'</span><span class="cw-coin-chg '+cc(usd.pct)+'">'+ct(usd.pct)+'</span></div><div class="cw-divider"></div><div class="cw-coin"><span class="cw-coin-name">CNY / BRL</span><span class="cw-coin-val">R$&nbsp;'+cny.bid.toFixed(4)+'</span><span class="cw-coin-chg '+cc(cny.pct)+'">'+ct(cny.pct)+'</span></div>'; _cwLastUpdated=new Date(); _cwUpdateLabel(); }catch(e){ console.warn('cwLoadToday:',e); } }
  async function cwLoadHistory(){ _histLoaded=true; await Promise.all([cwFetchPair('USD-BRL','cw-chart-usd','cw-msg-usd','#e8e8e8'),cwFetchPair('CNY-BRL','cw-chart-cny','cw-msg-cny','#aaaaaa')]); }
  async function cwFetchPair(pair,canvasId,msgId,color){ var msg=document.getElementById(msgId); try{ var r=await fetch('https://economia.awesomeapi.com.br/json/daily/'+pair+'/7'); if(!r.ok) throw new Error('HTTP '+r.status); var raw=await r.json(); if(!Array.isArray(raw)||!raw.length) throw new Error('empty'); var data=raw.slice().reverse(); var labels=data.map(function(x){ var ds=x.create_date?x.create_date.substring(0,10):''; if(!ds&&x.timestamp){ var d2=new Date(parseInt(x.timestamp)*1000); ds=d2.toISOString().substring(0,10); } var p=ds.split('-'); return p.length===3?p[2]+'/'+p[1]:ds; }); var values=data.map(function(x){ return parseFloat(x.bid||x.ask||0); }); var clean=labels.reduce(function(acc,lbl,i){ if(values[i]>0){ acc.labels.push(lbl); acc.values.push(values[i]); } return acc; },{labels:[],values:[]}); if(!clean.values.length) throw new Error('no values'); msg.style.display='none'; var canvas=document.getElementById(canvasId); canvas.style.display='block'; if(_charts[canvasId]) _charts[canvasId].destroy(); var mn=Math.min.apply(null,clean.values),mx=Math.max.apply(null,clean.values),pad=(mx-mn)*0.35||0.05; _charts[canvasId]=new Chart(canvas,{type:'line',data:{labels:clean.labels,datasets:[{data:clean.values,borderColor:color,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:1.5,pointRadius:3,pointBackgroundColor:color,fill:true,tension:0.3}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:400},plugins:{legend:{display:false}},scripts:{x:{grid:{color:'#1a1a1a'},ticks:{color:'#555',font:{size:9},maxRotation:0}},y:{min:parseFloat((mn-pad).toFixed(4)),max:parseFloat((mx+pad).toFixed(4)),grid:{color:'#1a1a1a'},ticks:{color:'#555',font:{size:9},callback:function(v){ return 'R$ '+v.toFixed(4); }}}}}}); }catch(e){ console.warn('cwFetchPair:',e); if(msg) msg.textContent=t('cw-unavailable'); } }
  window.cwLoadToday=cwLoadToday;
  cwLoadToday(); setInterval(cwLoadToday,60000);
})();

/* ═══ BUSCA GLOBAL ═══ */
var _globalSearchTimer=null, _globalSearchOpen=false;
function toggleGlobalSearch(){
  var panel=document.getElementById('global-search-panel');
  _globalSearchOpen=!_globalSearchOpen;
  panel.style.display=_globalSearchOpen?'block':'none';
  if(_globalSearchOpen){ setTimeout(function(){ document.getElementById('global-search-input').focus(); },50); }
}
document.addEventListener('click',function(e){
  var wrap=document.querySelector('.global-search-wrap');
  if(_globalSearchOpen&&wrap&&!wrap.contains(e.target)){ _globalSearchOpen=false; var p=document.getElementById('global-search-panel'); if(p) p.style.display='none'; }
});
function onGlobalSearchInput(value){
  clearTimeout(_globalSearchTimer);
  var resultsEl=document.getElementById('global-search-results');
  var q=(value||'').trim();
  if(q.length<2){ resultsEl.innerHTML='<div style="padding:10px;font-size:11px;color:#555;text-align:center;">'+t('global-search-hint')+'</div>'; return; }
  resultsEl.innerHTML='<div style="padding:10px;font-size:11px;color:#555;text-align:center;">'+t('loading')+'</div>';
  _globalSearchTimer=setTimeout(function(){
    if(typeof google==='undefined'||!google.script||!google.script.run) return;
    google.script.run.withSuccessHandler(function(result){ renderGlobalSearchResults(result||{}); }).withFailureHandler(function(){ resultsEl.innerHTML='<div style="padding:10px;font-size:11px;color:#555;text-align:center;">'+t('drive-error')+'</div>'; }).globalSearch(q,currentUserAlias);
  },350);
}
function _gsSection(title,items,renderFn){
  if(!items||!items.length) return '';
  var html='<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#555;margin:10px 0 4px;">'+escHtml(title)+'</div>';
  items.forEach(function(it){ html+=renderFn(it); });
  return html;
}
function renderGlobalSearchResults(result){
  var resultsEl=document.getElementById('global-search-results');
  var total=(result.tasks||[]).length+(result.contacts||[]).length+(result.driveLinks||[]).length+(result.chat||[]).length+(result.wiki||[]).length;
  if(!total){ resultsEl.innerHTML='<div style="padding:10px;font-size:11px;color:#555;text-align:center;">'+t('global-search-no-results')+'</div>'; return; }
  var html='';
  html+=_gsSection(t('global-search-section-wiki'),result.wiki,function(it){
    return '<div class="global-search-item" onclick="goToSearchResult(\'wiki\',\''+escHtml(it.id)+'\')" style="padding:8px 6px;cursor:pointer;border-radius:4px;font-size:12px;" onmouseover="this.style.background=\'rgba(255,255,255,.05)\'" onmouseout="this.style.background=\'transparent\'">📘 '+escHtml(it.titulo)+'</div>';
  });
  html+=_gsSection(t('global-search-section-tasks'),result.tasks,function(it){
    return '<div class="global-search-item" onclick="goToSearchResult(\'task\',\''+escHtml(it.id)+'\')" style="padding:8px 6px;cursor:pointer;border-radius:4px;font-size:12px;" onmouseover="this.style.background=\'rgba(255,255,255,.05)\'" onmouseout="this.style.background=\'transparent\'"><strong>#'+escHtml(it.numero)+'</strong> '+escHtml(it.titulo)+'</div>';
  });
  html+=_gsSection(t('global-search-section-contacts'),result.contacts,function(it){
    return '<div class="global-search-item" onclick="goToSearchResult(\'contact\',\''+escHtml(it.id)+'\')" style="padding:8px 6px;cursor:pointer;border-radius:4px;font-size:12px;" onmouseover="this.style.background=\'rgba(255,255,255,.05)\'" onmouseout="this.style.background=\'transparent\'"><strong>'+escHtml(it.nome)+'</strong> · '+escHtml(it.cargo)+'</div>';
  });
  html+=_gsSection(t('global-search-section-drive'),result.driveLinks,function(it){
    return '<div class="global-search-item" onclick="goToSearchResult(\'drive\',\''+escHtml(it.url)+'\')" style="padding:8px 6px;cursor:pointer;border-radius:4px;font-size:12px;" onmouseover="this.style.background=\'rgba(255,255,255,.05)\'" onmouseout="this.style.background=\'transparent\'">🔗 '+escHtml(it.title)+'</div>';
  });
  html+=_gsSection(t('global-search-section-chat'),result.chat,function(it){
    return '<div class="global-search-item" onclick="goToSearchResult(\'chat\',\''+escHtml(it.channel)+'\')" style="padding:8px 6px;cursor:pointer;border-radius:4px;font-size:12px;" onmouseover="this.style.background=\'rgba(255,255,255,.05)\'" onmouseout="this.style.background=\'transparent\'"><strong>'+escHtml(it.sender)+':</strong> '+escHtml(it.text)+'</div>';
  });
  resultsEl.innerHTML=html;
}
function goToSearchResult(type,ref){
  _globalSearchOpen=false; var p=document.getElementById('global-search-panel'); if(p) p.style.display='none';
  if(type==='task'){
    showPage('tarefas');
    setTimeout(function(){ var task=_allTasks.find(function(x){ return x.id===ref; }); if(task) populateAndOpenCardDetail(task); },300);
  } else if(type==='contact'){
    showPage('contato');
    setTimeout(function(){ if(!_contactsLoaded){ setTimeout(function(){ var c=_contactsData.find(function(x){return x.id===ref;}); if(c) openContactDetailModal(c); },600); return; } var c=_contactsData.find(function(x){ return x.id===ref; }); if(c) openContactDetailModal(c); },300);
  } else if(type==='drive'){
    window.open(ref,'_blank');
  } else if(type==='chat'){
    showPage('chat');
    setTimeout(function(){ var icon=ref.indexOf('dm:')===0?'@':'#'; selectChannel(ref,icon,ref.replace('canal:','#').replace('dm:','')); },300);
  } else if(type==='wiki'){
    showPage('wiki');
    setTimeout(function(){ if(!_wikiLoaded){ setTimeout(function(){ var a=_wikiData.find(function(x){return x.id===ref;}); if(a) openWikiDetailModal(a); },600); return; } var a=_wikiData.find(function(x){ return x.id===ref; }); if(a) openWikiDetailModal(a); },300);
  }
}
function populateAndOpenCardDetail(task){ openCardDetailModal(task.id); }

/* ═══ NOTIFICAÇÕES DO NAVEGADOR ═══ */
function _updateNotifBtnState(){
  var btn=document.getElementById('notif-toggle'); if(!btn) return;
  if(typeof Notification==='undefined'){ btn.style.display='none'; return; }
  if(Notification.permission==='granted'){ btn.textContent='🔔'; btn.style.color='#4caf7d'; }
  else if(Notification.permission==='denied'){ btn.textContent='🔕'; btn.style.color='#e05555'; }
  else { btn.textContent='🔔'; }
}
function toggleBrowserNotifications(){
  if(typeof Notification==='undefined') return;
  if(Notification.permission==='granted'){ _showToast(t('notif-enabled-toast')); return; }
  if(Notification.permission==='denied'){ _showToast(t('notif-blocked-explain')); return; }
  Notification.requestPermission().then(function(perm){ _updateNotifBtnState(); if(perm==='granted') _showToast(t('notif-enabled-toast')); else _showToast(t('notif-blocked-explain')); });
}
function _showToast(msg){
  var el=document.createElement('div');
  el.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:6px;font-size:12px;line-height:1.5;max-width:360px;text-align:center;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.4);';
  el.textContent=msg; document.body.appendChild(el);
  setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); },300); },5000);
}
function _fireBrowserNotification(title,body,onClick){
  if(typeof Notification==='undefined'||Notification.permission!=='granted') return;
  if(document.hasFocus()) return;
  try{
    var n=new Notification(title,{body:body,icon:'https://cdn-icons-png.flaticon.com/512/2111/2111463.png'});
    if(onClick) n.onclick=function(){ window.focus(); onClick(); n.close(); };
  }catch(e){}
}

/* ═══ NOTIFICAÇÕES DE TAREFAS ═══ */
var _taskNotifTimer=null;
function _getSeenTaskIds(){ try{ return JSON.parse(localStorage.getItem('klava-seen-tasks-'+currentUserAlias)||'[]'); }catch(e){ return []; } }
function _saveSeenTaskIds(ids){ try{ localStorage.setItem('klava-seen-tasks-'+currentUserAlias,JSON.stringify(ids)); }catch(e){} }
function startTaskNotifications(){
  if(!currentUserAlias||currentUserAlias==='visitante'||_taskNotifTimer) return;
  checkTaskNotifications();
  _taskNotifTimer=setInterval(checkTaskNotifications,30000);
}
function checkTaskNotifications(){
  if(typeof google==='undefined'||!google.script||!google.script.run) return;
  google.script.run.withSuccessHandler(function(list){
    list=list||[];
    var link=document.getElementById('nav-tasks-link');
    if(link){
      var badge=link.querySelector('.nav-badge');
      if(list.length){ if(!badge){ badge=document.createElement('span'); badge.className='nav-badge'; link.appendChild(badge); } badge.textContent=list.length>99?'99+':String(list.length); badge.style.display='flex'; }
      else if(badge){ badge.style.display='none'; }
    }
    var seen=_getSeenTaskIds();
    var newOnes=list.filter(function(x){ return seen.indexOf(x.id)===-1; });
    if(newOnes.length){
      newOnes.forEach(function(it){ _fireBrowserNotification(t('nav-tasks')+' · #'+it.numero,it.titulo,function(){ showPage('tarefas'); }); });
      _saveSeenTaskIds(list.map(function(x){ return x.id; }));
    }
  }).withFailureHandler(function(){}).getMyPendingTasks(currentUserAlias);
}

/* ═══ MEU DIA ═══ */
var _meuDiaOffset=0;
function _meuDiaDateStr(offset){
  var d=new Date(); d.setDate(d.getDate()+offset);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _meuDiaUpdateDateLabel(offset){
  var el=document.getElementById('meu-dia-date-label'); if(!el) return;
  if(offset===0){ el.textContent=t('meu-dia-today-label'); return; }
  var d=new Date(); d.setDate(d.getDate()+offset);
  try{ el.textContent=d.toLocaleDateString(localeTag(),{weekday:'short',day:'2-digit',month:'2-digit'}); }catch(e){ el.textContent=_meuDiaDateStr(offset); }
}
function meuDiaNavigate(delta){ loadMeuDia(_meuDiaOffset+delta); }
function meuDiaGoToday(){ loadMeuDia(0); }
function loadMeuDia(offset){
  offset=offset||0; _meuDiaOffset=offset;
  if(!currentUserAlias||currentUserAlias==='visitante') return;
  _meuDiaUpdateDateLabel(offset);
  var dateStr=_meuDiaDateStr(offset);
  var cacheKey='klava-meu-dia-'+currentUserAlias+'-'+dateStr;
  try{
    var cached=JSON.parse(localStorage.getItem(cacheKey)||'null');
    if(cached&&cached.data&&(Date.now()-cached.ts)<3600000) renderMeuDia(cached.data);
  }catch(e){}
  if(typeof google==='undefined'||!google.script||!google.script.run) return;
  google.script.run.withSuccessHandler(function(data){
    data=data||{}; renderMeuDia(data);
    try{ localStorage.setItem(cacheKey,JSON.stringify({ts:Date.now(),data:data})); }catch(e){}
  }).withFailureHandler(function(){}).getMyDayData(currentUserAlias,_lastSeenMap,dateStr);
  if(!window._meuDiaTimer) window._meuDiaTimer=setInterval(function(){ loadMeuDia(_meuDiaOffset); },300000);
}
var _lastMeuDiaData=null;
function renderMeuDia(data){
  _lastMeuDiaData=data;
  var body=document.getElementById('meu-dia-body'); if(!body) return;
  body.removeAttribute('data-i18n');
  _meuDiaUpdateDateLabel(_meuDiaOffset);
  var tasksToday=data.tasksToday||[], unreadTotal=data.unreadTotal||0, birthdays=data.birthdays||[];
  var calendarEvents=data.calendarEvents||[], calendarShared=!!data.calendarShared;
  var html='';
  html+='<div style="margin-bottom:14px;"><div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#555;margin-bottom:6px;">'+t('meu-dia-tasks-today')+'</div>';
  if(tasksToday.length){
    tasksToday.forEach(function(tk){ html+='<div onclick="showPage(\'tarefas\')" style="cursor:pointer;font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06);"><strong>#'+escHtml(tk.numero)+'</strong> '+escHtml(tk.titulo)+'</div>'; });
  } else { html+='<div style="font-size:12px;color:#555;">'+t('meu-dia-no-tasks-today')+'</div>'; }
  html+='</div>';
  html+='<div style="margin-bottom:14px;"><div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#555;margin-bottom:6px;">'+t('meu-dia-calendar-events')+'</div>';
  if(calendarEvents.length){
    calendarEvents.forEach(function(ev){
      if(ev.link){
        html+='<div onclick="window.open(\''+escHtml(ev.link)+'\',\'_blank\')" style="cursor:pointer;font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06);" onmouseover="this.style.color=\'var(--text)\'" onmouseout="this.style.color=\'\'"><strong>'+escHtml(ev.hora)+'</strong> '+escHtml(ev.title)+' <span style="color:#555;">↗</span></div>';
      } else {
        html+='<div style="font-size:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06);"><strong>'+escHtml(ev.hora)+'</strong> '+escHtml(ev.title)+'</div>';
      }
    });
  } else if(!calendarShared){
    var runnerEmail=data.calendarRunnerEmail||'';
    var msg=t('meu-dia-calendar-not-shared');
    if(runnerEmail) msg+=' <strong>'+escHtml(runnerEmail)+'</strong>';
    html+='<div style="font-size:11px;color:#555;line-height:1.5;">'+msg+'</div>';
    if(data.calendarError){ html+='<div style="font-size:10px;color:#e05555;line-height:1.4;margin-top:6px;font-family:monospace;">⚠ '+escHtml(data.calendarError)+'</div>'; }
  }
  else { html+='<div style="font-size:12px;color:#555;">'+t('meu-dia-no-calendar-events')+'</div>'; }
  html+='</div>';
  html+='<div style="margin-bottom:14px;"><div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#555;margin-bottom:6px;">'+t('meu-dia-unread')+'</div>';
  if(unreadTotal>0){ html+='<div onclick="showPage(\'chat\')" style="cursor:pointer;font-size:12px;color:var(--text);">'+unreadTotal+' · '+t('meu-dia-view-messages')+'</div>'; }
  else { html+='<div style="font-size:12px;color:#555;">'+t('meu-dia-no-unread')+'</div>'; }
  html+='</div>';
  html+='<div><div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#555;margin-bottom:6px;">'+t('meu-dia-birthdays')+'</div>';
  if(birthdays.length){ birthdays.forEach(function(b){ html+='<div style="font-size:12px;padding:3px 0;">🎂 '+escHtml(b.nome)+' · '+b.dia+'</div>'; }); }
  else { html+='<div style="font-size:12px;color:#555;">'+t('meu-dia-no-birthdays')+'</div>'; }
  html+='</div>';
  body.innerHTML=html;
}

/* ═══ PERGUNTE À INTRANET (IA) ═══ */
function openAiAskModal(){
  document.getElementById('ai-ask-modal').classList.add('open');
  setTimeout(function(){ document.getElementById('ai-ask-input').focus(); },50);
}
function closeAiAskModal(){ document.getElementById('ai-ask-modal').classList.remove('open'); }
function handleAiAskKey(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); submitAiAsk(); } }
function submitAiAsk(){
  var input=document.getElementById('ai-ask-input'), q=input.value.trim();
  var answerEl=document.getElementById('ai-ask-answer');
  if(!q){ answerEl.innerHTML='<div style="font-size:12px;color:#e05555;">'+t('ai-ask-empty-question')+'</div>'; return; }
  var btn=document.getElementById('ai-ask-submit-btn'); btn.disabled=true; btn.textContent=t('ai-ask-thinking');
  answerEl.innerHTML='<div style="font-size:12px;color:var(--text3);">'+t('ai-ask-thinking')+'</div>';
  if(typeof google==='undefined'||!google.script||!google.script.run){ btn.disabled=false; btn.textContent=t('ai-ask-submit-btn'); return; }
  google.script.run.withSuccessHandler(function(result){
    btn.disabled=false; btn.textContent=t('ai-ask-submit-btn');
    if(!result||!result.ok){ answerEl.innerHTML='<div style="font-size:12px;color:#e05555;line-height:1.5;">'+escHtml(result?result.msg:t('error-prefix'))+'</div>'; return; }
    answerEl.innerHTML='<div style="font-size:13px;line-height:1.65;white-space:pre-wrap;color:var(--text);border-top:1px solid var(--border2);padding-top:14px;">'+escHtml(result.answer)+'</div>';
  }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('ai-ask-submit-btn'); answerEl.innerHTML='<div style="font-size:12px;color:#e05555;">'+t('error-prefix')+': '+escHtml(e.message)+'</div>'; }).askIntranetAI(q,currentUserAlias);
}

/* ═══ WIKI (BASE DE CONHECIMENTO) ═══ */
var _wikiData=[], _wikiLoaded=false, _wikiDetailId='', _wikiFormEditingId='', _wikiFilterTerm='';

function initWiki(){
  var addBtn=document.getElementById('wiki-add-btn');
  var isAdmin=(_isAdmin||(currentUserAlias==='tadeu'||currentUserAlias==='luiz'));
  if(addBtn) addBtn.style.display=isAdmin?'inline-block':'none';
  if(_wikiLoaded){ renderWiki(); return; }
  loadWikiArticles();
}

function loadWikiArticles(){
  var container=document.getElementById('wiki-container'); if(container) container.innerHTML='<div class="drive-loading">'+t('loading')+'</div>';
  if(typeof google==='undefined'||!google.script||!google.script.run){ _wikiData=[]; _wikiLoaded=true; renderWiki(); return; }
  google.script.run.withSuccessHandler(function(data){ _wikiData=data||[]; _wikiLoaded=true; renderWiki(); }).withFailureHandler(function(){ var c=document.getElementById('wiki-container'); if(c) c.innerHTML='<div class="drive-empty">'+t('drive-error')+'</div>'; }).getWikiArticles();
}

function filterWiki(term){ _wikiFilterTerm=(term||'').toLowerCase(); renderWiki(); }

function renderWiki(){
  var container=document.getElementById('wiki-container'); if(!container) return; container.innerHTML='';
  var list=_wikiData;
  if(_wikiFilterTerm) list=list.filter(function(a){ return a.titulo.toLowerCase().indexOf(_wikiFilterTerm)!==-1||a.conteudo.toLowerCase().indexOf(_wikiFilterTerm)!==-1; });
  if(!list.length){ container.innerHTML='<div class="drive-empty">'+t('wiki-empty')+'</div>'; return; }
  var groups={}, order=[];
  list.forEach(function(a){ var key=a.categoria||'—'; if(!groups[key]){ groups[key]=[]; order.push(key); } groups[key].push(a); });
  order.sort(function(a,b){ return a.localeCompare(b); });
  order.forEach(function(key){
    var items=groups[key]; if(!items.length) return;
    var secDiv=document.createElement('div'); secDiv.className='section-title'; secDiv.textContent=key; container.appendChild(secDiv);
    var grid=document.createElement('div'); grid.className='content-grid';
    items.forEach(function(a){ var card=document.createElement('div'); card.className='card'; card.onclick=function(){ openWikiDetailModal(a); }; card.innerHTML='<h3>'+escHtml(a.titulo)+'</h3><p>'+escHtml(a.conteudo.substring(0,60))+(a.conteudo.length>60?'…':'')+'</p>'; grid.appendChild(card); });
    container.appendChild(grid);
  });
}

function openWikiDetailModal(a){
  _wikiDetailId=a.id;
  document.getElementById('wkd-titulo').textContent=a.titulo||'—';
  document.getElementById('wkd-categoria').textContent=a.categoria||'—';
  document.getElementById('wkd-conteudo').textContent=a.conteudo||'';
  var metaEl=document.getElementById('wkd-meta');
  try{ var d=new Date(a.updatedAt); metaEl.textContent=t('wiki-last-updated')+' '+d.toLocaleDateString(localeTag())+' · '+(a.updatedBy||''); }catch(e){ metaEl.textContent=''; }
  var isAdmin=(_isAdmin||(currentUserAlias==='tadeu'||currentUserAlias==='luiz'));
  var adminActions=document.getElementById('wkd-admin-actions'); adminActions.style.display=isAdmin?'flex':'none';
  openModal('wiki-detail');
}

function editWikiFromDetail(){ var a=_wikiData.find(function(x){ return x.id===_wikiDetailId; }); if(!a) return; closeModal('wiki-detail'); openWikiFormModal(a); }

function confirmDeleteWikiArticle(){
  var a=_wikiData.find(function(x){ return x.id===_wikiDetailId; }); if(!a) return;
  if(!confirm(t('confirm-delete-wiki-prefix')+' "'+a.titulo+'"?\n\n'+t('confirm-permanent'))) return;
  if(typeof google!=='undefined'&&google.script&&google.script.run){
    google.script.run.withSuccessHandler(function(result){ if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } closeModal('wiki-detail'); _wikiData=_wikiData.filter(function(x){ return x.id!==a.id; }); renderWiki(); }).withFailureHandler(function(e){ alert(t('error-prefix')+': '+e.message); }).deleteWikiArticle(a.id,currentUserAlias);
  }
}

function openWikiFormModal(a){
  _wikiFormEditingId=a?a.id:'';
  document.getElementById('wiki-form-modal-title').textContent=a?t('wiki-form-title-edit'):t('wiki-form-title-new');
  document.getElementById('wiki-form-id').value=a?a.id:'';
  document.getElementById('wiki-form-title').value=a?a.titulo:'';
  document.getElementById('wiki-form-category').value=a?a.categoria:'';
  document.getElementById('wiki-form-content').value=a?a.conteudo:'';
  var datalist=document.getElementById('wiki-category-options'); datalist.innerHTML='';
  var cats=Array.from(new Set(_wikiData.map(function(x){ return x.categoria; }).filter(Boolean)));
  cats.forEach(function(c){ var opt=document.createElement('option'); opt.value=c; datalist.appendChild(opt); });
  var btn=document.getElementById('wiki-form-save-btn'); btn.disabled=false; btn.textContent=t('wiki-save-btn');
  document.getElementById('wiki-form-modal').classList.add('open');
}
function closeWikiFormModal(){ document.getElementById('wiki-form-modal').classList.remove('open'); _wikiFormEditingId=''; }
function submitWikiForm(){
  var titulo=document.getElementById('wiki-form-title').value.trim();
  var categoria=document.getElementById('wiki-form-category').value.trim();
  var conteudo=document.getElementById('wiki-form-content').value.trim();
  if(!titulo){ alert(t('alert-wiki-title-required')); return; }
  if(!categoria){ alert(t('alert-wiki-category-required')); return; }
  if(!conteudo){ alert(t('alert-wiki-content-required')); return; }
  var btn=document.getElementById('wiki-form-save-btn'); btn.disabled=true; btn.textContent=t('saving-dots');
  var payload={id:_wikiFormEditingId,categoria:categoria,titulo:titulo,conteudo:conteudo};
  if(typeof google!=='undefined'&&google.script&&google.script.run){
    google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('wiki-save-btn'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } closeWikiFormModal(); loadWikiArticles(); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('wiki-save-btn'); alert(t('error-prefix')+': '+e.message); }).saveWikiArticle(payload,currentUserAlias);
  } else { btn.disabled=false; btn.textContent=t('wiki-save-btn'); closeWikiFormModal(); }
}

/* ═══ CONTATOS ═══ */
var CONTACT_SECTORS_DEF=[{id:'board',labelKey:'sec-board'},{id:'wholesale',labelKey:'sec-wholesale'},{id:'finance',labelKey:'sec-finance'},{id:'design',labelKey:'sec-design-title'},{id:'logistics',labelKey:'sec-logistics'},{id:'import',labelKey:'sec-import'},{id:'salesops',labelKey:'sec-salesops'}];
var _contactsData=[], _contactsLoaded=false, _contactDetailId='', _contactFormEditingId='';

function initContatos(){
  var addBtn=document.getElementById('contact-add-btn');
  var isAdmin=(_isAdmin||(currentUserAlias==='tadeu'||currentUserAlias==='luiz'));
  if(addBtn) addBtn.style.display=isAdmin?'inline-block':'none';
  if(_contactsLoaded){ renderContatos(); return; }
  loadContacts();
}

function loadContacts(){
  var container=document.getElementById('contatos-container'); if(container) container.innerHTML='<div class="drive-loading">'+t('loading')+'</div>';
  if(typeof google==='undefined'||!google.script||!google.script.run){ _contactsData=[]; _contactsLoaded=true; renderContatos(); return; }
  google.script.run.withSuccessHandler(function(data){ _contactsData=data||[]; _contactsLoaded=true; renderContatos(); }).withFailureHandler(function(){ var c=document.getElementById('contatos-container'); if(c) c.innerHTML='<div class="drive-empty">'+t('drive-error')+'</div>'; }).getContacts();
}

function _contactSectorLabel(c){
  var def=CONTACT_SECTORS_DEF.find(function(s){ return s.id===c.sectorKey; });
  if(def) return t(def.labelKey);
  return c.sectorLabel||c.sectorKey||'';
}

function contactCargoDisplay(c){
  if(currentLang==='en'&&c.cargoEn) return c.cargoEn;
  if(currentLang==='zh'&&c.cargoZh) return c.cargoZh;
  return c.cargo;
}

function renderContatos(){
  var container=document.getElementById('contatos-container'); if(!container) return; container.innerHTML='';
  if(!_contactsData.length){ container.innerHTML='<div class="drive-empty">'+t('no-contacts')+'</div>'; return; }
  var groups={}, order=[];
  _contactsData.forEach(function(c){ var key=c.sectorKey||'__outros__'; if(!groups[key]){ groups[key]=[]; order.push(key); } groups[key].push(c); });
  var knownIds=CONTACT_SECTORS_DEF.map(function(s){ return s.id; });
  order.sort(function(a,b){ var ia=knownIds.indexOf(a), ib=knownIds.indexOf(b); if(ia===-1&&ib===-1) return 0; if(ia===-1) return 1; if(ib===-1) return -1; return ia-ib; });
  order.forEach(function(key){
    var list=groups[key]; if(!list.length) return;
    var label=_contactSectorLabel(list[0]);
    var secDiv=document.createElement('div'); secDiv.className='section-title'; secDiv.textContent=label; container.appendChild(secDiv);
    var grid=document.createElement('div'); grid.className='content-grid';
    list.forEach(function(c){ var card=document.createElement('div'); card.className='card'; card.onclick=function(){ openContactDetailModal(c); }; card.innerHTML='<h3>'+escHtml(c.nome)+'</h3><p>'+escHtml(contactCargoDisplay(c))+'</p>'; grid.appendChild(card); });
    container.appendChild(grid);
  });
}

function openContactDetailModal(c){
  _contactDetailId=c.id;
  document.getElementById('cdt-nome').textContent=c.nome||'—';
  document.getElementById('cdt-cargo').textContent=contactCargoDisplay(c)||'—';
  var waLink=document.getElementById('cdt-whatsapp'), waText=document.getElementById('cdt-telefone');
  if(c.telefone){ var digits=c.telefone.replace(/\D/g,''); waLink.href='https://wa.me/'+digits; waLink.style.display='flex'; waText.textContent=c.telefone; } else { waLink.style.display='none'; }
  var emailWrap=document.getElementById('cdt-email-wrap'), emailText=document.getElementById('cdt-email');
  if(c.email){ emailWrap.style.display='flex'; emailText.textContent=c.email; } else { emailWrap.style.display='none'; }
  var isAdmin=(_isAdmin||(currentUserAlias==='tadeu'||currentUserAlias==='luiz'));
  var adminActions=document.getElementById('cdt-admin-actions'); adminActions.style.display=isAdmin?'flex':'none'; adminActions.style.flexDirection='column';
  openModal('contact-detail');
}

function editContactFromDetail(){ var c=_contactsData.find(function(x){ return x.id===_contactDetailId; }); if(!c) return; closeModal('contact-detail'); openContactFormModal(c); }

function confirmDeleteContact(){
  var c=_contactsData.find(function(x){ return x.id===_contactDetailId; }); if(!c) return;
  if(!confirm(t('confirm-delete-contact-prefix')+' "'+c.nome+'"?\n\n'+t('confirm-permanent'))) return;
  if(typeof google!=='undefined'&&google.script&&google.script.run){
    google.script.run.withSuccessHandler(function(result){ if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } closeModal('contact-detail'); _contactsData=_contactsData.filter(function(x){ return x.id!==c.id; }); renderContatos(); }).withFailureHandler(function(e){ alert(t('error-prefix')+': '+e.message); }).deleteContact(c.id,currentUserAlias);
  }
}

function openContactFormModal(c){
  _contactFormEditingId=c?c.id:'';
  document.getElementById('contact-form-modal-title').textContent=c?t('contact-form-title-edit'):t('contact-form-title-new');
  document.getElementById('contact-form-id').value=c?c.id:'';
  document.getElementById('contact-form-name').value=c?c.nome:'';
  document.getElementById('contact-form-role').value=c?c.cargo:'';
  document.getElementById('contact-form-role-en').value=c?(c.cargoEn||''):'';
  document.getElementById('contact-form-role-zh').value=c?(c.cargoZh||''):'';
  document.getElementById('contact-form-phone').value=c?c.telefone:'';
  document.getElementById('contact-form-email').value=c?c.email:'';
  var sectorSel=document.getElementById('contact-form-sector'), customWrap=document.getElementById('contact-form-sector-custom-wrap'), customInput=document.getElementById('contact-form-sector-custom');
  var knownIds=CONTACT_SECTORS_DEF.map(function(s){ return s.id; });
  if(c&&c.sectorKey&&knownIds.indexOf(c.sectorKey)===-1){ sectorSel.value='__custom__'; customWrap.style.display='block'; customInput.value=c.sectorLabel||c.sectorKey; }
  else { sectorSel.value=c?c.sectorKey:'board'; customWrap.style.display='none'; customInput.value=''; }
  var btn=document.getElementById('contact-form-save-btn'); btn.disabled=false; btn.textContent=t('contact-save-btn');
  document.getElementById('contact-form-modal').classList.add('open');
}
function closeContactFormModal(){ document.getElementById('contact-form-modal').classList.remove('open'); _contactFormEditingId=''; }
function onContactSectorChange(){
  var sel=document.getElementById('contact-form-sector'), wrap=document.getElementById('contact-form-sector-custom-wrap'), input=document.getElementById('contact-form-sector-custom');
  if(sel.value==='__custom__'){ wrap.style.display='block'; input.focus(); } else { wrap.style.display='none'; input.value=''; }
}
function submitContactForm(){
  var nome=document.getElementById('contact-form-name').value.trim();
  var cargo=document.getElementById('contact-form-role').value.trim();
  var cargoEn=document.getElementById('contact-form-role-en').value.trim();
  var cargoZh=document.getElementById('contact-form-role-zh').value.trim();
  var sectorSel=document.getElementById('contact-form-sector').value;
  var sectorCustom=document.getElementById('contact-form-sector-custom').value.trim();
  var telefone=document.getElementById('contact-form-phone').value.trim();
  var email=document.getElementById('contact-form-email').value.trim();
  if(!nome){ alert(t('alert-contact-name-required')); return; }
  if(!cargo){ alert(t('alert-contact-role-required')); return; }
  if(!sectorSel){ alert(t('alert-contact-sector-required')); return; }
  if(sectorSel==='__custom__'&&!sectorCustom){ alert(t('alert-contact-sector-required')); return; }
  var sectorKey=sectorSel==='__custom__'?('custom_'+sectorCustom.toLowerCase().replace(/[^a-z0-9]+/g,'_')):sectorSel;
  var sectorLabel=sectorSel==='__custom__'?sectorCustom:'';
  var btn=document.getElementById('contact-form-save-btn'); btn.disabled=true; btn.textContent=t('saving-dots');
  var payload={id:_contactFormEditingId,sectorKey:sectorKey,sectorLabel:sectorLabel,nome:nome,cargo:cargo,cargoEn:cargoEn,cargoZh:cargoZh,telefone:telefone,email:email};
  if(typeof google!=='undefined'&&google.script&&google.script.run){
    google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('contact-save-btn'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } closeContactFormModal(); loadContacts(); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('contact-save-btn'); alert(t('error-prefix')+': '+e.message); }).saveContact(payload,currentUserAlias);
  } else { btn.disabled=false; btn.textContent=t('contact-save-btn'); closeContactFormModal(); }
}

/* ═══ DRIVE ═══ */
var DRIVE_SECTORS_DEF=[{id:'diretoria',labelKey:'sec-diretoria',uploaders:['thiago','diego','tadeu','luiz']},{id:'comercial',labelKey:'sec-comercial',uploaders:['franklin','tadeu','luiz']},{id:'financeiro',labelKey:'sec-financeiro',uploaders:['nelia','raphael','tadeu','luiz']},{id:'tesouraria',labelKey:'sec-tesouraria',uploaders:['tadeu','luiz']},{id:'design',labelKey:'sec-design',uploaders:['luciano','aurea','luiza','tadeu','luiz']},{id:'logistica',labelKey:'sec-logistica',uploaders:['valeria','tadeu','luiz']},{id:'comex',labelKey:'sec-comex',uploaders:['nayanna','lethicia','tadeu','luiz']},{id:'salesops',labelKey:'sec-salesops-label',uploaders:['tadeu','reinaldo','luiz']},{id:'online',labelKey:'sec-online',uploaders:['tadeu','luiz']},{id:'novo',labelKey:'sec-novo',uploaders:['tadeu','luiz']}];
function getDriveSectors(){ return DRIVE_SECTORS_DEF.map(function(s){ return Object.assign({},s,{label:t(s.labelKey)}); }); }
var DRIVE_SECTORS=getDriveSectors();
function _driveIcon(name){ var ext=(name||'').split('.').pop().toLowerCase(); return {pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📋',pptx:'📋',txt:'📃',csv:'📊',png:'🖼️',jpg:'🖼️',jpeg:'🖼️',gif:'🖼️',webp:'🖼️',zip:'📦',rar:'📦',mp4:'🎬',mp3:'🎵'}[ext]||'📁'; }
function _driveFormatSize(bytes){ if(!bytes) return ''; if(bytes<1024) return bytes+' B'; if(bytes<1048576) return Math.round(bytes/1024)+' KB'; return (bytes/1048576).toFixed(1)+' MB'; }
function _driveFormatDate(iso){ if(!iso) return ''; try{ var d=new Date(iso); return d.toLocaleDateString(localeTag())+' '+d.toLocaleTimeString(localeTag(),{hour:'2-digit',minute:'2-digit'}); }catch(e){ return iso; } }
function initDrive(){ DRIVE_SECTORS=getDriveSectors(); if(_driveLoaded){ renderDriveSectors(); return; } loadDriveFiles(); }
function loadDriveFiles(){
  var container=document.getElementById('drive-sectors-container'); if(container) container.innerHTML='<div class="drive-loading">'+t('drive-loading')+'</div>';
  if(typeof google==='undefined'||!google.script||!google.script.run){ _driveFiles={}; _driveLoaded=true; renderDriveSectors(); return; }
  google.script.run.withSuccessHandler(function(data){ _driveFiles=data||{}; google.script.run.withSuccessHandler(function(ldata){ _driveLinks=ldata||{}; _driveLoaded=true; renderDriveSectors(); }).withFailureHandler(function(){ _driveLinks={}; _driveLoaded=true; renderDriveSectors(); }).getDriveLinks(); }).withFailureHandler(function(e){ var c=document.getElementById('drive-sectors-container'); if(c) c.innerHTML='<div class="drive-empty">'+t('drive-error')+'</div>'; }).getDriveFiles();
}
function renderDriveSectors(){
  var container=document.getElementById('drive-sectors-container'); if(!container) return; container.innerHTML='';
  var term=(_driveSearchTerm||'').toLowerCase(), isAdmin=(_isAdmin||(currentUserAlias==='tadeu'||currentUserAlias==='luiz'));
  DRIVE_SECTORS.forEach(function(sector){
    var files=(_driveFiles[sector.id]||[]).filter(function(f){ if(!term) return true; return (f.name||'').toLowerCase().includes(term)||(f.desc||'').toLowerCase().includes(term); });
    var links=(_driveLinks[sector.id]||[]).filter(function(l){ if(!term) return true; return (l.title||'').toLowerCase().includes(term); });
    var canUpload=sector.uploaders.indexOf(currentUserAlias)!==-1;
    if(term&&!files.length&&!links.length) return;
    var div=document.createElement('div'); div.className='drive-sector';
    var header=document.createElement('div'); header.className='drive-sector-header'; header.innerHTML='<span class="drive-sector-title">'+escHtml(sector.label)+'</span>';
    var actions=document.createElement('div'); actions.className='drive-sector-actions';
    if(isAdmin){ var alb=document.createElement('button'); alb.className='drive-add-link-btn'; alb.textContent=t('drive-add-link'); (function(s){ alb.onclick=function(){ openDriveLinkModal(s); }; })(sector); actions.appendChild(alb); }
    if(canUpload){ var ub=document.createElement('button'); ub.className='drive-upload-btn'; ub.textContent=t('drive-upload-btn'); (function(s){ ub.onclick=function(){ openDriveUploadModal(s); }; })(sector); actions.appendChild(ub); }
    header.appendChild(actions); div.appendChild(header);
    if(links.length||isAdmin){ var typeIcons={sheet:'📊',doc:'📝',dash:'📈',link:'🔗',slides:'📋',folder:'📁'}; var lg=document.createElement('div'); lg.className='drive-links-grid'; links.forEach(function(l){ var card=document.createElement('a'); card.className='drive-link-card'; card.href=l.url; card.target='_blank'; card.innerHTML='<div class="drive-link-card-icon">'+(typeIcons[l.type]||'🔗')+'</div><div class="drive-link-card-title">'+escHtml(l.title)+'</div>'+(l.sub?'<div class="drive-link-card-sub">'+escHtml(l.sub)+'</div>':''); if(isAdmin){ var db=document.createElement('button'); db.className='drive-link-delete'; db.textContent='✕'; db.title=t('drive-btn-remove-link'); db.onclick=function(e){ e.preventDefault(); e.stopPropagation(); if(confirm(t('confirm-remove-link')+' "'+l.title+'"?')) deleteDriveLink(l.id,sector.id); }; card.appendChild(db); } lg.appendChild(card); }); if(!links.length&&isAdmin){ var nl=document.createElement('div'); nl.style.cssText='font-size:11px;color:var(--text4);font-style:italic;padding:4px 0 12px;'; nl.textContent=t('drive-no-links'); lg.appendChild(nl); } div.appendChild(lg); var sep=document.createElement('div'); sep.className='drive-subsection-label'; sep.textContent=t('drive-subsection-files'); div.appendChild(sep); }
    var grid=document.createElement('div'); grid.className='drive-files-grid';
    if(!files.length){ grid.innerHTML='<div class="drive-empty">'+t('drive-no-files')+'</div>'; } else { files.forEach(function(f){ var card=document.createElement('div'); card.className='drive-file-card'; var canDel=isAdmin||f.uploadedBy===currentUserAlias; card.innerHTML='<div class="drive-file-icon">'+_driveIcon(f.name)+'</div><div class="drive-file-name">'+escHtml(f.name)+'</div>'+(f.desc?'<div class="drive-file-meta" style="font-style:italic;">'+escHtml(f.desc)+'</div>':'')+'<div class="drive-file-meta">'+escHtml(f.uploadedBy||'')+' · '+_driveFormatDate(f.uploadedAt)+(f.size?' · '+_driveFormatSize(f.size):'')+' </div><div class="drive-file-actions"><a class="drive-file-btn" href="'+escHtml(f.url)+'" target="_blank">'+t('drive-btn-open')+'</a>'+(canDel?'<button class="drive-file-btn del" onclick="deleteDriveFile(\''+escHtml(f.id)+'\',\''+escHtml(sector.id)+'\',this)">'+t('drive-btn-delete')+'</button>':'')+'</div>'; grid.appendChild(card); }); }
    div.appendChild(grid); container.appendChild(div);
  });
}
function filterDriveFiles(term){ _driveSearchTerm=term; renderDriveSectors(); }
function openDriveUploadModal(sector){ _driveUploadSector=sector; _driveUploadFile=null; document.getElementById('drive-upload-modal-title').textContent=t('drive-upload-modal-title-to')+' '+sector.label; document.getElementById('drive-file-desc').value=''; document.getElementById('drive-drop-label').textContent=t('drive-drop-label'); document.getElementById('drive-file-input').value=''; document.getElementById('drive-upload-progress').classList.remove('visible'); var btn=document.getElementById('drive-upload-btn'); btn.disabled=false; btn.textContent=t('drive-upload-submit-btn'); document.getElementById('drive-upload-modal').classList.add('open'); }
function closeDriveUploadModal(){ document.getElementById('drive-upload-modal').classList.remove('open'); _driveUploadSector=null; _driveUploadFile=null; }
function onDriveFileSelected(event){ var file=event.target.files[0]; if(!file) return; if(file.size>30*1024*1024){ alert(t('alert-file-too-large-30')); event.target.value=''; return; } _driveUploadFile=file; document.getElementById('drive-drop-label').textContent='✓ '+file.name+' ('+_driveFormatSize(file.size)+')'; }
function submitDriveUpload(){
  if(!_driveUploadFile){ alert(t('alert-file-required')); return; } if(!_driveUploadSector) return;
  var btn=document.getElementById('drive-upload-btn'),progress=document.getElementById('drive-upload-progress'); btn.disabled=true; btn.textContent=t('drive-uploading-dots'); progress.classList.add('visible');
  var desc=document.getElementById('drive-file-desc').value.trim(); var reader=new FileReader();
  reader.onload=function(e){ var base64=e.target.result.split(',')[1],mimeType=_driveUploadFile.type||'application/octet-stream',fileName=_driveUploadFile.name,fileSize=_driveUploadFile.size; if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('drive-upload-submit-btn'); progress.classList.remove('visible'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:t('error-unknown'))); return; } closeDriveUploadModal(); if(!_driveFiles[_driveUploadSector.id]) _driveFiles[_driveUploadSector.id]=[]; _driveFiles[_driveUploadSector.id].unshift({id:result.fileId,name:fileName,desc:desc,url:result.url,uploadedBy:currentUserAlias,uploadedAt:new Date().toISOString(),size:fileSize}); renderDriveSectors(); }).withFailureHandler(function(err){ btn.disabled=false; btn.textContent=t('drive-upload-submit-btn'); progress.classList.remove('visible'); alert(t('error-prefix')+': '+(err&&err.message?err.message:t('error-prefix')+'.')); }).uploadDriveFile(_driveUploadSector.id,fileName,mimeType,base64,desc,currentUserAlias,fileSize); } else { btn.disabled=false; btn.textContent=t('drive-upload-submit-btn'); progress.classList.remove('visible'); closeDriveUploadModal(); } };
  reader.readAsDataURL(_driveUploadFile);
}
function deleteDriveFile(fileId,sectorId,btn){ if(!confirm(t('drive-btn-delete')+' — '+t('confirm-permanent'))) return; btn.disabled=true; btn.textContent='…'; if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ if(!result||!result.ok){ btn.disabled=false; btn.textContent=t('drive-btn-delete'); alert(t('error-prefix')+': '+(result?result.msg:'')); return; } if(_driveFiles[sectorId]) _driveFiles[sectorId]=_driveFiles[sectorId].filter(function(f){ return f.id!==fileId; }); renderDriveSectors(); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('drive-btn-delete'); alert(t('error-prefix')+': '+e.message); }).deleteDriveFile(fileId,currentUserAlias); } }
function openDriveLinkModal(sector){ _driveLinkSector=sector; _driveLinkType='link'; document.getElementById('drive-link-modal-title').textContent=t('drive-link-modal-title-to')+' '+sector.label; document.getElementById('drive-link-title').value=''; document.getElementById('drive-link-url').value=''; document.getElementById('drive-link-sub').value=''; document.getElementById('drive-link-progress').classList.remove('visible'); var sb=document.getElementById('drive-link-save-btn'); sb.disabled=false; sb.textContent=t('drive-link-add-btn'); document.querySelectorAll('[id^="link-type-"]').forEach(function(el){ el.classList.remove('selected'); }); document.getElementById('link-type-link').classList.add('selected'); document.getElementById('drive-link-modal').classList.add('open'); }
function closeDriveLinkModal(){ document.getElementById('drive-link-modal').classList.remove('open'); _driveLinkSector=null; }
function selectLinkType(type,el){ _driveLinkType=type; document.querySelectorAll('[id^="link-type-"]').forEach(function(e){ e.classList.remove('selected'); }); if(el) el.classList.add('selected'); }
function submitDriveLink(){ var title=document.getElementById('drive-link-title').value.trim(),url=document.getElementById('drive-link-url').value.trim(),sub=document.getElementById('drive-link-sub').value.trim(); if(!title){ alert(t('alert-title-required')); return; } if(!url){ alert(t('alert-url-required')); return; } if(!url.startsWith('http')) url='https://'+url; if(!_driveLinkSector) return; var btn=document.getElementById('drive-link-save-btn'),prog=document.getElementById('drive-link-progress'); btn.disabled=true; btn.textContent=t('drive-link-saving'); prog.classList.add('visible'); if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('drive-link-add-btn'); prog.classList.remove('visible'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } closeDriveLinkModal(); if(!_driveLinks[_driveLinkSector.id]) _driveLinks[_driveLinkSector.id]=[]; _driveLinks[_driveLinkSector.id].push({id:result.linkId,title:title,url:url,sub:sub,type:_driveLinkType}); renderDriveSectors(); }).withFailureHandler(function(err){ btn.disabled=false; btn.textContent=t('drive-link-add-btn'); prog.classList.remove('visible'); alert(t('error-prefix')+': '+err.message); }).saveDriveLink(_driveLinkSector.id,title,url,sub,_driveLinkType,currentUserAlias); } else { btn.disabled=false; btn.textContent=t('drive-link-add-btn'); prog.classList.remove('visible'); closeDriveLinkModal(); if(!_driveLinks[_driveLinkSector.id]) _driveLinks[_driveLinkSector.id]=[]; _driveLinks[_driveLinkSector.id].push({id:Date.now(),title:title,url:url,sub:sub,type:_driveLinkType}); renderDriveSectors(); } }
function deleteDriveLink(linkId,sectorId){ if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } if(_driveLinks[sectorId]) _driveLinks[sectorId]=_driveLinks[sectorId].filter(function(l){ return String(l.id)!==String(linkId); }); renderDriveSectors(); }).withFailureHandler(function(e){ alert(t('error-prefix')+': '+e.message); }).deleteDriveLink(linkId,currentUserAlias); } }

/* ═══ COMENTÁRIOS ═══ */
function loadComments(taskId){ var list=document.getElementById('cdm-comments-list'); if(!list) return; if(typeof google==='undefined'||!google.script||!google.script.run){ list.innerHTML='<div class="cdm-comments-empty">'+t('cdm-comments-empty')+'</div>'; return; } google.script.run.withSuccessHandler(function(comments){ _cdmComments[taskId]=comments||[]; renderComments(taskId); }).withFailureHandler(function(){ var l=document.getElementById('cdm-comments-list'); if(l) l.innerHTML='<div class="cdm-comments-empty">'+t('cdm-comments-empty')+'</div>'; }).getTaskComments(taskId); }
function renderComments(taskId){ var list=document.getElementById('cdm-comments-list'); if(!list) return; var comments=_cdmComments[taskId]||[]; if(!comments.length){ list.innerHTML='<div class="cdm-comments-empty">'+t('cdm-comments-empty')+'</div>'; return; } list.innerHTML=''; comments.forEach(function(c){ var div=document.createElement('div'); div.className='cdm-comment'; var isMe=c.alias===currentUserAlias; var dt=''; try{ var d=new Date(c.createdAt); dt=d.toLocaleDateString(localeTag())+' '+d.toLocaleTimeString(localeTag(),{hour:'2-digit',minute:'2-digit'}); }catch(e){} div.innerHTML='<div class="cdm-comment-meta"><span class="cdm-comment-author">'+escHtml(c.alias)+'</span><div style="display:flex;align-items:center;gap:8px;"><span class="cdm-comment-time">'+dt+'</span>'+(isMe?'<button class="cdm-comment-del" onclick="deleteComment(\''+escHtml(c.id)+'\',\''+escHtml(taskId)+'\')" title="'+t('delete-btn')+'">✕</button>':'')+'</div></div><div class="cdm-comment-text">'+escHtml(c.text)+'</div>'; list.appendChild(div); }); }
function submitComment(){ var input=document.getElementById('cdm-comment-input'),btn=document.getElementById('cdm-comment-send-btn'),text=(input?input.value.trim():''); if(!text||!_cardDetailTaskId) return; btn.disabled=true; if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ btn.disabled=false; if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } input.value=''; input.style.height='auto'; if(!_cdmComments[_cardDetailTaskId]) _cdmComments[_cardDetailTaskId]=[]; _cdmComments[_cardDetailTaskId].push({id:result.commentId,alias:currentUserAlias,text:text,createdAt:new Date().toISOString()}); renderComments(_cardDetailTaskId); }).withFailureHandler(function(e){ btn.disabled=false; alert(t('error-prefix')+': '+e.message); }).addTaskComment(_cardDetailTaskId,currentUserAlias,text); } else { btn.disabled=false; } }
function deleteComment(commentId,taskId){ if(!confirm(t('confirm-delete-comment'))) return; if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } if(_cdmComments[taskId]) _cdmComments[taskId]=_cdmComments[taskId].filter(function(c){ return c.id!==commentId; }); renderComments(taskId); }).withFailureHandler(function(){}).deleteTaskComment(commentId,currentUserAlias); } }
function handleCommentKey(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); submitComment(); } }

/* ═══ EDITAR/EXCLUIR TAREFA ═══ */
function openEditTaskModal(task){ _editTaskId=task.id; _editTaskPriority=task.prioridade||'media'; document.getElementById('edit-task-id').value=task.id; document.getElementById('edit-task-titulo').value=task.titulo||''; document.getElementById('edit-task-desc').value=task.descricao||''; document.getElementById('edit-task-prazo').value=task.prazo||''; document.getElementById('edit-task-responsavel').value=task.responsavel||''; var btn=document.getElementById('edit-task-save-btn'); btn.disabled=false; btn.textContent=t('save-changes-btn'); ['baixa','media','alta'].forEach(function(p){ document.getElementById('edit-prio-'+p).className='task-priority-opt'; }); document.getElementById('edit-prio-'+_editTaskPriority).className='task-priority-opt selected-'+_editTaskPriority; document.getElementById('edit-task-modal').classList.add('open'); }
function closeEditTaskModal(){ document.getElementById('edit-task-modal').classList.remove('open'); _editTaskId=''; }
function selectEditPriority(p){ _editTaskPriority=p; ['baixa','media','alta'].forEach(function(x){ document.getElementById('edit-prio-'+x).className='task-priority-opt'; }); document.getElementById('edit-prio-'+p).className='task-priority-opt selected-'+p; }
function submitEditTask(){ var titulo=document.getElementById('edit-task-titulo').value.trim(),desc=document.getElementById('edit-task-desc').value.trim(),responsavel=document.getElementById('edit-task-responsavel').value,prazo=document.getElementById('edit-task-prazo').value; if(!titulo){ alert(t('alert-title-required')); return; } if(!responsavel){ alert(t('alert-responsible-required')); return; } if(!prazo){ alert(t('alert-deadline-required')); return; } var btn=document.getElementById('edit-task-save-btn'); btn.disabled=true; btn.textContent=t('saving-dots'); if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ btn.disabled=false; btn.textContent=t('save-changes-btn'); if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } closeEditTaskModal(); loadTasks(); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('save-changes-btn'); alert(t('error-prefix')+': '+e.message); }).updateTask({id:_editTaskId,titulo:titulo,descricao:desc,responsavel:responsavel,prazo:prazo,prioridade:_editTaskPriority,requestedBy:currentUserAlias}); } else { btn.disabled=false; btn.textContent=t('save-changes-btn'); closeEditTaskModal(); } }
function confirmDeleteTask(){ var task=_allTasks.find(function(t){ return t.id===_editTaskId; }),label=task?task.numero||task.titulo:_editTaskId; if(!confirm(t('confirm-delete-task-prefix')+' "'+label+'"?\n\n'+t('confirm-permanent'))) return; if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ if(!result||!result.ok){ alert(t('error-prefix')+': '+(result?result.msg:'')); return; } closeEditTaskModal(); loadTasks(); }).withFailureHandler(function(e){ alert(t('error-prefix')+': '+e.message); }).deleteTask(_editTaskId,currentUserAlias); } }

/* ═══ DASHBOARD ═══ */
function initDashboard(){
  var now=Date.now(); if(_dashLoaded&&_dashData&&(now-_dashLastLoad)<DASH_TTL_MS){ renderDashboard(_dashData); return; }
  var el=document.getElementById('dash-content'); if(el) el.innerHTML='<div class="dash-loading">'+t('dash-loading')+'</div>';
  if(typeof google==='undefined'||!google.script||!google.script.run){ renderDashboard({tasks:[],chatCount:0,commentCount:0}); return; }
  google.script.run.withSuccessHandler(function(data){ _dashLoaded=true; _dashData=data||{}; _dashLastLoad=Date.now(); renderDashboard(_dashData); }).withFailureHandler(function(){ var e2=document.getElementById('dash-content'); if(e2) e2.innerHTML='<div class="dash-loading">'+t('dash-error')+'</div>'; }).getDashboardData();
}
function renderDashboard(data){
  var tasks=data.tasks||[],chatCount=data.chatCount||0,commentCount=data.commentCount||0;
  var total=tasks.length,todo=tasks.filter(function(t){ return t.status==='todo'; }).length,doing=tasks.filter(function(t){ return t.status==='doing'; }).length,done=tasks.filter(function(t){ return t.status==='done'; }).length;
  var overdue=tasks.filter(function(t){ if(t.status==='done'||!t.prazo) return false; return new Date(t.prazo+'T00:00:00')<new Date(); }).length;
  var alta=tasks.filter(function(t){ return t.prioridade==='alta'&&t.status!=='done'; }).length;
  var byPerson={}; tasks.forEach(function(t){ if(!t.responsavel) return; if(!byPerson[t.responsavel]) byPerson[t.responsavel]={total:0,done:0}; byPerson[t.responsavel].total++; if(t.status==='done') byPerson[t.responsavel].done++; });
  var personArr=Object.keys(byPerson).map(function(k){ return {name:k,data:byPerson[k]}; }).sort(function(a,b){ return b.data.total-a.data.total; });
  var maxPerson=personArr.length?personArr[0].data.total:1;
  var pAlta=tasks.filter(function(t){ return t.prioridade==='alta'; }).length,pMedia=tasks.filter(function(t){ return t.prioridade==='media'; }).length,pBaixa=tasks.filter(function(t){ return t.prioridade==='baixa'; }).length;
  var el=document.getElementById('dash-content'); if(!el) return;
  var textColor=!document.body.classList.contains('light-mode')?'#ccc':'#333';
  el.innerHTML='<div class="dash-kpi-grid">'+kpiCard(t('dash-kpi-total'),total,'')+kpiCard(t('tasks-col-todo'),todo,'')+kpiCard(t('tasks-col-doing'),doing,'')+kpiCard(t('dash-kpi-done'),done,'')+kpiCard(t('dash-kpi-overdue'),overdue,overdue>0?'color:#e05555':'')+kpiCard(t('dash-kpi-high'),alta,alta>0?'color:#e8a020':'')+kpiCard(t('dash-kpi-chat'),chatCount,'')+kpiCard(t('dash-kpi-comments'),commentCount,'')+'</div><div class="dash-charts-grid"><div class="dash-chart-card"><div class="dash-chart-title">'+t('dash-chart-by-person')+'</div><div id="dash-person-list"></div></div><div class="dash-chart-card"><div class="dash-chart-title">'+t('dash-chart-status')+'</div><div style="position:relative;height:200px;"><canvas id="dash-status-chart"></canvas></div></div><div class="dash-chart-card"><div class="dash-chart-title">'+t('dash-chart-prio')+'</div><div style="position:relative;height:200px;"><canvas id="dash-prio-chart"></canvas></div></div><div class="dash-chart-card"><div class="dash-chart-title">'+t('dash-chart-completion')+'</div><div id="dash-completion-list"></div></div></div>';
  var pl=document.getElementById('dash-person-list'); if(pl&&personArr.length){ personArr.slice(0,8).forEach(function(p){ var pct=Math.round((p.data.total/maxPerson)*100); pl.innerHTML+='<div class="dash-person-row"><span class="dash-person-name">'+escHtml(p.name)+'</span><div class="dash-person-bar-bg"><div class="dash-person-bar" style="width:'+pct+'%"></div></div><span class="dash-person-count">'+p.data.total+'</span></div>'; }); } else if(pl) pl.innerHTML='<div class="cdm-comments-empty">'+t('dash-no-data')+'</div>';
  var cl=document.getElementById('dash-completion-list'); if(cl&&personArr.length){ personArr.filter(function(p){ return p.data.total>0; }).slice(0,8).forEach(function(p){ var pct=Math.round((p.data.done/p.data.total)*100),barColor=pct>=70?'#4caf7d':pct>=40?'#e8a020':'#e05555'; cl.innerHTML+='<div class="dash-person-row"><span class="dash-person-name">'+escHtml(p.name)+'</span><div class="dash-person-bar-bg"><div class="dash-person-bar" style="width:'+pct+'%;background:'+barColor+'"></div></div><span class="dash-person-count">'+pct+'%</span></div>'; }); } else if(cl) cl.innerHTML='<div class="cdm-comments-empty">'+t('dash-no-data')+'</div>';
  setTimeout(function(){
    if(typeof Chart==='undefined') return;
    var se=document.getElementById('dash-status-chart'); if(se){ var ex=Chart.getChart(se); if(ex) ex.destroy(); new Chart(se,{type:'doughnut',data:{labels:[t('tasks-col-todo'),t('tasks-col-doing'),t('tasks-col-done')],datasets:[{data:[todo,doing,done],backgroundColor:['#555','#e8a020','#4caf7d'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:textColor,font:{size:11},padding:12}}}}}); }
    var pe=document.getElementById('dash-prio-chart'); if(pe){ var exP=Chart.getChart(pe); if(exP) exP.destroy(); new Chart(pe,{type:'doughnut',data:{labels:[t('tasks-prio-high'),t('tasks-prio-mid'),t('tasks-prio-low')],datasets:[{data:[pAlta,pMedia,pBaixa],backgroundColor:['#e05555','#e8a020','#4caf7d'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:textColor,font:{size:11},padding:12}}}}}); }
  },100);
}
function kpiCard(label,value,style){ return '<div class="dash-kpi"><div class="dash-kpi-label">'+label+'</div><div class="dash-kpi-value" style="'+style+'">'+value+'</div></div>'; }

/* ═══ KANBAN / TAREFAS ═══ */
function toggleRecurrence(){ var cb=document.getElementById('recurrence-toggle-input'); _taskRecurrenceEnabled=cb.checked; document.getElementById('recurrence-options').classList.toggle('visible',_taskRecurrenceEnabled); if(!_taskRecurrenceEnabled) _taskRecurrence=''; updateRecurrencePreview(); }
function selectFreq(freq,el){ _taskRecurrence=freq; document.querySelectorAll('.recurrence-freq-opt').forEach(function(o){ o.classList.remove('selected'); }); if(el) el.classList.add('selected'); updateRecurrencePreview(); }
function updateRecurrencePreview(){ var preview=document.getElementById('recurrence-preview'); if(!_taskRecurrenceEnabled||!_taskRecurrence){ if(preview) preview.textContent=t('recurrence-preview-default'); return; } var prazo=document.getElementById('task-prazo').value,count=parseInt(document.getElementById('recurrence-count').value,10)||4; if(!prazo){ if(preview) preview.textContent=t('recurrence-preview-need-deadline'); return; } var dates=generateOccurrencesClient(prazo,_taskRecurrence,count); if(preview) preview.textContent=recurrenceLabel(_taskRecurrence)+' · '+count+'x · '+dates.slice(0,3).map(function(d){ var p=d.split('-'); return p[2]+'/'+p[1]; }).join(' → ')+(dates.length>3?' → …':''); }
function generateOccurrencesClient(prazoStr,recorrencia,total){ var dates=[],start=new Date(prazoStr+'T00:00:00'); for(var i=0;i<total;i++){ var d=new Date(start); switch(recorrencia){ case 'diaria': d.setDate(start.getDate()+i); break; case 'semanal': d.setDate(start.getDate()+i*7); break; case 'quinzenal': d.setDate(start.getDate()+i*14); break; case 'mensal': d.setMonth(start.getMonth()+i); break; default: dates.push(prazoStr); return dates; } dates.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')); } return dates; }
function openTaskModal(){ _taskPendingFiles=[]; renderTaskAttachList(); _taskRecurrenceEnabled=false; _taskRecurrence=''; document.getElementById('recurrence-toggle-input').checked=false; document.getElementById('recurrence-options').classList.remove('visible'); document.querySelectorAll('.recurrence-freq-opt').forEach(function(o){ o.classList.remove('selected'); }); document.getElementById('recurrence-count').value='4'; document.getElementById('recurrence-preview').textContent=t('recurrence-preview-default'); document.getElementById('task-titulo').value=''; document.getElementById('task-desc').value=''; document.getElementById('task-responsavel').value=''; document.getElementById('task-prazo').value=''; document.getElementById('task-unidade').value=''; document.getElementById('task-marca').innerHTML='<option value="">'+t('task-brand-select-first')+'</option>'; var w=document.getElementById('task-marca-custom-wrap'); if(w) w.style.display='none'; var ci=document.getElementById('task-marca-custom'); if(ci) ci.value=''; _taskPriority=''; ['baixa','media','alta'].forEach(function(p){ document.getElementById('prio-'+p).className='task-priority-opt'; }); document.getElementById('task-modal').classList.add('open'); }
function closeTaskModal(){ document.getElementById('task-modal').classList.remove('open'); }
function selectPriority(p){ _taskPriority=p; ['baixa','media','alta'].forEach(function(x){ document.getElementById('prio-'+x).className='task-priority-opt'; }); document.getElementById('prio-'+p).className='task-priority-opt selected-'+p; }
function submitTask(){
  var titulo=document.getElementById('task-titulo').value.trim(),desc=document.getElementById('task-desc').value.trim(),responsavel=document.getElementById('task-responsavel').value,prazo=document.getElementById('task-prazo').value,unidade=document.getElementById('task-unidade').value;
  var marcaSel=document.getElementById('task-marca').value,marcaCustom=(document.getElementById('task-marca-custom')||{}).value||'';
  var marca=(marcaSel==='__custom__')?marcaCustom.trim():marcaSel;
  if(!titulo){ alert(t('alert-title-required')); return; } if(!responsavel){ alert(t('alert-responsible-required')); return; } if(!prazo){ alert(t('alert-deadline-required')); return; } if(!_taskPriority){ alert(t('alert-priority-required')); return; } if(!unidade){ alert(t('alert-unit-required')); return; } if(!marca||marca==='__custom__'){ alert(t('alert-client-required')); return; }
  var recorrencia=_taskRecurrenceEnabled?_taskRecurrence:'',totalOcorrencias=_taskRecurrenceEnabled?parseInt(document.getElementById('recurrence-count').value,10):1;
  if(_taskRecurrenceEnabled&&!recorrencia){ alert(t('alert-frequency-required')); return; }
  var btn=document.getElementById('task-submit-btn'); btn.disabled=true; btn.textContent=t('creating-dots');
  if(typeof google!=='undefined'&&google.script&&google.script.run){
    google.script.run.withSuccessHandler(function(result){ if(!result||!result.ok){ btn.disabled=false; btn.textContent=t('task-create-btn'); alert(t('error-prefix')+': '+(result?result.msg:'')); return; } uploadTaskFiles(result.id,function(){ btn.disabled=false; btn.textContent=t('task-create-btn'); _taskPendingFiles=[]; renderTaskAttachList(); closeTaskModal(); loadTasks(); if(result.occurrences&&result.occurrences.length>1){ setTimeout(function(){ alert(t('alert-task-created')+'\n🔁 '+result.occurrences.length+' '+t('alert-task-created-events')); },200); } }); }).withFailureHandler(function(e){ btn.disabled=false; btn.textContent=t('task-create-btn'); alert(t('error-prefix')+': '+e.message); }).createTask({titulo:titulo,descricao:desc,responsavel:responsavel,solicitante:currentUserAlias,prazo:prazo,prioridade:_taskPriority,unidade:unidade,marca:marca,recorrencia:recorrencia,totalOcorrencias:totalOcorrencias});
  } else { btn.disabled=false; btn.textContent=t('task-create-btn'); _taskPendingFiles=[]; renderTaskAttachList(); closeTaskModal(); }
}
function loadTasks(){ if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(tasks){ _allTasks=tasks||[]; renderKanban(_allTasks); if(_cardDetailTaskId){ var u=_allTasks.find(function(t){ return t.id===_cardDetailTaskId; }); if(u) populateCardDetail(u); } }).withFailureHandler(function(e){ console.error('loadTasks:',e); }).getTasks(); } }
function renderKanban(tasks){ var filtered=tasks.filter(function(task){ if(_activeFilter==='minhas') return task.responsavel===currentUserAlias; if(_activeFilter==='solicitadas') return task.solicitante===currentUserAlias; if(_activeFilter==='alta') return task.prioridade==='alta'; if(_activeFilter==='recorrentes') return task.recorrencia&&task.recorrencia!==''; return true; }); var cols={todo:[],doing:[],done:[]}; filtered.forEach(function(task){ if(task.status==='todo') cols.todo.push(task); else if(task.status==='doing') cols.doing.push(task); else cols.done.push(task); }); ['todo','doing','done'].forEach(function(col){ var container=document.getElementById('cards-'+col); document.getElementById('count-'+col).textContent=cols[col].length; if(!cols[col].length){ container.innerHTML='<div class="kanban-empty">'+t('kanban-empty')+'</div>'; return; } container.innerHTML=''; cols[col].forEach(function(task){ container.appendChild(buildCard(task)); }); }); if(_kanbanSearchTerm) applyKanbanSearch(_kanbanSearchTerm); }
function buildCard(task){ var today=new Date(); today.setHours(0,0,0,0); var prazoDate=task.prazo?new Date(task.prazo+'T00:00:00'):null; var deadlineClass='',deadlineText=task.prazo?formatTaskDate(task.prazo):'—'; if(prazoDate){ var diff=Math.ceil((prazoDate-today)/86400000); if(diff<0){ deadlineClass='overdue'; deadlineText=t('task-overdue-prefix')+' '+deadlineText; } else if(diff<=2) deadlineClass='soon'; } var div=document.createElement('div'); div.className='kanban-card'; div.dataset.id=task.id; div.dataset.num=(task.numero||'').toUpperCase(); var prioLbl=prioLabel(task.prioridade); var attachCount=0; try{ attachCount=JSON.parse(task.anexos||'[]').length; }catch(e){} var numHtml=task.numero?'<span class="kanban-card-number">'+escHtml(task.numero)+'</span>':''; var recBadge=''; if(task.recorrencia&&task.totalOcorrencias>1){ recBadge='<span class="kanban-card-recurrence">🔁 '+escHtml(recurrenceLabel(task.recorrencia))+' ×'+task.totalOcorrencias+'</span>'; } div.innerHTML=numHtml+'<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:10px;"><span class="kanban-card-priority priority-'+task.prioridade+'">'+prioLbl+'</span>'+recBadge+'</div><div class="kanban-card-title">'+escHtml(task.titulo)+'</div>'+(task.descricao?'<div class="kanban-card-desc">'+escHtml(task.descricao.substring(0,90))+(task.descricao.length>90?'…':'')+'</div>':'')+'<div class="kanban-card-meta"><div class="kanban-card-people"><div class="kanban-card-person"><strong>'+t('kanban-card-to')+'</strong> '+escHtml(task.responsavel)+'</div><div class="kanban-card-person"><strong>'+t('kanban-card-from')+'</strong> '+escHtml(task.solicitante)+'</div></div><div class="kanban-card-deadline '+deadlineClass+'">📅 '+deadlineText+'</div></div><button class="kanban-card-attach-btn">📎 '+(attachCount?attachCount+' '+(attachCount>1?t('attachment-plural'):t('attachment-singular')):t('attachments-label'))+'</button>'; div.addEventListener('click',function(e){ if(e.target.classList.contains('kanban-card-attach-btn')||e.target.closest('.kanban-card-attach-btn')) return; openCardDetailModal(task.id); }); div.querySelector('.kanban-card-attach-btn').addEventListener('click',function(e){ e.stopPropagation(); openAttachModal(task.id,task.anexos||'[]'); }); return div; }

function openCardDetailModal(taskId){ var task=_allTasks.find(function(t){ return t.id===taskId; }); if(!task) return; _cardDetailTaskId=taskId; _cdmComments[taskId]=[]; var inp=document.getElementById('cdm-comment-input'); if(inp){ inp.value=''; inp.style.height='auto'; } document.getElementById('cdm-comments-list').innerHTML='<div class="cdm-comments-empty">'+t('loading')+'</div>'; populateCardDetail(task); document.getElementById('card-detail-modal').classList.add('open'); }
function closeCardDetailModal(){ document.getElementById('card-detail-modal').classList.remove('open'); _cardDetailTaskId=''; }
function populateCardDetail(task){ document.getElementById('cdm-number').textContent=task.numero||'—'; document.getElementById('cdm-title').textContent=task.titulo||'—'; document.getElementById('cdm-id').textContent=task.id||'—'; var prioColors={alta:'#e05555',media:'#e8a020',baixa:'#4caf7d'}; var pc=prioColors[task.prioridade]||'#555'; document.getElementById('cdm-badges').innerHTML='<span class="card-detail-badge badge-status-'+task.status+'">'+statusLabel(task.status)+'</span><span class="card-detail-badge" style="color:'+pc+';border-color:'+pc+';background:rgba(128,128,128,.06);">'+prioLabel(task.prioridade)+'</span>'+(task.unidade?'<span class="card-detail-badge badge-unidade">'+escHtml(task.unidade)+'</span>':'')+(task.marca?'<span class="card-detail-badge badge-marca">'+escHtml(task.marca)+'</span>':'')+(task.recorrencia&&task.totalOcorrencias>1?'<span class="card-detail-badge badge-recurrence">🔁 '+recurrenceLabel(task.recorrencia)+' ×'+task.totalOcorrencias+'</span>':''); var ds=document.getElementById('cdm-desc-section'); if(task.descricao){ document.getElementById('cdm-desc').textContent=task.descricao; ds.style.display=''; } else { ds.style.display='none'; } document.getElementById('cdm-responsavel').textContent=task.responsavel||'—'; document.getElementById('cdm-solicitante').textContent=task.solicitante||'—'; document.getElementById('cdm-prioridade').textContent=prioLabel(task.prioridade); var prazoEl=document.getElementById('cdm-prazo'),today=new Date(); today.setHours(0,0,0,0); var prazoDate=task.prazo?new Date(task.prazo+'T00:00:00'):null; prazoEl.className='card-detail-field-value'; prazoEl.textContent=task.prazo?formatTaskDate(task.prazo):'—'; if(prazoDate){ var diff=Math.ceil((prazoDate-today)/86400000); if(diff<0) prazoEl.classList.add('overdue'); else if(diff<=2) prazoEl.classList.add('soon'); } var criadoEl=document.getElementById('cdm-criado'); if(task.criadoEm){ try{ var d=new Date(task.criadoEm); criadoEl.textContent=d.toLocaleDateString(localeTag())+' '+d.toLocaleTimeString(localeTag(),{hour:'2-digit',minute:'2-digit'}); }catch(e){ criadoEl.textContent=task.criadoEm; } } else { criadoEl.textContent='—'; } renderCdmAttachList(task); var recSection=document.getElementById('cdm-recurrence-section'),recTimeline=document.getElementById('cdm-recurrence-timeline'); if(task.recorrencia&&task.totalOcorrencias>1&&task.prazo){ recSection.style.display=''; var occ=generateOccurrencesClient(task.prazo,task.recorrencia,task.totalOcorrencias); recTimeline.innerHTML=occ.map(function(d,i){ var p=d.split('-'); return '<div class="recurrence-timeline-item"><div class="recurrence-timeline-dot'+(i===0?' first':'')+'"></div><span style="'+(i===0?'color:#aaa;':'')+'">'+t('occurrence-label')+' '+(i+1)+': '+p[2]+'/'+p[1]+'/'+p[0]+'</span></div>'; }).join(''); } else { recSection.style.display='none'; } if(!_cdmComments[task.id]||!_cdmComments[task.id].length) loadComments(task.id); else renderComments(task.id); var footer=document.getElementById('cdm-footer'); footer.innerHTML=''; var isResp=(task.responsavel===currentUserAlias); if(isResp&&task.status==='todo'){ var bs=document.createElement('button'); bs.className='card-detail-action-btn btn-start'; bs.textContent=t('card-action-start'); bs.onclick=function(){ moveTask(task.id,'doing'); closeCardDetailModal(); }; footer.appendChild(bs); } else if(isResp&&task.status==='doing'){ var bd=document.createElement('button'); bd.className='card-detail-action-btn btn-done'; bd.textContent=t('card-action-complete'); bd.onclick=function(){ moveTask(task.id,'done'); closeCardDetailModal(); }; footer.appendChild(bd); } var ba=document.createElement('button'); ba.className='card-detail-action-btn'; ba.textContent=t('card-action-manage-attach'); ba.onclick=function(){ closeCardDetailModal(); openAttachModal(task.id,task.anexos||'[]'); }; footer.appendChild(ba); var be=document.createElement('button'); be.className='card-detail-action-btn'; be.textContent='✏️ '+t('edit-task-title'); be.onclick=function(){ closeCardDetailModal(); openEditTaskModal(task); }; footer.appendChild(be); }
function renderCdmAttachList(task){ var list=document.getElementById('cdm-attach-list'); var attachs=[]; try{ attachs=JSON.parse(task.anexos||'[]'); }catch(e){} list.innerHTML=''; if(!attachs.length){ list.innerHTML='<div class="card-detail-attach-empty">'+t('card-detail-no-attach-empty')+'</div>'; return; } attachs.forEach(function(a){ var ext=a.name.split('.').pop().toUpperCase().substring(0,4); var item=document.createElement('a'); item.className='attach-file-item'; item.href=a.url; item.target='_blank'; item.innerHTML='<span class="attach-file-ext">'+escHtml(ext)+'</span><span class="attach-file-name">'+escHtml(a.name)+'</span><span class="attach-file-arrow">&#x2197;</span>'; list.appendChild(item); }); }
function onCdmFileSelected(event){ if(!_cardDetailTaskId) return; var files=Array.from(event.target.files); if(!files.length) return; var status=document.getElementById('cdm-upload-status'); status.classList.add('visible'); var remaining=files.length; files.forEach(function(file){ if(file.size>10*1024*1024){ alert(file.name+': '+t('alert-file-too-large-10')); remaining--; if(!remaining) status.classList.remove('visible'); return; } var reader=new FileReader(); reader.onload=function(e){ var base64=e.target.result.split(',')[1],mimeType=file.type||'application/octet-stream'; if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(){ remaining--; if(!remaining){ status.classList.remove('visible'); event.target.value=''; google.script.run.withSuccessHandler(function(tasks){ _allTasks=tasks||[]; renderKanban(_allTasks); var u=_allTasks.find(function(t){ return t.id===_cardDetailTaskId; }); if(u) populateCardDetail(u); }).getTasks(); } }).withFailureHandler(function(err){ remaining--; alert(t('error-prefix')+': '+err.message); if(!remaining) status.classList.remove('visible'); }).uploadTaskFile(_cardDetailTaskId,file.name,mimeType,base64); } else { remaining--; if(!remaining) status.classList.remove('visible'); } }; reader.readAsDataURL(file); }); }
function onKanbanSearch(value){ _kanbanSearchTerm=value.trim().toUpperCase(); var clearBtn=document.getElementById('kanban-search-clear'),countEl=document.getElementById('kanban-search-count'); if(clearBtn) clearBtn.style.display=_kanbanSearchTerm?'inline-block':'none'; applyKanbanSearch(_kanbanSearchTerm); if(countEl) countEl.style.display=_kanbanSearchTerm?'inline-block':'none'; }
function applyKanbanSearch(term){ var countEl=document.getElementById('kanban-search-count'),totalMatch=0; document.querySelectorAll('.kanban-card').forEach(function(card){ if(!term){ card.classList.remove('search-hidden','search-match'); return; } var num=(card.dataset.num||'').toUpperCase(),title=(card.querySelector('.kanban-card-title')||{}).textContent||''; var match=num.indexOf(term)!==-1||title.toUpperCase().indexOf(term)!==-1; if(match){ card.classList.remove('search-hidden'); card.classList.add('search-match'); totalMatch++; } else { card.classList.add('search-hidden'); card.classList.remove('search-match'); } }); if(countEl) countEl.textContent=term?totalMatch+' '+t('kanban-search-results')+(totalMatch!==1&&currentLang!=='zh'?'s':''):''; }
function clearKanbanSearch(){ var input=document.getElementById('kanban-search'); if(input) input.value=''; _kanbanSearchTerm=''; var clearBtn=document.getElementById('kanban-search-clear'),countEl=document.getElementById('kanban-search-count'); if(clearBtn) clearBtn.style.display='none'; if(countEl) countEl.style.display='none'; document.querySelectorAll('.kanban-card').forEach(function(c){ c.classList.remove('search-hidden','search-match'); }); }
function moveTask(id,newStatus){ if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(result){ if(result&&result.ok) loadTasks(); else alert(t('error-prefix')+': '+(result?result.msg:'')); }).withFailureHandler(function(e){ alert(t('error-prefix')+': '+e.message); }).updateTaskStatus({id:id,status:newStatus,alias:currentUserAlias}); } }
function filterTasks(type,btn){ _activeFilter=type; document.querySelectorAll('.kanban-filter-btn').forEach(function(b){ b.classList.remove('active'); }); if(btn) btn.classList.add('active'); renderKanban(_allTasks); }

/* ═══ UTILITÁRIOS ═══ */
function prioLabel(p){ return {alta:t('tasks-prio-high'),media:t('tasks-prio-mid'),baixa:t('tasks-prio-low')}[p]||p; }
function statusLabel(s){ return {todo:t('tasks-col-todo'),doing:t('tasks-col-doing'),done:t('tasks-col-done')}[s]||s; }
function recurrenceLabel(r){ return {diaria:t('recurrence-daily'),semanal:t('recurrence-weekly'),quinzenal:t('recurrence-biweekly'),mensal:t('recurrence-monthly')}[r]||r; }
function escHtml(text){ if(!text) return ''; return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatTaskDate(dateStr){ if(!dateStr) return '—'; var parts=dateStr.split('-'); if(parts.length!==3) return dateStr; return parts[2]+'/'+parts[1]+'/'+parts[0]; }

var _MARCA_MAP={private:['COOPER SHOES','FLOWFA','INSIDER','LIVE','LIVE_KLAVA','MELISSA','OXER','PEGADA','RESERVA','SCHUTZ','USAFLEX','VIA MARTE'],atacado:['ECKO','FLOWFA','LIVE'],ecomm:['FLOWFA ECOMM']};
function updateMarcas(){ var unidade=document.getElementById('task-unidade').value,select=document.getElementById('task-marca'),wrap=document.getElementById('task-marca-custom-wrap'),ci=document.getElementById('task-marca-custom'); if(wrap) wrap.style.display='none'; if(ci) ci.value=''; var opts=_MARCA_MAP[unidade]||[]; if(!opts.length){ select.innerHTML='<option value="">'+t('task-brand-select-first')+'</option>'; } else { select.innerHTML='<option value="">'+t('select-default')+'</option>'; opts.forEach(function(m){ var o=document.createElement('option'); o.value=m; o.textContent=m; select.appendChild(o); }); var other=document.createElement('option'); other.value='__custom__'; other.textContent=t('task-brand-custom-option'); select.appendChild(other); } }
document.addEventListener('change',function(e){ if(e.target&&e.target.id==='task-marca'){ var wrap=document.getElementById('task-marca-custom-wrap'),ci=document.getElementById('task-marca-custom'); if(e.target.value==='__custom__'){ if(wrap) wrap.style.display='block'; if(ci) ci.focus(); } else { if(wrap) wrap.style.display='none'; if(ci) ci.value=''; } } });

function onTaskFileSelected(event){ var files=Array.from(event.target.files); files.forEach(function(f){ if(f.size>10*1024*1024){ alert(f.name+': '+t('alert-file-too-large-10')); return; } if(_taskPendingFiles.length>=5){ alert(t('alert-attach-limit')); return; } _taskPendingFiles.push(f); }); event.target.value=''; renderTaskAttachList(); }
function renderTaskAttachList(){ var list=document.getElementById('task-attach-list'); if(!list) return; list.innerHTML=''; _taskPendingFiles.forEach(function(f,i){ var item=document.createElement('div'); item.className='task-attach-item'; item.innerHTML='<span class="task-attach-item-name">📄 '+escHtml(f.name)+'</span><span class="task-attach-item-remove" onclick="removeTaskFile('+i+')">✕</span>'; list.appendChild(item); }); }
function removeTaskFile(index){ _taskPendingFiles.splice(index,1); renderTaskAttachList(); }
function uploadTaskFiles(taskId,callback){ if(!_taskPendingFiles.length){ callback([]); return; } var status=document.getElementById('task-upload-status'); if(status) status.classList.add('visible'); var results=[],remaining=_taskPendingFiles.length; _taskPendingFiles.forEach(function(file){ var reader=new FileReader(); reader.onload=function(e){ var base64=e.target.result.split(',')[1],mimeType=file.type||'application/octet-stream'; if(typeof google!=='undefined'&&google.script&&google.script.run){ google.script.run.withSuccessHandler(function(url){ results.push({name:file.name,url:url}); remaining--; if(!remaining){ if(status) status.classList.remove('visible'); callback(results); } }).withFailureHandler(function(err){ remaining--; if(!remaining){ if(status) status.classList.remove('visible'); callback(results); } }).uploadTaskFile(taskId,file.name,mimeType,base64); } else { remaining--; if(!remaining){ if(status) status.classList.remove('visible'); callback(results); } } }; reader.readAsDataURL(file); }); }
function openAttachModal(taskId,anexosJson){ _attachCurrentId=taskId; var list=document.getElementById('attach-modal-list'); list.innerHTML=''; var attachs=[]; try{ attachs=JSON.parse(anexosJson||'[]'); }catch(e){} if(!attachs.length){ list.innerHTML='<div class="attach-empty">'+t('card-detail-no-attach-empty')+'</div>'; } else { attachs.forEach(function(a){ var ext=a.name.split('.').pop().toUpperCase().substring(0,4); var item=document.createElement('a'); item.className='attach-file-item'; item.href=a.url; item.target='_blank'; item.innerHTML='<span class="attach-file-ext">'+escHtml(ext)+'</span><span class="attach-file-name">'+escHtml(a.name)+'</span><span class="attach-file-arrow">&#x2197;</span>'; list.appendChild(item); }); } document.getElementById('attach-modal').classList.add('open'); }
function closeAttachModal(){ document.getElementById('attach-modal').classList.remove('open'); var s=document.getElementById('attach-upload-status'); if(s) s.classList.remove('visible'); _attachCurrentId=''; }
function onAttachAddSelected(event){ if(!_attachCurrentId) return; var files=Array.from(event.target.files); if(!files.length) return; var status=document.getElementById('attach-upload-status'); status.classList.add('visible'); var remaining=files.length; files.forEach(function(file){ if(file.size>10*1024*1024){ alert(file.name+': '+t('alert-file-too-large-10')); remaining--; if(!remaining) status.classList.remove('visible'); return; } var reader=new FileReader(); reader.onload=function(e){ var base64=e.target.result.split(',')[1],mimeType=file.type||'application/octet-stream'; google.script.run.withSuccessHandler(function(){ remaining--; if(!remaining){ status.classList.remove('visible'); event.target.value=''; google.script.run.withSuccessHandler(function(tasks){ _allTasks=tasks||[]; renderKanban(_allTasks); var task=_allTasks.find(function(t){ return t.id===_attachCurrentId; }); if(task) openAttachModal(task.id,task.anexos||'[]'); }).getTasks(); } }).withFailureHandler(function(err){ remaining--; alert(t('error-prefix')+': '+err.message); if(!remaining) status.classList.remove('visible'); }).uploadTaskFile(_attachCurrentId,file.name,mimeType,base64); }; reader.readAsDataURL(file); }); }

/* ═══ INICIALIZAÇÃO ═══ */
document.addEventListener('DOMContentLoaded',function(){
  applyTranslations(currentLang);
  var htmlEl0=document.documentElement; if(htmlEl0) htmlEl0.setAttribute('lang',localeTag(currentLang));
  document.querySelectorAll('.lang-btn').forEach(function(b){ b.classList.remove('active'); });
  var activeBtn0=document.getElementById('btn-'+currentLang); if(activeBtn0) activeBtn0.classList.add('active');
  initTheme();
  _updateNotifBtnState();
  initEmojiPicker();
  ['card-detail-modal','attach-modal','create-channel-modal','dm-modal','edit-channel-modal','drive-upload-modal','drive-link-modal','edit-task-modal','contact-form-modal','ai-ask-modal','wiki-form-modal'].forEach(function(id){
    var el=document.getElementById(id); if(!el) return;
    el.addEventListener('click',function(e){
      if(e.target!==this) return;
      if(id==='card-detail-modal') closeCardDetailModal();
      else if(id==='attach-modal') closeAttachModal();
      else if(id==='create-channel-modal') closeCreateChannelModal();
      else if(id==='dm-modal') closeDmModal();
      else if(id==='edit-channel-modal') closeEditChannelModal();
      else if(id==='drive-upload-modal') closeDriveUploadModal();
      else if(id==='drive-link-modal') closeDriveLinkModal();
      else if(id==='edit-task-modal') closeEditTaskModal();
      else if(id==='contact-form-modal') closeContactFormModal();
      else if(id==='ai-ask-modal') closeAiAskModal();
      else if(id==='wiki-form-modal') closeWikiFormModal();
    });
  });
  var prazoInput=document.getElementById('task-prazo'); if(prazoInput) prazoInput.addEventListener('change',updateRecurrencePreview);
});

// Registro dos módulos. Cada fase da migração preenche um destes.
// render(el, ctx) recebe o container e { perfil }.
const emBreve = (titulo, fase) => (el) => {
  el.innerHTML = `<div class="placeholder"><h1>${titulo}</h1><p>Migração em andamento · ${fase}</p></div>`;
};

export const MODULOS = [
  { id: 'inicio',   label: 'Início',    render: emBreve('Início', 'Fase 3') },
  { id: 'setores',  label: 'Setores',   render: emBreve('Setores', 'Fase 3') },
  { id: 'drive',    label: 'Drive',     render: emBreve('Drive', 'Fase 3') },
  { id: 'tarefas',  label: 'Tarefas',   render: emBreve('Tarefas', 'Fase 4') },
  { id: 'chat',     label: 'Chat',      render: emBreve('Chat', 'Fase 5') },
  { id: 'wiki',     label: 'Wiki',      render: emBreve('Wiki', 'Fase 3') },
  { id: 'sistemas', label: 'Sistemas',  render: emBreve('Sistemas', 'Fase 3') },
  { id: 'bi',       label: 'BIs',       render: emBreve('BIs e Dashboards', 'Fase 3') },
  { id: 'contato',  label: 'Contato',   render: emBreve('Contato', 'Fase 3') },
];

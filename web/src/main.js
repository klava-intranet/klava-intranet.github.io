import { entrarComGoogle, sair, carregarSessao } from './lib/auth.js';
import { instalarShim, iniciarRealtime } from './shim/gas.js';
import { iniciarSistemas } from './modulos/sistemas.js';
import { iniciarCatalogos } from './modulos/catalogos.js';
import { iniciarPatrimonio } from './modulos/patrimonio.js';
import { registrarServiceWorker, iniciarPWA } from './lib/pwa.js';

registrarServiceWorker();

const $ = (id) => document.getElementById(id);
const mostrarTela = (id) => ['tela-carregando', 'tela-login', 'tela-sem-acesso'].forEach((t) => ($(t).hidden = t !== id));

function carregarScript(src) {
  return new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => falha(new Error('Não consegui carregar ' + src));
    document.body.appendChild(s);
  });
}

// Avisos nas páginas que ainda não foram migradas
const AVISOS = {
};
function instalarAvisos() {
  const original = window.showPage;
  window.showPage = function (pageId) {
    original(pageId);
    const html = AVISOS[pageId];
    const sec = $('page-' + pageId);
    if (!html || !sec || sec.querySelector('.aviso-migracao')) return;
    const div = document.createElement('div');
    div.className = 'aviso-migracao';
    div.innerHTML = html;
    sec.prepend(div);
  };
}

async function iniciar() {
  $('btn-login').onclick = () =>
    entrarComGoogle().catch((e) => { $('login-erro').textContent = e.message; $('login-erro').hidden = false; });
  $('btn-sair-2').onclick = sair;
  $('btn-sair').onclick = sair;

  const { session, perfil } = await carregarSessao();
  if (!session) return mostrarTela('tela-login');
  if (!perfil) { $('email-sem-acesso').textContent = session.user.email; return mostrarTela('tela-sem-acesso'); }

  // 1) troca o google.script.run pelo Supabase  2) carrega o front antigo  3) roda a inicialização dele
  instalarShim(perfil);
  await carregarScript(`${import.meta.env.BASE_URL}legado/app.js`);
  document.dispatchEvent(new Event('DOMContentLoaded'));
  instalarAvisos();
  iniciarSistemas(perfil);
  iniciarCatalogos(perfil);
  iniciarPatrimonio(perfil).catch((e) => console.error('patrimonio', e));
  iniciarPWA();
  window.getUser();
  iniciarRealtime();

  const overlay = $('auth-overlay');
  overlay.classList.add('saindo');
  setTimeout(() => overlay.remove(), 300);
}

iniciar().catch((e) => {
  console.error(e);
  mostrarTela('tela-login');
  $('login-erro').textContent = 'Erro ao iniciar: ' + e.message;
  $('login-erro').hidden = false;
});

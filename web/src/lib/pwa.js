/**
 * App instalável (PWA): registra o service worker, oferece "Instalar app" no menu de apps
 * e abre a tela pedida no endereço (#patrimonio, #tarefas, #chat…) — usado pelos atalhos do ícone.
 */
const $ = (id) => document.getElementById(id);
const TXT = {
  pt: { instalar: 'Instalar app', ios: 'No iPhone: toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início".' },
  en: { instalar: 'Install app', ios: 'On iPhone: tap Share (□↑) and then "Add to Home Screen".' },
  zh: { instalar: '安装应用', ios: '在 iPhone 上：点击"分享"(□↑)，然后选择"添加到主屏幕"。' },
};
const tx = (k) => (TXT[window.currentLang] || TXT.pt)[k];
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((e) => console.warn('service worker', e));
  });
}

export function iniciarPWA() {
  const item = $('pwa-instalar');
  const rotulo = $('pwa-instalar-rotulo');
  let pedido = null;
  const mostrar = () => { if (!item || instalado()) return; rotulo.textContent = tx('instalar'); item.hidden = false; };

  // Android / Chrome / Edge: o navegador avisa que dá para instalar
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; mostrar(); });
  window.addEventListener('appinstalled', () => { pedido = null; if (item) item.hidden = true; });
  if (ehIOS()) mostrar(); // iPhone não tem botão de instalar: mostramos como fazer

  item?.addEventListener('click', async () => {
    window.closeAppsHub?.();
    if (pedido) { pedido.prompt(); await pedido.userChoice.catch(() => {}); pedido = null; item.hidden = true; return; }
    alert(tx('ios'));
  });

  const setLanguage = window.setLanguage;
  window.setLanguage = function (l) { setLanguage(l); if (rotulo) rotulo.textContent = tx('instalar'); };

  // atalho do ícone / link direto: .../#tarefas abre Tarefas (o Patrimônio trata o próprio #patrimonio)
  const pagina = decodeURIComponent(location.hash.slice(1));
  if (pagina && pagina !== 'patrimonio' && /^[a-z]+$/.test(pagina) && document.getElementById('page-' + pagina)) {
    window.showPage(pagina);
  }
}

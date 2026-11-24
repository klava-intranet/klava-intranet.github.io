import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (web/.env.local)');

/**
 * Sessão vencida: quando o login expira (aba aberta por muito tempo, computador que dormiu,
 * login renovado em outra aba), o pedido chega ao banco sem usuário e volta
 * "permission denied for schema intranet" ou "JWT expired". Aqui o pedido renova o login
 * e é repetido uma vez; se não der para renovar, a pessoa volta para a tela de login.
 */
const SEM_SESSAO = /permission denied for schema intranet|JWT expired|invalid JWT|PGRST301|PGRST303/i;
let renovando = null;
let avisado = false;

function sessaoExpirada() {
  if (avisado || window.__klavaSaindo) return;
  avisado = true;
  alert('Sua sessão expirou. Entre de novo para continuar.');
  try { Object.keys(localStorage).filter((k) => /^sb-.*-auth-token$/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch { /* sem storage */ }
  window.location.reload();
}

async function fetchComSessao(input, init = {}) {
  const resp = await fetch(input, init);
  const alvo = String(input?.url || input);
  if (![401, 403].includes(resp.status) || !/\/(rest|storage)\/v1\//.test(alvo)) return resp;
  const txt = await resp.clone().text().catch(() => '');
  if (!SEM_SESSAO.test(txt)) return resp;

  renovando ||= sb.auth.refreshSession().finally(() => { setTimeout(() => { renovando = null; }, 1000); });
  const { data } = await renovando.catch(() => ({ data: null }));
  const token = data?.session?.access_token;
  if (!token) { sessaoExpirada(); return resp; }
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

// Todas as tabelas/RPCs da intranet vivem no schema "intranet"
export const sb = createClient(url, key, {
  db: { schema: 'intranet' },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: fetchComSessao },
});

// login caiu de vez (ou saiu em outra aba): volta para a tela de login
let logado = false;
sb.auth.onAuthStateChange((evento, sessao) => {
  if (sessao) logado = true;
  if (evento === 'SIGNED_OUT' && logado) sessaoExpirada();
});
// ao voltar para a aba (ou reabrir o app), renova o login se tiver vencido
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') sb.auth.getSession().catch(() => {});
});

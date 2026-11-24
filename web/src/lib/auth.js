import { sb } from './supabase.js';

export async function entrarComGoogle() {
  const hd = import.meta.env.VITE_GOOGLE_HD;
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: hd ? { hd, prompt: 'select_account' } : { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

export async function sair() {
  window.__klavaSaindo = true; // saída voluntária: não mostrar "sessão expirou"
  await sb.auth.signOut();
  window.location.reload();
}

/** Sessão + perfil da intranet. perfil = null → e-mail não cadastrado/inativo. */
export async function carregarSessao() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { session: null, perfil: null };
  const { data, error } = await sb.rpc('perfil');
  if (error) throw error;
  return { session, perfil: data?.[0] ?? null };
}

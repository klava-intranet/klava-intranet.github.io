// Acesso às APIs do Google com a conta-robô (a mesma que hoje roda o Apps Script).
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_AGENDA_CONTA
let cache: { token: string; expira: number } | null = null;

export const contaRobo = () => Deno.env.get('GOOGLE_AGENDA_CONTA') ?? '';
export const googleConfigurado = () =>
  !!(Deno.env.get('GOOGLE_CLIENT_ID') && Deno.env.get('GOOGLE_CLIENT_SECRET') && Deno.env.get('GOOGLE_REFRESH_TOKEN'));

export async function tokenGoogle(): Promise<string> {
  if (cache && cache.expira > Date.now() + 60_000) return cache.token;
  if (!googleConfigurado()) throw new Error('Integração Google não configurada (secrets GOOGLE_*).');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Google OAuth: ' + (j.error_description || j.error || r.status));
  cache = { token: j.access_token, expira: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cache.token;
}

export class GoogleErro extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export async function gapi<T = any>(metodo: string, url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + (await tokenGoogle()), 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (r.status === 204) return undefined as T;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new GoogleErro(r.status, `Google ${r.status}: ${j?.error?.message ?? r.statusText}`);
  return j as T;
}

export const CAL = 'https://www.googleapis.com/calendar/v3';

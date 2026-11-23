// Utilitários compartilhados pelas Edge Functions da intranet
import { createClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
export type Cliente = ReturnType<typeof createClient<any, 'intranet'>>;

export const TZ = 'America/Sao_Paulo';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Cliente com poderes totais (ignora RLS) — usar só depois de checar permissão */
export function admin(): Cliente {
  return createClient(URL, SERVICE, { db: { schema: 'intranet' }, auth: { persistSession: false } });
}

export type Perfil = { id: string; email: string; alias: string; nome: string; setor: string | null; papel: 'admin' | 'colaborador' };

/** Cliente "como o usuário" (RLS vale) + perfil da intranet. Lança erro se não estiver logado/cadastrado. */
export async function usuario(req: Request): Promise<{ sb: Cliente; perfil: Perfil }> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) throw new HttpErro(401, 'Não autenticado.');
  const sb = createClient(URL, ANON, {
    db: { schema: 'intranet' },
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await sb.rpc('perfil');
  if (error || !data?.[0]) throw new HttpErro(403, 'Sem acesso à intranet.');
  return { sb, perfil: data[0] as Perfil };
}

export class HttpErro extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

/** Envolve o handler: CORS, JSON e erros padronizados ({ok:false,msg}) */
export function servir(handler: (req: Request, body: Record<string, unknown>) => Promise<unknown>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
      const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      return json(await handler(req, body));
    } catch (e) {
      const status = e instanceof HttpErro ? e.status : 500;
      console.error(e);
      return json({ ok: false, msg: e instanceof Error ? e.message : String(e) }, status);
    }
  });
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo */
export function hojeSP(base = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(base);
}

export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export async function config<T>(chave: string, padrao: T): Promise<T> {
  const { data } = await admin().from('app_config').select('valor').eq('chave', chave).maybeSingle();
  return (data?.valor as T) ?? padrao;
}

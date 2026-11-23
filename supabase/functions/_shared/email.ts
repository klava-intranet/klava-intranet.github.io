// E-mail: usa o Resend se RESEND_API_KEY estiver configurado; senão envia pelo Gmail
// da conta-robô (mesmo comportamento do MailApp do Apps Script, sem configurar DNS).
import { gapi, contaRobo } from './google.ts';

type Email = { para: string[]; assunto: string; texto?: string; html?: string };

function b64utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export async function enviarEmail({ para, assunto, texto, html }: Email): Promise<void> {
  const dest = para.filter(Boolean);
  if (!dest.length) return;

  const resend = Deno.env.get('RESEND_API_KEY');
  if (resend) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_REMETENTE') ?? 'Klava Intranet <intranet@klavabrands.com>',
        to: dest, subject: assunto, text: texto, html,
      }),
    });
    if (!r.ok) throw new Error('Resend: ' + (await r.text()));
    return;
  }

  const mime = [
    `From: Klava Intranet <${contaRobo()}>`,
    `To: ${dest.join(', ')}`,
    `Subject: =?UTF-8?B?${b64utf8(assunto)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: ${html ? 'text/html' : 'text/plain'}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    b64utf8(html ?? texto ?? ''),
  ].join('\r\n');
  const raw = b64utf8(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await gapi('POST', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { raw });
}

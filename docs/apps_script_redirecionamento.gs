/**
 * KLAVA INTRANET — REDIRECIONAMENTO (usar no dia da virada)
 *
 * No editor do Apps Script da intranet antiga:
 *   1. Troque a função doGet() do GS.txt por esta (apague a antiga).
 *   2. Troque NOVA_URL pelo endereço da intranet nova.
 *   3. Implantar → Gerenciar implantações → editar a implantação ativa → Nova versão → Implantar.
 *
 * Quem abrir o link antigo (favoritos, atalhos no celular) cai numa tela que
 * leva para a intranet nova. Nada é apagado: a planilha continua lá, só leitura.
 */
var NOVA_URL = 'https://SEU_USUARIO.github.io/klava-intranet/';

function doGet() {
  var html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>' +
    'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0a0a;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box}' +
    '.logo{font-weight:900;font-size:34px;letter-spacing:4px;margin-bottom:12px}' +
    'p{color:#ccc;font-size:15px;line-height:1.6;max-width:420px;margin:0 auto 24px}' +
    'a{display:inline-block;background:#fff;color:#0a0a0a;text-decoration:none;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:13px;padding:14px 28px;border-radius:6px}' +
    '</style></head><body><div>' +
    '<div class="logo">KLAVA®</div>' +
    '<p>A intranet mudou de endereço. Entre com a sua conta Google da Klava e atualize seus favoritos.</p>' +
    '<a href="' + NOVA_URL + '" target="_top">Abrir a nova intranet</a>' +
    '</div>' +
    '<script>try{ window.top.location.href = "' + NOVA_URL + '"; }catch(e){}</script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('Klava Brands Group | Intranet')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

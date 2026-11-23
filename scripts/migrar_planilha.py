#!/usr/bin/env python3
"""
KLAVA INTRANET — Migração planilha (Apps Script) → Postgres/Supabase

Uso:
  1. Na planilha da intranet: Arquivo → Fazer download → Microsoft Excel (.xlsx)
  2. python scripts/migrar_planilha.py Intranet.xlsx            → gera seed_planilha.sql
  3. psql "$SUPABASE_DB_URL" -f seed_planilha.sql

Pode rodar quantas vezes quiser: tudo usa ON CONFLICT (pelo ID legado), então
uma segunda importação só acrescenta o que entrou de novo na planilha.

Requisitos: pip install openpyxl
"""
import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta

try:
    import openpyxl
except ImportError:
    sys.exit("Instale o openpyxl:  pip install openpyxl")

# ─────────────────────────── regras herdadas do GS.txt ───────────────────────────
ADMINS = {"tadeu", "luiz"}

# getChatMessages normalizava estes aliases antigos na exibição
ALIAS_NORM = {"faturamento": "tadeu", "financeiro": "luiz", "naya": "nayanna", "comex": "lethicia"}

# DRIVE_UPLOADERS (admins têm acesso a todos os setores pelo papel, não precisam estar aqui)
DRIVE_UPLOADERS = {
    "diretoria": ["thiago", "diego"], "comercial": ["franklin"],
    "financeiro": ["nelia", "raphael"], "tesouraria": [], "design": ["luciano", "aurea", "luiza"],
    "logistica": ["valeria"], "comex": ["nayanna", "lethicia"], "salesops": ["reinaldo"],
    "online": [], "novo": [],
}

PRIORIDADES = {"alta", "media", "baixa"}
STATUS = {"todo", "doing", "done"}
RECORRENCIAS = {"diaria", "semanal", "quinzenal", "mensal"}

avisos = []


# ─────────────────────────── helpers ───────────────────────────
def q(v):
    """Literal SQL seguro (ou NULL)."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(int(v)) if float(v).is_integer() else str(v)
    if isinstance(v, datetime):
        return "'" + v.isoformat() + "'"
    if isinstance(v, date):
        return "'" + v.isoformat() + "'"
    s = str(v).replace("\x00", "")
    return "'" + s.replace("'", "''") + "'"


def txt(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def is_true(v):
    return txt(v).lower() in ("true", "verdadeiro", "1", "sim")


def ts(v):
    """Timestamp ISO / datetime da planilha → datetime (ou None)."""
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day)
    s = txt(v)
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%f%z",
                "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        avisos.append(f"data não reconhecida: {s!r}")
        return None


def dt(v):
    d = ts(v)
    return d.date() if d else None


def aniversario(v):
    if v in (None, ""):
        return None
    if isinstance(v, (datetime, date)):
        return dt(v)
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$", txt(v))
    if not m:
        return dt(v)
    d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
    try:
        return date(int(y) if y and len(y) == 4 else 2000, mo, d)
    except ValueError:
        return None


def norm_alias(a):
    a = txt(a).lower()
    return ALIAS_NORM.get(a, a)


def ocorrencias(prazo, rec, total):
    if not rec or rec not in RECORRENCIAS:
        return [prazo]
    out = []
    for i in range(total):
        if rec == "diaria":
            out.append(prazo + timedelta(days=i))
        elif rec == "semanal":
            out.append(prazo + timedelta(days=7 * i))
        elif rec == "quinzenal":
            out.append(prazo + timedelta(days=14 * i))
        else:  # mensal (dia limitado ao fim do mês)
            mo = prazo.month - 1 + i
            y, mo = prazo.year + mo // 12, mo % 12 + 1
            nxt = date(y + (mo == 12), mo % 12 + 1, 1)
            out.append(date(y, mo, min(prazo.day, (nxt - timedelta(days=1)).day)))
    return out


def aba(wb, *nomes):
    """Lê uma aba como lista de dicts pelo cabeçalho. Aceita nomes alternativos."""
    for n in nomes:
        if n in wb.sheetnames:
            rows = list(wb[n].iter_rows(values_only=True))
            if not rows:
                return []
            head = [txt(h) for h in rows[0]]
            return [dict(zip(head, r)) for r in rows[1:] if any(c not in (None, "") for c in r)]
    avisos.append(f"aba não encontrada: {' / '.join(nomes)}")
    return []


def num_sql(numero):
    """Número da planilha; se já existir no banco (tarefa criada na intranet nova
    durante o paralelo), deixa NULL para o banco gerar o próximo da sequência."""
    if not numero:
        return "NULL"
    return f"(select case when exists (select 1 from intranet.tarefas where numero = {q(numero)}) then null else {q(numero)} end)"


def uid(alias):
    return f"(select id from intranet.usuarios where alias = {q(alias)})" if alias else "NULL"


# ─────────────────────────── migração ───────────────────────────
def migrar(wb):
    out = ["-- Gerado por scripts/migrar_planilha.py em " + datetime.now().isoformat(timespec="seconds"),
           "set client_encoding = 'UTF8';", "set client_min_messages = warning;", "begin;", ""]
    cont = defaultdict(int)
    conhecidos = set()

    def sec(t):
        out.extend(["", f"-- ══════════ {t} ══════════"])

    # USUÁRIOS ---------------------------------------------------------------
    sec("USUÁRIOS")
    for r in aba(wb, "Usuários", "Usuarios"):
        email, alias = txt(r.get("Email")).lower(), txt(r.get("Alias")).lower()
        if not email or not alias:
            continue
        if alias in conhecidos:
            avisos.append(f"alias '{alias}' repetido na aba Usuários → {email} ignorado (vale a 1ª linha)")
            continue
        ativo = txt(r.get("Ativo") or "sim").lower() not in ("não", "nao", "no")
        papel = "admin" if alias in ADMINS else "colaborador"
        out.append(
            "insert into intranet.usuarios (email, alias, nome, setor, aniversario, ativo, papel) select "
            f"{q(email)}, {q(alias)}, {q(txt(r.get('Nome Completo')) or alias)}, {q(txt(r.get('Setor')) or None)}, "
            f"{q(aniversario(r.get('Aniversario')))}::date, {q(ativo)}, '{papel}' "
            f"where not exists (select 1 from intranet.usuarios where alias = {q(alias)} and email <> {q(email)}) "
            "on conflict (email) do update set nome = excluded.nome, setor = excluded.setor, "
            "aniversario = excluded.aniversario, ativo = excluded.ativo;")
        conhecidos.add(alias)
        cont["usuarios"] += 1

    # coleta aliases usados nas outras abas para criar usuários legados inativos
    usados = set()
    for r in aba(wb, "Chat"):
        usados.add(norm_alias(r.get("Alias")))
    for r in aba(wb, "Tarefas"):
        usados.update({txt(r.get("Solicitante")).lower(), txt(r.get("Responsável")).lower()})
    for r in aba(wb, "Comentarios"):
        usados.add(txt(r.get("Alias")).lower())
    for r in aba(wb, "Reações", "Reacoes"):
        usados.add(txt(r.get("Alias")).lower())
    for r in aba(wb, "Canais"):
        usados.update(norm_alias(m) for m in txt(r.get("Membros")).split(","))
    usados -= {"", "sistema", "visitante", "?"}
    for a in sorted(usados - conhecidos):
        if a in ADMINS:
            avisos.append(f"🚨 ADMIN '{a}' não está na aba Usuários → adicione a linha dele na planilha e gere de novo (senão ele perde o acesso)")
        else:
            avisos.append(f"alias '{a}' não está na aba Usuários → criado como usuário inativo (legado)")
        out.append("insert into intranet.usuarios (email, alias, nome, ativo) values "
                   f"({q(a + '@legado.klava.local')}, {q(a)}, {q(a)}, false) on conflict do nothing;")
        conhecidos.add(a)

    # DRIVE: uploaders
    for setor, aliases in DRIVE_UPLOADERS.items():
        for a in aliases:
            out.append("insert into intranet.drive_setor_uploaders (setor_key, usuario_id) "
                       f"select {q(setor)}, id from intranet.usuarios where alias = {q(a)} on conflict do nothing;")

    # CANAIS -----------------------------------------------------------------
    sec("CANAIS")
    out.append("insert into intranet.canais (key, tipo, nome) values ('geral', 'geral', 'Geral') on conflict do nothing;")
    canais = {}
    for r in aba(wb, "Canais"):
        key = txt(r.get("ChannelKey"))
        if not key:
            continue
        membros = sorted({norm_alias(m) for m in txt(r.get("Membros")).split(",")} - {""})
        criador = norm_alias(r.get("CriadoPor"))
        canais[key] = key
        out.append("insert into intranet.canais (key, tipo, nome, descricao, criado_por, criado_em) values "
                   f"({q(key)}, 'canal', {q(txt(r.get('Nome')) or key)}, {q(txt(r.get('Descrição')) or None)}, "
                   f"{uid(criador)}, coalesce({q(ts(r.get('CriadoEm')))}::timestamptz, now())) on conflict do nothing;")
        for m in set(membros) | ({criador} if criador else set()):
            out.append("insert into intranet.canal_membros (canal_id, usuario_id) "
                       f"select c.id, u.id from intranet.canais c, intranet.usuarios u "
                       f"where c.key = {q(key)} and u.alias = {q(m)} on conflict do nothing;")
        cont["canais"] += 1

    def resolver_canal(key):
        """Normaliza a key e garante que o canal exista (DMs e canais apagados)."""
        key = txt(key)
        if key in ("", "geral"):
            return "geral"
        if key.startswith("dm:"):
            partes = sorted({norm_alias(p) for p in key[3:].split("_") if p})
            nova = "dm:" + "_".join(partes if len(partes) > 1 else partes * 2)
            if nova not in canais:
                canais[nova] = nova
                out.append(f"insert into intranet.canais (key, tipo, nome) values ({q(nova)}, 'dm', {q(nova)}) on conflict do nothing;")
                for p in partes:
                    out.append("insert into intranet.canal_membros (canal_id, usuario_id) "
                               "select c.id, u.id from intranet.canais c, intranet.usuarios u "
                               f"where c.key = {q(nova)} and u.alias = {q(p)} on conflict do nothing;")
                cont["dms"] += 1
            return nova
        if key not in canais:
            canais[key] = key
            avisos.append(f"canal '{key}' tem mensagens mas não está na aba Canais → criado sem membros (só admins veem via SQL)")
            out.append(f"insert into intranet.canais (key, tipo, nome) values ({q(key)}, 'canal', {q(key.replace('canal:', ''))}) on conflict do nothing;")
        return key

    # MENSAGENS --------------------------------------------------------------
    sec("MENSAGENS")
    linhas_chat = aba(wb, "Chat")
    for r in linhas_chat:
        resolver_canal(r.get("Canal"))
    for r in linhas_chat:
        try:
            legacy = int(float(r.get("ID")))
        except (TypeError, ValueError):
            continue
        canal = resolver_canal(r.get("Canal"))
        autor = norm_alias(r.get("Alias"))
        tipo = txt(r.get("Tipo")) or "text"
        if autor == "sistema":
            tipo = "sistema"
        if tipo not in ("text", "file", "videocall", "sistema"):
            tipo = "text"
        conteudo = txt(r.get("Mensagem"))[:4000] or "(vazio)"
        quando = ts(r.get("Timestamp")) or datetime.fromtimestamp(legacy / 1000)
        out.append("insert into intranet.mensagens (legacy_id, canal_id, autor_id, tipo, conteudo, arquivo_url, criado_em) values "
                   f"({legacy}, (select id from intranet.canais where key = {q(canal)}), "
                   f"{uid(autor) if tipo != 'sistema' else 'NULL'}, '{tipo}', {q(conteudo)}, "
                   f"{q(txt(r.get('FileURL')) or None)}, {q(quando)}) on conflict (legacy_id) do nothing;")
        cont["mensagens"] += 1

    # marca tudo que já existia como lido (ninguém recebe milhares de "não lidas" no 1º acesso)
    out.append("update intranet.canal_membros m set last_read_id = coalesce((select max(id) from intranet.mensagens x where x.canal_id = m.canal_id), 0);")
    out.append("insert into intranet.leituras_geral (usuario_id, last_read_id) select u.id, coalesce((select max(x.id) from intranet.mensagens x "
               "join intranet.canais c on c.id = x.canal_id and c.tipo = 'geral'), 0) from intranet.usuarios u "
               "on conflict (usuario_id) do update set last_read_id = greatest(intranet.leituras_geral.last_read_id, excluded.last_read_id);")

    sec("REAÇÕES")
    for r in aba(wb, "Reações", "Reacoes"):
        try:
            legacy = int(float(r.get("MsgId")))
        except (TypeError, ValueError):
            continue
        a, emoji = txt(r.get("Alias")).lower(), txt(r.get("Emoji"))
        if not a or not emoji:
            continue
        out.append("insert into intranet.reacoes (mensagem_id, usuario_id, emoji, criado_em) "
                   f"select m.id, u.id, {q(emoji)}, coalesce({q(ts(r.get('Timestamp')))}::timestamptz, now()) "
                   f"from intranet.mensagens m, intranet.usuarios u where m.legacy_id = {legacy} and u.alias = {q(a)} on conflict do nothing;")
        cont["reacoes"] += 1

    # TAREFAS ----------------------------------------------------------------
    sec("TAREFAS")
    # contadores em dia com o que já foi criado na intranet nova (importação de virada)
    out.append("do $$ begin perform intranet.recalcular_contadores(); end $$;")
    tarefas = aba(wb, "Tarefas")
    # 1º as que já têm número; depois recalcula contadores; por último as sem número
    tarefas.sort(key=lambda r: 0 if txt(r.get("Numero")) else 1)
    recalculado = False
    for r in tarefas:
        tid = txt(r.get("ID"))
        if not tid:
            continue
        numero = txt(r.get("Numero")) or None
        if numero is None and not recalculado:
            out.append("do $$ begin perform intranet.recalcular_contadores(); end $$;")
            recalculado = True
        sol, resp = txt(r.get("Solicitante")).lower(), txt(r.get("Responsável")).lower()
        resp = resp or sol
        if not resp:
            avisos.append(f"tarefa {tid} sem responsável → ignorada")
            continue
        prazo = dt(r.get("Prazo"))
        if not prazo:
            prazo = dt(r.get("CriadoEm")) or date.today()
            avisos.append(f"tarefa {tid} sem prazo válido → prazo = data de criação")
        prio = txt(r.get("Prioridade")).lower()
        prio = prio if prio in PRIORIDADES else "baixa"
        status = txt(r.get("Status")).lower()
        status = status if status in STATUS else "todo"
        rec = txt(r.get("Recorrencia")).lower() or None
        rec = rec if rec in RECORRENCIAS else None
        try:
            total = max(1, min(52, int(float(r.get("TotalOcorrencias") or 1))))
        except (TypeError, ValueError):
            total = 1
        criado = ts(r.get("CriadoEm"))
        titulo = (txt(r.get("Título")) or "(sem título)")[:200]
        out.append(
            "insert into intranet.tarefas (legacy_id, numero, titulo, descricao, solicitante_id, responsavel_id, prazo, "
            "prioridade, unidade, marca, status, recorrencia, total_ocorrencias, criado_em, concluido_em) select "
            f"{q(tid)}, {num_sql(numero)}, {q(titulo)}, {q(txt(r.get('Descrição')))}, {uid(sol)}, {uid(resp)}, {q(prazo)}, "
            f"'{prio}', {q(txt(r.get('Unidade')) or 'geral')}, {q(txt(r.get('Marca')) or 'GERAL')}, '{status}', "
            f"{q(rec)}, {total}, coalesce({q(criado)}::timestamptz, now()), "
            f"{'now()' if status == 'done' else 'NULL'} "
            f"where not exists (select 1 from intranet.tarefas where legacy_id = {q(tid)});")
        # ocorrências + eventos do Calendar
        try:
            ev_ids = json.loads(txt(r.get("CalendarEventIds")) or "[]")
        except json.JSONDecodeError:
            ev_ids = []
        if not ev_ids and txt(r.get("CalendarEventId")):
            ev_ids = [txt(r.get("CalendarEventId"))]
        for i, d in enumerate(ocorrencias(prazo, rec, total)):
            ev = ev_ids[i] if i < len(ev_ids) and ev_ids[i] else None
            out.append("insert into intranet.tarefa_ocorrencias (tarefa_id, ordem, data, calendar_event_id) "
                       f"select id, {i + 1}, {q(d)}, {q(ev)} from intranet.tarefas where legacy_id = {q(tid)} on conflict do nothing;")
        # anexos
        try:
            anexos = json.loads(txt(r.get("Anexos")) or "[]")
        except json.JSONDecodeError:
            anexos = []
        for ax in anexos if isinstance(anexos, list) else []:
            if isinstance(ax, dict) and ax.get("url"):
                out.append("insert into intranet.tarefa_anexos (tarefa_id, nome, url) "
                           f"select id, {q(ax.get('name') or 'anexo')}, {q(ax['url'])} from intranet.tarefas t "
                           f"where legacy_id = {q(tid)} and not exists (select 1 from intranet.tarefa_anexos a "
                           f"where a.tarefa_id = t.id and a.url = {q(ax['url'])});")
                cont["anexos"] += 1
        cont["tarefas"] += 1
    out.append("do $$ begin perform intranet.recalcular_contadores(); end $$;")

    sec("COMENTÁRIOS")
    for r in aba(wb, "Comentarios", "Comentários"):
        cid, tid = txt(r.get("CommentId")), txt(r.get("TaskId"))
        if not cid or not tid or not txt(r.get("Text")):
            continue
        out.append("insert into intranet.tarefa_comentarios (legacy_id, tarefa_id, autor_id, texto, criado_em, deleted_at) "
                   f"select {q(cid)}, t.id, {uid(txt(r.get('Alias')).lower())}, {q(txt(r.get('Text'))[:1000])}, "
                   f"coalesce({q(ts(r.get('CreatedAt')))}::timestamptz, now()), {'now()' if is_true(r.get('Deleted')) else 'NULL'} "
                   f"from intranet.tarefas t where t.legacy_id = {q(tid)} on conflict (legacy_id) do nothing;")
        cont["comentarios"] += 1

    # DRIVE ------------------------------------------------------------------
    sec("DRIVE")
    for r in aba(wb, "Drive_Arquivos"):
        fid, setor = txt(r.get("FileId")), txt(r.get("SectorId")).lower()
        if not fid or not setor:
            continue
        out.append(f"insert into intranet.drive_setores (key, nome, ordem) values ({q(setor)}, {q(setor.title())}, 99) on conflict do nothing;")
        try:
            tam = int(float(r.get("Size") or 0)) or None
        except (TypeError, ValueError):
            tam = None
        out.append("insert into intranet.drive_arquivos (google_file_id, setor_key, nome, descricao, mime_type, url, tamanho, enviado_por, enviado_em, deleted_at) values "
                   f"({q(fid)}, {q(setor)}, {q(txt(r.get('FileName')) or fid)}, {q(txt(r.get('Description')))}, "
                   f"{q(txt(r.get('MimeType')) or None)}, {q(txt(r.get('Url')) or None)}, {q(tam)}, "
                   f"{uid(txt(r.get('UploadedBy')).lower())}, coalesce({q(ts(r.get('UploadedAt')))}::timestamptz, now()), "
                   f"{'now()' if is_true(r.get('Deleted')) else 'NULL'}) on conflict (google_file_id) do nothing;")
        cont["drive_arquivos"] += 1

    for r in aba(wb, "Drive_Links"):
        lid, setor = txt(r.get("LinkId")), txt(r.get("SectorId")).lower()
        if not lid or not setor or not txt(r.get("Url")):
            continue
        out.append(f"insert into intranet.drive_setores (key, nome, ordem) values ({q(setor)}, {q(setor.title())}, 99) on conflict do nothing;")
        out.append("insert into intranet.drive_links (legacy_id, setor_key, titulo, url, sub, tipo, criado_por, criado_em, deleted_at) values "
                   f"({q(lid)}, {q(setor)}, {q(txt(r.get('Title')) or txt(r.get('Url')))}, {q(txt(r.get('Url')))}, "
                   f"{q(txt(r.get('Sub')))}, {q(txt(r.get('Type')) or 'link')}, {uid(txt(r.get('CreatedBy')).lower())}, "
                   f"coalesce({q(ts(r.get('CreatedAt')))}::timestamptz, now()), {'now()' if is_true(r.get('Deleted')) else 'NULL'}) "
                   "on conflict (legacy_id) do nothing;")
        cont["drive_links"] += 1

    # CONTATOS / WIKI --------------------------------------------------------
    sec("CONTATOS")
    for r in aba(wb, "Contatos"):
        cid = txt(r.get("ContactId"))
        if not cid or not txt(r.get("Nome")):
            continue
        try:
            ordem = int(float(r.get("Ordem") or 0))
        except (TypeError, ValueError):
            ordem = 0
        out.append("insert into intranet.contatos (legacy_id, setor_key, setor_label, nome, cargo, cargo_en, cargo_zh, telefone, email, ordem, criado_em, deleted_at) values "
                   f"({q(cid)}, {q(txt(r.get('SectorKey')) or 'geral')}, {q(txt(r.get('SectorLabel')))}, {q(txt(r.get('Nome')))}, "
                   f"{q(txt(r.get('Cargo')) or '-')}, {q(txt(r.get('CargoEN')))}, {q(txt(r.get('CargoZH')))}, "
                   f"{q(txt(r.get('Telefone')))}, {q(txt(r.get('Email')).lower())}, {ordem}, "
                   f"coalesce({q(ts(r.get('CreatedAt')))}::timestamptz, now()), {'now()' if is_true(r.get('Deleted')) else 'NULL'}) "
                   "on conflict (legacy_id) do nothing;")
        cont["contatos"] += 1

    sec("WIKI")
    for r in aba(wb, "Wiki"):
        wid = txt(r.get("WikiId"))
        if not wid or not txt(r.get("Titulo")):
            continue
        out.append("insert into intranet.wiki_artigos (legacy_id, categoria, titulo, conteudo, criado_por, criado_em, atualizado_por, atualizado_em, deleted_at) values "
                   f"({q(wid)}, {q(txt(r.get('Categoria')) or 'Geral')}, {q(txt(r.get('Titulo')))}, {q(txt(r.get('Conteudo')))}, "
                   f"{uid(txt(r.get('CreatedBy')).lower())}, coalesce({q(ts(r.get('CreatedAt')))}::timestamptz, now()), "
                   f"{uid(txt(r.get('UpdatedBy')).lower())}, coalesce({q(ts(r.get('UpdatedAt')))}::timestamptz, now()), "
                   f"{'now()' if is_true(r.get('Deleted')) else 'NULL'}) on conflict (legacy_id) do nothing;")
        cont["wiki"] += 1

    # LOGS (só na 1ª importação, para não duplicar) -----------------------------
    sec("LOGS DE ACESSO")
    out.append("do $$ begin if exists (select 1 from intranet.logs_acesso) then raise notice 'logs já importados'; return; end if;")
    for r in aba(wb, "Logs_Acesso"):
        quando = ts(r.get("Data e Hora"))
        if not quando:
            continue
        email = txt(r.get("E-mail")).lower()
        out.append("  insert into intranet.logs_acesso (usuario_id, email, acao, criado_em) values "
                   f"((select id from intranet.usuarios where email = {q(email)} or alias = {q(email)} limit 1), "
                   f"{q(email)}, {q(txt(r.get('Ação')) or 'Acesso')}, {q(quando)});")
        cont["logs_acesso"] += 1
    out.append("end $$;")

    out.extend(["", "commit;"])
    return out, cont


def main():
    ap = argparse.ArgumentParser(description="Migra a planilha da intranet para o Postgres (gera SQL).")
    ap.add_argument("xlsx", help="planilha exportada (.xlsx)")
    ap.add_argument("-o", "--out", default="seed_planilha.sql", help="arquivo SQL de saída")
    a = ap.parse_args()

    wb = openpyxl.load_workbook(a.xlsx, read_only=True, data_only=True)
    linhas, cont = migrar(wb)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")

    import os
    mb = os.path.getsize(a.out) / 1024 / 1024
    print(f"✅ {a.out} gerado ({len(linhas)} linhas, {mb:.1f} MB)")
    print("   → até ~2 MB: cole no SQL Editor do Supabase | acima disso: use o psql (README, passo 5)")
    for k, v in cont.items():
        print(f"   {k:<16}{v:>7}")
    if avisos:
        print(f"\n⚠️  {len(avisos)} aviso(s):")
        for w in avisos[:50]:
            print("   -", w)
        if len(avisos) > 50:
            print(f"   … e mais {len(avisos) - 50}")


if __name__ == "__main__":
    main()

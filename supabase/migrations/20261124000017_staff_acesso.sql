-- ═══════════════════════════════════════════════════════════════════════
-- KLAVA INTRANET — 0017 · ACESSO À INTRANET PELO STAFF
-- O admin libera (ou corta) o login de um funcionário direto na ficha do Staff,
-- sem precisar do Table Editor. Usa o e-mail do cadastro (conta Google da Klava).
-- Quem sai da empresa (Staff inativo) perde o acesso na hora.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function intranet.staff_acesso(p_staff uuid, p_liberar boolean)
returns jsonb language plpgsql security definer set search_path = '' as
$$
declare
  s intranet.staff;
  v_user uuid;
  v_alias text;
  v_base text;
  n int := 1;
begin
  if not intranet.is_admin() then raise exception 'Só administradores liberam acesso.'; end if;
  select * into s from intranet.staff where id = p_staff;
  if s.id is null then raise exception 'Funcionário não encontrado.'; end if;

  if not p_liberar then
    if s.usuario_id = intranet.me() then raise exception 'Você não pode cortar o seu próprio acesso.'; end if;
    update intranet.usuarios set ativo = false where id = s.usuario_id;
    return jsonb_build_object('acesso', false);
  end if;

  if s.email is null then raise exception 'Cadastre o e-mail (conta Google) antes de liberar o acesso.'; end if;
  if not s.ativo then raise exception 'Funcionário inativo não pode ter acesso.'; end if;

  select id into v_user from intranet.usuarios where email = s.email;
  if v_user is null then
    -- apelido de login: parte do e-mail antes do @ (gabriel.santos → gabriel.santos), sem repetir
    v_base := regexp_replace(lower(split_part(s.email, '@', 1)), '[^a-z0-9._-]', '', 'g');
    if v_base = '' then v_base := 'usuario'; end if;
    v_alias := v_base;
    while exists (select 1 from intranet.usuarios where alias = v_alias) loop
      n := n + 1; v_alias := v_base || n;
    end loop;
    insert into intranet.usuarios (email, alias, nome, setor, telefone, papel, ativo)
    values (s.email, v_alias, coalesce(s.apelido, s.nome), s.setor, s.telefone, 'colaborador', true)
    returning id into v_user;
  else
    update intranet.usuarios set ativo = true where id = v_user;
  end if;

  -- se a pessoa já tinha tentado entrar antes de ser cadastrada, liga o login agora
  if to_regclass('auth.users') is not null then
    execute 'update intranet.usuarios u set auth_id = a.id from auth.users a
              where u.id = $1 and u.auth_id is null and lower(a.email) = u.email' using v_user;
  end if;

  update intranet.staff set usuario_id = v_user where id = s.id;
  return jsonb_build_object('acesso', true, 'alias', (select alias from intranet.usuarios where id = v_user));
end $$;

revoke execute on function intranet.staff_acesso(uuid, boolean) from public, anon;
grant execute on function intranet.staff_acesso(uuid, boolean) to authenticated;

-- desligou (Staff inativo) → perde o login da intranet
create or replace function intranet.staff_after_inativo()
returns trigger language plpgsql security definer set search_path = '' as
$$ begin
  if old.ativo and not new.ativo and new.usuario_id is not null then
    update intranet.usuarios set ativo = false where id = new.usuario_id and id <> coalesce(intranet.me(), gen_random_uuid());
  end if;
  return new;
end $$;
drop trigger if exists t_staff_after_inativo on intranet.staff;
create trigger t_staff_after_inativo after update of ativo on intranet.staff
  for each row execute function intranet.staff_after_inativo();

-- o Staff mostra quem tem acesso: lista de usuários ativos ligados ao Staff
create or replace function intranet.staff_com_acesso()
returns setof uuid language sql stable security definer set search_path = '' as
$$ select s.id from intranet.staff s join intranet.usuarios u on u.id = s.usuario_id
    where u.ativo and intranet.me() is not null $$;
grant execute on function intranet.staff_com_acesso() to authenticated;

notify pgrst, 'reload schema';

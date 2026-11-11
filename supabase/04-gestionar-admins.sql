-- ════════════════════════════════════════════════════════════════
-- NAMNA — dar y quitar permisos de administración
--
-- Desde que la escritura está cerrada (03-cerrar-escritura.sql), crear
-- un usuario en Authentication NO le da acceso al catálogo: además hay
-- que meterlo en la tabla `admins`.
--
-- Esto deja dos funciones para hacerlo con una línea, en vez de buscar
-- el UUID del usuario a mano.
--
-- Aplicar UNA VEZ: Supabase → SQL Editor → pegar entero → Run.
-- Después se usan desde el mismo editor (ver el final del archivo).
--
-- No se conceden a anon ni a authenticated: solo se pueden ejecutar
-- desde el editor SQL o con la clave secreta. Desde el navegador, no.
-- ════════════════════════════════════════════════════════════════

-- ── Dar permisos ──
create or replace function public.agregar_admin(correo text, apunte text default null)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  id_usuario uuid;
begin
  select id into id_usuario
  from auth.users
  where lower(email) = lower(trim(correo))
  limit 1;

  if id_usuario is null then
    return 'No existe ningún usuario con el correo ' || correo ||
           '. Créalo primero en Authentication → Users → Add user.';
  end if;

  insert into public.admins (user_id, email, nota)
  values (id_usuario, lower(trim(correo)), coalesce(apunte, 'alta manual'))
  on conflict (user_id) do update set email = excluded.email, nota = excluded.nota;

  return correo || ' ya es administrador.';
end;
$$;

-- ── Quitar permisos ──
-- No borra el usuario: solo le retira el acceso al catálogo. Podrá
-- seguir entrando al panel, pero no verá ni cambiará nada.
create or replace function public.quitar_admin(correo text)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  borrados int;
begin
  if (select count(*) from public.admins) <= 1 then
    return 'No se puede: es el único administrador que queda. ' ||
           'Da de alta a otro antes de quitarle los permisos a este.';
  end if;

  delete from public.admins
  where lower(email) = lower(trim(correo));
  get diagnostics borrados = row_count;

  if borrados = 0 then
    return correo || ' no estaba en la lista de administradores.';
  end if;
  return 'Permisos retirados a ' || correo || '. El usuario sigue existiendo.';
end;
$$;

-- Solo desde el editor SQL o con la clave secreta. Nunca desde el navegador.
revoke all on function public.agregar_admin(text, text) from public, anon, authenticated;
revoke all on function public.quitar_admin(text)        from public, anon, authenticated;

-- ── Ver quién tiene acceso hoy ──
select a.email, a.nota, a.creado_en, u.last_sign_in_at as ultimo_acceso
from public.admins a
left join auth.users u on u.id = a.user_id
order by a.creado_en;


-- ════════════════════════════════════════════════════════════════
-- CÓMO SE USA (descomenta la línea y ejecútala sola)
-- ════════════════════════════════════════════════════════════════
--
--   select public.agregar_admin('persona@ejemplo.com', 'quien es y por que');
--   select public.quitar_admin('persona@ejemplo.com');
--
-- Antes de agregar, el usuario tiene que existir:
--   Authentication → Users → Add user → marcar «Auto Confirm User».
--   https://supabase.com/dashboard/project/mublwuvrpyztgblxqrmn/auth/users
-- ════════════════════════════════════════════════════════════════

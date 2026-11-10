-- ════════════════════════════════════════════════════════════════
-- NAMNA — cerrar la escritura a una lista de administradores
--
-- PROBLEMA QUE ARREGLA (encontrado en la auditoría del 10-nov-2026):
-- El registro publico de Supabase estaba abierto (disable_signup:false)
-- y las politicas daban permiso total al rol `authenticated`. Cualquiera
-- podia crearse una cuenta con su correo y, al confirmarla, editar
-- precios, publicar o retirar piezas, reescribir los textos de la web y
-- subir archivos al bucket.
--
-- A partir de aqui no basta con estar autenticado: hay que estar en la
-- tabla `admins`. Aunque alguien se registre, no puede tocar nada.
--
-- Aplicar: Supabase → SQL Editor → pegar entero → Run.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════

-- ── Quien es administrador ──
create table if not exists public.admins (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  email     text,
  nota      text,
  creado_en timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Nadie lee ni escribe esta tabla desde el navegador. Se gestiona
-- desde el panel de Supabase o con la clave secreta. Sin politicas
-- permisivas, el RLS lo niega todo por defecto.
revoke all on public.admins from anon, authenticated;

-- Da de alta como administradores a los usuarios que YA existian antes
-- de este cambio, para no dejarte fuera de tu propio panel.
insert into public.admins (user_id, email, nota)
select id, email, 'alta automatica al cerrar la escritura (03-cerrar-escritura.sql)'
from auth.users
on conflict (user_id) do nothing;

-- ── La comprobación ──
-- SECURITY DEFINER para que pueda leer `admins` sin que el usuario
-- tenga permiso sobre ella. search_path fijado para que nadie pueda
-- colar una tabla `admins` suya por delante.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

-- ════════════════════════════════════════════════════════════════
-- POLÍTICAS: escribir exige ser admin, no solo estar autenticado
-- ════════════════════════════════════════════════════════════════

-- Productos
drop policy if exists "productos admin total" on public.productos;
create policy "productos admin total" on public.productos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Imágenes de producto
drop policy if exists "imagenes admin total" on public.imagenes;
create policy "imagenes admin total" on public.imagenes
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Textos
drop policy if exists "textos admin total" on public.textos;
create policy "textos admin total" on public.textos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Imágenes del sitio
drop policy if exists "imagenes sitio admin total" on public.imagenes_sitio;
create policy "imagenes sitio admin total" on public.imagenes_sitio
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Un autenticado que no sea admin tampoco debe ver lo oculto ni lo
-- archivado: para él rigen las mismas politicas de lectura que para
-- el publico.
drop policy if exists "productos lectura autenticada" on public.productos;
create policy "productos lectura autenticada" on public.productos
  for select to authenticated using (public.es_admin() or (visible = true and archivado = false));

drop policy if exists "imagenes lectura autenticada" on public.imagenes;
create policy "imagenes lectura autenticada" on public.imagenes
  for select to authenticated using (
    public.es_admin() or (
      archivada = false and exists (
        select 1 from public.productos p
        where p.id = producto_id and p.visible = true and p.archivado = false
      )
    )
  );

-- ── Storage: subir, cambiar y borrar exige ser admin ──
drop policy if exists "fotos escritura admin" on storage.objects;
create policy "fotos escritura admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos' and public.es_admin());

drop policy if exists "fotos actualizacion admin" on storage.objects;
create policy "fotos actualizacion admin" on storage.objects
  for update to authenticated using (bucket_id = 'productos' and public.es_admin());

drop policy if exists "fotos borrado admin" on storage.objects;
create policy "fotos borrado admin" on storage.objects
  for delete to authenticated using (bucket_id = 'productos' and public.es_admin());

notify pgrst, 'reload schema';

-- ── Comprobación ──
select
  (select count(*) from public.admins)                                    as administradores,
  (select count(*) from auth.users)                                       as usuarios_totales,
  (select count(*) from pg_proc where proname = 'es_admin')               as funcion_creada,
  (select count(*) from pg_policies
     where schemaname = 'public' and qual like '%es_admin%')              as politicas_cerradas;
-- Esperado: administradores = usuarios_totales = 1 · funcion_creada = 1 · politicas_cerradas >= 6

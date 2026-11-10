-- ════════════════════════════════════════════════════════════════
-- NAMNA Fine Jewelry — esquema Postgres (Supabase)
-- Sustituye a la Hoja de Google como fuente de verdad del catálogo.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar entero → Run.
-- Es idempotente: se puede volver a ejecutar sin romper nada.
-- ════════════════════════════════════════════════════════════════

-- ── Utilidad: marcar la fecha de modificación ──
create or replace function public.tocar_actualizado()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- PRODUCTOS
-- El id es el mismo texto que ya usas ("N. Ruby D"), para no romper
-- enlaces existentes (producto.html?id=) ni el nombre de las fotos.
-- ════════════════════════════════════════════════════════════════
create table if not exists public.productos (
  id                text        primary key,
  nombre            text        not null default '',
  descripcion_es    text        not null default '',
  descripcion_en    text        not null default '',
  categoria_es      text        not null default '',
  categoria_en      text        not null default '',
  precio            numeric(10,2) not null default 0 check (precio >= 0),
  precio_mayorista  numeric(10,2)          check (precio_mayorista >= 0),
  stock             integer                check (stock >= 0),
  visible           boolean     not null default false,
  archivado         boolean     not null default false,
  orden             integer     not null default 0,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

comment on column public.productos.orden is
  'Orden manual en el catálogo. Menor primero; empate se resuelve por creado_en desc.';
comment on column public.productos.stock is
  'NULL = sin control de inventario. 0 = agotado.';
comment on column public.productos.precio_mayorista is
  'Fase 2b: precio para clientes mayoristas. NULL mientras no se use.';
comment on column public.productos.archivado is
  'Regla del proyecto: nada se borra. "Eliminar" en el panel pone esto a true y la fila se conserva entera.';

create index if not exists productos_visible_idx  on public.productos (visible) where archivado = false;
create index if not exists productos_orden_idx    on public.productos (orden, creado_en desc);
create index if not exists productos_categoria_idx on public.productos (categoria_es);

drop trigger if exists productos_tocar on public.productos;
create trigger productos_tocar before update on public.productos
  for each row execute function public.tocar_actualizado();

-- ════════════════════════════════════════════════════════════════
-- IMÁGENES DE PRODUCTO
-- orden = 0 es la foto principal (la de la tarjeta).
-- ════════════════════════════════════════════════════════════════
create table if not exists public.imagenes (
  id             uuid        primary key default gen_random_uuid(),
  producto_id    text        not null references public.productos(id) on update cascade,
  ruta           text        not null,          -- ruta dentro del bucket de Storage
  url            text        not null,          -- URL pública completa
  orden          integer     not null default 0,
  ancho          integer,
  alto           integer,
  bytes          integer,
  archivada      boolean     not null default false,
  origen_drive   text,                          -- fileId de Drive, para poder auditar la migración
  creado_en      timestamptz not null default now()
);

create index if not exists imagenes_producto_idx on public.imagenes (producto_id, orden) where archivada = false;
create unique index if not exists imagenes_ruta_idx on public.imagenes (ruta);

-- ════════════════════════════════════════════════════════════════
-- TEXTOS DEL SITIO  (lo que hoy vive en la pestaña TEXTOS)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.textos (
  id             text        primary key,       -- 'TXT-001'
  es             text        not null default '',
  en             text        not null default '',
  nota           text,                          -- frase legible para quien edita
  pagina         text,                          -- en qué página(s) sale
  seccion        text,                          -- Cabecera, Hero, Pie de página…
  papel          text,                          -- Titular, Botón, Enlace del menú…
  orden_ui       integer     not null default 9000,
  actualizado_en timestamptz not null default now()
);

-- Las 4 últimas las rellena scripts/mapear-textos.mjs leyendo los HTML.
create index if not exists textos_orden_idx on public.textos (orden_ui);

drop trigger if exists textos_tocar on public.textos;
create trigger textos_tocar before update on public.textos
  for each row execute function public.tocar_actualizado();

-- ════════════════════════════════════════════════════════════════
-- IMÁGENES DECORATIVAS DEL SITIO (hero, banners — hoy en Site_Assets)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.imagenes_sitio (
  clave          text        primary key,       -- 'hero', 'banner_info'…
  url            text        not null,
  ruta           text,
  actualizado_en timestamptz not null default now()
);

drop trigger if exists imagenes_sitio_tocar on public.imagenes_sitio;
create trigger imagenes_sitio_tocar before update on public.imagenes_sitio
  for each row execute function public.tocar_actualizado();

-- ════════════════════════════════════════════════════════════════
-- SEGURIDAD (RLS)
-- Lectura pública: solo lo publicado. Escritura: solo autenticado.
-- La anon key del frontend NO puede escribir ni ver lo oculto.
-- ════════════════════════════════════════════════════════════════
alter table public.productos       enable row level security;
alter table public.imagenes        enable row level security;
alter table public.textos          enable row level security;
alter table public.imagenes_sitio  enable row level security;

-- Productos: el público ve solo los visibles
drop policy if exists "productos lectura publica" on public.productos;
create policy "productos lectura publica" on public.productos
  for select to anon using (visible = true and archivado = false);

drop policy if exists "productos admin total" on public.productos;
create policy "productos admin total" on public.productos
  for all to authenticated using (true) with check (true);

-- Imágenes: el público ve las de productos visibles
drop policy if exists "imagenes lectura publica" on public.imagenes;
create policy "imagenes lectura publica" on public.imagenes
  for select to anon using (
    archivada = false
    and exists (
      select 1 from public.productos p
      where p.id = producto_id and p.visible = true and p.archivado = false
    )
  );

drop policy if exists "imagenes admin total" on public.imagenes;
create policy "imagenes admin total" on public.imagenes
  for all to authenticated using (true) with check (true);

-- Textos e imágenes del sitio: lectura abierta, escritura autenticada
drop policy if exists "textos lectura publica" on public.textos;
create policy "textos lectura publica" on public.textos
  for select to anon using (true);

drop policy if exists "textos admin total" on public.textos;
create policy "textos admin total" on public.textos
  for all to authenticated using (true) with check (true);

drop policy if exists "imagenes sitio lectura publica" on public.imagenes_sitio;
create policy "imagenes sitio lectura publica" on public.imagenes_sitio
  for select to anon using (true);

drop policy if exists "imagenes sitio admin total" on public.imagenes_sitio;
create policy "imagenes sitio admin total" on public.imagenes_sitio
  for all to authenticated using (true) with check (true);

-- ════════════════════════════════════════════════════════════════
-- VISTA DEL CATÁLOGO
-- Una sola consulta devuelve el producto con sus fotos ya ordenadas,
-- que es lo que pide la portada. Hereda el RLS de las tablas base.
-- ════════════════════════════════════════════════════════════════
create or replace view public.catalogo
with (security_invoker = true)
as
select
  p.id, p.nombre,
  p.descripcion_es, p.descripcion_en,
  p.categoria_es,  p.categoria_en,
  p.precio, p.stock, p.visible, p.orden,
  coalesce(
    (select jsonb_agg(i.url order by i.orden)
       from public.imagenes i
      where i.producto_id = p.id and i.archivada = false),
    '[]'::jsonb
  ) as imagenes,
  p.creado_en, p.actualizado_en
from public.productos p
where p.archivado = false
order by p.orden, p.creado_en desc;

-- ════════════════════════════════════════════════════════════════
-- ALMACENAMIENTO
-- Bucket público de solo lectura; subir y borrar exige sesión.
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos lectura publica" on storage.objects;
create policy "fotos lectura publica" on storage.objects
  for select to anon, authenticated using (bucket_id = 'productos');

drop policy if exists "fotos escritura admin" on storage.objects;
create policy "fotos escritura admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'productos');

drop policy if exists "fotos actualizacion admin" on storage.objects;
create policy "fotos actualizacion admin" on storage.objects
  for update to authenticated using (bucket_id = 'productos');

drop policy if exists "fotos borrado admin" on storage.objects;
create policy "fotos borrado admin" on storage.objects
  for delete to authenticated using (bucket_id = 'productos');

-- ════════════════════════════════════════════════════════════════
-- PERMISOS Y RECARGA DEL API
-- Supabase suele conceder esto solo cuando «Automatically expose new
-- tables» está activo, pero dejarlo explícito evita el fallo más
-- típico: el SQL se ejecuta bien y luego /rest/v1/ devuelve 404.
-- ════════════════════════════════════════════════════════════════
grant usage on schema public to anon, authenticated;

grant select on public.catalogo       to anon, authenticated;
grant select on public.productos      to anon, authenticated;
grant select on public.imagenes       to anon, authenticated;
grant select on public.textos         to anon, authenticated;
grant select on public.imagenes_sitio to anon, authenticated;

grant insert, update, delete on public.productos      to authenticated;
grant insert, update, delete on public.imagenes       to authenticated;
grant insert, update, delete on public.textos         to authenticated;
grant insert, update, delete on public.imagenes_sitio to authenticated;

-- Las políticas RLS de arriba son las que mandan: estos grants solo
-- abren la puerta, el RLS decide qué filas se ven y quién escribe.

-- PostgREST cachea el esquema; sin esto los cambios tardan en verse.
notify pgrst, 'reload schema';

-- ── Comprobación final ──
-- Esto SÍ devuelve filas: si al ejecutar ves "No rows returned",
-- es que el script no corrió y hay que volver a pegarlo entero.
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE')  as tablas,
  (select count(*) from information_schema.views
    where table_schema = 'public')                                 as vistas,
  (select count(*) from pg_policies
    where schemaname in ('public','storage'))                      as politicas,
  (select count(*) from storage.buckets where id = 'productos')    as bucket;
-- Esperado:  tablas = 4 · vistas = 1 · politicas >= 12 · bucket = 1

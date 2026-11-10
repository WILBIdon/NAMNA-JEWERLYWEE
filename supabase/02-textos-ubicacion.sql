-- ════════════════════════════════════════════════════════════════
-- NAMNA — dónde va cada texto
--
-- Añade a `textos` las columnas que describen su sitio en la web,
-- para que quien edite no vea un "TXT-017" sin contexto.
-- Las rellena `scripts/mapear-textos.mjs` leyendo los HTML.
--
-- Aplicar: Supabase → SQL Editor → pegar → Run.
-- Idempotente: se puede repetir sin romper nada.
-- ════════════════════════════════════════════════════════════════

alter table public.textos add column if not exists pagina   text;
alter table public.textos add column if not exists seccion  text;
alter table public.textos add column if not exists papel    text;
alter table public.textos add column if not exists orden_ui integer not null default 9000;

comment on column public.textos.pagina   is 'En qué página(s) aparece. Lo rellena scripts/mapear-textos.mjs.';
comment on column public.textos.seccion  is 'Zona de la página: Cabecera, Hero, Pie de página…';
comment on column public.textos.papel    is 'Qué es: Titular principal, Botón, Enlace del menú, Párrafo…';
comment on column public.textos.nota     is 'Frase legible para quien edita.';
comment on column public.textos.orden_ui is 'Orden en el panel, siguiendo el recorrido real de la web.';

create index if not exists textos_orden_idx on public.textos (orden_ui);

notify pgrst, 'reload schema';

-- Comprobación: debe devolver una fila con las 4 columnas a true
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='textos'
      and column_name in ('pagina','seccion','papel','orden_ui')) as columnas_nuevas,
  (select count(*) from public.textos) as textos;
-- Esperado: columnas_nuevas = 4 · textos = 47

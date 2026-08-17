-- EC-16: export de embarques paginado sobre datos vivos.
-- `embarques_listado` ordenaba por la columna elegida + `created_at DESC`;
-- con `expediente_num` duplicado/nulo y created_at empatado el orden entre
-- páginas no era determinista y el CSV exportado podía duplicar/omitir filas.
-- Se agrega `id` como tie-breaker final en ambos ORDER BY de la función.
-- Patrón de parcheo igual al de 20260809062758 (pg_get_functiondef + replace).
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'embarques_listado'
   LIMIT 1;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No se encontró public.embarques_listado';
  END IF;
  v_new := replace(v_def,
    'ORDER BY %s, f.created_at DESC',
    'ORDER BY %s, f.created_at DESC, f.id DESC');
  v_new := replace(v_new,
    'ORDER BY %s, c.created_at DESC',
    'ORDER BY %s, c.created_at DESC, c.id DESC');
  IF v_new = v_def THEN
    RAISE EXCEPTION 'Patch no aplicado en public.embarques_listado (patrón ORDER BY no encontrado)';
  END IF;
  EXECUTE v_new;
END
$do$;

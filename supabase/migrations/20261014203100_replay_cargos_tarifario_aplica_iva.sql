-- Replay exacto de Drizzle 0018 con rechazo de drift, sin reparar datos.
DO $install$
DECLARE v_table regclass; v_ok boolean;
BEGIN
  LOCK TABLE ONLY public.costeo_cargos_fob_agente, public.costeo_cargos_locales_naviera
    IN ACCESS EXCLUSIVE MODE;
  FOREACH v_table IN ARRAY ARRAY['public.costeo_cargos_fob_agente'::regclass,
      'public.costeo_cargos_locales_naviera'::regclass] LOOP
    SELECT a.atttypid = 'pg_catalog.bool'::regtype AND a.attnotnull
        AND a.attgenerated = ''
        AND pg_get_expr(d.adbin, d.adrelid) = 'false'
      INTO v_ok FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = v_table AND a.attname = 'aplica_iva' AND NOT a.attisdropped;
    IF FOUND AND v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'LC_CARGOS_IVA_SCHEMA_DRIFT: columna aplica_iva incompatible en %', v_table
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
ALTER TABLE public.costeo_cargos_fob_agente ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT false;
ALTER TABLE public.costeo_cargos_locales_naviera ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT false;
  FOREACH v_table IN ARRAY ARRAY['public.costeo_cargos_fob_agente'::regclass,
      'public.costeo_cargos_locales_naviera'::regclass] LOOP
    SELECT a.atttypid = 'pg_catalog.bool'::regtype AND a.attnotnull
        AND a.attgenerated = ''
        AND pg_get_expr(d.adbin, d.adrelid) = 'false'
      INTO v_ok FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = v_table AND a.attname = 'aplica_iva' AND NOT a.attisdropped;
    IF v_ok IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'LC_CARGOS_IVA_SCHEMA_DRIFT: columna aplica_iva incompatible en %', v_table
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
END;
$install$;

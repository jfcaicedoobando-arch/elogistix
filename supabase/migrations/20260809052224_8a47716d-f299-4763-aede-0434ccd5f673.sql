-- Ola 1 · C1: fail-closed de organización en RPCs SECURITY DEFINER de reportes.
DO $do$
DECLARE
  v_def text;
  v_new text;
  v_fn  text;
BEGIN
  -- 1) Aging CxC / CxP: super_admin debe elegir organización explícita.
  FOREACH v_fn IN ARRAY ARRAY['cxc_aging_clientes','cxp_aging_proveedores'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fn
     LIMIT 1;
    IF v_def IS NULL THEN
      RAISE EXCEPTION 'No se encontró public.%', v_fn;
    END IF;
    v_new := replace(
      v_def,
      E'  IF v_is_super THEN\n    v_org := p_org;',
      E'  IF v_is_super THEN\n    IF p_org IS NULL THEN\n      RAISE EXCEPTION ''LC_ORG_REQUERIDA: selecciona una organización para ver este reporte'' USING ERRCODE=''42501'';\n    END IF;\n    v_org := p_org;'
    );
    IF v_new = v_def THEN
      RAISE EXCEPTION 'Patch no aplicado en public.% (patrón no encontrado)', v_fn;
    END IF;
    EXECUTE v_new;
  END LOOP;

  -- 2) libro_pagos: nuevo parámetro p_org + misma regla.
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'libro_pagos'
     AND pg_get_function_identity_arguments(p.oid) = 'p_desde date, p_hasta date'
   LIMIT 1;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No se encontró public.libro_pagos(date,date)';
  END IF;

  v_new := replace(
    v_def,
    'public.libro_pagos(p_desde date, p_hasta date)',
    'public.libro_pagos(p_desde date, p_hasta date, p_org uuid DEFAULT NULL)'
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'Patch de firma no aplicado en libro_pagos';
  END IF;
  v_def := v_new;

  v_new := replace(
    v_def,
    E'  v_super := has_role(auth.uid(), ''super_admin'');',
    E'  v_super := has_role(auth.uid(), ''super_admin'');\n  IF v_super THEN\n    IF p_org IS NULL THEN\n      RAISE EXCEPTION ''LC_ORG_REQUERIDA: selecciona una organización para ver el libro de pagos'' USING ERRCODE=''42501'';\n    END IF;\n    v_org := p_org;\n    v_super := false;\n  ELSIF p_org IS NOT NULL AND p_org IS DISTINCT FROM v_org THEN\n    RAISE EXCEPTION ''LC_ORG_AJENA: no puedes consultar el libro de pagos de otra organización'' USING ERRCODE=''42501'';\n  END IF;'
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'Patch de guarda no aplicado en libro_pagos';
  END IF;
  EXECUTE v_new;
END
$do$;

DROP FUNCTION IF EXISTS public.libro_pagos(date, date);

REVOKE ALL ON FUNCTION public.libro_pagos(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.libro_pagos(date, date, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public.cxp_aging_proveedores(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO service_role;
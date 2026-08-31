-- FIX Sentry JAVASCRIPT-REACT-1G · demo-access 500 (LC_EVENTO_ANTERIOR_A_EMBARQUE)
-- El sembrado demo insertaba embarques con created_at = now() y luego eventos
-- reales (Zarpe/Arribo/Entrega) fechados hasta 45 días atrás, lo que dispara el
-- guard de coherencia de eventos. Se backdatea created_at al ETD de cada
-- embarque demo para que la historia sembrada sea coherente con el guard.
DO $do$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'seed_demo_organization_core';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'seed_demo_organization_core no existe';
  END IF;

  v_src := replace(v_src,
    E'    etd, eta, tipo_carga\n  ) VALUES (\n    gen_random_uuid(), v_org, ''DEMO-2026-001''',
    E'    etd, eta, tipo_carga, created_at\n  ) VALUES (\n    gen_random_uuid(), v_org, ''DEMO-2026-001''');
  v_src := replace(v_src,
    E'CURRENT_DATE - 12, CURRENT_DATE + 6, ''Carga General''\n  ) RETURNING id INTO v_emb1;',
    E'CURRENT_DATE - 12, CURRENT_DATE + 6, ''Carga General'', (CURRENT_DATE - 12)::timestamptz\n  ) RETURNING id INTO v_emb1;');

  v_src := replace(v_src,
    E'    etd, eta, fecha_llegada_real, tipo_carga\n  ) VALUES (\n    gen_random_uuid(), v_org, ''DEMO-2026-002''',
    E'    etd, eta, fecha_llegada_real, tipo_carga, created_at\n  ) VALUES (\n    gen_random_uuid(), v_org, ''DEMO-2026-002''');
  v_src := replace(v_src,
    E'CURRENT_DATE - 28, CURRENT_DATE - 2, NULL, ''Carga General''\n  ) RETURNING id INTO v_emb2;',
    E'CURRENT_DATE - 28, CURRENT_DATE - 2, NULL, ''Carga General'', (CURRENT_DATE - 28)::timestamptz\n  ) RETURNING id INTO v_emb2;');

  v_src := replace(v_src,
    E'    etd, eta, fecha_llegada_real, tipo_carga\n  ) VALUES (\n    gen_random_uuid(), v_org, ''DEMO-2026-004''',
    E'    etd, eta, fecha_llegada_real, tipo_carga, created_at\n  ) VALUES (\n    gen_random_uuid(), v_org, ''DEMO-2026-004''');
  v_src := replace(v_src,
    E'CURRENT_DATE - 45, CURRENT_DATE - 18, CURRENT_DATE - 16, ''Carga General''\n  ) RETURNING id INTO v_emb4;',
    E'CURRENT_DATE - 45, CURRENT_DATE - 18, CURRENT_DATE - 16, ''Carga General'', (CURRENT_DATE - 45)::timestamptz\n  ) RETURNING id INTO v_emb4;');

  IF v_src NOT LIKE '%(CURRENT_DATE - 45)::timestamptz%'
     OR v_src NOT LIKE '%(CURRENT_DATE - 28)::timestamptz%'
     OR v_src NOT LIKE '%(CURRENT_DATE - 12)::timestamptz%' THEN
    RAISE EXCEPTION 'No se pudo aplicar el backdate de created_at al sembrado demo';
  END IF;

  EXECUTE v_src;
END
$do$;

REVOKE ALL ON FUNCTION public.seed_demo_organization_core() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization_core() TO service_role;
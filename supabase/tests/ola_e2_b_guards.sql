-- ==========================================================================
-- Ola E2 · Sub-ola B — guards de regresión (M2-res, M5-res, N26, L4)
-- Se ejecuta con psql contra la base de CI.
-- ==========================================================================

-- M2-res · el T/C DOF debe recalcularse también al CAMBIAR la moneda.
DO $$
DECLARE v_def text; v_src text;
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO v_def
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'facturas' AND t.tgname = 'trg_factura_tc_dof_obligatorio_upd';
  IF v_def IS NULL OR v_def NOT LIKE '%UPDATE OF moneda%' THEN
    RAISE EXCEPTION 'M2-res REGRESIÓN: falta trigger de T/C DOF en UPDATE OF moneda: %', v_def;
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_factura_tc_dof_obligatorio';
  IF v_src IS NULL OR v_src NOT LIKE '%OLD.moneda%' THEN
    RAISE EXCEPTION 'M2-res REGRESIÓN: _factura_tc_dof_obligatorio no compara OLD.moneda';
  END IF;
END $$;

-- M5-res · ningún evento real puede ser anterior a la creación del embarque.
DO $$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_validar_cronologia_evento_embarque';
  IF v_src IS NULL OR v_src NOT LIKE '%LC_EVENTO_ANTERIOR_A_EMBARQUE%' THEN
    RAISE EXCEPTION 'M5-res REGRESIÓN: falta validación de evento anterior al embarque';
  END IF;
END $$;

-- N26 · los enlaces públicos de tracking no pueden ser eternos.
DO $$
DECLARE v_nullable text; v_default text; v_src text;
BEGIN
  SELECT is_nullable, column_default INTO v_nullable, v_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tracking_links' AND column_name = 'expires_at';

  IF v_nullable <> 'NO' THEN
    RAISE EXCEPTION 'N26 REGRESIÓN: tracking_links.expires_at volvió a ser nullable';
  END IF;
  IF COALESCE(v_default, '') NOT LIKE '%30 days%' THEN
    RAISE EXCEPTION 'N26 REGRESIÓN: tracking_links.expires_at sin default de 30 días: %', v_default;
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_tracking_link_vigencia_maxima';
  IF v_src IS NULL OR v_src NOT LIKE '%LC_TRACKING_VIGENCIA_EXCEDIDA%' THEN
    RAISE EXCEPTION 'N26 REGRESIÓN: falta el tope de 90 días en enlaces de tracking';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'tracking_links'
      AND indexname = 'idx_tracking_links_expires_at'
  ) THEN
    RAISE EXCEPTION 'N26 REGRESIÓN: falta índice idx_tracking_links_expires_at';
  END IF;
END $$;

-- L4 · el IVA de facturas convertidas se fija por LÍNEA (conceptos_factura),
-- nunca por un agregado de proforma. Si alguien vuelve a calcular el IVA con
-- una tasa global, este guard truena.
DO $$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'convertir_proformas_a_factura';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'L4 REGRESIÓN: no existe convertir_proformas_a_factura';
  END IF;
  IF v_src NOT LIKE '%tasa_iva_aplicada%' OR v_src NOT LIKE '%FROM public.conceptos_factura%' THEN
    RAISE EXCEPTION 'L4 REGRESIÓN: el IVA ya no se recalcula por línea desde conceptos_factura';
  END IF;
  IF v_src LIKE '%tasa_iva_global%' OR v_src LIKE '%obtener_tasa_iva()%' THEN
    RAISE EXCEPTION 'L4 REGRESIÓN: reapareció cálculo de IVA agregado (tasa global)';
  END IF;
END $$;

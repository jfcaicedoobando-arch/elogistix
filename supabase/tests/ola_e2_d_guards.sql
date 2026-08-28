-- ==========================================================================
-- Ola E2/E3 · Sub-ola D — guards de regresión (N10, N14, N9)
-- Se ejecuta con psql contra la base de CI.
-- ==========================================================================

-- N10 · las retenciones de cada pago se prorratean sobre base NETA de NC y el
-- pago liquidador absorbe el residuo de centavos.
DO $$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'calc_pago_retenciones';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'N10 REGRESIÓN: no existe calc_pago_retenciones';
  END IF;
  IF v_src NOT LIKE '%nc_aplicadas_en_moneda_factura%' THEN
    RAISE EXCEPTION 'N10 REGRESIÓN: la base de retenciones no descuenta notas de crédito';
  END IF;
  IF v_src NOT LIKE '%v_prev_isr%' THEN
    RAISE EXCEPTION 'N10 REGRESIÓN: el pago liquidador no absorbe el residuo de retenciones';
  END IF;
END $$;

-- N10b · aplicar una NC sobre factura con pagos que ya declararon retenciones
-- debe levantar alerta de revisión.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_triggerdef(t.oid) INTO v_def
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname = 'factura_notas_credito' AND t.tgname = 'trg_nc_alerta_retenciones';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'N10b REGRESIÓN: falta trigger trg_nc_alerta_retenciones';
  END IF;
END $$;

-- N14 · anticipos de proveedor: conversión con paridad DOF de la fecha de
-- aplicación (incluye EUR) y registro del diferencial cambiario.
DO $$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'aplicar_anticipo_a_factura';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'N14 REGRESIÓN: no existe aplicar_anticipo_a_factura';
  END IF;
  IF v_src NOT LIKE '%convertir_monto_dof%' THEN
    RAISE EXCEPTION 'N14 REGRESIÓN: la aplicación de anticipo no usa el T/C DOF de la fecha de aplicación';
  END IF;
  IF v_src NOT LIKE '%diferencial_cambiario%' THEN
    RAISE EXCEPTION 'N14 REGRESIÓN: no se registra el diferencial cambiario del anticipo';
  END IF;
END $$;

-- N14b · el helper de paridad DOF debe cubrir EUR, no sólo USD.
DO $$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'tc_dof_moneda';
  IF v_src IS NULL OR v_src NOT LIKE '%eur_mxn%' THEN
    RAISE EXCEPTION 'N14b REGRESIÓN: tc_dof_moneda no resuelve la paridad EUR/MXN';
  END IF;
END $$;

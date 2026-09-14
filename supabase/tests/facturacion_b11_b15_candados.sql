-- Lote B11–B15 (v13.823.376) · candados de facturación / proformas en la BASE.
-- Sólo lectura sobre el catálogo: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_def text;
BEGIN
  -- B11: la exposición de crédito ya no supone T/C = 1 para divisa.
  v_def := pg_get_functiondef('public.get_exposicion_credito_cliente(uuid)'::regprocedure);
  IF v_def ~* 'COALESCE\(NULLIF\(\s*f?a?\.?tipo_cambio' THEN
    RAISE EXCEPTION 'B11 FAIL: la exposición de crédito volvió al fallback de T/C = 1';
  END IF;
  IF v_def !~ 'LC_CREDITO_TC_INVALIDO' THEN
    RAISE EXCEPTION 'B11 FAIL: la exposición de crédito dejó de reportar los T/C inválidos';
  END IF;
  IF v_def !~ '< 5' OR v_def !~ '> 40' THEN
    RAISE EXCEPTION 'B11 FAIL: la exposición de crédito dejó de aplicar la banda de plausibilidad del T/C';
  END IF;
  -- R3: el mensaje lista a lo más 10 folios y resume el resto.
  IF v_def !~ 'v_malas\[1:10\]' OR v_def !~ 'y %s más' THEN
    RAISE EXCEPTION 'B11/R3 FAIL: el error de T/C inválido dejó de acotar la lista de folios';
  END IF;

  -- B12: el INSERT de la factura USD de conversión no inventa T/C (pasa NULL
  -- explícito). El trigger BEFORE INSERT trg_factura_tc_dof_obligatorio
  -- resuelve el T/C DOF o rechaza el INSERT, así que el borrador nunca queda
  -- persistido sin T/C: el NULL es documental.
  v_def := pg_get_functiondef('public.convertir_proformas_a_factura(uuid[],uuid,text,text,text,integer,text,uuid)'::regprocedure);
  IF v_def !~ '''USD''::public\.moneda, NULL' THEN
    RAISE EXCEPTION 'B12 FAIL: la factura USD de conversión volvió a nacer con un tipo de cambio inventado';
  END IF;
  IF v_def !~ '''MXN''::public\.moneda, 1' THEN
    RAISE EXCEPTION 'B12 FAIL: la factura MXN debe conservar tipo de cambio 1';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.facturas'::regclass
       AND t.tgname = 'trg_factura_tc_dof_obligatorio'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'B12 FAIL: falta el trigger que exige el T/C DOF al crear la factura';
  END IF;

  -- B13: un concepto ya proformado tampoco puede mover su total.
  v_def := pg_get_functiondef('public._assert_concepto_no_proformado()'::regprocedure);
  IF v_def !~ 'NEW\.total\s+IS DISTINCT FROM OLD\.total' THEN
    RAISE EXCEPTION 'B13 FAIL: el guard de concepto proformado dejó de vigilar el total';
  END IF;



  -- B14: un costo vinculado a una factura de proveedor viva no cambia de
  -- monto, moneda ni proveedor.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.conceptos_costo'::regclass
       AND t.tgname = 'trg_conceptos_costo_guard_vinculo_cxp'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'B14 FAIL: falta el trigger trg_conceptos_costo_guard_vinculo_cxp';
  END IF;
  v_def := pg_get_functiondef('public.tg_conceptos_costo_guard_vinculo_cxp()'::regprocedure);
  IF v_def !~ 'LC_COSTO_VINCULADO_CXP' THEN
    RAISE EXCEPTION 'B14 FAIL: el guard del costo vinculado dejó de emitir el código LC';
  END IF;
  IF v_def !~ 'proveedor_facturas_conceptos' THEN
    RAISE EXCEPTION 'B14 FAIL: el guard del costo dejó de consultar el vínculo de CxP';
  END IF;
  -- R2: la existencia del vínculo se decide por id de factura, no por folio
  -- (una factura sin folio también debe bloquear).
  IF v_def !~ 'v_factura_id IS NOT NULL' THEN
    RAISE EXCEPTION 'B14/R2 FAIL: el guard del costo volvió a decidir por folio y una factura sin folio lo evade';
  END IF;
  IF v_def !~ '\(sin folio\)' THEN
    RAISE EXCEPTION 'B14/R2 FAIL: el guard del costo perdió el texto de respaldo para facturas sin folio';
  END IF;
  -- Los cambios que no tocan monto/moneda/proveedor deben salir sin bloquear.
  IF v_def !~ 'IS NOT DISTINCT FROM OLD\.monto' THEN
    RAISE EXCEPTION 'B14 FAIL: el guard del costo dejó de permitir los cambios no financieros';
  END IF;

  -- B15: eliminar proforma exige el rol de la policy, no sólo ser miembro.
  v_def := pg_get_functiondef('public.eliminar_proforma_rpc(uuid)'::regprocedure);
  IF v_def !~ 'has_any_role_efectivo' THEN
    RAISE EXCEPTION 'B15 FAIL: eliminar_proforma_rpc volvió a autorizar por simple membresía';
  END IF;
  IF v_def !~ 'LC_PROFORMA_SIN_PERMISO' THEN
    RAISE EXCEPTION 'B15 FAIL: eliminar_proforma_rpc no reporta el rol no autorizado';
  END IF;
  IF v_def !~ 'LC_PROFORMA_FACTURADA' THEN
    RAISE EXCEPTION 'B15 FAIL: eliminar_proforma_rpc perdió la validación de factura';
  END IF;
  -- R1: sólo bloquea una factura viva; cancelada, sustituida o en papelera no.
  IF v_def !~ 'deleted_at IS NULL' OR v_def !~ 'Sustituida' THEN
    RAISE EXCEPTION 'B15/R1 FAIL: eliminar_proforma_rpc volvió a bloquear con facturas canceladas/sustituidas/en papelera';
  END IF;

  RAISE NOTICE 'OK facturacion_b11_b15_candados';
END $$;

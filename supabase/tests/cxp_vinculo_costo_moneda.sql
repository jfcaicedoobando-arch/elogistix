-- Guard v13.823.330 · el vínculo factura de proveedor ↔ concepto de costo se
-- valida en la BASE, no sólo en la UI. Vigila que el trigger exista y conserve
-- las cuatro reglas: organización, proveedor, MISMA moneda y no sobreasignar el
-- costo (con bloqueo de la fila del costo para evitar carreras).
--
-- Sólo lectura sobre el catálogo: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_def text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.proveedor_facturas_conceptos'::regclass
       AND t.tgname = 'trg_pfc_validar_vinculo_costo'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'falta el trigger trg_pfc_validar_vinculo_costo en proveedor_facturas_conceptos';
  END IF;

  v_def := pg_get_functiondef('public.tg_pfc_validar_vinculo_costo()'::regprocedure);

  IF v_def !~ 'LC_CXP_VINCULO_MONEDA' THEN
    RAISE EXCEPTION 'el vínculo de costo dejó de validar que la moneda coincida';
  END IF;
  -- La única conversión admitida (MXN↔USD) exige el TC congelado en la factura.
  IF v_def !~ 'LC_CXP_VINCULO_TC_REQUERIDO' THEN
    RAISE EXCEPTION 'el vínculo de costo dejó de exigir el tipo de cambio de la factura al conciliar monedas distintas';
  END IF;
  IF v_def !~ 'tipo_cambio_usd' THEN
    RAISE EXCEPTION 'el vínculo de costo dejó de leer el tipo de cambio congelado de la factura';
  END IF;
  IF v_def !~ 'LC_CXP_VINCULO_PROVEEDOR' THEN
    RAISE EXCEPTION 'el vínculo de costo dejó de validar el proveedor';
  END IF;
  IF v_def !~ 'LC_CXP_VINCULO_ORG' THEN
    RAISE EXCEPTION 'el vínculo de costo dejó de validar la organización';
  END IF;
  IF v_def !~ 'LC_CXP_VINCULO_SOBREASIGNADO' THEN
    RAISE EXCEPTION 'el vínculo de costo dejó de topar el monto acumulado del costo';
  END IF;
  IF v_def !~ 'FOR UPDATE' THEN
    RAISE EXCEPTION 'el vínculo de costo dejó de bloquear la fila del costo (carrera de sobreasignación)';
  END IF;
  -- Los renglones fiscales (sin costo vinculado) siguen permitidos.
  IF v_def !~ 'NEW\.concepto_costo_id IS NULL' THEN
    RAISE EXCEPTION 'el trigger dejó de permitir renglones fiscales sin costo vinculado';
  END IF;

  RAISE NOTICE 'OK cxp_vinculo_costo_moneda';
END $$;

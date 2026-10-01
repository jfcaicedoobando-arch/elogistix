-- AUD-ANALISIS-7b: el saldo ya descuenta NC 'Timbrada'/'Aplicada'; el candado
-- reconstruye el saldo previo a NC antes de comparar (evita doble conteo).
DO $mig$
DECLARE
  d text;
  n text;
BEGIN
  d := pg_get_functiondef('public.assert_nc_no_excede_saldo()'::regprocedure);
  n := replace(d,
    '  v_total_ncs_mxn := v_ncs_previas_mxn + v_nc_nueva_mxn;',
    E'  -- AUD-ANALISIS-7b: devolver al saldo las NC ya descontadas (incluida la fila actual guardada).\n'
    || E'  v_saldo_mxn := v_saldo_mxn + v_ncs_previas_mxn + COALESCE((\n'
    || E'    SELECT public.a_mxn_doc(nc.monto, COALESCE(nc.moneda::text, v_fac.moneda),\n'
    || E'             COALESCE(nc.fecha_emision, v_fac.fecha_emision), nc.tipo_cambio, v_fac.tipo_cambio)\n'
    || E'    FROM public.factura_notas_credito nc\n'
    || E'    WHERE nc.id = NEW.id AND nc.deleted_at IS NULL\n'
    || E'      AND nc.estado::text IN (''Timbrada'',''Aplicada'')), 0);\n'
    || '  v_total_ncs_mxn := v_ncs_previas_mxn + v_nc_nueva_mxn;');
  IF n = d THEN
    RAISE EXCEPTION 'AUD-ANALISIS-7b: assert_nc_no_excede_saldo no cambió';
  END IF;
  EXECUTE n;
END
$mig$;
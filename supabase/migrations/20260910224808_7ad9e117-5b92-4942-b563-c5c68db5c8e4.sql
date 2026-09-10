CREATE OR REPLACE FUNCTION public.reversar_movimiento_cobro_rep_cancelado(p_pago_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov bbva_movimientos%ROWTYPE;
  v_motivo text := 'REP cancelado: el cobro se anuló';
  v_accion text;
BEGIN
  SELECT * INTO v_mov
    FROM bbva_movimientos
   WHERE pago_factura_id = p_pago_id
     AND deleted_at IS NULL
   ORDER BY importado_en NULLS LAST, id
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('reversado', false, 'motivo', 'sin_movimiento');
  END IF;

  IF COALESCE(v_mov.hash_dedupe,'') LIKE 'cobro-%' THEN
    UPDATE bbva_movimientos
       SET deleted_at = now(),
           deleted_by = auth.uid(),
           motivo_ignorar = v_motivo
     WHERE id = v_mov.id;
    v_accion := 'reversar_movimiento_cobro_rep_cancelado';
  ELSE
    UPDATE bbva_movimientos
       SET pago_factura_id = NULL,
           estado_conciliacion = 'Pendiente',
           motivo_ignorar = v_motivo
     WHERE id = v_mov.id;
    v_accion := 'desvincular_movimiento_cobro_rep_cancelado';
  END IF;

  PERFORM public.registrar_bitacora(
    'tesoreria',
    v_accion,
    v_mov.id,
    COALESCE(v_mov.concepto, ''),
    jsonb_build_object(
      'pago_factura_id', p_pago_id,
      'cuenta_bancaria_id', v_mov.cuenta_bancaria_id,
      'abono', v_mov.abono,
      'motivo', v_motivo,
      'origen', CASE WHEN COALESCE(v_mov.hash_dedupe,'') LIKE 'cobro-%' THEN 'sistema' ELSE 'estado_cuenta' END
    ),
    v_mov.organization_id,
    auth.uid()
  );

  RETURN jsonb_build_object('reversado', true, 'movimiento_id', v_mov.id, 'accion', v_accion);
END;
$$;

REVOKE ALL ON FUNCTION public.reversar_movimiento_cobro_rep_cancelado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reversar_movimiento_cobro_rep_cancelado(uuid) TO service_role;
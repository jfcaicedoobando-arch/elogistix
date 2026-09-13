CREATE OR REPLACE FUNCTION public.tg_bloquear_financiero_embarque_cerrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row jsonb;
  v_emb uuid;
  v_pf uuid;
  v_estado text;
  v_prot text[] := ARRAY[
    'embarque_id','factura_id','proveedor_factura_id','concepto_costo_id',
    'cliente_id','proveedor_id','monto','monto_mxn','monto_aplicado_factura',
    'monto_declarado','total','total_detectado','subtotal','subtotal_detectado',
    'iva','ieps','retenciones','moneda','moneda_detectada','moneda_declarada',
    'tipo_cambio','tipo_cambio_usd','comision_mxn','pnl_base','deleted_at'
  ];
  v_col text;
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_row := to_jsonb(COALESCE(NEW, OLD));
  v_emb := NULLIF(v_row->>'embarque_id','')::uuid;
  IF v_emb IS NULL THEN
    v_pf := NULLIF(v_row->>'proveedor_factura_id','')::uuid;
    IF v_pf IS NOT NULL THEN
      SELECT pf.embarque_id INTO v_emb FROM public.proveedor_facturas pf WHERE pf.id = v_pf;
    END IF;
  END IF;
  IF v_emb IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_estado := public._assert_embarque_abierto_locked(v_emb);
  IF v_estado IS DISTINCT FROM 'Cerrado' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Invariante previo (supabase/tests/cxp_pago_embarque_cerrado.sql): liquidar
  -- lo ya comprometido es legítimo después del cierre. Sólo se permite el ALTA
  -- del pago; borrarlo o cambiar sus importes/vínculos sigue bloqueado.
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('pagos_factura','pagos_proveedor') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH v_col IN ARRAY v_prot LOOP
      IF (to_jsonb(NEW) ? v_col)
         AND (to_jsonb(NEW)->v_col) IS DISTINCT FROM (to_jsonb(OLD)->v_col) THEN
        RAISE EXCEPTION 'LC_EMBARQUE_CERRADO: el embarque está cerrado; reábrelo para modificar % en %.', v_col, TG_TABLE_NAME
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_EMBARQUE_CERRADO: el embarque está cerrado; reábrelo antes de registrar o eliminar en %.', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$;

REVOKE ALL ON FUNCTION public.tg_bloquear_financiero_embarque_cerrado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_bloquear_financiero_embarque_cerrado() TO service_role;
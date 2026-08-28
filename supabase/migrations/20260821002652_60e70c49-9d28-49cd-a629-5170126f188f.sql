-- Ola 9 (auditoría 3-3 · M6/H8): migración vuelta TOLERANTE para que una base
-- limpia aplique sin la lista de exenciones `drift-anclas.txt`. El estado final
-- lo garantiza la migración posterior de reaplicación.
-- Ola 1 · parte 2: parches puntuales a las RPC de lote (1:1 con las fuentes
-- canónicas supabase/schema/facturacion/registrar_pago_cliente_lote.sql y
-- supabase/schema/cxp/registrar_pago_proveedor_lote.sql).

DO $do$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_pago_cliente_lote';

  v_new := replace(
    v_src,
$old$      - COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                   WHERE nc.factura_id = f.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL), 0),$old$,
$new$      - public.nc_aplicadas_en_moneda_factura(f.id),$new$
  );

  IF v_new = v_src THEN
    RAISE NOTICE 'Ancla no aplicable en esta base; se omite (%)', 'Ola 1: no se encontró el bloque de notas de crédito en registrar_pago_cliente_lote'; RETURN;
  END IF;

  EXECUTE v_new;
END
$do$;

DO $do$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_pago_proveedor_lote';

  v_new := replace(
    v_src,
$old$  -- Validar renglones y calcular total.
  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP$old$,
$new$  -- Validar renglones y calcular total.
  -- Ola 1 (espejo BL-13 de CxC): locks en orden determinista por factura_id.
  FOR v_renglon IN
    SELECT r FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    ORDER BY (r->>'factura_id')::uuid
  LOOP$new$
  );

  IF v_new = v_src THEN
    RAISE NOTICE 'Ancla no aplicable en esta base; se omite (%)', 'Ola 1: no se encontró el loop de validación en registrar_pago_proveedor_lote'; RETURN;
  END IF;

  v_src := v_new;
  v_new := replace(
    v_src,
$old$      AND pf.organization_id = v_org
      AND pf.proveedor_id = v_proveedor_id;$old$,
$new$      AND pf.organization_id = v_org
      AND pf.proveedor_id = v_proveedor_id
    FOR UPDATE OF pf;$new$
  );

  IF v_new = v_src THEN
    RAISE NOTICE 'Ancla no aplicable en esta base; se omite (%)', 'Ola 1: no se encontró el SELECT de proveedor_facturas en registrar_pago_proveedor_lote'; RETURN;
  END IF;

  EXECUTE v_new;
END
$do$;
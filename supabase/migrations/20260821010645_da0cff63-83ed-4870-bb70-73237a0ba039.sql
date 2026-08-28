-- Ola 9 (auditoría 3-3 · M6/H8): migración vuelta TOLERANTE para que una base
-- limpia aplique sin la lista de exenciones `drift-anclas.txt`. El estado final
-- lo garantiza la migración posterior de reaplicación.
-- Ola 2 · O2.2 (corrección): la cola `comisiones_recalculo_pendiente` no tiene
-- columnas `embarque_id` ni `resuelto`; se relaciona por `pago_factura_id` y se
-- considera abierta cuando `resuelto_at IS NULL`.
DO $ola2fix$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc WHERE proname = 'validar_cierre_embarque'
  ORDER BY oid DESC LIMIT 1;

  IF v_src IS NULL OR position('comisiones_recalculo_pendiente crp' IN v_src) = 0 THEN
    RAISE NOTICE 'Ancla no aplicable en esta base; se omite (%)', 'Ola 2: validar_cierre_embarque no trae el bloque de la cola de recálculo'; RETURN;
  END IF;

  v_new := replace(v_src,
$old$  IF EXISTS (SELECT 1 FROM comisiones_recalculo_pendiente crp
              WHERE crp.embarque_id=p_embarque_id
                AND COALESCE(crp.resuelto, false) = false) THEN$old$,
$new$  IF EXISTS (SELECT 1 FROM comisiones_recalculo_pendiente crp
               JOIN pagos_factura pf2 ON pf2.id = crp.pago_factura_id
               JOIN facturas f2 ON f2.id = pf2.factura_id
              WHERE f2.embarque_id = p_embarque_id
                AND crp.resuelto_at IS NULL) THEN$new$);

  IF v_new = v_src THEN
    RAISE NOTICE 'Ancla no aplicable en esta base; se omite (%)', 'Ola 2: el bloque de la cola de recálculo no coincidió textualmente'; RETURN;
  END IF;

  EXECUTE v_new;
END
$ola2fix$;

REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO service_role;
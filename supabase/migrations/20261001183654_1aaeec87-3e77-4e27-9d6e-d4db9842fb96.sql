-- AUD-ANALISIS-7: la nota de crédito de cliente cuenta desde 'Timbrada'
-- (CFDI vigente ante el SAT). Ningún flujo la pasaba a 'Aplicada', así que
-- saldos, cartera, utilidad y comisiones nunca la restaban.
-- Las NC de PROVEEDOR no cambian (su ciclo sí llega a 'Aplicada').
DO $mig$
DECLARE
  r record;
  d text;
  n text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        '_nc_aplicadas_moneda_factura', '_saldo_factura_calc', 'assert_nc_no_excede_saldo',
        'cartera_pendiente', 'cartera_pendiente_total', 'clientes_listado', 'cxc_aging_clientes',
        'estado_cuenta_agregados', 'portal_factura_resumen_saldo', 'validar_cierre_embarque',
        '_nc_cliente_recalcular_comisiones', 'eerr_resumen_anual', 'pnl_financiero_embarque')
  LOOP
    d := pg_get_functiondef(r.oid);
    IF r.proname = 'eerr_resumen_anual' THEN
      n := replace(d, 'AND ncf.estado = ''Aplicada''', 'AND ncf.estado IN (''Timbrada'',''Aplicada'')');
    ELSIF r.proname = 'pnl_financiero_embarque' THEN
      n := replace(d,
        E'JOIN f ON f.id = n.factura_id\n    WHERE n.deleted_at IS NULL AND n.estado::text = ''Aplicada''',
        E'JOIN f ON f.id = n.factura_id\n    WHERE n.deleted_at IS NULL AND n.estado::text IN (''Timbrada'',''Aplicada'')');
    ELSE
      n := replace(d, '.estado::text = ''Aplicada''', '.estado::text IN (''Timbrada'',''Aplicada'')');
      n := replace(n, '.estado = ''Aplicada''', '.estado IN (''Timbrada'',''Aplicada'')');
      n := replace(n, '.estado=''Aplicada''', '.estado IN (''Timbrada'',''Aplicada'')');
      n := replace(n, '(''Aplicada'',''Emitida'')', '(''Timbrada'',''Aplicada'')');
    END IF;
    IF n = d THEN
      RAISE EXCEPTION 'AUD-ANALISIS-7: % no cambió; revisar el patrón', r.proname;
    END IF;
    EXECUTE n;
  END LOOP;
END
$mig$;
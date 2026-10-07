-- Pure conversion and read-only caller-contract checks. No persisted legacy NULL,
-- disabled trigger/constraint, RLS bypass or authentication-setting change.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE pair record; rate numeric; body text; caller record; checks integer:=0;
BEGIN
  FOR pair IN SELECT origen,destino
    FROM unnest(ARRAY['MXN','USD','EUR']) origen
    CROSS JOIN unnest(ARRAY['MXN','USD','EUR']) destino
  LOOP
    FOREACH rate IN ARRAY ARRAY[NULL::numeric,0::numeric,-1::numeric,18.1903::numeric] LOOP
      PERFORM pg_temp.assert(public.monto_pago_proveedor_en_moneda_factura(
        true,NULL,100,pair.origen,rate,pair.destino) IS NULL,
        'Audit134: missing frozen amount stays unknown for '||pair.origen||'/'||pair.destino);
      PERFORM pg_temp.assert(public.monto_pago_proveedor_en_moneda_factura(
        true,7.1234,100,pair.origen,rate,pair.destino) IS NOT DISTINCT FROM 7.1234,
        'Audit134: frozen four-decimal amount is authoritative');
      PERFORM pg_temp.assert(public.monto_pago_proveedor_en_moneda_factura(
        false,7.1234,100,pair.origen,rate,pair.destino)
        IS NOT DISTINCT FROM public.monto_pago_en_moneda_factura(100,pair.origen,rate,pair.destino),
        'Audit134: ordinary payment conversion is unchanged');
      checks:=checks+3;
    END LOOP;
    PERFORM pg_temp.assert(public.monto_pago_proveedor_en_moneda_factura(
      true,0,100,pair.origen,20,pair.destino) IS NOT DISTINCT FROM 0,
      'Audit134: a recorded zero is known and must not fall back to a positive amount');
    checks:=checks+1;
  END LOOP;
  -- A historical MXN/EUR application could freeze100/20=5 while its stored
  -- application-day rate is25. Missing the5 does not authorize reconstructing4.
  PERFORM pg_temp.assert(public.monto_pago_proveedor_en_moneda_factura(true,5,100,'MXN',25,'EUR')=5,
    'Audit134: differing historical parity cannot replace the frozen amount');
  PERFORM pg_temp.assert(public.monto_pago_proveedor_en_moneda_factura(true,NULL,100,'MXN',25,'EUR') IS NULL,
    'Audit134: missing historical MXN/EUR amount does not become100/25');

  -- All payment amounts AND closure unknown detection use the same selector.
  FOR caller IN SELECT * FROM (VALUES
    ('public.saldo_factura_proveedor(uuid)'::regprocedure,1),
    ('public.proveedor_estado_cuenta_movimientos(uuid,date,date,integer,integer)'::regprocedure,3),
    ('public.validar_cierre_embarque(uuid)'::regprocedure,2)
  ) AS callers(signature,expected_calls) LOOP
    body:=regexp_replace(lower(pg_get_functiondef(caller.signature)), '[[:space:]]+', '', 'g');
    PERFORM pg_temp.assert(array_length(string_to_array(body,'public.monto_pago_proveedor_en_moneda_factura(pp.es_anticipo_aplicado,pp.monto_en_moneda_factura,pp.monto,pp.moneda::text,pp.tipo_cambio_usd,'),1)-1=caller.expected_calls,
      'Audit134: every amount/unknown consumer shares the frozen selector: '||caller.signature::text);
    PERFORM pg_temp.assert(position('public.monto_pago_en_moneda_factura(pp.monto,' in body)=0,
      'Audit134: caller must not reconstruct applied-advance FX directly: '||caller.signature::text);
  END LOOP;
  body:=regexp_replace(lower(pg_get_functiondef('public.proveedor_estado_cuenta_movimientos(uuid,date,date,integer,integer)'::regprocedure)), '[[:space:]]+', '', 'g');
  PERFORM pg_temp.assert(position('casewhenf.estado=''pagada''andnotexists(select1frompublic.pagos_proveedorppwherepp.proveedor_factura_id=f.idandpp.deleted_atisnullandpp.es_anticipo_aplicadoandpublic.monto_pago_proveedor_en_moneda_factura(pp.es_anticipo_aplicado,pp.monto_en_moneda_factura,pp.monto,pp.moneda::text,pp.tipo_cambio_usd,f.moneda)isnull)then0::numeric' in body)>0,
    'Audit134: Pagada shortcut excludes exactly active applied advances with unknown frozen amounts');
  PERFORM pg_temp.assert(position('then0::numericelsecoalesce(p.monto_factura,0)end' in body)>0,
    'Audit134: missing destination conversion has no monetary credit');
  PERFORM pg_temp.assert(position('wherep.es_anticipo_aplicadoandp.moneda_pago<>p.moneda_facturaandp.monto_facturaisnotnull' in body)>0,
    'Audit134: missing conversion has no source-currency reclassification debit');
  PERFORM pg_temp.assert(position('p.monto_facturaisnull' in body)>0 AND position('sintc' in body)>0,
    'Audit134: the informational statement row explains missing conversion');
  body:=regexp_replace(lower(pg_get_functiondef('public.saldo_factura_proveedor(uuid)'::regprocedure)), '[[:space:]]+', '', 'g');
  PERFORM pg_temp.assert(position('bool_or(p.monto_facturaisnull)' in body)>0,
    'Audit134: canonical balance exposes incomplete conversion');
  body:=regexp_replace(lower(pg_get_functiondef('public.validar_cierre_embarque(uuid)'::regprocedure)), '[[:space:]]+', '', 'g');
  PERFORM pg_temp.assert(position('(m->>''pagos_sin_tipo_cambio'')::integer>0' in body)>0,
    'Audit134: unknown conversion blocks closure even when known amounts give zero residual');
  RAISE NOTICE 'Audit134: % conversion cases plus historical mismatch and caller consistency passed',checks;
END $tests$;
ROLLBACK;

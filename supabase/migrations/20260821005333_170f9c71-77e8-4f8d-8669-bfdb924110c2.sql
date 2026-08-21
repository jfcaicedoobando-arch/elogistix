-- Ola 1 · reaplicación de los parches de lote (drift NUEVO en base limpia).
-- Migraciones posteriores (BUG-15, BL-03) reescribieron ambas RPC desde una
-- fuente anterior y "deshicieron" los parches de 20260821002652. Aquí se
-- reaplican de forma TOLERANTE (si ya están, no-op) y se verifica el estado
-- final con asserts, para que no haya divergencia entre prod y base limpia.

DO $do$
DECLARE v_src text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_pago_cliente_lote';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'Ola 1 reaplica: no existe public.registrar_pago_cliente_lote';
  END IF;

  v_new := replace(
    v_src,
$old$      - COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                   WHERE nc.factura_id = f.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL), 0)$old$,
$new$      - public.nc_aplicadas_en_moneda_factura(f.id)$new$
  );

  IF v_new <> v_src THEN
    EXECUTE v_new;
  ELSIF position('nc_aplicadas_en_moneda_factura' in v_src) = 0 THEN
    RAISE EXCEPTION 'Ola 1 reaplica: no se encontró el bloque de notas de crédito en registrar_pago_cliente_lote';
  END IF;
END
$do$;

DO $do$
DECLARE v_src text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_pago_proveedor_lote';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'Ola 1 reaplica: no existe public.registrar_pago_proveedor_lote';
  END IF;

  -- 1) Loop en orden determinista por factura_id (espejo BL-18 de CxC).
  v_new := replace(
    v_src,
$old$  -- Validar renglones y calcular total.
  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP$old$,
$new$  -- Validar renglones y calcular total.
  -- Ola 1 (espejo BL-13/BL-18 de CxC): locks en orden determinista.
  FOR v_renglon IN
    SELECT r FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    ORDER BY (r->>'factura_id')::uuid
  LOOP$new$
  );

  -- 2) Lock explícito de la factura de proveedor leída.
  v_new := replace(
    v_new,
$old$      AND pf.organization_id = v_org
      AND pf.proveedor_id = v_proveedor_id;$old$,
$new$      AND pf.organization_id = v_org
      AND pf.proveedor_id = v_proveedor_id
    FOR UPDATE OF pf;$new$
  );

  IF v_new <> v_src THEN
    EXECUTE v_new;
  ELSIF position('FOR UPDATE OF pf' in v_src) = 0 THEN
    RAISE EXCEPTION 'Ola 1 reaplica: no se encontraron las anclas de locks en registrar_pago_proveedor_lote';
  END IF;
END
$do$;

-- Asserts de estado final: si alguna migración futura vuelve a reescribir las
-- RPC desde una fuente antigua, esta migración ya no basta y el CI debe verlo.
DO $do$
DECLARE v_cli text; v_prov text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_cli FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='registrar_pago_cliente_lote';
  SELECT pg_get_functiondef(p.oid) INTO v_prov FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='registrar_pago_proveedor_lote';

  IF position('nc_aplicadas_en_moneda_factura' in v_cli) = 0 THEN
    RAISE EXCEPTION 'Ola 1 reaplica: registrar_pago_cliente_lote no usa nc_aplicadas_en_moneda_factura';
  END IF;
  IF position('FOR UPDATE OF pf' in v_prov) = 0
     OR position('ORDER BY (r->>''factura_id'')::uuid' in v_prov) = 0 THEN
    RAISE EXCEPTION 'Ola 1 reaplica: registrar_pago_proveedor_lote perdió los locks deterministas';
  END IF;
END
$do$;
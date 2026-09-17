-- Fuente canónica de public.absorber_espejos_importacion(uuid, jsonb).
-- 1:1 con supabase/migrations/20260917182140_3783eacb-667c-4501-b6f6-b175b44e3bd8.sql.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.absorber_espejos_importacion(
  p_cuenta_bancaria_id uuid,
  p_filas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_fila jsonb;
  v_cand uuid;
  v_cuantos int;
  v_absorbidos int := 0;
BEGIN
  SELECT organization_id INTO v_org
    FROM public.cuentas_bancarias
   WHERE id = p_cuenta_bancaria_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CUENTA_NO_ENCONTRADA: la cuenta bancaria no existe o está dada de baja'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public._assert_writer(v_org);

  FOR v_fila IN SELECT * FROM jsonb_array_elements(COALESCE(p_filas, '[]'::jsonb))
  LOOP
    -- Idempotencia: si la línea del archivo ya está guardada, no se toca nada.
    PERFORM 1 FROM public.bbva_movimientos
      WHERE cuenta_bancaria_id = p_cuenta_bancaria_id
        AND hash_dedupe = v_fila->>'hash_dedupe'
        AND deleted_at IS NULL;
    CONTINUE WHEN FOUND;

    -- Candidato: espejo de COBRO de cliente (hash 'cobro-<pago_id>'), mismo
    -- importe exacto al centavo y fecha dentro de ±3 días. Los espejos de pago
    -- a proveedor, anticipos y devoluciones NO se absorben (su hash forma parte
    -- de los candados de sentido).
    SELECT count(*), min(id) INTO v_cuantos, v_cand
      FROM public.bbva_movimientos m
     WHERE m.cuenta_bancaria_id = p_cuenta_bancaria_id
       AND m.deleted_at IS NULL
       AND m.hash_dedupe LIKE 'cobro-%'
       AND m.pago_factura_id IS NOT NULL
       AND round(COALESCE(m.cargo, 0), 2) = round(COALESCE((v_fila->>'cargo')::numeric, 0), 2)
       AND round(COALESCE(m.abono, 0), 2) = round(COALESCE((v_fila->>'abono')::numeric, 0), 2)
       AND abs(m.fecha - (v_fila->>'fecha')::date) <= 3;

    -- Nunca se fusionan coincidencias ambiguas.
    CONTINUE WHEN COALESCE(v_cuantos, 0) <> 1;

    UPDATE public.bbva_movimientos
       SET hash_dedupe = v_fila->>'hash_dedupe',
           fecha = (v_fila->>'fecha')::date,
           concepto = COALESCE(NULLIF(v_fila->>'concepto', ''), concepto),
           referencia = COALESCE(NULLIF(v_fila->>'referencia', ''), referencia),
           saldo = COALESCE((v_fila->>'saldo')::numeric, saldo)
     WHERE id = v_cand;

    v_absorbidos := v_absorbidos + 1;

    PERFORM public.registrar_bitacora(
      'tesoreria', 'absorber_espejo_cobro_importacion', v_cand,
      COALESCE(v_fila->>'concepto', ''),
      jsonb_build_object('hash_dedupe', v_fila->>'hash_dedupe',
                         'cuenta_bancaria_id', p_cuenta_bancaria_id),
      v_org, auth.uid()
    );
  END LOOP;

  RETURN jsonb_build_object('absorbidos', v_absorbidos);
END;
$$;

REVOKE ALL ON FUNCTION public.absorber_espejos_importacion(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.absorber_espejos_importacion(uuid, jsonb) TO authenticated, service_role;

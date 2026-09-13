-- Espejo declarativo de public.actualizar_cotizacion_costos (v13.823.358).
--
-- Reemplaza los costos internos del Paso 2 del wizard de cotización de forma
-- atómica y participa del MISMO bloqueo optimista que la cotización:
--   * toma el lock de la fila de `cotizaciones` ANTES de borrar/insertar,
--   * valida autoridad/organización ANTES de resolver el replay de idempotencia
--     (la clave está ligada a key+organization_id+user_id por PK),
--   * v13.823.358 (Addendum P1): valida ESTADO. La base de costos sólo se
--     reemplaza en Borrador/Solicitada y sin embarque vinculado
--     (`LC_COT_COSTOS_ESTADO_INVALIDO` / `LC_COT_COSTOS_CON_EMBARQUE`); antes
--     una llamada autenticada directa podía borrar los costos de una cotización
--     Aceptada / En operación y dejar el P&L desincronizado. Para cambiar los
--     costos de una cotización cerrada existe `recotizar_cotizacion`.
--   * falla CERRADA: si `p_expected_updated_at` viene NULL o no coincide, no
--     borra ni inserta nada y lanza LC_CONFLICTO_CONCURRENCIA,
--   * al terminar toca la cotización y devuelve el nuevo `updated_at` para que
--     el wizard resincronice su sello.

DROP FUNCTION IF EXISTS public.actualizar_cotizacion_costos(uuid, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.actualizar_cotizacion_costos(
  p_cotizacion_id uuid,
  p_costos jsonb,
  p_request_id uuid DEFAULT NULL::uuid,
  p_expected_updated_at timestamptz DEFAULT NULL::timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_org_id uuid;
  v_actual timestamptz;
  v_nuevo timestamptz;
  v_estado estado_cotizacion;
  v_embarque_id uuid;
  v_folio text;
  v_count integer := 0;
  c jsonb;
  v_resp jsonb;
BEGIN
  SELECT organization_id, updated_at, estado, embarque_id, folio
    INTO v_org_id, v_actual, v_estado, v_embarque_id, v_folio
    FROM cotizaciones
   WHERE id = p_cotizacion_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  PERFORM public._assert_writer_cotizacion(v_org_id);

  -- v13.823.358 · Addendum P1: la base de costos sólo se reemplaza mientras la
  -- cotización sigue en captura. Aceptada / En operación / Enviada / etc. ya
  -- respaldan un P&L (y posiblemente un embarque): para cambiarlas existe el
  -- flujo explícito de nueva versión (`recotizar_cotizacion`).
  IF v_estado NOT IN ('Borrador'::estado_cotizacion, 'Solicitada'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_COSTOS_ESTADO_INVALIDO: la cotización % está en estado % y sus costos ya no pueden reemplazarse; genera una nueva versión (Re-cotizar) para cambiar la base de costos', COALESCE(v_folio, p_cotizacion_id::text), v_estado
      USING ERRCODE = 'P0001';
  END IF;

  IF v_embarque_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_COSTOS_CON_EMBARQUE: la cotización % ya tiene un embarque vinculado; sus costos no pueden reemplazarse', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  v_resp := public.idempotency_claim(p_request_id, 'actualizar_cotizacion_costos');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  IF p_expected_updated_at IS NULL
     OR v_actual IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: otro usuario modificó esta cotización. Recarga y vuelve a intentar.';
  END IF;

  DELETE FROM cotizacion_costos WHERE cotizacion_id = p_cotizacion_id;

  FOR c IN SELECT * FROM jsonb_array_elements(p_costos) LOOP
    INSERT INTO cotizacion_costos (
      cotizacion_id, concepto, moneda, proveedor, cantidad,
      costo_unitario, precio_venta, unidad_medida, notas, organization_id,
      costeo_tarifa_id, costeo_tarifa_recargo_id
    ) VALUES (
      p_cotizacion_id,
      c->>'concepto',
      c->>'moneda',
      COALESCE(c->>'proveedor', ''),
      (c->>'cantidad')::numeric,
      (c->>'costo_unitario')::numeric,
      COALESCE((c->>'precio_venta')::numeric, 0),
      COALESCE(c->>'unidad_medida', ''),
      COALESCE(c->>'notas', ''),
      v_org_id,
      NULLIF(c->>'costeo_tarifa_id', '')::uuid,
      NULLIF(c->>'costeo_tarifa_recargo_id', '')::uuid
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE cotizaciones
     SET updated_at = now()
   WHERE id = p_cotizacion_id
  RETURNING updated_at INTO v_nuevo;

  v_resp := jsonb_build_object(
    'cotizacion_id', p_cotizacion_id,
    'count', v_count,
    'updated_at', v_nuevo
  );
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid, timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid, timestamptz) IS
  'Reemplaza los costos del paso 2 del wizard. Sólo en Borrador/Solicitada y sin embarque vinculado (LC_COT_COSTOS_ESTADO_INVALIDO / LC_COT_COSTOS_CON_EMBARQUE). Falla cerrada: exige p_expected_updated_at bajo FOR UPDATE; autoridad validada antes del replay de idempotencia.';

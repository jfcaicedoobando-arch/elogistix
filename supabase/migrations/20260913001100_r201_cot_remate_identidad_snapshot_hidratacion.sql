-- R201 remate: identidad de costos de cotización + snapshot económico de
-- re-aprobación. Migración aditiva preparada; no modifica datos históricos.

ALTER TABLE public.conceptos_costo
  ADD COLUMN IF NOT EXISTS cotizacion_costo_origen_id uuid;

ALTER TABLE public.conceptos_costo
  DROP CONSTRAINT IF EXISTS conceptos_costo_cotizacion_costo_origen_id_fkey;
ALTER TABLE public.conceptos_costo
  ADD CONSTRAINT conceptos_costo_cotizacion_costo_origen_id_fkey
  FOREIGN KEY (cotizacion_costo_origen_id) REFERENCES public.cotizacion_costos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_conceptos_costo_cotizacion_origen
  ON public.conceptos_costo (embarque_id, cotizacion_costo_origen_id)
  WHERE deleted_at IS NULL AND cotizacion_costo_origen_id IS NOT NULL;

COMMENT ON COLUMN public.conceptos_costo.cotizacion_costo_origen_id IS
  'Renglón exacto de cotizacion_costos que originó el costo al convertir a embarque; evita modificar costos manuales u homónimos.';

-- Fuente canónica de public._crear_embarque_replicar_conceptos
-- Helper privado (Bloque 3.2 · god-function split) usado por
-- crear_embarque_borrador_core para replicar cotizacion_costos y
-- conceptos_venta en el embarque recién creado.
-- Regenerada 1:1 desde la definición vigente (migración 20260912000100:
-- prorrateo por resto mayor, sin importes negativos).
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public._crear_embarque_replicar_conceptos(p_cotizacion_id uuid, p_embarque_id uuid, p_org uuid, p_target_ids uuid[], p_conceptos_venta jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_costo public.cotizacion_costos%ROWTYPE;
  v_cid   uuid;
  v_venta jsonb;
  v_cant  numeric;
  v_total numeric;
  v_pu    numeric;
  v_tasa  numeric;
  v_base  numeric;
  v_n     integer;
  v_parte numeric;
  v_cent  bigint;
  v_piso  bigint;
  v_resto bigint;
  v_signo integer;
  v_i     integer;
  v_prov_nombre text;
  v_prov_id uuid;
BEGIN
  -- Idempotencia: si el embarque ya tiene conceptos vivos, no re-sembrar.
  IF EXISTS (
    SELECT 1 FROM public.conceptos_costo
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.conceptos_venta
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  v_n := COALESCE(array_length(p_target_ids, 1), 0);

  FOR v_costo IN
    SELECT * FROM public.cotizacion_costos
    WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
  LOOP
    v_base := ROUND(COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad, 0), 2);
    v_prov_nombre := COALESCE(btrim(v_costo.proveedor), '');
    v_prov_id := public._resolver_proveedor_por_nombre(p_org, v_prov_nombre);
    IF v_prov_id IS NULL AND v_prov_nombre <> '' THEN
      SELECT a.proveedor_id INTO v_prov_id
        FROM public.proveedor_alias a
       WHERE a.organization_id = p_org
         AND upper(btrim(a.alias_normalizado)) = upper(v_prov_nombre)
       LIMIT 1;
    END IF;

    IF COALESCE(v_costo.unidad_medida, 'Contenedor') = 'BL' OR v_n = 0 THEN
      INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, proveedor_id, organization_id, origen, cotizacion_costo_origen_id)
      VALUES (p_embarque_id, NULL, v_costo.concepto, v_base,
              CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
              v_prov_nombre, v_prov_id, p_org, 'cotizacion', v_costo.id);
    ELSE
      -- Prorrateo sin importes negativos (método del resto mayor en centavos):
      -- el piso se reparte a todos y los primeros `v_resto` contenedores
      -- reciben un centavo extra. La suma cuadra exacta y ninguna parte queda
      -- con signo contrario al total (antes 0.02 entre 4 daba 0.01/0.01/0.01/-0.01).
      v_signo := CASE WHEN v_base < 0 THEN -1 ELSE 1 END;
      v_cent  := ROUND(ABS(v_base) * 100)::bigint;
      v_piso  := v_cent / v_n::bigint;
      v_resto := v_cent - v_piso * v_n::bigint;
      v_i     := 0;
      FOREACH v_cid IN ARRAY p_target_ids LOOP
        v_i := v_i + 1;
        v_parte := ROUND(v_signo * (v_piso + CASE WHEN v_i <= v_resto THEN 1 ELSE 0 END)::numeric / 100, 2);
        INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, proveedor_id, organization_id, origen, cotizacion_costo_origen_id)
        VALUES (p_embarque_id, v_cid, v_costo.concepto, v_parte,
                CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                v_prov_nombre, v_prov_id, p_org, 'cotizacion', v_costo.id);
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(p_conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        v_cant := COALESCE(NULLIF((v_venta->>'cantidad')::numeric, 0), 1);
        v_pu   := COALESCE((v_venta->>'precio_unitario')::numeric, 0);
        v_tasa := GREATEST(COALESCE((v_venta->>'tasa_iva_aplicada')::numeric, 0), 0);

        -- C-1: la base gravable se DERIVA del unitario capturado. Fallback sólo
        -- si no hay unitario: se desinfla el `total` (que viene con IVA).
        IF v_pu = 0 THEN
          v_total := ROUND(COALESCE((v_venta->>'total')::numeric, 0) / (1 + v_tasa), 2);
          v_pu    := ROUND(v_total / v_cant, 6);
        END IF;
        v_total := ROUND(v_cant * v_pu, 2);

        INSERT INTO public.conceptos_venta (
          embarque_id, descripcion, cantidad, precio_unitario, moneda,
          aplica_iva, tasa_iva_aplicada, total, organization_id
        )
        VALUES (
          p_embarque_id, v_venta->>'descripcion', v_cant, v_pu,
          CASE WHEN v_venta->>'moneda' = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE((v_venta->>'aplica_iva')::boolean, v_tasa > 0),
          v_tasa,
          v_total, p_org
        );
      END IF;
    END LOOP;
  END IF;
END;
$function$
;

REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;

-- Fuente canónica de public._embarque_aplicar_tarifa_decidida (R201-COT-01).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.
--
-- Aplica al COSTO del embarque los importes de la tarifa realmente decidida
-- (`refrescada` / `sustituida`). No toca `cotizacion_costos` (el histórico de la
-- cotización y el precio de venta aceptado quedan intactos) ni renglones ya
-- liquidados. Es idempotente por construcción: sólo se invoca desde
-- `crear_embarque_borrador_desde_cotizacion` cuando el embarque aún no tenía
-- decisión de tarifa registrada.

CREATE OR REPLACE FUNCTION public._embarque_aplicar_tarifa_decidida(
  p_embarque_id uuid,
  p_cotizacion_id uuid,
  p_tarifa_id_aplicada uuid
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_costo          RECORD;
  v_fila           RECORD;
  v_unit           numeric;
  v_base           numeric;
  v_n              integer;
  v_cent           bigint;
  v_piso           bigint;
  v_resto          bigint;
  v_equivalentes   integer;
  v_moneda_match   text;
  v_tarifa_origen  uuid;
  v_es_sustitucion boolean;
  v_ag_origen      uuid;
  v_ag_nueva       uuid;
  v_mon_origen     text;
  v_mon_nueva      text;
  v_actualizados   integer := 0;
BEGIN
  IF p_embarque_id IS NULL OR p_cotizacion_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT c.tarifa_id INTO v_tarifa_origen
    FROM public.cotizaciones c
   WHERE c.id = p_cotizacion_id;

  v_es_sustitucion := p_tarifa_id_aplicada IS NOT NULL
                  AND p_tarifa_id_aplicada IS DISTINCT FROM v_tarifa_origen;

  -- Coherencia global de la sustituta: mezclar precios de una tarifa con el
  -- proveedor/moneda sembrados de otra produciría un costo inauditable.
  IF v_es_sustitucion THEN
    SELECT t.agente_id, t.moneda INTO v_ag_nueva, v_mon_nueva
      FROM public.costeo_tarifas t WHERE t.id = p_tarifa_id_aplicada;
    SELECT t.agente_id, t.moneda INTO v_ag_origen, v_mon_origen
      FROM public.costeo_tarifas t WHERE t.id = v_tarifa_origen;

    IF v_ag_nueva IS NULL THEN
      RAISE EXCEPTION 'La tarifa sustituta no existe o no tiene agente asignado. Revisa y selecciona otra tarifa.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tarifa_origen IS NOT NULL AND v_ag_nueva IS DISTINCT FROM v_ag_origen THEN
      RAISE EXCEPTION 'La tarifa sustituta pertenece a otro proveedor/agente: no se puede aplicar sin recotizar. Revisa y selecciona una tarifa del mismo proveedor.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tarifa_origen IS NOT NULL AND upper(btrim(COALESCE(v_mon_nueva, ''))) IS DISTINCT FROM upper(btrim(COALESCE(v_mon_origen, ''))) THEN
      RAISE EXCEPTION 'La tarifa sustituta está en otra moneda (% vs %): no se puede aplicar sin recotizar. Revisa y selecciona una tarifa en la misma moneda.',
        v_mon_nueva, v_mon_origen USING ERRCODE = 'P0001';
    END IF;
  END IF;

  FOR v_costo IN
    SELECT cc.id, cc.concepto, cc.moneda,
           COALESCE(NULLIF(cc.cantidad, 0), 1) AS cantidad,
           cc.costo_unitario, cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id,
           r.concepto AS recargo_concepto, r.lado AS recargo_lado,
           r.monto AS recargo_monto_vigente, r.moneda AS recargo_moneda_vigente,
           r.id AS recargo_vigente_id
      FROM public.cotizacion_costos cc
      LEFT JOIN public.costeo_tarifa_recargos r ON r.id = cc.costeo_tarifa_recargo_id
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
       AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    v_unit := NULL;

    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      IF v_es_sustitucion THEN
        -- Sustitución: sólo una equivalencia inequívoca es aceptable.
        SELECT count(*), min(r.monto), min(r.moneda)
          INTO v_equivalentes, v_unit, v_moneda_match
          FROM public.costeo_tarifa_recargos r
         WHERE r.tarifa_id = p_tarifa_id_aplicada
           AND lower(btrim(r.concepto)) = lower(btrim(COALESCE(v_costo.recargo_concepto, v_costo.concepto)))
           AND r.lado IS NOT DISTINCT FROM v_costo.recargo_lado
           AND upper(btrim(r.moneda)) = upper(btrim(v_costo.moneda));

        IF COALESCE(v_equivalentes, 0) = 0 THEN
          RAISE EXCEPTION 'La tarifa sustituta no tiene un cargo equivalente a "%" (%). Revisa y selecciona otra tarifa: no se aplicará conservando el cargo anterior.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto), v_costo.moneda
            USING ERRCODE = 'P0001';
        END IF;
        IF v_equivalentes > 1 THEN
          RAISE EXCEPTION 'La tarifa sustituta tiene % cargos llamados "%" (%): la equivalencia es ambigua. Revisa y selecciona otra tarifa.',
            v_equivalentes, COALESCE(v_costo.recargo_concepto, v_costo.concepto), v_costo.moneda
            USING ERRCODE = 'P0001';
        END IF;
        IF upper(btrim(COALESCE(v_moneda_match, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
          RAISE EXCEPTION 'El cargo equivalente a "%" está en otra moneda. Revisa y selecciona otra tarifa.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto) USING ERRCODE = 'P0001';
        END IF;
      ELSE
        -- Refrescar la misma tarifa: identidad exacta del recargo fuente.
        IF v_costo.recargo_vigente_id IS NULL THEN
          RAISE EXCEPTION 'El cargo "%" de la tarifa ya no existe: no se puede refrescar. Revisa y selecciona una tarifa vigente.',
            v_costo.concepto USING ERRCODE = 'P0001';
        END IF;
        IF upper(btrim(COALESCE(v_costo.recargo_moneda_vigente, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
          RAISE EXCEPTION 'El cargo "%" cambió de moneda en la tarifa: no se puede refrescar sin recotizar.',
            COALESCE(v_costo.recargo_concepto, v_costo.concepto) USING ERRCODE = 'P0001';
        END IF;
        v_unit := v_costo.recargo_monto_vigente;
      END IF;
    ELSE
      SELECT t.flete_base, t.moneda INTO v_unit, v_moneda_match
        FROM public.costeo_tarifas t
       WHERE t.id = COALESCE(p_tarifa_id_aplicada, v_costo.costeo_tarifa_id);

      IF v_unit IS NOT NULL
         AND upper(btrim(COALESCE(v_moneda_match, ''))) IS DISTINCT FROM upper(btrim(v_costo.moneda)) THEN
        RAISE EXCEPTION 'El flete de la tarifa aplicada está en % y el costo aceptado en %: no se puede aplicar sin recotizar.',
          v_moneda_match, v_costo.moneda USING ERRCODE = 'P0001';
      END IF;
    END IF;

    CONTINUE WHEN v_unit IS NULL;

    v_base := ROUND(v_unit * v_costo.cantidad, 2);

    SELECT count(*) INTO v_n
      FROM public.conceptos_costo c
     WHERE c.embarque_id = p_embarque_id
       AND c.deleted_at IS NULL
       AND c.estado_liquidacion = 'Pendiente'::estado_liquidacion
       AND c.origen IN ('cotizacion','costeo_tarifa')
       AND c.cotizacion_costo_origen_id = v_costo.id;

    CONTINUE WHEN COALESCE(v_n, 0) = 0;

    -- Reparto de centavos por resto mayor, sin crear montos negativos.
    v_cent := ROUND(GREATEST(v_base, 0) * 100)::bigint;
    v_piso := v_cent / v_n::bigint;
    v_resto := v_cent - (v_piso * v_n::bigint);

    FOR v_fila IN
      SELECT c.id, row_number() OVER (ORDER BY c.contenedor_id NULLS FIRST, c.created_at, c.id) AS rn
        FROM public.conceptos_costo c
       WHERE c.embarque_id = p_embarque_id
         AND c.deleted_at IS NULL
         AND c.estado_liquidacion = 'Pendiente'::estado_liquidacion
         AND c.origen IN ('cotizacion','costeo_tarifa')
         AND c.cotizacion_costo_origen_id = v_costo.id
    LOOP
      UPDATE public.conceptos_costo
         SET monto = (v_piso + CASE WHEN v_fila.rn <= v_resto THEN 1 ELSE 0 END)::numeric / 100,
             origen = 'costeo_tarifa',
             updated_at = now()
       WHERE id = v_fila.id;
      v_actualizados := v_actualizados + 1;
    END LOOP;
  END LOOP;

  IF v_actualizados > 0 THEN
    PERFORM public._recompute_totales_embarque(p_embarque_id);
  END IF;

  RETURN v_actualizados;
END;
$function$;

REVOKE ALL ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._embarque_aplicar_tarifa_decidida(uuid, uuid, uuid) TO service_role;

-- Fuente canónica de public.revalidar_tarifa_cotizacion (R201-COT-02).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.
--
-- R201-COT-02: cuando ventas ya re-aprobó la tarifa, la revalidación deja de
-- devolver `bloqueante` (que dejaba a operaciones en un bucle pidiendo la misma
-- re-aprobación) y expone `estado_revalidacion` + `reaprobacion_vigente`. La
-- aprobación sólo vale para el delta que ventas vio: si la tarifa vuelve a
-- cambiar, el resultado regresa a `bloqueante`.

CREATE OR REPLACE FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot             public.cotizaciones%ROWTYPE;
  v_caller_org      UUID := current_user_org_id();
  v_is_super        BOOLEAN := has_role(auth.uid(),'super_admin'::app_role);
  v_umbral_pct      NUMERIC;
  v_bloquea_vencida BOOLEAN;
  v_tarifa_vigente  BOOLEAN := FALSE;
  v_tarifa_vig_rec  RECORD;
  v_cambios         JSONB := '[]'::jsonb;
  v_max_delta_pct   NUMERIC := 0;
  v_severidad       TEXT;
  v_costo           RECORD;
  v_monto_actual    NUMERIC;
  v_delta_abs       NUMERIC;
  v_delta_pct       NUMERIC;
  v_reaprob_vigente BOOLEAN := FALSE;
  v_snapshot        JSONB;
  v_snapshot_aprob  JSONB;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT COALESCE((valor#>>'{}')::numeric,5) INTO v_umbral_pct
    FROM public.configuracion
    WHERE categoria='operaciones' AND clave='tarifa_revalidacion_umbral_pct';
  v_umbral_pct := COALESCE(v_umbral_pct,5);
  SELECT COALESCE((valor#>>'{}')::boolean,TRUE) INTO v_bloquea_vencida
    FROM public.configuracion
    WHERE categoria='operaciones' AND clave='tarifa_revalidacion_bloquea_si_vencida';
  v_bloquea_vencida := COALESCE(v_bloquea_vencida,TRUE);
  IF v_cot.tarifa_id IS NULL THEN
    RETURN jsonb_build_object(
      'tarifa_vigente',TRUE,'agente_sin_cupo',FALSE,'severidad','sin_cambios',
      'cambios','[]'::jsonb,'umbral_pct',v_umbral_pct,'max_delta_pct',0,
      'estado_revalidacion',v_cot.estado_revalidacion,'reaprobacion_vigente',FALSE,
      'motivo','sin_tarifa_vinculada');
  END IF;
  SELECT * INTO v_tarifa_vig_rec FROM public.costeo_tarifas_vigentes_v WHERE id=v_cot.tarifa_id LIMIT 1;
  v_tarifa_vigente := FOUND;
  FOR v_costo IN
    SELECT cc.concepto, cc.moneda, cc.costo_unitario AS monto_anterior,
           cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id
    FROM public.cotizacion_costos cc
    WHERE cc.cotizacion_id=v_cot.id AND cc.deleted_at IS NULL
      AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      SELECT monto INTO v_monto_actual FROM public.costeo_tarifa_recargos WHERE id=v_costo.costeo_tarifa_recargo_id;
    ELSE
      SELECT flete_base INTO v_monto_actual FROM public.costeo_tarifas WHERE id=v_costo.costeo_tarifa_id;
    END IF;
    IF v_monto_actual IS NULL THEN
      v_cambios := v_cambios || jsonb_build_object(
        'concepto',v_costo.concepto,'moneda',v_costo.moneda,
        'monto_anterior',v_costo.monto_anterior,'monto_actual',NULL,
        'delta_abs',NULL,'delta_pct',NULL,'motivo','eliminado');
      v_max_delta_pct := 100;
      CONTINUE;
    END IF;
    v_delta_abs := v_monto_actual - v_costo.monto_anterior;
    v_delta_pct := CASE WHEN v_costo.monto_anterior=0
                     THEN CASE WHEN v_delta_abs=0 THEN 0 ELSE 100 END
                     ELSE ROUND(ABS(v_delta_abs)/v_costo.monto_anterior*100,2) END;
    IF ABS(v_delta_abs) > 0.001 THEN
      v_cambios := v_cambios || jsonb_build_object(
        'concepto',v_costo.concepto,'moneda',v_costo.moneda,
        'monto_anterior',v_costo.monto_anterior,'monto_actual',v_monto_actual,
        'delta_abs',v_delta_abs,'delta_pct',v_delta_pct);
      IF v_delta_pct > v_max_delta_pct THEN v_max_delta_pct := v_delta_pct; END IF;
    END IF;
  END LOOP;

  -- Huella económica canónica: identifica cada costo fuente y su importe
  -- vigente. A diferencia del máximo porcentual, detecta cualquier cambio de
  -- composición o importe aunque el porcentaje agregado coincida.
  SELECT jsonb_build_object(
    'tarifa_vigente', v_tarifa_vigente,
    'filas', COALESCE(jsonb_agg(jsonb_build_object(
      'cotizacion_costo_id', cc.id,
      'tarifa_id', cc.costeo_tarifa_id,
      'recargo_id', cc.costeo_tarifa_recargo_id,
      'cantidad', cc.cantidad,
      'moneda', cc.moneda,
      'monto_actual', CASE WHEN cc.costeo_tarifa_recargo_id IS NOT NULL THEN r.monto ELSE t.flete_base END
    ) ORDER BY cc.id), '[]'::jsonb)
  ) INTO v_snapshot
  FROM public.cotizacion_costos cc
  LEFT JOIN public.costeo_tarifa_recargos r ON r.id=cc.costeo_tarifa_recargo_id
  LEFT JOIN public.costeo_tarifas t ON t.id=cc.costeo_tarifa_id
  WHERE cc.cotizacion_id=v_cot.id AND cc.deleted_at IS NULL
    AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL);
  IF NOT v_tarifa_vigente AND v_bloquea_vencida THEN v_severidad := 'bloqueante';
  ELSIF jsonb_array_length(v_cambios)=0 AND v_tarifa_vigente THEN v_severidad := 'sin_cambios';
  ELSIF v_max_delta_pct > v_umbral_pct THEN v_severidad := 'bloqueante';
  ELSE v_severidad := 'informativa';
  END IF;

  -- R201-COT-02: la re-aprobación de ventas consume el bloqueo, pero SÓLO si
  -- corresponde al mismo delta que ventas autorizó.
  IF v_severidad = 'bloqueante' AND v_cot.estado_revalidacion = 'reaprobada' THEN
    v_snapshot_aprob := v_cot.revalidacion_delta_jsonb->'snapshot_economico';
    IF v_snapshot_aprob IS NOT NULL AND v_snapshot_aprob = v_snapshot THEN
      v_severidad := 'informativa';
      v_reaprob_vigente := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tarifa_vigente',v_tarifa_vigente,'agente_sin_cupo',FALSE,'severidad',v_severidad,
    'cambios',v_cambios,'umbral_pct',v_umbral_pct,'max_delta_pct',v_max_delta_pct,
    'estado_revalidacion',v_cot.estado_revalidacion,
    'reaprobacion_vigente',v_reaprob_vigente,
    'snapshot_economico',v_snapshot,
    'motivo',CASE WHEN v_reaprob_vigente THEN 'reaprobada_por_ventas' ELSE NULL END,
    'tarifa_id_vigente',CASE WHEN v_tarifa_vigente THEN v_cot.tarifa_id ELSE NULL END);
END;
$function$;

REVOKE ALL ON FUNCTION public.revalidar_tarifa_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revalidar_tarifa_cotizacion(uuid) TO authenticated, service_role;

-- Fuente canónica de public.solicitar_reaprobacion_tarifa (R201-COT-02).
-- El snapshot aprobado se calcula en servidor; p_delta_jsonb sólo aporta el
-- detalle visible recibido del cliente y nunca decide la vigencia económica.

CREATE OR REPLACE FUNCTION public.solicitar_reaprobacion_tarifa(p_cotizacion_id uuid, p_delta_jsonb jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cot public.cotizaciones%ROWTYPE;
  v_caller_org uuid := current_user_org_id();
  v_is_super boolean := has_role(auth.uid(),'super_admin'::app_role);
  v_operador_id uuid;
  v_revalidacion jsonb;
  v_delta_seguro jsonb;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  v_revalidacion := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  v_delta_seguro := COALESCE(p_delta_jsonb, '{}'::jsonb)
    || jsonb_build_object('snapshot_economico', v_revalidacion->'snapshot_economico');

  UPDATE public.cotizaciones
     SET estado_revalidacion='pendiente_reaprobacion',
         revalidacion_solicitada_en=now(), revalidacion_resuelta_en=NULL,
         revalidacion_delta_jsonb=v_delta_seguro, updated_at=now()
   WHERE id=p_cotizacion_id;

  BEGIN v_operador_id := v_cot.operador::uuid;
  EXCEPTION WHEN others THEN v_operador_id := NULL; END;
  IF v_operador_id IS NOT NULL THEN
    INSERT INTO public.notificaciones_internas(
      organization_id,usuario_id,tipo,titulo,mensaje,enlace,entidad_tipo,entidad_id)
    VALUES (v_cot.organization_id,v_operador_id,'tarifa_reaprobacion_requerida',
      'Cotización requiere re-aprobación de tarifa',
      'La cotización '||v_cot.folio||' tiene cambios en la tarifa vigente. Revisa y decide.',
      '/cotizaciones/'||v_cot.id::text,'cotizacion',v_cot.id);
  END IF;

  INSERT INTO public.bitacora_actividad(
    organization_id,usuario_id,usuario_email,modulo,accion,entidad_id,entidad_nombre,detalles)
  SELECT v_cot.organization_id,auth.uid(),COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'Cotizaciones','reaprobacion_solicitada',v_cot.id,v_cot.folio,
    jsonb_build_object('delta',v_delta_seguro);
END;
$function$;

REVOKE ALL ON FUNCTION public.solicitar_reaprobacion_tarifa(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_reaprobacion_tarifa(uuid, jsonb) TO authenticated, service_role;

-- Fuente canónica de public.enforce_revalidacion_sin_cambios (R201-COT-02).
-- Siempre recalcula; una bandera reaprobada no sustituye la comparación del
-- snapshot económico autoritativo.

CREATE OR REPLACE FUNCTION public.enforce_revalidacion_sin_cambios(p_cotizacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_res jsonb;
BEGIN
  v_res := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  IF v_res->>'severidad' = 'bloqueante' THEN
    RAISE EXCEPTION 'LC_TARIFA_REQUIERE_REVALIDACION severidad=% max_delta_pct=% — resuelve la revalidación antes de convertir',
      v_res->>'severidad', COALESCE(v_res->>'max_delta_pct','0') USING ERRCODE='P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_revalidacion_sin_cambios(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_revalidacion_sin_cambios(uuid) TO authenticated, service_role;

-- Fuente canónica de public.crear_embarque_borrador_core
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_core(p_cotizacion_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot           public.cotizaciones%ROWTYPE;
  v_caller_org    uuid := current_user_org_id();
  v_is_super      boolean := has_role(auth.uid(), 'super_admin'::app_role);
  v_can_write     boolean;
  v_embarque_id   uuid;
  v_orphan_id     uuid;
  v_num           integer;
  v_peso_each     numeric;
  v_vol_each      numeric;
  v_piezas_base   integer;
  v_piezas_rest   integer;
  v_piezas_este   integer;
  v_first_hijo_id uuid;
  v_user_email    text;
  i               integer;
  v_target_ids    uuid[];
  v_cid           uuid;

  v_origen_code   text;
  v_destino_code  text;
  v_puerto_o      text;
  v_puerto_d      text;
  v_aero_o        text;
  v_aero_d        text;
  v_ciudad_o      text;
  v_ciudad_d      text;
  v_tipo_cont_code text;
  v_agente_id     uuid;
  v_naviera_id    uuid;
  v_agente_nombre text;
  v_naviera_nombre text;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: cotización % no existe', p_cotizacion_id USING ERRCODE = 'P0002';
  END IF;

  IF v_cot.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: la cotización % está eliminada', p_cotizacion_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE = '42501';
  END IF;

  v_can_write := v_is_super
                 OR has_role(auth.uid(), 'admin'::app_role)
                 OR has_role(auth.uid(), 'operador'::app_role);
  IF NOT v_can_write THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: solo admin u operador pueden crear el borrador' USING ERRCODE = '42501';
  END IF;

  IF v_cot.estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_cot.estado USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.cliente_id IS NULL OR v_cot.es_prospecto THEN
    RAISE EXCEPTION 'LC_COT_SIN_CLIENTE: convierte el prospecto a cliente antes de crear el borrador' USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.embarque_id IS NOT NULL THEN
    SELECT id INTO v_orphan_id FROM public.embarques WHERE id = v_cot.embarque_id AND deleted_at IS NULL;
    IF FOUND THEN
      RETURN v_orphan_id;
    END IF;
    UPDATE public.cotizaciones SET embarque_id = NULL WHERE id = v_cot.id;
  END IF;

  SELECT id INTO v_orphan_id
  FROM public.embarques
  WHERE cotizacion_id = v_cot.id AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;
  IF v_orphan_id IS NOT NULL THEN
    RETURN v_orphan_id;
  END IF;

  v_origen_code := COALESCE(
    NULLIF(substring(v_cot.origen  FROM '\(([^)]+)\)'), ''),
    NULLIF(trim(v_cot.origen),  ''),
    NULL
  );
  v_destino_code := COALESCE(
    NULLIF(substring(v_cot.destino FROM '\(([^)]+)\)'), ''),
    NULLIF(trim(v_cot.destino), ''),
    NULL
  );

  IF v_origen_code IS NOT NULL THEN
    SELECT p.name INTO v_puerto_o FROM public.puertos p WHERE p.code = v_origen_code LIMIT 1;
  END IF;
  IF v_destino_code IS NOT NULL THEN
    SELECT p.name INTO v_puerto_d FROM public.puertos p WHERE p.code = v_destino_code LIMIT 1;
  END IF;

  IF v_cot.modo = 'Aéreo'::modo_transporte THEN
    v_aero_o := COALESCE(v_puerto_o, v_origen_code);
    v_aero_d := COALESCE(v_puerto_d, v_destino_code);
    v_puerto_o := NULL; v_puerto_d := NULL;
  ELSIF v_cot.modo = 'Terrestre'::modo_transporte THEN
    v_ciudad_o := COALESCE(v_puerto_o, v_origen_code);
    v_ciudad_d := COALESCE(v_puerto_d, v_destino_code);
    v_puerto_o := NULL; v_puerto_d := NULL;
  ELSE
    v_puerto_o := COALESCE(v_puerto_o, v_origen_code);
    v_puerto_d := COALESCE(v_puerto_d, v_destino_code);
  END IF;

  -- v13.320.4: usar columna real cotizaciones.tipo_contenedor (text).
  -- La versión viva anterior referenciaba una columna fantasma con sufijo _id que
  -- nunca existió en la tabla y hacía fallar toda la revalidación de tarifa.
  v_tipo_cont_code := v_cot.tipo_contenedor;
  IF v_tipo_cont_code IS NOT NULL AND v_tipo_cont_code ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    SELECT code INTO v_tipo_cont_code FROM public.tipos_contenedor WHERE id = v_cot.tipo_contenedor::uuid;
    v_tipo_cont_code := COALESCE(v_tipo_cont_code, v_cot.tipo_contenedor);
  END IF;

  v_agente_id  := v_cot.agente_id;
  v_naviera_id := v_cot.naviera_id;
  IF (v_agente_id IS NULL OR v_naviera_id IS NULL) AND v_cot.tarifa_id IS NOT NULL THEN
    SELECT COALESCE(v_agente_id, t.agente_id), COALESCE(v_naviera_id, t.naviera_id)
      INTO v_agente_id, v_naviera_id
    FROM public.costeo_tarifas t WHERE t.id = v_cot.tarifa_id;
  END IF;

  IF v_agente_id  IS NOT NULL THEN SELECT nombre INTO v_agente_nombre  FROM public.costeo_agentes WHERE id = v_agente_id; END IF;
  IF v_naviera_id IS NOT NULL THEN SELECT name   INTO v_naviera_nombre FROM public.navieras       WHERE id = v_naviera_id; END IF;

  INSERT INTO public.embarques (
    cotizacion_id, expediente, cliente_id, cliente_nombre,
    estado, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, operador, tipo_carga, tipo_contenedor,
    msds_archivo,
    organization_id,
    puerto_origen, puerto_destino,
    aeropuerto_origen, aeropuerto_destino,
    ciudad_origen, ciudad_destino,
    tarifa_id, tarifa_id_original, tarifa_id_aplicada,
    carta_garantia, dias_libres_destino,
    seguro, valor_seguro_usd,
    agente_id, naviera_id, agente, naviera
  )
  VALUES (
    v_cot.id, NULL, v_cot.cliente_id, v_cot.cliente_nombre,
    'Borrador'::estado_embarque, v_cot.modo, v_cot.tipo, v_cot.incoterm, v_cot.descripcion_mercancia,
    COALESCE(v_cot.peso_kg, 0), COALESCE(v_cot.volumen_m3, 0), COALESCE(v_cot.piezas, 0),
    v_cot.operador, v_cot.tipo_carga, v_tipo_cont_code,
    -- R201-COT-07: la hoja de seguridad (MSDS) capturada en la cotización se
    -- hereda al embarque; antes el borrador nacía sin el documento.
    v_cot.msds_archivo,
    v_cot.organization_id,
    v_puerto_o, v_puerto_d,
    v_aero_o, v_aero_d,
    v_ciudad_o, v_ciudad_d,
    v_cot.tarifa_id, v_cot.tarifa_id, v_cot.tarifa_id,
    v_cot.carta_garantia, v_cot.dias_libres_destino,
    v_cot.seguro, v_cot.valor_seguro_usd,
    v_agente_id, v_naviera_id, v_agente_nombre, v_naviera_nombre
  )
  RETURNING id INTO v_embarque_id;

  v_num := GREATEST(1, COALESCE(v_cot.num_contenedores, 1));
  v_peso_each := COALESCE(v_cot.peso_kg, 0) / v_num;
  v_vol_each := COALESCE(v_cot.volumen_m3, 0) / v_num;
  v_piezas_base := COALESCE(v_cot.piezas, 0) / v_num;
  v_piezas_rest := COALESCE(v_cot.piezas, 0);

  v_target_ids := ARRAY[]::uuid[];
  FOR i IN 1..v_num LOOP
    IF i = v_num THEN v_piezas_este := v_piezas_rest;
    ELSE v_piezas_este := v_piezas_base; END IF;
    v_piezas_rest := v_piezas_rest - v_piezas_este;

    INSERT INTO public.embarque_contenedores (
      embarque_id, numero_contenedor, tipo_contenedor, bl_house,
      peso_kg, volumen_m3, piezas, orden
    )
    VALUES (
      v_embarque_id, '', COALESCE(v_tipo_cont_code, ''), '',
      v_peso_each, v_vol_each, v_piezas_este, i
    )
    RETURNING id INTO v_cid;

    v_target_ids := array_append(v_target_ids, v_cid);
    IF i = 1 THEN v_first_hijo_id := v_cid; END IF;
  END LOOP;

  PERFORM public._crear_embarque_replicar_conceptos(
    v_cot.id, v_embarque_id, v_cot.organization_id, v_target_ids, v_cot.conceptos_venta
  );

  UPDATE public.cotizaciones
  SET embarque_id = v_embarque_id, estado = 'En operación'::estado_cotizacion, updated_at = now()
  WHERE id = v_cot.id;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
  VALUES (v_cot.organization_id, auth.uid(), COALESCE(v_user_email, ''),
          'Cotizaciones', 'Borrador de embarque creado', v_cot.id, v_cot.folio,
          jsonb_build_object('embarque_id', v_embarque_id, 'expediente', NULL));

  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace)
  SELECT v_cot.organization_id, om.user_id, 'cotizacion_borrador_embarque',
         'Borrador de embarque creado',
         'Se generó un borrador de embarque desde la cotización ' || v_cot.folio,
         '/embarques/' || v_embarque_id::text
  FROM public.organization_members om
  WHERE om.organization_id = v_cot.organization_id
    AND om.role IN ('admin'::app_role, 'operador'::app_role)
    AND om.user_id <> auth.uid();

  RETURN v_embarque_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_borrador_core(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_core(uuid) TO service_role;

-- Fuente canónica. Espejo 1:1 de la migración R201-COT-01/02 (cotización→embarque).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid, p_decision text DEFAULT 'sin_cambios'::text, p_tarifa_id_aplicada uuid DEFAULT NULL::uuid, p_delta_jsonb jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_embarque_id UUID; v_cot public.cotizaciones%ROWTYPE; v_ya_decidido BOOLEAN; v_rev jsonb;
BEGIN
  IF p_decision NOT IN ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas') THEN
    RAISE EXCEPTION 'Decisión de tarifa inválida: %', p_decision USING ERRCODE='P0001';
  END IF;
  PERFORM public.enforce_cotizacion_vigente(p_cotizacion_id);
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  v_rev := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  IF p_decision='sin_cambios' THEN
    IF v_rev->>'severidad' = 'bloqueante' THEN
      RAISE EXCEPTION 'LC_TARIFA_REQUIERE_REVALIDACION: la tarifa cambió antes de crear el embarque' USING ERRCODE='P0001';
    END IF;
  ELSIF p_decision='reaprobada_ventas' THEN
    IF COALESCE((v_rev->>'reaprobacion_vigente')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_REAPROBACION_NO_VIGENTE: la aprobación de ventas no corresponde al estado económico actual' USING ERRCODE='P0001';
    END IF;
  ELSIF p_decision IN ('refrescada','sustituida') THEN
    IF p_tarifa_id_aplicada IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.costeo_tarifas t
       WHERE t.id=p_tarifa_id_aplicada
         AND t.organization_id=v_cot.organization_id
         AND (
           p_decision='refrescada' AND t.id=v_cot.tarifa_id
           OR p_decision='sustituida' AND t.id IS DISTINCT FROM v_cot.tarifa_id
         )
    ) THEN
      RAISE EXCEPTION 'LC_TARIFA_APLICADA_INVALIDA: selecciona una tarifa válida de la organización' USING ERRCODE='P0001';
    END IF;
  END IF;
  v_embarque_id := public.crear_embarque_borrador_core(p_cotizacion_id);

  -- v13.823.32: repetir la conversión (el core devuelve el embarque ya
  -- existente) NO debe pisar el snapshot/decisión histórica de tarifa.
  SELECT tarifa_decision IS NOT NULL INTO v_ya_decidido
    FROM public.embarques WHERE id = v_embarque_id;

  IF NOT COALESCE(v_ya_decidido, false) THEN
    UPDATE public.embarques
       SET tarifa_id_original=v_cot.tarifa_id,
           tarifa_id_aplicada=COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
           tarifa_delta_jsonb=p_delta_jsonb,
           tarifa_decision=p_decision,
           tarifa_revalidada_en=now(),
           tarifa_revalidada_por=auth.uid()
     WHERE id=v_embarque_id;

    -- R201-COT-01: refrescar o sustituir la tarifa debe reflejarse en el COSTO
    -- del embarque; antes sólo se guardaba la etiqueta de la decisión y el
    -- embarque nacía con los importes viejos. El histórico de la cotización y
    -- el precio de venta aceptado no se tocan.
    IF p_decision IN ('refrescada','sustituida') THEN
      PERFORM public._embarque_aplicar_tarifa_decidida(
        v_embarque_id, p_cotizacion_id, COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id));
    END IF;

    IF p_decision <> 'sin_cambios' AND v_cot.estado_revalidacion='pendiente_reaprobacion' THEN
      UPDATE public.cotizaciones
         SET estado_revalidacion='reaprobada', revalidacion_resuelta_en=now(), updated_at=now()
       WHERE id=p_cotizacion_id;
    END IF;

    INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
      SELECT v_cot.organization_id, auth.uid(),
        COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
        'Embarques','tarifa_decision_aplicada', v_embarque_id, v_cot.folio,
        jsonb_build_object('decision',p_decision,
          'tarifa_id_original',v_cot.tarifa_id,
          'tarifa_id_aplicada',COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
          'delta',p_delta_jsonb);
  END IF;

  RETURN v_embarque_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb) TO authenticated, service_role;

-- ============================================================================
-- Ola 1 · Auditoría v14 — C-1 (doble IVA cotización→embarque) y
-- C-2 / A-10 / M-6 (snapshots de auditoría).
-- ============================================================================

-- ── C-1 ─────────────────────────────────────────────────────────────────────
-- El JSONB `cotizaciones.conceptos_venta[].total` se persiste CON IVA (canon
-- de la cotización, usado por PDF y listados). Al replicar al embarque, el
-- importe debe ser la BASE gravable: total = ROUND(cantidad × precio_unitario).
-- Nunca reescribir `precio_unitario` a partir de `total` (inflaba el unitario
-- con IVA y la proforma volvía a aplicar IVA sobre esa base).
CREATE OR REPLACE FUNCTION public._crear_embarque_replicar_conceptos(p_cotizacion_id uuid, p_embarque_id uuid, p_org uuid, p_target_ids uuid[], p_conceptos_venta jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $$
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
  v_acum  numeric;
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
      INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, proveedor_id, organization_id)
      VALUES (p_embarque_id, NULL, v_costo.concepto, v_base,
              CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
              v_prov_nombre, v_prov_id, p_org);
    ELSE
      -- Prorrateo: el importe total se reparte entre contenedores; el ajuste
      -- de centavos se aplica al último para que la suma cuadre exacto.
      v_parte := ROUND(v_base / v_n::numeric, 2);
      v_acum  := 0;
      v_i     := 0;
      FOREACH v_cid IN ARRAY p_target_ids LOOP
        v_i := v_i + 1;
        IF v_i = v_n THEN
          v_parte := ROUND(v_base - v_acum, 2);
        END IF;
        v_acum := v_acum + v_parte;
        INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, proveedor_id, organization_id)
        VALUES (p_embarque_id, v_cid, v_costo.concepto, v_parte,
                CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                v_prov_nombre, v_prov_id, p_org);
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(p_conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        v_cant := GREATEST(COALESCE((v_venta->>'cantidad')::numeric, 1), 1);
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
$$;

REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;

-- ── C-2 / A-10 / M-6 ────────────────────────────────────────────────────────
-- C-2: el cron corre con service_role (auth.uid() NULL) → el guard rechazaba
--      TODAS las orgs y nunca se capturaba snapshot.
-- A-10: los contadores dependían de current_user_org_id() = p_organization_id
--      → ceros y score=100 ficticio para service_role / multi-org.
-- M-6: `total_pendientes` contaba filas de auditoria_revisiones (sólo existen
--      tras interacción humana), `por_regla` era '{}' y el score usaba una
--      fórmula distinta a la de la pantalla ejecutiva (higiene: 100 - suma*2,
--      pesos critico=5 alto=2 medio=1 sobre hallazgos PENDIENTES).
CREATE OR REPLACE FUNCTION public.auditoria_capturar_snapshot(p_organization_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE
  v_reporte jsonb;
  v_total int := 0;
  v_pend  int := 0;
  v_crit  int := 0;
  v_alto  int := 0;
  v_med   int := 0;
  v_suma  int := 0;
  v_score int := 100;
  v_por_regla jsonb := '{}'::jsonb;
  v_id uuid;
BEGIN
  IF NOT (
    COALESCE(auth.role(), '') = 'service_role'
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR is_org_admin(auth.uid(), p_organization_id)
    OR has_org_role(auth.uid(), p_organization_id, 'admin'::app_role)
    OR has_org_role(auth.uid(), p_organization_id, 'operador'::app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado para capturar snapshot de esta organización';
  END IF;

  -- A-10: siempre por la org objetivo (la RPC ya es SECURITY DEFINER).
  v_reporte := public.auditoria_embarques_org(p_organization_id);
  v_total := COALESCE((v_reporte->>'total_hallazgos')::int, 0);

  -- M-6: pendientes = hallazgos sin revisión registrada (misma llave que el
  -- frontend: embarque_id + regla + detalle).
  WITH hallazgos AS (
    SELECT je.value AS j
      FROM jsonb_array_elements(COALESCE(v_reporte->'hallazgos', '[]'::jsonb)) je
  ), pendientes AS (
    SELECT h.j
      FROM hallazgos h
     WHERE NOT EXISTS (
       SELECT 1
         FROM public.auditoria_revisiones r
        WHERE r.organization_id = p_organization_id
          AND r.embarque_id = (h.j->>'embarque_id')::uuid
          AND r.regla = (h.j->>'regla')
          AND r.detalle = (h.j->>'detalle')
     )
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE j->>'severidad' = 'critico')::int,
    COUNT(*) FILTER (WHERE j->>'severidad' = 'alto')::int,
    COUNT(*) FILTER (WHERE j->>'severidad' = 'medio')::int,
    COALESCE(jsonb_object_agg(regla, cnt) FILTER (WHERE regla IS NOT NULL), '{}'::jsonb)
    INTO v_pend, v_crit, v_alto, v_med, v_por_regla
    FROM (
      SELECT p.j,
             (p.j->>'regla') AS regla,
             COUNT(*) OVER (PARTITION BY (p.j->>'regla'))::int AS cnt
        FROM pendientes p
    ) x;

  -- Higiene (espejo de `calcularScore` con riesgoMxn = 0).
  v_suma := v_crit * 5 + v_alto * 2 + v_med * 1;
  IF v_pend = 0 THEN
    v_score := 100;
  ELSE
    v_score := GREATEST(0, 100 - LEAST(100, v_suma * 2));
  END IF;

  INSERT INTO auditoria_snapshots (
    organization_id, fecha, total_hallazgos, total_pendientes,
    criticos, altos, medios, score, por_regla
  ) VALUES (
    p_organization_id, CURRENT_DATE, v_total, GREATEST(0, v_pend),
    v_crit, v_alto, v_med, v_score, COALESCE(v_por_regla, '{}'::jsonb)
  )
  ON CONFLICT (organization_id, fecha) DO UPDATE SET
    total_hallazgos  = EXCLUDED.total_hallazgos,
    total_pendientes = EXCLUDED.total_pendientes,
    criticos = EXCLUDED.criticos,
    altos    = EXCLUDED.altos,
    medios   = EXCLUDED.medios,
    score    = EXCLUDED.score,
    por_regla = EXCLUDED.por_regla
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.auditoria_capturar_snapshot(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auditoria_capturar_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_capturar_snapshot(uuid) TO service_role;
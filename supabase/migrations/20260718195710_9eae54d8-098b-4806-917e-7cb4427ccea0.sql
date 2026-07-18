-- Fase C — cierre auditoría cadena de facturación (v13.301.71)
-- Bug 3: sibling-alive check al eliminar borrador
-- H7: reemplazar bitacora_actividad por conceptos_factura.proforma_id_origen

CREATE OR REPLACE FUNCTION public.eliminar_factura_borrador(p_factura_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_factura                public.facturas;
  v_caller_org             uuid;
  v_candidatas             uuid[] := ARRAY[]::uuid[];
  v_revertidas             uuid[] := ARRAY[]::uuid[];
  v_conservadas            uuid[] := ARRAY[]::uuid[];
  v_pid                    uuid;
  v_tiene_hermano_vivo     boolean;
BEGIN
  IF p_factura_id IS NULL THEN
    RAISE EXCEPTION 'factura_id es obligatorio';
  END IF;

  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_factura.estado <> 'Borrador'::estado_factura THEN
    RAISE EXCEPTION 'Sólo se pueden eliminar facturas en estado Borrador (estado actual: %)', v_factura.estado;
  END IF;
  IF v_factura.facturapi_id IS NOT NULL OR v_factura.uuid_fiscal IS NOT NULL THEN
    RAISE EXCEPTION 'La factura ya fue timbrada y no puede eliminarse';
  END IF;

  v_caller_org := public.current_user_org_id();
  IF NOT (public.has_role(auth.uid(), 'admin_org'::app_role)
          OR public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar borradores de factura';
  END IF;
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_factura.organization_id <> v_caller_org THEN
    RAISE EXCEPTION 'No puedes eliminar borradores de otra organización';
  END IF;
  PERFORM public._assert_writer(v_factura.organization_id);

  -- Fuente 1: link directo (proformas.factura_id) — reservado a futuro.
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_candidatas
  FROM public.proformas
  WHERE factura_id = p_factura_id;

  -- Fuente 2: link inverso (facturas.proforma_id) — caso 1:1.
  IF v_factura.proforma_id IS NOT NULL THEN
    v_candidatas := array(SELECT DISTINCT unnest(v_candidatas || ARRAY[v_factura.proforma_id]));
  END IF;

  -- Fuente 3 (H7): conceptos_factura.proforma_id_origen — fuente autoritativa
  -- para borradores consolidados. Reemplaza la lectura previa de bitacora_actividad,
  -- que era un log de auditoría inmutable, no una fuente de verdad.
  v_candidatas := array(
    SELECT DISTINCT x
    FROM unnest(
      v_candidatas || COALESCE(
        (
          SELECT array_agg(DISTINCT cf.proforma_id_origen)
          FROM public.conceptos_factura cf
          WHERE cf.factura_id = p_factura_id
            AND cf.proforma_id_origen IS NOT NULL
            AND cf.deleted_at IS NULL
        ),
        ARRAY[]::uuid[]
      )
    ) AS t(x)
    WHERE x IS NOT NULL
  );

  -- Bug 3: sibling-alive check por proforma.
  -- Sólo revertimos las que NO tienen otra factura viva consumiéndolas
  -- (directamente vía facturas.proforma_id o vía conceptos_factura.proforma_id_origen).
  IF array_length(v_candidatas, 1) IS NOT NULL THEN
    FOREACH v_pid IN ARRAY v_candidatas LOOP
      SELECT EXISTS (
        SELECT 1
        FROM public.facturas f
        WHERE f.id <> p_factura_id
          AND f.deleted_at IS NULL
          AND f.estado NOT IN ('Cancelada'::estado_factura, 'Sustituida'::estado_factura)
          AND (
            f.proforma_id = v_pid
            OR EXISTS (
              SELECT 1
              FROM public.conceptos_factura cf
              WHERE cf.factura_id = f.id
                AND cf.proforma_id_origen = v_pid
                AND cf.deleted_at IS NULL
            )
          )
      ) INTO v_tiene_hermano_vivo;

      IF v_tiene_hermano_vivo THEN
        v_conservadas := v_conservadas || v_pid;
      ELSE
        v_revertidas := v_revertidas || v_pid;
      END IF;
    END LOOP;
  END IF;

  IF array_length(v_revertidas, 1) IS NOT NULL THEN
    UPDATE public.proformas
       SET factura_id        = NULL,
           estado_proforma   = 'pendiente',
           fecha_facturacion = NULL,
           updated_at        = now()
     WHERE id = ANY(v_revertidas);
  END IF;

  DELETE FROM public.conceptos_factura WHERE factura_id = p_factura_id;
  DELETE FROM public.facturas WHERE id = p_factura_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  )
  VALUES (
    v_factura.organization_id, auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'factura.borrador_eliminado', 'facturacion', p_factura_id, v_factura.numero,
    jsonb_build_object(
      'proformas_revertidas', v_revertidas,
      'proformas_conservadas_por_sibling', v_conservadas,
      'origen', v_factura.origen
    )
  );
END $function$;

-- Backfill idempotente: sanea 42 proformas históricas huérfanas.
DO $$
DECLARE
  v_remanente integer;
BEGIN
  UPDATE public.proformas p
     SET estado_proforma = 'pendiente',
         factura_id = NULL,
         fecha_facturacion = NULL,
         updated_at = now()
   WHERE p.estado_proforma = 'facturada'
     AND (p.estado_revision IS DISTINCT FROM 'consolidada')
     AND NOT EXISTS (
       SELECT 1 FROM public.facturas f
        WHERE f.deleted_at IS NULL
          AND f.estado NOT IN ('Cancelada'::estado_factura, 'Sustituida'::estado_factura)
          AND (
            f.proforma_id = p.id
            OR EXISTS (
              SELECT 1 FROM public.conceptos_factura cf
               WHERE cf.factura_id = f.id
                 AND cf.proforma_id_origen = p.id
                 AND cf.deleted_at IS NULL
            )
          )
     );

  SELECT count(*) INTO v_remanente
  FROM public.proformas p
  WHERE p.estado_proforma = 'facturada'
    AND (p.estado_revision IS DISTINCT FROM 'consolidada')
    AND NOT EXISTS (
      SELECT 1 FROM public.facturas f
       WHERE f.deleted_at IS NULL
         AND f.estado NOT IN ('Cancelada'::estado_factura, 'Sustituida'::estado_factura)
         AND (
           f.proforma_id = p.id
           OR EXISTS (
             SELECT 1 FROM public.conceptos_factura cf
              WHERE cf.factura_id = f.id
                AND cf.proforma_id_origen = p.id
                AND cf.deleted_at IS NULL
           )
         )
    );

  RAISE NOTICE 'Fase C backfill — proformas huérfanas remanentes: %', v_remanente;
END $$;
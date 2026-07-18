-- v13.301.70 · Fase B — Bug 1: cancelación multi-proforma libera N proformas.
-- Antes: la RPC leía facturas.proforma_id (NULL para facturas multi-proforma)
-- y retornaba temprano sin liberar nada.
-- Ahora: resuelve desde facturas.proforma_id + conceptos_factura.proforma_id_origen
-- + proformas.proformas_origen (consolidadas). Libera cada proforma sólo si
-- ninguna factura viva la consume (directa o vía conceptos).

DROP FUNCTION IF EXISTS public.revertir_proforma_al_cancelar_sustitucion(uuid);

CREATE OR REPLACE FUNCTION public.revertir_proforma_al_cancelar_sustitucion(
  p_factura_id uuid
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura        public.facturas%ROWTYPE;
  v_ids            uuid[] := ARRAY[]::uuid[];
  v_liberadas      uuid[] := ARRAY[]::uuid[];
  v_id             uuid;
  v_facturas_vivas int;
BEGIN
  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN
    RETURN v_liberadas;
  END IF;

  -- Fuente 1: link 1:1 directo.
  IF v_factura.proforma_id IS NOT NULL THEN
    v_ids := array_append(v_ids, v_factura.proforma_id);

    -- Fuente 3: si el link apunta a una consolidada, expandir a sus orígenes
    -- para no dejar las proformas fuente marcadas como facturadas.
    v_ids := v_ids || COALESCE(
      (SELECT proformas_origen FROM public.proformas
        WHERE id = v_factura.proforma_id AND es_consolidada = true),
      ARRAY[]::uuid[]
    );
  END IF;

  -- Fuente 2: multi-proforma vía conceptos.
  v_ids := v_ids || COALESCE(
    (SELECT array_agg(DISTINCT proforma_id_origen)
       FROM public.conceptos_factura
      WHERE factura_id = p_factura_id
        AND deleted_at IS NULL
        AND proforma_id_origen IS NOT NULL),
    ARRAY[]::uuid[]
  );

  -- Dedup y filtrar NULLs.
  v_ids := array(
    SELECT DISTINCT x FROM unnest(v_ids) AS x WHERE x IS NOT NULL
  );

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN v_liberadas;
  END IF;

  -- Por cada id, liberar sólo si ninguna otra factura viva la consume.
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT count(*) INTO v_facturas_vivas
    FROM public.facturas f
    WHERE f.estado NOT IN ('Cancelada','Sustituida','Borrador')
      AND f.id <> p_factura_id
      AND (
        f.proforma_id = v_id
        OR EXISTS (
          SELECT 1 FROM public.conceptos_factura cf
           WHERE cf.factura_id = f.id
             AND cf.deleted_at IS NULL
             AND cf.proforma_id_origen = v_id
        )
      );

    IF v_facturas_vivas = 0 THEN
      UPDATE public.proformas
         SET estado_proforma   = 'pendiente',
             fecha_facturacion = NULL,
             updated_at        = now()
       WHERE id = v_id
         AND estado_proforma = 'facturada';

      IF FOUND THEN
        v_liberadas := array_append(v_liberadas, v_id);
        INSERT INTO public.bitacora_actividad (
          organization_id, usuario_id, usuario_email,
          accion, modulo, entidad_id, entidad_nombre, detalles
        ) VALUES (
          v_factura.organization_id,
          auth.uid(),
          COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
          'proforma_liberada_por_cancelacion',
          'proformas',
          v_id, '',
          jsonb_build_object('factura_id', p_factura_id, 'multi_proforma',
            v_factura.proforma_id IS NULL)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_liberadas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revertir_proforma_al_cancelar_sustitucion(uuid)
  TO authenticated, service_role;

-- Backfill idempotente: recorrer facturas ya canceladas/sustituidas y liberar
-- proformas que hayan quedado colgadas por el bug histórico.
DO $$
DECLARE
  r record;
  v_liberadas uuid[];
  v_total int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.facturas
    WHERE estado IN ('Cancelada','Sustituida')
  LOOP
    v_liberadas := public.revertir_proforma_al_cancelar_sustitucion(r.id);
    v_total := v_total + COALESCE(array_length(v_liberadas, 1), 0);
  END LOOP;
  RAISE NOTICE 'v13.301.70 backfill: proformas liberadas por barrido histórico = %', v_total;
END;
$$;

-- Marcador para guardrail: revincular_proformas_backfill
-- Reconciliación idempotente 1:1 sobre proformas del backfill Fase C.

DO $$
DECLARE
  v_par record;
  v_aplicados int := 0;
  v_descartados int := 0;
  v_motivo text;
  v_system_user uuid := 'f7d122d2-0926-48c0-99ed-092b587d9b3c';
  v_system_email text := 'system@backfill-fase-c';
BEGIN
  PERFORM set_config('app.bypass_cierre', 'true', true);

  FOR v_par IN
    WITH bf AS (
      SELECT id, numero, embarque_id, organization_id
      FROM public.proformas
      WHERE estado_proforma = 'pendiente'
        AND updated_at > now() - interval '24 hours'
        AND embarque_id IS NOT NULL
    ),
    facturas_vivas AS (
      SELECT DISTINCT ON (f.id)
        f.id AS factura_id,
        f.numero AS factura_numero,
        f.proforma_id AS factura_proforma_id,
        fe.embarque_id,
        f.organization_id
      FROM public.facturas f
      JOIN public.factura_embarques fe ON fe.factura_id = f.id
      WHERE f.estado::text NOT IN ('Cancelada', 'Sustituida')
        AND f.cancellation_status IS NULL
    ),
    conteo_embarque AS (
      SELECT
        bf.embarque_id,
        count(DISTINCT bf.id) AS n_proformas_backfill,
        count(DISTINCT fv.factura_id) AS n_facturas_vivas
      FROM bf
      LEFT JOIN facturas_vivas fv ON fv.embarque_id = bf.embarque_id
      GROUP BY bf.embarque_id
    ),
    pares_1a1 AS (
      SELECT
        bf.id AS proforma_id,
        bf.numero AS proforma_numero,
        bf.embarque_id,
        bf.organization_id,
        fv.factura_id,
        fv.factura_numero,
        fv.factura_proforma_id
      FROM bf
      JOIN facturas_vivas fv ON fv.embarque_id = bf.embarque_id
      JOIN conteo_embarque ce ON ce.embarque_id = bf.embarque_id
      WHERE ce.n_proformas_backfill = 1
        AND ce.n_facturas_vivas = 1
    )
    SELECT * FROM pares_1a1
  LOOP
    IF v_par.factura_proforma_id IS NOT NULL THEN
      v_motivo := 'factura_ya_vinculada_a_' || v_par.factura_proforma_id::text;
      v_descartados := v_descartados + 1;

      INSERT INTO public.bitacora_actividad (
        usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id
      ) VALUES (
        v_system_user, v_system_email,
        'revincular_proforma_backfill_descartado',
        'facturacion',
        v_par.proforma_id,
        v_par.proforma_numero,
        jsonb_build_object(
          'proforma_id', v_par.proforma_id,
          'proforma_numero', v_par.proforma_numero,
          'factura_id', v_par.factura_id,
          'factura_numero', v_par.factura_numero,
          'embarque_id', v_par.embarque_id,
          'motivo', v_motivo
        ),
        v_par.organization_id
      );

      CONTINUE;
    END IF;

    UPDATE public.facturas
    SET proforma_id = v_par.proforma_id
    WHERE id = v_par.factura_id
      AND proforma_id IS NULL;

    UPDATE public.proformas
    SET estado_proforma = 'facturada'
    WHERE id = v_par.proforma_id
      AND estado_proforma = 'pendiente';

    v_aplicados := v_aplicados + 1;

    INSERT INTO public.bitacora_actividad (
      usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id
    ) VALUES (
      v_system_user, v_system_email,
      'revincular_proforma_backfill',
      'facturacion',
      v_par.proforma_id,
      v_par.proforma_numero,
      jsonb_build_object(
        'proforma_id', v_par.proforma_id,
        'proforma_numero', v_par.proforma_numero,
        'factura_id', v_par.factura_id,
        'factura_numero', v_par.factura_numero,
        'embarque_id', v_par.embarque_id,
        'regla', 'unico_par_1a1_en_embarque'
      ),
      v_par.organization_id
    );
  END LOOP;

  RAISE NOTICE 'revincular_proformas_backfill: aplicados=%, descartados=%',
    v_aplicados, v_descartados;
END $$;

-- AUD-F03/F04: preservar impuestos globales al editar y alinear aprobación con captura.
-- No hay backfill ni modificación de facturas existentes.
BEGIN;

DROP FUNCTION IF EXISTS public.reemplazar_conceptos_factura_proveedor(uuid, jsonb);

-- v13.628.0 — Edición de conceptos en facturas de proveedor capturadas a mano.
-- v13.646.0 (BUG-02, auditoría 2026-08-18): recalcula la cabecera (subtotal,
-- IVA, retenciones, total) a partir de los conceptos reemplazados.
-- v13.823.303: la cabecera se calcula SÓLO con el desglose fiscal del proveedor;
-- los renglones de vínculo (concepto_costo_id NOT NULL) duplicaban el total.
-- Espejo canónico; actualizar en el mismo PR que la migración.

CREATE OR REPLACE FUNCTION public.reemplazar_conceptos_factura_proveedor(
  p_factura_id uuid,
  p_conceptos jsonb,
  p_impuestos_no_desglosados jsonb DEFAULT NULL::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_f public.proveedor_facturas%ROWTYPE;
  v_pagado numeric := 0;
  v_insertados int := 0;
  v_subtotal numeric := 0;
  v_iva numeric := 0;
  v_ieps numeric := 0;
  v_fiscales int := 0;
  v_iva_global numeric;
  v_ieps_global numeric;
BEGIN
  SELECT * INTO v_f FROM public.proveedor_facturas
   WHERE id = p_factura_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_NOT_FOUND: la factura no existe' USING ERRCODE = 'P0002';
  END IF;
  IF v_f.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_ELIMINADA: la factura está en la papelera' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_org_member(v_f.organization_id)
     AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: factura de otra organización' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')
          OR public.has_role(auth.uid(), 'admin_org')
          OR public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'tesorero')) THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_FORBIDDEN: sin permiso para editar los conceptos de la factura'
      USING ERRCODE = '42501';
  END IF;

  IF v_f.uuid_fiscal IS NOT NULL OR v_f.archivo_xml_url IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_FISCALES: los conceptos vienen del XML del CFDI; vuelve a adjuntar el XML para cambiarlos'
      USING ERRCODE = '22023';
  END IF;

  IF v_f.estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_FACTURA_CANCELADA: la factura está cancelada' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;
  IF v_pagado > 0 THEN
    RAISE EXCEPTION 'LC_FACTURA_CON_PAGOS: la factura tiene pagos aplicados por %; elimina los pagos antes de editar los conceptos', v_pagado
      USING ERRCODE = '22023';
  END IF;

  -- La captura histórica admite impuestos globales sin distribución por partida.
  -- No convertir un cambio de descripción en una reducción de la deuda.
  -- El parámetro explícito permite distribuirlos o corregirlos conscientemente.
  SELECT ROUND(COALESCE(v_f.iva, 0) - COALESCE(SUM(iva), 0), 2),
         ROUND(COALESCE(v_f.ieps, 0) - COALESCE(SUM(ieps), 0), 2)
    INTO v_iva_global, v_ieps_global
    FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL;

  IF p_impuestos_no_desglosados IS NOT NULL THEN
    IF jsonb_typeof(p_impuestos_no_desglosados) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_impuestos_no_desglosados->'iva') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_impuestos_no_desglosados->'ieps') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'LC_CONCEPTOS_IMPUESTOS: indica IVA e IEPS globales como importes numéricos'
        USING ERRCODE = '22023';
    END IF;
    v_iva_global := ROUND((p_impuestos_no_desglosados->>'iva')::numeric, 2);
    v_ieps_global := ROUND((p_impuestos_no_desglosados->>'ieps')::numeric, 2);
    IF v_iva_global < 0 OR v_ieps_global < 0 THEN
      RAISE EXCEPTION 'LC_CONCEPTOS_IMPUESTOS: los impuestos globales no pueden ser negativos'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  DELETE FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id
     AND concepto_costo_id IS NULL;

  INSERT INTO public.proveedor_facturas_conceptos
    (proveedor_factura_id, organization_id, concepto_costo_id,
     descripcion, cantidad, clave_unidad, monto, iva, ieps)
  SELECT p_factura_id,
         v_f.organization_id,
         NULL,
         COALESCE(NULLIF(btrim(x->>'descripcion'), ''), '(Sin descripción)'),
         COALESCE(NULLIF(x->>'cantidad', '')::numeric, 1),
         NULLIF(btrim(COALESCE(x->>'clave_unidad', '')), ''),
         COALESCE(NULLIF(x->>'monto', '')::numeric, 0),
         COALESCE(NULLIF(x->>'iva', '')::numeric, 0),
         COALESCE(NULLIF(x->>'ieps', '')::numeric, 0)
    FROM jsonb_array_elements(COALESCE(p_conceptos, '[]'::jsonb)) AS x;
  GET DIAGNOSTICS v_insertados = ROW_COUNT;

  -- BUG-02 (auditoría 2026-08-18): la cabecera debe cuadrar con sus renglones.
  -- v13.823.191: el importe es UNITARIO, así que el subtotal es Σ monto × cantidad.
  -- v13.823.303: sólo el desglose fiscal del proveedor (concepto_costo_id IS NULL);
  -- los renglones de vínculo con conceptos_costo NO son cargos y duplicaban el total.
  -- Alineado con `_cxp_validar_aprobacion`, que ya suma sólo el desglose fiscal.
  SELECT COUNT(*) INTO v_fiscales
    FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id
     AND concepto_costo_id IS NULL;

  SELECT COALESCE(SUM(monto * COALESCE(NULLIF(cantidad, 0), 1)), 0),
         COALESCE(SUM(iva) FILTER (WHERE concepto_costo_id IS NULL), 0) + v_iva_global,
         COALESCE(SUM(ieps) FILTER (WHERE concepto_costo_id IS NULL), 0) + v_ieps_global
    INTO v_subtotal, v_iva, v_ieps
    FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id
     AND (v_fiscales = 0 OR concepto_costo_id IS NULL);

  IF v_iva < 0 OR v_ieps < 0 THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_IMPUESTOS: el desglose produciría impuestos negativos; revisa los importes globales'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.proveedor_facturas
     SET subtotal = ROUND(v_subtotal, 2),
         iva      = ROUND(v_iva, 2),
         ieps     = ROUND(v_ieps, 2),
         estado_aprobacion = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN 'pendiente'::public.estado_aprobacion_factura_proveedor
           ELSE estado_aprobacion END,
         aprobada_por = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN NULL ELSE aprobada_por END,
         aprobada_at = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN NULL ELSE aprobada_at END,
         updated_at = now()
   WHERE id = p_factura_id;

  RETURN v_insertados;
END;
$$;

REVOKE ALL ON FUNCTION public.reemplazar_conceptos_factura_proveedor(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reemplazar_conceptos_factura_proveedor(uuid, jsonb, jsonb) TO authenticated, service_role;

-- Espejo canónico de public._cxp_validar_aprobacion
-- Fuente vigente: 20260927040000_cxp_impuestos_globales_y_base_iva.sql
-- Vigilado por `bun run audit:replay-mirror` y `audit:schema-functions`.
-- Ola E1 · N-F3: sin T/C válido la factura extranjera sin vínculo NO se valúa
-- 1:1 contra el umbral; se bloquea con LC_CXP_TC_REQUERIDO.
-- FP-000221: los gastos cuya categoría no es CostoDirectoEmbarque (Administracion /
-- Venta) quedan exentos del umbral y del vínculo a embarque; sólo se les exige
-- justificación del gasto.

CREATE OR REPLACE FUNCTION public._cxp_validar_aprobacion(p_factura_id uuid, p_justificacion text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_conceptos_count integer;
  v_suma_conceptos numeric(18,4);
  v_suma_cantidades numeric(18,4);
  v_tolerancia numeric(18,4);
  v_diferencia numeric(18,4);
  v_emb_estado text;
  v_emb_org uuid;
  v_origen text;
  v_tiene_xml_lineas boolean;
  v_total_mxn numeric(18,4);
  v_umbral numeric;
  v_tipo_contable text;
  v_iva_max numeric(18,4);
  v_c record;
  v_comprometido numeric(18,4);
  v_facturado numeric(18,4);
  v_moneda_cmp text;
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_factura_id;
  IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: La factura no existe.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL
  ) INTO v_tiene_xml_lineas;

  IF v_tiene_xml_lineas THEN
    SELECT COUNT(*),
           COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0),
           COALESCE(SUM(COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos, v_suma_cantidades
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id
        AND concepto_costo_id IS NULL;
  ELSE
    SELECT COUNT(*),
           COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0),
           COALESCE(SUM(COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos, v_suma_cantidades
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id;
  END IF;

  IF v_conceptos_count = 0 THEN
    RAISE EXCEPTION 'LC_CXP_SIN_CONCEPTOS: Captura los conceptos de la factura antes de aprobar.';
  END IF;

  v_tolerancia := GREATEST(0.01, 0.005 * COALESCE(v_suma_cantidades,0));

  v_diferencia := ABS(COALESCE(v_row.subtotal,0) - v_suma_conceptos);
  IF v_diferencia > v_tolerancia THEN
    RAISE EXCEPTION 'LC_CXP_DESCUADRE: Los conceptos (%) no cuadran con el subtotal (%) de la factura. Diferencia: % (tolerancia: %)',
      to_char(v_suma_conceptos,          'FM999,999,999,990.00'),
      to_char(COALESCE(v_row.subtotal,0),'FM999,999,999,990.00'),
      to_char(v_diferencia,              'FM999,999,999,990.00'),
      to_char(v_tolerancia,              'FM999,999,999,990.00');
  END IF;

  -- FP-000256: "IVA fantasma". El total se deriva de subtotal + IVA + IEPS −
  -- retenciones, así que un IVA imposible (50 sobre un subtotal de 60) infla la
  -- factura sin ningún renglón que lo respalde. Paridad con ivaPlausible.ts:
  -- incluir el IEPS declarado en la base, sin aflojar el tope ni su tolerancia.
  v_iva_max := (GREATEST(COALESCE(v_row.subtotal,0),0) + GREATEST(COALESCE(v_row.ieps,0),0)) * 0.16 + 0.02;
  IF COALESCE(v_row.iva,0) > v_iva_max THEN
    RAISE EXCEPTION 'LC_CXP_IVA_IMPLAUSIBLE: El IVA capturado (%) es mayor al 16%% de la base subtotal más IEPS (%). Corrige el IVA de la factura antes de aprobar; el máximo aceptable es %.',
      to_char(COALESCE(v_row.iva,0),      'FM999,999,999,990.00'),
      to_char(GREATEST(COALESCE(v_row.subtotal,0),0) + GREATEST(COALESCE(v_row.ieps,0),0), 'FM999,999,999,990.00'),
      to_char(v_iva_max,                  'FM999,999,999,990.00');
  END IF;

  -- Tope de sobrecosto POR CONCEPTO, sumando todas las facturas vivas ligadas
  -- a ese concepto.
  --
  -- FP-000256 (v13.823.301): cuando el costo comprometido y TODAS las facturas
  -- ligadas están en la misma moneda, la comparación se hace en esa moneda sin
  -- convertir. Antes se convertían ambos lados a MXN con tipos de cambio
  -- distintos (el del expediente para el costo, el de la factura para lo
  -- facturado), lo que fabricaba un "sobrecosto" que era puro efecto cambiario
  -- (60 USD vs 60 USD → 1,039.90 MXN vs 1,168.29 MXN). Sólo cuando hay mezcla
  -- de monedas se usa la ruta MXN (incluido LC_CXP_SIN_TC si falta T/C).
  FOR v_c IN
    SELECT cc.id,
           cc.concepto,
           cc.moneda::text AS moneda_costo,
           cc.monto        AS comprometido_orig,
           public.a_mxn_doc(cc.monto, cc.moneda::text, v_row.fecha_emision,
                            NULL, emb.tipo_cambio_usd) AS comprometido_mxn,
           (
             SELECT COALESCE(SUM(
                      public.a_mxn_doc(p2.monto * COALESCE(NULLIF(p2.cantidad,0),1),
                                       pf2.moneda::text, pf2.fecha_emision,
                                       pf2.tipo_cambio_usd, emb.tipo_cambio_usd)
                    ), 0)
               FROM public.proveedor_facturas_conceptos p2
               JOIN public.proveedor_facturas pf2 ON pf2.id = p2.proveedor_factura_id
              WHERE p2.concepto_costo_id = cc.id
                AND pf2.deleted_at IS NULL
                AND pf2.estado <> 'Cancelada'::public.estado_proveedor_factura
                AND COALESCE(pf2.estado_aprobacion::text, 'pendiente') <> 'rechazada'
           ) AS facturado_mxn,
           (
             SELECT COALESCE(SUM(p2.monto * COALESCE(NULLIF(p2.cantidad,0),1)), 0)
               FROM public.proveedor_facturas_conceptos p2
               JOIN public.proveedor_facturas pf2 ON pf2.id = p2.proveedor_factura_id
              WHERE p2.concepto_costo_id = cc.id
                AND pf2.deleted_at IS NULL
                AND pf2.estado <> 'Cancelada'::public.estado_proveedor_factura
                AND COALESCE(pf2.estado_aprobacion::text, 'pendiente') <> 'rechazada'
           ) AS facturado_orig,
           NOT EXISTS (
             SELECT 1
               FROM public.proveedor_facturas_conceptos p2
               JOIN public.proveedor_facturas pf2 ON pf2.id = p2.proveedor_factura_id
              WHERE p2.concepto_costo_id = cc.id
                AND pf2.deleted_at IS NULL
                AND pf2.estado <> 'Cancelada'::public.estado_proveedor_factura
                AND COALESCE(pf2.estado_aprobacion::text, 'pendiente') <> 'rechazada'
                AND pf2.moneda::text IS DISTINCT FROM cc.moneda::text
           ) AS misma_moneda
      FROM public.proveedor_facturas_conceptos pfc
      JOIN public.conceptos_costo cc
        ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
      LEFT JOIN public.embarques emb ON emb.id = cc.embarque_id
     WHERE pfc.proveedor_factura_id = p_factura_id
       AND pfc.concepto_costo_id IS NOT NULL
     GROUP BY cc.id, cc.concepto, cc.monto, cc.moneda, emb.tipo_cambio_usd
  LOOP
    IF v_c.misma_moneda THEN
      v_comprometido := v_c.comprometido_orig;
      v_facturado    := v_c.facturado_orig;
      v_moneda_cmp   := v_c.moneda_costo;
    ELSE
      IF v_c.comprometido_mxn IS NULL THEN
        RAISE WARNING 'LC_CXP_SIN_TC: el concepto "%" no tiene tipo de cambio para comparar; se omite el control de sobrecosto.', v_c.concepto;
        CONTINUE;
      END IF;
      v_comprometido := v_c.comprometido_mxn;
      v_facturado    := v_c.facturado_mxn;
      v_moneda_cmp   := 'MXN';
    END IF;

    IF v_facturado - v_comprometido > 0.02
       AND v_comprometido > 0
       AND (v_facturado - v_comprometido) > v_comprometido * 0.05 THEN
      RAISE EXCEPTION 'LC_CXP_SOBRECOSTO: el concepto "%" ya tiene facturado % % contra % % comprometidos (incluyendo otras facturas del mismo costo). Revisa la vinculación antes de aprobar.',
        v_c.concepto,
        to_char(v_facturado,    'FM999,999,999,990.00'), v_moneda_cmp,
        to_char(v_comprometido, 'FM999,999,999,990.00'), v_moneda_cmp;
    ELSIF v_facturado - v_comprometido > 0.02 THEN
      RAISE WARNING 'LC_CXP_SOBRECOSTO: el concepto "%" excede lo comprometido en % % (<= 5%%, se aprueba con advertencia).',
        v_c.concepto,
        to_char(v_facturado - v_comprometido, 'FM999,999,999,990.00'), v_moneda_cmp;
    END IF;
  END LOOP;

  IF v_row.embarque_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.proveedor_facturas_conceptos
        WHERE proveedor_factura_id = p_factura_id
          AND concepto_costo_id IS NOT NULL
     )
  THEN
    SELECT pc.tipo_contable::text INTO v_tipo_contable
      FROM public.presupuesto_categorias pc
     WHERE pc.id = v_row.categoria_presupuesto_id;

    IF COALESCE(v_tipo_contable, 'CostoDirectoEmbarque') = 'CostoDirectoEmbarque' THEN
      IF v_row.moneda = 'MXN'::public.moneda THEN
        v_total_mxn := COALESCE(v_row.total,0);
      ELSE
        IF COALESCE(NULLIF(v_row.tipo_cambio_usd,0), 0) <= 0 THEN
          RAISE EXCEPTION 'LC_CXP_TC_REQUERIDO: la factura está en % y no tiene tipo de cambio capturado; registra el T/C del DOF de la fecha de la factura antes de aprobar.',
            v_row.moneda;
        END IF;
        v_total_mxn := COALESCE(v_row.total,0) * v_row.tipo_cambio_usd;
      END IF;

      v_umbral := public.cxp_umbral_sin_vinculo(v_row.organization_id);

      IF v_total_mxn > v_umbral THEN
        RAISE EXCEPTION 'LC_CXP_SIN_RESPALDO_MONTO: La factura por % MXN no está ligada a un embarque ni a costos acordados y excede el umbral autorizado (%). Vincúlala al embarque o a sus conceptos de costo antes de aprobar.',
          to_char(v_total_mxn, 'FM999,999,999,990.00'),
          to_char(v_umbral,    'FM999,999,999,990.00');
      END IF;
    END IF;

    IF length(COALESCE(btrim(p_justificacion), '')) < 10 THEN
      RAISE EXCEPTION 'LC_CXP_SIN_RESPALDO: Esta factura no está ligada a un embarque ni a costos acordados. Escribe la justificación del gasto (mínimo 10 caracteres) para aprobarla.';
    END IF;
  END IF;

  IF v_row.embarque_id IS NOT NULL THEN
    SELECT estado, organization_id INTO v_emb_estado, v_emb_org
      FROM public.embarques WHERE id = v_row.embarque_id;
    IF v_emb_estado IS NULL THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_NO_EXISTE: El embarque asociado no existe.';
    END IF;
    IF v_emb_estado = 'Cancelado' THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_CANCELADO: El embarque asociado está cancelado.';
    END IF;
    IF v_emb_org IS DISTINCT FROM v_row.organization_id THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_ORG_MISMATCH: El embarque pertenece a otra organización.';
    END IF;
  END IF;

  SELECT origen_proveedor::text INTO v_origen
    FROM public.proveedores WHERE id = v_row.proveedor_id;

  IF COALESCE(v_origen,'Nacional') = 'Nacional'
     AND v_row.uuid_fiscal IS NOT NULL
     AND COALESCE(v_row.uuid_verificado,false) = false THEN
    RAISE EXCEPTION 'LC_CXP_UUID_NO_VERIFICADO: Verifica el UUID en el SAT antes de aprobar.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._cxp_validar_aprobacion(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Auditorías 122/125: separar gasto neto, crédito a deuda y valuación MXN.
-- Columnas nullable intencionalmente: no se infiere ni se reescribe historia.
ALTER TABLE public.proveedor_notas_credito
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS tipo_cambio_mxn numeric;
COMMENT ON COLUMN public.proveedor_notas_credito.subtotal IS
  'Base neta de impuestos y descuentos de la NC en su moneda. NULL indica desglose histórico desconocido; monto sigue siendo crédito total a deuda.';
COMMENT ON COLUMN public.proveedor_notas_credito.tipo_cambio_mxn IS
  'MXN por una unidad de la moneda de la NC. Independiente del tipo_cambio usado para convertir deuda; MXN vale 1.';

-- Reemplaza el cuerpo conservando seguridad, dueño y ACL existentes.
CREATE OR REPLACE FUNCTION public._nc_prov_tc_moneda_convertible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_moneda_factura text;
  v_moneda_ext text;
  v_tc numeric;
BEGIN
  -- No-op fiscal: no consultar DOF ni completar metadatos de una NC histórica.
  IF TG_OP = 'UPDATE' AND ROW(NEW.monto, NEW.subtotal, NEW.moneda,
      NEW.tipo_cambio, NEW.tipo_cambio_mxn, NEW.fecha, NEW.proveedor_factura_id)
    IS NOT DISTINCT FROM ROW(OLD.monto, OLD.subtotal, OLD.moneda,
      OLD.tipo_cambio, OLD.tipo_cambio_mxn, OLD.fecha, OLD.proveedor_factura_id) THEN
    RETURN NEW;
  END IF;
  -- Toda NC nueva requiere base explícita. Una edición fiscal tampoco puede
  -- eliminar la base; un UPDATE de otro campo no repara ni cambia históricos.
  IF TG_OP = 'INSERT' OR NEW.subtotal IS DISTINCT FROM OLD.subtotal THEN
    IF NEW.subtotal IS NULL OR NEW.subtotal < 0
       OR NEW.subtotal::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'LC_NC_PROV_BASE_REQUERIDA: captura la base sin impuestos de la nota de crédito'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado <> 'Borrador' AND (
      NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.tipo_cambio_mxn IS DISTINCT FROM OLD.tipo_cambio_mxn) THEN
    RAISE EXCEPTION 'LC_NC_PROV_DESGLOSE_INMUTABLE: no se cambia la base ni valuación de una NC aprobada'
      USING ERRCODE = '22023';
  END IF;

  SELECT pf.moneda::text INTO v_moneda_factura
  FROM public.proveedor_facturas pf WHERE pf.id = NEW.proveedor_factura_id;

  IF NEW.moneda::text <> v_moneda_factura
     AND NEW.moneda::text <> 'MXN' AND v_moneda_factura <> 'MXN' THEN
    RAISE EXCEPTION 'LC_NC_PROV_MONEDA_NO_CONVERTIBLE: no hay tipo de cambio cruzado entre % y %', NEW.moneda, v_moneda_factura
      USING ERRCODE = '22023';
  END IF;
  IF NEW.tipo_cambio IS NOT NULL AND (NEW.tipo_cambio <= 0
      OR NEW.tipo_cambio::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'LC_NC_PROV_TC_INVALIDO: el tipo de cambio capturado debe ser finito y mayor a cero'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.tipo_cambio_mxn IS NOT NULL AND (NEW.tipo_cambio_mxn <= 0
      OR NEW.tipo_cambio_mxn::text IN ('NaN', 'Infinity', '-Infinity')) THEN
    RAISE EXCEPTION 'LC_NC_PROV_TC_INVALIDO: la valuación MXN debe ser finita y mayor a cero'
      USING ERRCODE = '22023';
  END IF;

  v_moneda_ext := CASE WHEN NEW.moneda::text = 'MXN' THEN v_moneda_factura ELSE NEW.moneda::text END;
  -- Un único valor de mercado por divisa, preservando cualquier paridad explícita.
  IF NEW.moneda::text <> v_moneda_factura THEN
    v_tc := COALESCE(NEW.tipo_cambio, CASE WHEN NEW.moneda::text <> 'MXN' THEN NEW.tipo_cambio_mxn END);
  ELSIF NEW.moneda::text <> 'MXN' THEN
    v_tc := NEW.tipo_cambio_mxn;
  END IF;
  IF v_moneda_ext <> 'MXN' AND v_tc IS NULL THEN
    SELECT CASE WHEN v_moneda_ext = 'USD' THEN d.usd_mxn WHEN v_moneda_ext = 'EUR' THEN d.eur_mxn END
      INTO v_tc FROM public.tc_dof_vigente(NEW.fecha) d;
    IF v_tc IS NULL OR v_tc <= 0 OR v_tc::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'LC_NC_PROV_TC_REQUERIDO: captura la valuación MXN de % para la fecha de la NC', v_moneda_ext
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.moneda::text = 'MXN' THEN
    IF NEW.tipo_cambio_mxn IS NOT NULL AND NEW.tipo_cambio_mxn <> 1 THEN
      RAISE EXCEPTION 'LC_NC_PROV_TC_INVALIDO: una NC MXN se valúa a 1 MXN';
    END IF;
    NEW.tipo_cambio_mxn := 1;
  ELSE
    NEW.tipo_cambio_mxn := COALESCE(NEW.tipo_cambio_mxn, v_tc);
    IF NEW.moneda::text <> v_moneda_factura AND NEW.tipo_cambio_mxn <> v_tc THEN
      RAISE EXCEPTION 'LC_NC_PROV_TC_INCONSISTENTE: la valuación MXN y conversión a deuda deben coincidir para esta divisa';
    END IF;
  END IF;
  -- La identidad EUR/EUR (o USD/USD) nunca multiplica la deuda por su valuación.
  NEW.tipo_cambio := CASE WHEN NEW.moneda::text = v_moneda_factura THEN NULL ELSE v_tc END;
  -- La normalización también cuenta como cambio: no inferir valuación de una
  -- NC aprobada/aplicada cuyo desglose histórico sigue desconocido.
  IF TG_OP = 'UPDATE' AND OLD.estado <> 'Borrador' AND (
      NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.tipo_cambio_mxn IS DISTINCT FROM OLD.tipo_cambio_mxn) THEN
    RAISE EXCEPTION 'LC_NC_PROV_DESGLOSE_INMUTABLE: no se cambia la base ni valuación de una NC aprobada'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_nc_prov_tc_convertible ON public.proveedor_notas_credito;
CREATE TRIGGER trg_nc_prov_tc_convertible
  BEFORE INSERT OR UPDATE OF monto, subtotal, moneda, tipo_cambio, tipo_cambio_mxn, fecha, proveedor_factura_id
  ON public.proveedor_notas_credito
  FOR EACH ROW EXECUTE FUNCTION public._nc_prov_tc_moneda_convertible();

-- Auditoría 123: una asignación parcial no es autorización para reducir
-- presupuesto. Se conserva la RPC de sobrecostos y todos sus candados/ACL.
CREATE OR REPLACE FUNCTION public.crear_ajustes_factura_proveedor_rpc(p_factura_id uuid, p_ajustes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fact public.proveedor_facturas%ROWTYPE;
  v_count integer := 0;
  v_previos uuid[];
BEGIN
  SELECT * INTO v_fact
  FROM public.proveedor_facturas
  WHERE id = p_factura_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROVEEDOR_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_fact.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- N6: todo embarque_id del payload debe ser un embarque vigente de la
  -- MISMA organización que la factura.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE NULLIF(btrim(COALESCE(a->>'embarque_id', '')), '') IS NOT NULL
      AND abs(COALESCE((a->>'monto')::numeric, 0)) > 0.01
      AND NOT EXISTS (
        SELECT 1
        FROM public.embarques e
        WHERE e.id = (a->>'embarque_id')::uuid
          AND e.organization_id = v_fact.organization_id
          AND e.deleted_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'LC_EMBARQUE_AJENO: todo ajuste debe referenciar un embarque vigente de la misma organización que la factura'
      USING ERRCODE = '42501';
  END IF;

  -- v13.823.285 · candado de magnitud: un ajuste nace de la diferencia entre el
  -- costo devengado y la MISMA factura, así que nunca puede superar el total de
  -- la factura. Cuando la base congelada quedó en otra moneda (p. ej. el costo
  -- convertido a MXN contra una factura en USD) el delta era un "ajuste
  -- fantasma" que inflaba la utilidad del embarque (ELIMP00368: -546,777.68 USD
  -- sobre una factura de 34,400 USD). Se rechaza en el servidor para que ni una
  -- versión vieja del front pueda volver a insertarlo.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE abs(COALESCE((a->>'monto')::numeric, 0)) > COALESCE(v_fact.total, 0) + 0.01
  ) THEN
    RAISE EXCEPTION 'LC_AJUSTE_DESPROPORCIONADO: el ajuste no puede exceder el total de la factura (%). Revisa la moneda del costo vinculado.', v_fact.total
      USING ERRCODE = '22003';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE COALESCE((a->>'monto')::numeric, 0) < -0.01
  ) THEN
    RAISE EXCEPTION 'LC_AJUSTE_REDUCCION_NO_EXPLICITA: una factura parcial no reduce el presupuesto; registra una reducción explícita por separado'
      USING ERRCODE = '22023';
  END IF;

  -- Ola 5 · RG4-3: capturar ANTES de cualquier DELETE los ids de todos los
  -- conceptos de ajuste de esta factura (vivos o ya soft-borrados).
  SELECT COALESCE(array_agg(pfc.concepto_costo_id), '{}'::uuid[])
    INTO v_previos
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND cc.origen = 'ajuste_factura_proveedor';

  -- Idempotencia (paso 1): soft-delete de los ajustes previos vivos.
  UPDATE public.conceptos_costo cc
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE cc.deleted_at IS NULL
     AND cc.id = ANY (v_previos);

  -- Idempotencia (paso 2): borrar los puentes de esos mismos ids.
  DELETE FROM public.proveedor_facturas_conceptos pfc
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND pfc.concepto_costo_id = ANY (v_previos);

  -- Conceptos de ajuste + puentes, atómicos.
  WITH nuevos AS (
    INSERT INTO public.conceptos_costo (
      embarque_id, organization_id, proveedor_id, proveedor_nombre,
      concepto, monto, moneda, origen,
      estado_liquidacion, fecha_pago, referencia_pago
    )
    SELECT
      (a->>'embarque_id')::uuid,
      v_fact.organization_id,
      v_fact.proveedor_id,
      v_fact.proveedor_nombre,
      'Ajuste factura ' || COALESCE(v_fact.folio_proveedor, '') || ': ' || COALESCE(a->>'descripcion', ''),
      (a->>'monto')::numeric,
      v_fact.moneda,
      'ajuste_factura_proveedor',
      'Pagado'::estado_liquidacion,
      v_fact.fecha_emision,
      v_fact.folio_proveedor
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE NULLIF(btrim(COALESCE(a->>'embarque_id', '')), '') IS NOT NULL
      AND abs(COALESCE((a->>'monto')::numeric, 0)) > 0.01
    RETURNING id, concepto, monto
  ),
  puentes AS (
    INSERT INTO public.proveedor_facturas_conceptos (
      proveedor_factura_id, organization_id, concepto_costo_id,
      descripcion, cantidad, monto
    )
    SELECT p_factura_id, v_fact.organization_id, n.id, n.concepto, 1, n.monto
    FROM nuevos n
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM puentes;

  RETURN jsonb_build_object('ajustes_creados', v_count, 'folio', v_fact.folio_proveedor);
END;
$function$;

-- ACL idénticas al baseline; no se amplía acceso ni cambian roles/RLS.
REVOKE ALL ON FUNCTION public._nc_prov_tc_moneda_convertible() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._nc_prov_tc_moneda_convertible() TO service_role;
REVOKE ALL ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) TO authenticated, service_role;

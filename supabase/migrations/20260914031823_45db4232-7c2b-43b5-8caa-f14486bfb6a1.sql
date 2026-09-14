-- ============================================================================
-- v13.823.376 · Lote B11–B15 (facturación / proformas)
-- B11 exposición de crédito fail-closed  · B12 TC USD nace NULL
-- B13 concepto proformado inmutable en `total` · B14 costo vinculado a CxP
-- B15 autorización fina para eliminar proforma
-- NO se normalizan datos históricos: los T/C inválidos existentes se reportan,
-- nunca se inventan.
-- ============================================================================

-- ── B11 ─────────────────────────────────────────────────────────────────────
-- Antes: `COALESCE(NULLIF(tipo_cambio,0),1)` convertía una factura USD sin T/C
-- a razón de 1 MXN por dólar y subestimaba la cartera. Ahora se alinea con
-- `credito_en_uso_mxn` (banda 5..40, fail-closed) y devuelve un error
-- accionable con los folios a corregir.
CREATE OR REPLACE FUNCTION public.get_exposicion_credito_cliente(p_cliente_id uuid)
RETURNS TABLE(cliente_id uuid, organization_id uuid, dias_credito integer, limite_mxn numeric, en_uso_mxn numeric, disponible_mxn numeric, excedido boolean, facturas_vivas integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_dias integer;
  v_limite numeric;
  v_en_uso numeric := 0;
  v_facturas integer := 0;
  v_malas text[] := ARRAY[]::text[];
  v_saldo numeric;
  f record;
BEGIN
  SELECT c.organization_id, c.dias_credito, c.limite_credito_mxn
    INTO v_org, v_dias, v_limite
  FROM public.clientes c
  WHERE c.id = p_cliente_id
    AND c.deleted_at IS NULL
    AND (
      c.organization_id = public.current_user_org_id()
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    );

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado o sin acceso'
      USING ERRCODE = '42501';
  END IF;

  FOR f IN
    SELECT fa.id, fa.numero, COALESCE(fa.total, 0) AS total,
           fa.moneda::text AS moneda, fa.tipo_cambio AS tc
      FROM public.facturas fa
     WHERE fa.cliente_id = p_cliente_id
       AND fa.deleted_at IS NULL
       AND fa.estado IN ('Emitida','Vencida','Parcialmente pagada','Pagada')
  LOOP
    v_facturas := v_facturas + 1;

    SELECT GREATEST(
             0,
             f.total
               - COALESCE((SELECT SUM(p.monto_aplicado_factura)
                             FROM public.pagos_factura p
                            WHERE p.factura_id = f.id AND p.deleted_at IS NULL), 0)
               - public.nc_aplicadas_en_moneda_factura(f.id)
           )
      INTO v_saldo;

    IF f.moneda = 'MXN' THEN
      v_en_uso := v_en_uso + v_saldo;
    ELSIF v_saldo > 0 THEN
      IF f.tc IS NULL OR f.tc < 5 OR f.tc > 40 THEN
        v_malas := array_append(v_malas, COALESCE(NULLIF(btrim(f.numero), ''), f.id::text));
      ELSE
        v_en_uso := v_en_uso + (v_saldo * f.tc);
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_malas, 1) > 0 THEN
    RAISE EXCEPTION 'LC_CREDITO_TC_INVALIDO: corrige el tipo de cambio de la(s) factura(s) en moneda extranjera %; sin él no se puede calcular la exposición de crédito.',
      array_to_string(v_malas, ', ')
      USING ERRCODE = '22023';
  END IF;

  cliente_id      := p_cliente_id;
  organization_id := v_org;
  dias_credito    := v_dias;
  limite_mxn      := v_limite;
  en_uso_mxn      := ROUND(v_en_uso, 2);
  disponible_mxn  := CASE WHEN v_limite IS NULL THEN NULL ELSE ROUND(v_limite - v_en_uso, 2) END;
  excedido        := CASE WHEN v_limite IS NULL THEN false ELSE v_en_uso > v_limite END;
  facturas_vivas  := v_facturas;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_exposicion_credito_cliente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_exposicion_credito_cliente(uuid) TO authenticated, service_role;

-- ── B12 ─────────────────────────────────────────────────────────────────────
-- La factura USD de conversión nacía con tipo_cambio = 1 (valor falso). Ahora
-- nace en NULL: el trigger `_factura_tc_dof_obligatorio` resuelve el T/C DOF y,
-- si no existe, falla en claro. MXN conserva 1.
CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(p_proforma_ids uuid[], p_serie_id uuid, p_metodo_pago text, p_forma_pago text, p_uso_cfdi text, p_dias_credito integer DEFAULT NULL::integer, p_notas text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF facturas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cached jsonb; v_count int; v_first public.proformas;
  v_org uuid; v_caller_org uuid; v_cliente public.clientes;
  v_serie public.factura_series;
  v_subtotal_usd numeric := 0; v_iva_usd numeric := 0; v_total_usd numeric := 0;
  v_subtotal_mxn numeric := 0; v_iva_mxn numeric := 0; v_total_mxn numeric := 0;
  v_distinct_cli int; v_distinct_org int;
  v_factura_ids uuid[] := ARRAY[]::uuid[];
  v_factura_mxn_id uuid; v_factura_usd_id uuid;
  v_numero_tmp text; v_embarque_ids uuid[];
  v_dias int;
  -- R170-02: fecha de negocio en hora México, no CURRENT_DATE (UTC).
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'convertir_proformas_a_factura');
  IF v_cached IS NOT NULL AND (v_cached ? 'factura_ids') THEN
    RETURN QUERY SELECT * FROM public.facturas
      WHERE id = ANY(ARRAY(SELECT jsonb_array_elements_text(v_cached->'factura_ids'))::uuid[])
        AND deleted_at IS NULL;
    RETURN;
  END IF;

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes proporcionar al menos una proforma';
  END IF;
  IF p_metodo_pago NOT IN ('PUE', 'PPD') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_metodo_pago;
  END IF;
  IF coalesce(p_forma_pago, '') = '' OR coalesce(p_uso_cfdi, '') = '' THEN
    RAISE EXCEPTION 'forma_pago y uso_cfdi son obligatorios';
  END IF;

  PERFORM public.convertir_proformas_a_factura_check_embarque_vivo(p_proforma_ids);

  v_caller_org := public.current_user_org_id();

  IF NOT (
    public.es_escritor_financiero(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: rol no autorizado para convertir proformas' USING ERRCODE='P0001';
  END IF;

  PERFORM 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL FOR UPDATE;

  SELECT count(*), count(DISTINCT organization_id), count(DISTINCT cliente_id)
    INTO v_count, v_distinct_org, v_distinct_cli
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;

  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o están eliminadas';
  END IF;
  IF v_distinct_org <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a una sola organización';
  END IF;
  IF v_distinct_cli <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a un solo cliente';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND estado_proforma = 'facturada'
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_YA_FACTURADA: una o más proformas ya fueron facturadas' USING ERRCODE='P0002';
  END IF;

  -- v13.823.279 — Candado de aceptación: la UI ya oculta la acción para
  -- proformas pendientes o rechazadas, pero la RPC podía llamarse directo y
  -- facturar sin la respuesta del cliente. Para clientes de casa, la RPC
  -- `aceptar_proforma_sin_autorizacion` deja `estado_cliente = 'aceptada'`,
  -- así que ese flujo sigue funcionando igual.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND deleted_at IS NULL
      AND coalesce(estado_cliente, 'pendiente') <> 'aceptada'
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_REQUIERE_ACEPTACION: una o más proformas no están aceptadas por el cliente (pendiente o rechazada)' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO v_first FROM public.proformas
    WHERE id = ANY(p_proforma_ids) ORDER BY created_at ASC LIMIT 1;

  v_org := v_first.organization_id;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;

  SELECT * INTO v_serie FROM public.factura_series WHERE id = p_serie_id AND organization_id = v_org;
  IF v_serie IS NULL THEN RAISE EXCEPTION 'Serie no encontrada'; END IF;

  -- Cascada de plazo de crédito: parámetro → proforma → ficha del cliente → 0.
  v_dias := COALESCE(NULLIF(p_dias_credito, 0), v_first.dias_credito, v_cliente.dias_credito, p_dias_credito, 0);


  SELECT array_agg(DISTINCT embarque_id) INTO v_embarque_ids
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND embarque_id IS NOT NULL;

  IF v_first.es_consolidada THEN
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN total ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN total ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.proforma_conceptos_consolidados
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  ELSE
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.conceptos_venta
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  END IF;

  IF v_subtotal_mxn > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      0, 0, 0, 'MXN'::public.moneda, 1,
      v_hoy_mx,
      v_hoy_mx + make_interval(days => v_dias),
      'Borrador'::estado_factura, v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, v_dias,
      p_notas, 'conversion_proforma'
    ) RETURNING id INTO v_factura_mxn_id;

    PERFORM public._convertir_proformas_insertar_conceptos(
      v_factura_mxn_id, p_proforma_ids, v_org, v_first.es_consolidada, 'MXN'::public.moneda
    );

    -- BUG-17: recalcular desde el `total` guardado del renglón (pcc.total en
    -- consolidadas), no desde cantidad*precio_unitario que puede diverger.
    SELECT
      COALESCE(SUM(total), 0),
      COALESCE(SUM(total * COALESCE(tasa_iva_aplicada, 0)), 0)
    INTO v_subtotal_mxn, v_iva_mxn
    FROM public.conceptos_factura
    WHERE factura_id = v_factura_mxn_id AND deleted_at IS NULL;
    v_subtotal_mxn := round(v_subtotal_mxn, 2);
    v_iva_mxn := round(v_iva_mxn, 2);
    v_total_mxn := v_subtotal_mxn + v_iva_mxn;

    UPDATE public.facturas
    SET subtotal = v_subtotal_mxn, iva = v_iva_mxn, total = v_total_mxn
    WHERE id = v_factura_mxn_id;

    IF v_embarque_ids IS NOT NULL THEN
      INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id)
      SELECT v_factura_mxn_id, unnest(v_embarque_ids), v_org
      ON CONFLICT DO NOTHING;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_mxn_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    ) VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_mxn_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'MXN',
                        'embarque_ids', to_jsonb(v_embarque_ids),
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF v_subtotal_usd > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      0, 0, 0, 'USD'::public.moneda, NULL,
      v_hoy_mx,
      v_hoy_mx + make_interval(days => v_dias),
      'Borrador'::estado_factura, v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, v_dias,
      p_notas, 'conversion_proforma'
    ) RETURNING id INTO v_factura_usd_id;

    PERFORM public._convertir_proformas_insertar_conceptos(
      v_factura_usd_id, p_proforma_ids, v_org, v_first.es_consolidada, 'USD'::public.moneda
    );

    -- BUG-17: recalcular desde el `total` guardado del renglón (pcc.total en
    -- consolidadas), no desde cantidad*precio_unitario que puede diverger.
    SELECT
      COALESCE(SUM(total), 0),
      COALESCE(SUM(total * COALESCE(tasa_iva_aplicada, 0)), 0)
    INTO v_subtotal_usd, v_iva_usd
    FROM public.conceptos_factura
    WHERE factura_id = v_factura_usd_id AND deleted_at IS NULL;
    v_subtotal_usd := round(v_subtotal_usd, 2);
    v_iva_usd := round(v_iva_usd, 2);
    v_total_usd := v_subtotal_usd + v_iva_usd;

    UPDATE public.facturas
    SET subtotal = v_subtotal_usd, iva = v_iva_usd, total = v_total_usd
    WHERE id = v_factura_usd_id;

    IF v_embarque_ids IS NOT NULL THEN
      INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id)
      SELECT v_factura_usd_id, unnest(v_embarque_ids), v_org
      ON CONFLICT DO NOTHING;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_usd_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    ) VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_usd_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'USD',
                        'embarque_ids', to_jsonb(v_embarque_ids),
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF array_length(v_factura_ids, 1) > 0 THEN
    UPDATE public.proformas
    SET estado_proforma = 'facturada', fecha_facturacion = v_hoy_mx
    WHERE id = ANY(p_proforma_ids) AND estado_proforma <> 'facturada';
  END IF;

  IF p_request_id IS NOT NULL THEN
    PERFORM public.idempotency_store(p_request_id, jsonb_build_object('factura_ids', to_jsonb(v_factura_ids)));
  END IF;

  RETURN QUERY SELECT * FROM public.facturas WHERE id = ANY(v_factura_ids);
END;
$function$;

-- ── B13 ─────────────────────────────────────────────────────────────────────
-- El guard ya protegía descripción, cantidad, precio, moneda y tratamiento de
-- IVA, pero NO `total`, así que `actualizar_embarque_completo` podía mover el
-- importe de un concepto ya incluido en una proforma y desalinear la factura de
-- conversión. Las transiciones de estado (`estado_facturacion`, `proforma_id`)
-- siguen permitidas para poder crear, eliminar o convertir la proforma.
CREATE OR REPLACE FUNCTION public._assert_concepto_no_proformado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.proforma_id IS NOT NULL THEN
      RAISE EXCEPTION
        'LC_CONCEPTO_PROFORMADO: el concepto ya está incluido en una proforma y no puede eliminarse'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.proforma_id IS NOT NULL
     AND (NEW.descripcion       IS DISTINCT FROM OLD.descripcion
       OR NEW.cantidad          IS DISTINCT FROM OLD.cantidad
       OR NEW.precio_unitario   IS DISTINCT FROM OLD.precio_unitario
       OR NEW.moneda            IS DISTINCT FROM OLD.moneda
       OR NEW.total             IS DISTINCT FROM OLD.total
       OR NEW.aplica_iva        IS DISTINCT FROM OLD.aplica_iva
       OR NEW.tasa_iva_aplicada IS DISTINCT FROM OLD.tasa_iva_aplicada) THEN
    RAISE EXCEPTION
      'LC_CONCEPTO_PROFORMADO: el concepto ya está incluido en una proforma; elimina o recrea la proforma pendiente antes de ajustarlo (si ya se facturó, usa el flujo fiscal correspondiente)'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── B14 ─────────────────────────────────────────────────────────────────────
-- Un costo con factura de proveedor viva vinculada no puede cambiar de monto,
-- moneda ni proveedor: primero hay que desvincular o corregir la factura. Los
-- campos no financieros y las transiciones de liquidación siguen permitidos.
CREATE OR REPLACE FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_folio text;
BEGIN
  IF NEW.monto IS NOT DISTINCT FROM OLD.monto
     AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
     AND NEW.proveedor_id IS NOT DISTINCT FROM OLD.proveedor_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(pf.folio_interno, pf.folio_proveedor)
    INTO v_folio
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
   WHERE pfc.concepto_costo_id = NEW.id
     AND pf.deleted_at IS NULL
     AND pf.estado::text <> 'Cancelada'
   LIMIT 1;

  IF v_folio IS NOT NULL THEN
    RAISE EXCEPTION
      'LC_COSTO_VINCULADO_CXP: el costo está vinculado a la factura de proveedor %; desvincula o corrige esa factura antes de cambiar monto, moneda o proveedor',
      COALESCE(NULLIF(btrim(v_folio), ''), '(sin folio)')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_conceptos_costo_guard_vinculo_cxp ON public.conceptos_costo;
CREATE TRIGGER trg_conceptos_costo_guard_vinculo_cxp
BEFORE UPDATE OF monto, moneda, proveedor_id ON public.conceptos_costo
FOR EACH ROW EXECUTE FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp();

-- ── B15 ─────────────────────────────────────────────────────────────────────
-- `is_org_member` dejaba borrar proformas vivas a cualquier miembro (incluido
-- sólo lectura) invocando el RPC. Se alinea con la policy canónica
-- "Tenant delete proformas": admin, admin_org, operador, contador, super_admin.
CREATE OR REPLACE FUNCTION public.eliminar_proforma_rpc(p_proforma_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_numero text;
  v_estado text;
  v_factura uuid;
  v_factura2 uuid;
  v_folio_ext text;
  v_deleted timestamptz;
  v_embarque uuid;
BEGIN
  SELECT organization_id, numero, estado_proforma, factura_id, factura_secundaria_id,
         folio_factura_externa, deleted_at, embarque_id
    INTO v_org, v_numero, v_estado, v_factura, v_factura2, v_folio_ext, v_deleted, v_embarque
  FROM public.proformas WHERE id = p_proforma_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;
  -- Espejo de la policy RLS `Tenant delete proformas`.
  IF auth.uid() IS NOT NULL AND NOT public.has_any_role_efectivo(
       auth.uid(),
       ARRAY['admin'::public.app_role, 'admin_org'::public.app_role,
             'operador'::public.app_role, 'contador'::public.app_role,
             'super_admin'::public.app_role]
     ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: tu rol no puede eliminar proformas'
      USING ERRCODE = '42501';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque, 'eliminada', false);
  END IF;
  -- RG10: el folio externo suelto ya NO bloquea; sólo una factura viva o el
  -- estado 'facturada'.
  IF v_factura IS NOT NULL OR v_factura2 IS NOT NULL
     OR lower(COALESCE(v_estado, '')) = 'facturada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_FACTURADA';
  END IF;

  UPDATE public.conceptos_venta
     SET estado_facturacion = 'pendiente', proforma_id = NULL
   WHERE proforma_id = p_proforma_id;

  UPDATE public.proformas
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_proforma_id;

  RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque, 'eliminada', true);
END;
$function$;

-- H6: REVOKE/GRANT explícitos para toda función SECURITY DEFINER de esta
-- migración. Ninguna debe quedar ejecutable por PUBLIC/anon.
REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp() FROM anon;
GRANT EXECUTE ON FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tg_conceptos_costo_guard_vinculo_cxp() TO service_role;

REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO service_role;

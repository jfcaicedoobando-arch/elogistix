-- ==========================================================================
-- Ola backlog v5 — M3-res, M6, N18, N19
-- ==========================================================================

-- M3-res.1 — el candado de email no debe tratar '' como duplicado
CREATE OR REPLACE FUNCTION public._assert_email_unico_org()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dup int;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.email IS NOT DISTINCT FROM NEW.email THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'clientes' THEN
    SELECT count(*) INTO v_dup
    FROM public.clientes c
    WHERE c.organization_id = NEW.organization_id
      AND c.deleted_at IS NULL
      AND c.id <> NEW.id
      AND lower(btrim(coalesce(c.email, ''))) = lower(btrim(NEW.email));
  ELSE
    SELECT count(*) INTO v_dup
    FROM public.contactos_cliente c
    WHERE c.organization_id = NEW.organization_id
      AND c.deleted_at IS NULL
      AND c.id <> NEW.id
      AND lower(btrim(coalesce(c.email, ''))) = lower(btrim(NEW.email));
  END IF;

  IF v_dup > 0 THEN
    RAISE EXCEPTION 'LC_EMAIL_DUPLICADO: el correo % ya está registrado en esta organización.', NEW.email
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- M6 — una sola fuente de conversión de notas de crédito
CREATE OR REPLACE FUNCTION public.cartera_pendiente()
 RETURNS TABLE(factura_id uuid, numero text, cliente_id uuid, cliente_nombre text, embarque_id uuid, expediente text, fecha_emision date, fecha_vencimiento date, dias_vencido integer, moneda text, total numeric, pagado numeric, saldo numeric, ultimo_contacto date, estado text, cancellation_status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      -- M6: helper canónico, no una copia en línea de la cascada de monedas.
      public._nc_aplicadas_moneda_factura(f.id) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    ((now() AT TIME ZONE 'America/Mexico_City')::date - b.fecha_vencimiento)::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id),
    b.estado, b.cancellation_status
  FROM base b
  LEFT JOIN public.clientes c ON c.id = b.cliente_id
  LEFT JOIN public.embarques e ON e.id = b.embarque_id AND e.deleted_at IS NULL
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
  ORDER BY b.fecha_vencimiento ASC NULLS LAST
  LIMIT 500
$function$;

-- N18 — candado de fila para que un doble clic no genere dos movimientos
CREATE OR REPLACE FUNCTION public.aprobar_nota_credito_proveedor(_nc_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado public.estado_nota_credito_proveedor;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- N18: serializa dos llamadas concurrentes sobre la misma nota.
  SELECT estado INTO v_estado
  FROM public.proveedor_notas_credito
  WHERE id = _nc_id AND organization_id = public.org_scope()
  FOR UPDATE;

  IF NOT FOUND OR v_estado <> 'Borrador' THEN
    RAISE EXCEPTION 'Nota de crédito no encontrada o no está en Borrador';
  END IF;

  UPDATE public.proveedor_notas_credito
  SET estado = 'Aprobada',
      aprobada_por = auth.uid(),
      aprobada_at = now(),
      updated_at = now()
  WHERE id = _nc_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_anticipo_proveedor(p_id uuid, p_motivo text)
 RETURNS anticipos_proveedor
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_email text;
  v_aplicaciones integer;
  v_autorizado boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden cancelar anticipos.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(trim(p_motivo),'') = '' OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOTIVO_REQUERIDO: Debes indicar un motivo de cancelación.';
  END IF;

  -- N18: candado de fila antes de validar estado (doble clic / doble pestaña).
  SELECT * INTO v_row FROM public.anticipos_proveedor
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo ya está cancelado.';
  END IF;

  SELECT COUNT(*) INTO v_aplicaciones
    FROM public.anticipos_aplicaciones
    WHERE anticipo_id = p_id AND deleted_at IS NULL;

  IF v_aplicaciones > 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CON_APLICACIONES: No se puede cancelar un anticipo con aplicaciones vivas. Reversa las aplicaciones primero.';
  END IF;

  UPDATE public.anticipos_proveedor
    SET estado = 'cancelado',
        saldo_disponible = 0,
        motivo_cancelacion = p_motivo,
        deleted_at = now(),
        deleted_by = v_uid,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;

  UPDATE public.bbva_movimientos
    SET deleted_at = now(), deleted_by = v_uid
    WHERE anticipo_proveedor_id = p_id AND deleted_at IS NULL;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'cancelar_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('motivo', p_motivo, 'monto', v_row.monto, 'moneda', v_row.moneda));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en cancelar_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

-- N19 — bitácora de cambios financieros (genérica por columnas vigiladas)
CREATE OR REPLACE FUNCTION public._bitacora_cambio_financiero()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_diff jsonb := '{}'::jsonb;
  v_col text;
  v_modulo text := TG_ARGV[0];
  v_nombre text;
  v_org uuid;
  i int;
BEGIN
  FOR i IN 1 .. (array_length(TG_ARGV, 1) - 1) LOOP
    v_col := TG_ARGV[i];
    IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
      v_diff := v_diff || jsonb_build_object(
        v_col, jsonb_build_object('antes', v_old -> v_col, 'despues', v_new -> v_col));
    END IF;
  END LOOP;

  IF v_diff = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  v_org := NULLIF(v_new ->> 'organization_id', '')::uuid;
  v_nombre := COALESCE(v_new ->> 'numero', v_new ->> 'expediente',
                       v_new ->> 'folio_interno', v_new ->> 'referencia', '');

  PERFORM public.registrar_bitacora(
    v_modulo,
    'cambio_financiero_' || TG_TABLE_NAME,
    NEW.id,
    v_nombre,
    jsonb_build_object('tabla', TG_TABLE_NAME, 'cambios', v_diff),
    v_org,
    auth.uid()
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_bitacora_fin_embarques ON public.embarques;
CREATE TRIGGER trg_bitacora_fin_embarques
AFTER UPDATE OF tipo_cambio_usd, tipo_cambio_eur, cliente_id ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public._bitacora_cambio_financiero(
  'embarques', 'tipo_cambio_usd', 'tipo_cambio_eur', 'cliente_id');

DROP TRIGGER IF EXISTS trg_bitacora_fin_facturas ON public.facturas;
CREATE TRIGGER trg_bitacora_fin_facturas
AFTER UPDATE OF cliente_id, subtotal, total, moneda, tipo_cambio ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._bitacora_cambio_financiero(
  'facturacion', 'cliente_id', 'subtotal', 'total', 'moneda', 'tipo_cambio');

DROP TRIGGER IF EXISTS trg_bitacora_fin_bbva ON public.bbva_movimientos;
CREATE TRIGGER trg_bitacora_fin_bbva
AFTER UPDATE OF cargo, abono, fecha ON public.bbva_movimientos
FOR EACH ROW EXECUTE FUNCTION public._bitacora_cambio_financiero(
  'tesoreria', 'cargo', 'abono', 'fecha');

DROP TRIGGER IF EXISTS trg_bitacora_fin_comisiones ON public.comisiones_devengadas;
CREATE TRIGGER trg_bitacora_fin_comisiones
AFTER UPDATE OF porcentaje_aplicado, comision_mxn, estado ON public.comisiones_devengadas
FOR EACH ROW EXECUTE FUNCTION public._bitacora_cambio_financiero(
  'cxp', 'porcentaje_aplicado', 'comision_mxn', 'estado');
-- =====================================================================
-- OLA 1 · Remediación auditoría QA (auditoria_elogistix_3)
-- C1/C1b saldo con NC multi-moneda · C7 demo · C6 delete físico
-- C8 uuid_fiscal · C9 costos por API
-- =====================================================================

-- ---------------------------------------------------------------------
-- C1 · Fuente única de NC aplicadas en la moneda de la factura.
-- Función interna, invoker (respeta RLS), reutilizada por todas las
-- fuentes de saldo. Evita el drift por parches de texto (M6).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._nc_aplicadas_moneda_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN nc.moneda::text = f.moneda::text THEN nc.monto
      WHEN f.moneda::text = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
        THEN nc.monto * nc.tipo_cambio
      WHEN f.moneda::text <> 'MXN' AND nc.moneda::text = 'MXN' AND f.tipo_cambio > 1
        THEN nc.monto / f.tipo_cambio
      WHEN f.moneda::text <> 'MXN' AND nc.moneda::text <> 'MXN'
           AND f.moneda::text <> nc.moneda::text
           AND nc.tipo_cambio > 1 AND f.tipo_cambio > 1
        THEN (nc.monto * nc.tipo_cambio) / f.tipo_cambio
      ELSE 0
    END), 0)
  FROM public.facturas f
  JOIN public.factura_notas_credito nc
    ON nc.factura_id = f.id
   AND nc.deleted_at IS NULL
   AND nc.estado = 'Aplicada'
  WHERE f.id = p_factura_id;
$$;

REVOKE ALL ON FUNCTION public._nc_aplicadas_moneda_factura(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._nc_aplicadas_moneda_factura(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._nc_aplicadas_moneda_factura(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._nc_aplicadas_moneda_factura(uuid) TO service_role;

-- API pública existente: delega en la fuente única.
CREATE OR REPLACE FUNCTION public.nc_aplicadas_en_moneda_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public._nc_aplicadas_moneda_factura(p_factura_id);
$$;

-- Estado de la factura: antes restaba nc.monto en crudo (C1).
CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid;
  v_total numeric;
  v_pagado numeric;
  v_ncs numeric;
  v_saldo numeric;
  v_vencimiento date;
  v_estado_actual estado_factura;
  v_nuevo_estado estado_factura;
  v_prev_flag text;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado
    INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas
  WHERE id = v_factura_id;

  IF v_estado_actual IN ('Cancelada', 'Borrador', 'Sustituida') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM public.pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL;

  -- OLA 1 · C1: NC convertidas a la moneda de la factura (fuente única).
  v_ncs := public._nc_aplicadas_moneda_factura(v_factura_id);

  v_saldo := COALESCE(v_total, 0) - v_pagado - COALESCE(v_ncs, 0);

  IF v_saldo <= 0.01 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  v_prev_flag := current_setting('app.recalc_estado_factura', true);
  PERFORM set_config('app.recalc_estado_factura', '1', true);

  UPDATE facturas
  SET estado = v_nuevo_estado, updated_at = now()
  WHERE id = v_factura_id AND estado IS DISTINCT FROM v_nuevo_estado;

  PERFORM set_config('app.recalc_estado_factura', COALESCE(v_prev_flag, ''), true);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Saldo bruto: antes restaba nc.monto en crudo (C1b).
CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_org uuid; v_uid uuid; v_caller_org uuid;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT f.total, f.organization_id INTO v_total, v_org
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador');
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();
  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura p
  WHERE p.factura_id = p_factura_id AND p.deleted_at IS NULL;

  v_ncs := public._nc_aplicadas_moneda_factura(p_factura_id);

  RETURN COALESCE(v_total, 0) - v_pagos - COALESCE(v_ncs, 0);
END;
$function$;

-- Cartera: misma fuente única (antes tenía la conversión duplicada con ELSE NULL).
CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(factura_id uuid, numero text, cliente_id uuid, cliente_nombre text, embarque_id uuid, expediente text, fecha_emision date, fecha_vencimiento date, dias_vencido integer, moneda text, total numeric, pagado numeric, saldo numeric, ultimo_contacto date, estado text, cancellation_status text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
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

-- ---------------------------------------------------------------------
-- C7 · ensure_demo_membership: sólo service_role.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_demo_membership(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- OLA 1 · C7: privilegio de servicio obligatorio. Antes cualquier usuario
  -- autenticado podía reescribir el rol y la organización de otra persona.
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'LC_DEMO_SOLO_SERVICIO: la asignación demo sólo puede hacerse desde el servidor'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin_org'::app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin_org'::app_role;

  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (_user_id, 'de100000-0000-0000-0000-000000000001'::uuid, 'admin_org'::app_role)
  ON CONFLICT (user_id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        role            = EXCLUDED.role;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_demo_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_demo_membership(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_demo_membership(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_demo_membership(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- C6 · Prohibido el DELETE físico de facturas.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenant delete facturas" ON public.facturas;
REVOKE DELETE ON public.facturas FROM anon;
REVOKE DELETE ON public.facturas FROM authenticated;

CREATE OR REPLACE FUNCTION public._prohibir_delete_factura()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'LC_FACTURA_DELETE_PROHIBIDO: las facturas no se borran físicamente; usa la baja lógica (soft_delete_record) o cancela/sustituye el CFDI'
    USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS trg_prohibir_delete_factura ON public.facturas;
CREATE TRIGGER trg_prohibir_delete_factura
BEFORE DELETE ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._prohibir_delete_factura();

-- ---------------------------------------------------------------------
-- C8 · uuid_fiscal único por organización + inmutable tras emisión.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS facturas_uuid_fiscal_unico
  ON public.facturas (organization_id, uuid_fiscal)
  WHERE uuid_fiscal IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.bloquear_modificacion_factura_emitida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.snapshot_emision IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.estado = 'Cancelada' AND OLD.estado <> 'Cancelada' THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- OLA 1 · C8: la identidad fiscal (UUID SAT y artefactos del PAC) sólo puede
  -- escribirla el servidor (webhook/edge con credencial de servicio).
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.uuid_fiscal IS DISTINCT FROM OLD.uuid_fiscal
     OR NEW.facturapi_id IS DISTINCT FROM OLD.facturapi_id
    THEN
      RAISE EXCEPTION 'factura_inmutable: la identidad fiscal de la factura % no puede modificarse desde la aplicación.', OLD.numero
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.numero        IS DISTINCT FROM OLD.numero
   OR NEW.subtotal     IS DISTINCT FROM OLD.subtotal
   OR NEW.iva          IS DISTINCT FROM OLD.iva
   OR NEW.total        IS DISTINCT FROM OLD.total
   OR NEW.moneda       IS DISTINCT FROM OLD.moneda
   OR NEW.tipo_cambio  IS DISTINCT FROM OLD.tipo_cambio
   OR NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
   OR NEW.cliente_id   IS DISTINCT FROM OLD.cliente_id
   OR NEW.embarque_id  IS DISTINCT FROM OLD.embarque_id
   OR NEW.proforma_id  IS DISTINCT FROM OLD.proforma_id
  THEN
    RAISE EXCEPTION 'factura_inmutable: la factura % ya fue emitida y no puede modificarse. Emite una nota de crédito.', OLD.numero
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- C9 · Costos y utilidad por API.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.puede_ver_dashboard_direccion(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND public.has_any_role_efectivo(
    _user_id,
    ARRAY['admin','admin_org','super_admin','gerente_comercial','gerente_visor','gerente_operaciones']::app_role[]
  );
$$;

REVOKE ALL ON FUNCTION public.puede_ver_dashboard_direccion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puede_ver_dashboard_direccion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_dashboard_direccion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_dashboard_direccion(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.puede_ver_costos_cotizacion(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND public.has_any_role_efectivo(
    _user_id,
    ARRAY['admin','admin_org','super_admin','gerente_comercial','gerente_visor',
          'gerente_operaciones','ejecutivo_pricing','vendedor','coordinador_logistico',
          'operador','customer_service','contador','tesorero','auxiliar_contable']::app_role[]
  );
$$;

REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO service_role;

-- SELECT de costos de cotización: separado de la escritura y cerrado a los
-- roles de portal (cliente, agente_carga).
DROP POLICY IF EXISTS "Tenant CRUD cotizacion_costos" ON public.cotizacion_costos;

CREATE POLICY "Tenant read cotizacion_costos"
ON public.cotizacion_costos FOR SELECT TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_ver_costos_cotizacion((SELECT auth.uid())))
);

CREATE POLICY "Tenant insert cotizacion_costos"
ON public.cotizacion_costos FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_escribir_cotizaciones((SELECT auth.uid())))
);

CREATE POLICY "Tenant update cotizacion_costos"
ON public.cotizacion_costos FOR UPDATE TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_escribir_cotizaciones((SELECT auth.uid())))
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_escribir_cotizaciones((SELECT auth.uid())))
);

CREATE POLICY "Tenant delete cotizacion_costos"
ON public.cotizacion_costos FOR DELETE TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_escribir_cotizaciones((SELECT auth.uid())))
);

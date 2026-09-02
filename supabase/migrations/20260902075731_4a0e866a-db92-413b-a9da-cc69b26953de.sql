-- ===========================================================================
-- Ronda YAGNI post v13.823.37 · defectos 1, 2, 3, 4 y 7
-- Forward-only e idempotente.
-- ===========================================================================

-- ── 1) P0 · client_users: pareja (cliente_id, organization_id) garantizada ──
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_users_cliente_org_fkey'
      AND conrelid = 'public.client_users'::regclass
  ) THEN
    ALTER TABLE public.client_users
      ADD CONSTRAINT client_users_cliente_org_fkey
      FOREIGN KEY (cliente_id, organization_id)
      REFERENCES public.clientes (id, organization_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  BEGIN
    ALTER TABLE public.client_users VALIDATE CONSTRAINT client_users_cliente_org_fkey;
  EXCEPTION WHEN foreign_key_violation THEN
    -- No se borra ni reasigna nada: se reporta y el constraint queda NOT VALID
    -- (bloquea altas nuevas inconsistentes) mientras se depura manualmente.
    RAISE WARNING 'LC_CLIENT_USERS_INCONSISTENTES: existen vínculos cuyo cliente no pertenece a la organización declarada; el constraint queda NOT VALID y esas filas se ignoran en current_user_client_ids';
  END;
END
$mig$;

-- current_user_client_ids ahora coteja cliente + organización.
CREATE OR REPLACE FUNCTION public.current_user_client_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT cu.cliente_id
  FROM public.client_users cu
  JOIN public.clientes c
    ON c.id = cu.cliente_id
   AND c.organization_id = cu.organization_id
  WHERE cu.user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.current_user_client_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_client_ids() TO authenticated, service_role;

-- El personal deja de escribir directo: sólo lectura + RPC controlada.
DROP POLICY IF EXISTS "Org staff manage client_users" ON public.client_users;

DROP POLICY IF EXISTS "Org staff read client_users" ON public.client_users;
CREATE POLICY "Org staff read client_users" ON public.client_users
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    )
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'operador'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    )
  );

CREATE OR REPLACE FUNCTION public.revocar_usuario_portal_cliente(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cliente uuid;
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO: inicia sesión para revocar accesos'
      USING ERRCODE = '42501';
  END IF;

  SELECT cu.cliente_id, c.organization_id
    INTO v_cliente, v_org
  FROM public.client_users cu
  JOIN public.clientes c ON c.id = cu.cliente_id
  WHERE cu.id = p_id;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'LC_PORTAL_VINCULO_INEXISTENTE: el acceso ya no existe'
      USING ERRCODE = '22023';
  END IF;

  -- El tenant válido es el del CLIENTE, no el declarado en el vínculo.
  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT public.has_any_role_in_org_exact(
       v_uid, ARRAY['admin','admin_org','operador']::app_role[], v_org) THEN
    RAISE EXCEPTION 'LC_PORTAL_SIN_PERMISO: requiere un rol administrativo en la organización del cliente'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.client_users WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.revocar_usuario_portal_cliente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revocar_usuario_portal_cliente(uuid) TO authenticated, service_role;

-- ── 2) P1 · catálogos globales: escritura sólo super_admin ─────────────────
DROP POLICY IF EXISTS "Operativos y admin actualizan navieras" ON public.navieras;
DROP POLICY IF EXISTS "Operativos y admin gestionan navieras" ON public.navieras;
DROP POLICY IF EXISTS "Operativos y admin actualizan puertos" ON public.puertos;
DROP POLICY IF EXISTS "Operativos y admin agregan puertos" ON public.puertos;

-- ── 3) P1 · notificaciones_cliente: sin inyección cross-org ───────────────
CREATE OR REPLACE FUNCTION public._notif_cliente_validar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT c.organization_id INTO v_org
  FROM public.clientes c WHERE c.id = NEW.cliente_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_NOTIF_CLIENTE_INEXISTENTE: el cliente de la notificación no existe'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_NOTIF_CROSS_ORG: el cliente no pertenece a la organización de la notificación'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.embarque_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.embarques e
    WHERE e.id = NEW.embarque_id
      AND e.organization_id = v_org
      AND e.cliente_id = NEW.cliente_id
  ) THEN
    RAISE EXCEPTION 'LC_NOTIF_EMBARQUE_AJENO: el embarque referido no pertenece a ese cliente'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.factura_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.facturas f
    WHERE f.id = NEW.factura_id
      AND f.organization_id = v_org
      AND f.cliente_id = NEW.cliente_id
  ) THEN
    RAISE EXCEPTION 'LC_NOTIF_FACTURA_AJENA: la factura referida no pertenece a ese cliente'
      USING ERRCODE = '42501';
  END IF;

  -- Allowlist: sólo rutas internas del portal (nunca URLs absolutas).
  IF NEW.url IS NOT NULL AND NEW.url <> '' THEN
    IF NEW.url !~ '^/portal(/[A-Za-z0-9._~-]+)*$' THEN
      RAISE EXCEPTION 'LC_NOTIF_URL_NO_PERMITIDA: sólo se permiten enlaces internos del portal'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._notif_cliente_validar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._notif_cliente_validar() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_notif_cliente_validar ON public.notificaciones_cliente;
CREATE TRIGGER trg_notif_cliente_validar
  BEFORE INSERT OR UPDATE OF cliente_id, organization_id, embarque_id, factura_id, url
  ON public.notificaciones_cliente
  FOR EACH ROW EXECUTE FUNCTION public._notif_cliente_validar();

DROP POLICY IF EXISTS "Tenant staff inserta notificaciones" ON public.notificaciones_cliente;
CREATE POLICY "Tenant staff inserta notificaciones" ON public.notificaciones_cliente
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
      OR organization_id IN (
        SELECT m.organization_id FROM public.organization_members m
        WHERE m.user_id = (SELECT auth.uid())
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = notificaciones_cliente.cliente_id
        AND c.organization_id = notificaciones_cliente.organization_id
    )
  );

-- ── 4) P1 · T/C DOF obligatorio y siempre vigente a la fecha de emisión ───
CREATE OR REPLACE FUNCTION public._factura_tc_dof_obligatorio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
  v_fecha date;
BEGIN
  -- Timbradas: inmutables por los guards fiscales existentes; no recalculamos.
  IF TG_OP = 'UPDATE' AND OLD.uuid_fiscal IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.moneda::text = 'MXN' THEN
    NEW.tipo_cambio := 1;
    RETURN NEW;
  END IF;

  -- El T/C NUNCA se toma de lo capturado: se resuelve del DOF vigente a la
  -- fecha de emisión, así que un valor arbitrario u obsoleto no persiste.
  v_fecha := COALESCE(NEW.fecha_emision, (now() AT TIME ZONE 'America/Mexico_City')::date);

  SELECT CASE
           WHEN NEW.moneda::text = 'USD' THEN d.usd_mxn
           WHEN NEW.moneda::text = 'EUR' THEN d.eur_mxn
         END
    INTO v_tc
  FROM public.tc_dof_vigente(v_fecha) d;

  IF COALESCE(v_tc, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_FACTURA_SIN_TC_DOF: no hay tipo de cambio DOF para % al %; captúralo antes de generar la factura',
      NEW.moneda, v_fecha
      USING ERRCODE = '22023';
  END IF;

  NEW.tipo_cambio := v_tc;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_factura_tc_dof_obligatorio_upd ON public.facturas;
CREATE TRIGGER trg_factura_tc_dof_obligatorio_upd
  BEFORE UPDATE OF moneda, fecha_emision, tipo_cambio ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public._factura_tc_dof_obligatorio();

-- ── 7) P1 · saldo de factura del portal desde agregado completo ────────────
-- saldo_factura sólo autorizaba por organización; los usuarios del portal no
-- son miembros de la org, así que se agrega la rama de cliente vinculado.
CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_caller_org uuid; v_uid uuid; v_pagos numeric; v_ncs numeric;
  v_moneda text; v_tc numeric; v_cliente uuid;
BEGIN
  SELECT total, estado, organization_id, moneda::text, tipo_cambio, cliente_id
    INTO v_total, v_estado, v_org, v_moneda, v_tc, v_cliente
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      -- Portal: el usuario cliente sí puede consultar el saldo de SU factura.
      IF v_cliente IS NULL
         OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
        RETURN 0;
      END IF;
    END IF;
  END IF;

  -- BUG-2026-08-25: 'Pagada' también es terminal (facturas legacy sin pagos
  -- capturados generaban adeudo fantasma en el estado de cuenta).
  IF v_estado IN ('Cancelada', 'Sustituida', 'Borrador', 'Pagada') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  -- BUG-04 (auditoría 2026-08-18): misma conversión que `cartera_pendiente`.
  SELECT COALESCE(SUM(
      CASE
        WHEN nc.moneda::text = v_moneda THEN nc.monto
        WHEN v_moneda = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
          THEN nc.monto * nc.tipo_cambio
        WHEN v_moneda <> 'MXN' AND nc.moneda::text = 'MXN' AND v_tc > 1
          THEN nc.monto / v_tc
        WHEN v_moneda <> 'MXN' AND nc.moneda::text <> 'MXN'
             AND v_moneda <> nc.moneda::text
             AND nc.tipo_cambio > 1 AND v_tc > 1
          THEN (nc.monto * nc.tipo_cambio) / v_tc
        ELSE 0
      END), 0) INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.portal_factura_resumen_saldo(p_factura_id uuid)
 RETURNS TABLE(total numeric, pagado numeric, notas_credito numeric, saldo numeric,
               num_pagos integer, num_notas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente uuid; v_moneda text; v_tc numeric; v_total numeric;
BEGIN
  SELECT f.cliente_id, f.moneda::text, f.tipo_cambio, f.total
    INTO v_cliente, v_moneda, v_tc, v_total
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_cliente IS NULL
     OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH p AS (
    SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) AS monto, COUNT(*)::int AS n
    FROM public.pagos_factura pf
    WHERE pf.factura_id = p_factura_id AND pf.deleted_at IS NULL
  ), nc AS (
    SELECT COALESCE(SUM(
      CASE
        WHEN n.moneda::text = v_moneda THEN n.monto
        WHEN v_moneda = 'MXN' AND n.moneda::text <> 'MXN' AND n.tipo_cambio > 1
          THEN n.monto * n.tipo_cambio
        WHEN v_moneda <> 'MXN' AND n.moneda::text = 'MXN' AND v_tc > 1
          THEN n.monto / v_tc
        WHEN v_moneda <> 'MXN' AND n.moneda::text <> 'MXN'
             AND v_moneda <> n.moneda::text
             AND n.tipo_cambio > 1 AND v_tc > 1
          THEN (n.monto * n.tipo_cambio) / v_tc
        ELSE 0
      END), 0) AS monto, COUNT(*)::int AS n
    FROM public.factura_notas_credito n
    WHERE n.factura_id = p_factura_id AND n.deleted_at IS NULL AND n.estado = 'Aplicada'
  )
  SELECT COALESCE(v_total, 0), p.monto, nc.monto,
         public.saldo_factura(p_factura_id), p.n, nc.n
  FROM p, nc;
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_factura_resumen_saldo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_factura_resumen_saldo(uuid) TO authenticated, service_role;
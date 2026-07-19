
-- =====================================================================
-- Fase P.1 — Modelo de Anticipos a proveedor (v13.301.87)
-- =====================================================================

-- 1) Columna marker en pagos_proveedor
ALTER TABLE public.pagos_proveedor
  ADD COLUMN IF NOT EXISTS es_anticipo_aplicado boolean NOT NULL DEFAULT false;

-- 2) Tabla anticipos_proveedor
CREATE TABLE IF NOT EXISTS public.anticipos_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id),
  fecha_anticipo date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric(18,4) NOT NULL CHECK (monto > 0),
  moneda public.moneda NOT NULL DEFAULT 'MXN',
  tipo_cambio_usd numeric(18,6),
  metodo_pago text,
  referencia text,
  cuenta_bancaria_id uuid REFERENCES public.cuentas_bancarias(id),
  notas text,
  estado text NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible','aplicado_parcial','aplicado_total','cancelado')),
  saldo_disponible numeric(18,4) NOT NULL,
  motivo_cancelacion text,
  created_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anticipos_proveedor_org ON public.anticipos_proveedor(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_anticipos_proveedor_prov ON public.anticipos_proveedor(proveedor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_anticipos_proveedor_estado ON public.anticipos_proveedor(estado) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anticipos_proveedor TO authenticated;
GRANT ALL ON public.anticipos_proveedor TO service_role;

ALTER TABLE public.anticipos_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anticipos_proveedor_select_own_org"
  ON public.anticipos_proveedor FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "anticipos_proveedor_insert_own_org"
  ON public.anticipos_proveedor FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_org_id()
              OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "anticipos_proveedor_update_own_org"
  ON public.anticipos_proveedor FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (organization_id = public.current_user_org_id()
              OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "anticipos_proveedor_delete_own_org"
  ON public.anticipos_proveedor FOR DELETE TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

-- 3) Tabla anticipos_aplicaciones (bridge)
CREATE TABLE IF NOT EXISTS public.anticipos_aplicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  anticipo_id uuid NOT NULL REFERENCES public.anticipos_proveedor(id) ON DELETE RESTRICT,
  proveedor_factura_id uuid NOT NULL REFERENCES public.proveedor_facturas(id),
  pago_proveedor_id uuid NOT NULL REFERENCES public.pagos_proveedor(id),
  monto_aplicado numeric(18,4) NOT NULL CHECK (monto_aplicado > 0),
  moneda_aplicada public.moneda NOT NULL,
  fecha_aplicacion date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aa_org ON public.anticipos_aplicaciones(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aa_anticipo ON public.anticipos_aplicaciones(anticipo_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aa_factura ON public.anticipos_aplicaciones(proveedor_factura_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anticipos_aplicaciones TO authenticated;
GRANT ALL ON public.anticipos_aplicaciones TO service_role;

ALTER TABLE public.anticipos_aplicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anticipos_aplicaciones_select_own_org"
  ON public.anticipos_aplicaciones FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "anticipos_aplicaciones_insert_own_org"
  ON public.anticipos_aplicaciones FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_org_id()
              OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "anticipos_aplicaciones_update_own_org"
  ON public.anticipos_aplicaciones FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (organization_id = public.current_user_org_id()
              OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "anticipos_aplicaciones_delete_own_org"
  ON public.anticipos_aplicaciones FOR DELETE TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

-- 4) Trigger de saldo/estado del anticipo
CREATE OR REPLACE FUNCTION public._recalc_anticipo_saldo(p_anticipo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.anticipos_proveedor;
  v_aplicado numeric(18,4);
  v_nuevo_saldo numeric(18,4);
  v_nuevo_estado text;
BEGIN
  SELECT * INTO v_row FROM public.anticipos_proveedor WHERE id = p_anticipo_id;
  IF v_row.id IS NULL THEN RETURN; END IF;
  -- Respeta cancelado y soft-deleted.
  IF v_row.estado = 'cancelado' OR v_row.deleted_at IS NOT NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
    FROM public.anticipos_aplicaciones
    WHERE anticipo_id = p_anticipo_id
      AND deleted_at IS NULL
      AND moneda_aplicada = v_row.moneda;

  v_nuevo_saldo := v_row.monto - v_aplicado;

  IF v_aplicado <= 0.01 THEN
    v_nuevo_estado := 'disponible';
  ELSIF v_nuevo_saldo <= 0.01 THEN
    v_nuevo_estado := 'aplicado_total';
  ELSE
    v_nuevo_estado := 'aplicado_parcial';
  END IF;

  UPDATE public.anticipos_proveedor
    SET saldo_disponible = v_nuevo_saldo,
        estado = v_nuevo_estado,
        updated_at = now()
    WHERE id = p_anticipo_id
      AND (saldo_disponible IS DISTINCT FROM v_nuevo_saldo OR estado IS DISTINCT FROM v_nuevo_estado);
END;
$$;

REVOKE ALL ON FUNCTION public._recalc_anticipo_saldo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._recalc_anticipo_saldo(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_anticipo_saldo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._recalc_anticipo_saldo(OLD.anticipo_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.anticipo_id IS DISTINCT FROM OLD.anticipo_id THEN
    PERFORM public._recalc_anticipo_saldo(OLD.anticipo_id);
    PERFORM public._recalc_anticipo_saldo(NEW.anticipo_id);
    RETURN NEW;
  ELSE
    PERFORM public._recalc_anticipo_saldo(NEW.anticipo_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_anticipo_saldo ON public.anticipos_aplicaciones;
CREATE TRIGGER trg_anticipo_saldo
  AFTER INSERT OR UPDATE OR DELETE ON public.anticipos_aplicaciones
  FOR EACH ROW EXECUTE FUNCTION public.tg_anticipo_saldo();

-- 5) RPC: registrar_anticipo_proveedor
CREATE OR REPLACE FUNCTION public.registrar_anticipo_proveedor(
  p_proveedor_id uuid,
  p_monto numeric,
  p_moneda public.moneda,
  p_fecha_anticipo date DEFAULT CURRENT_DATE,
  p_tipo_cambio_usd numeric DEFAULT NULL,
  p_metodo_pago text DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_cuenta_bancaria_id uuid DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS public.anticipos_proveedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_org uuid;
  v_email text;
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden registrar anticipos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto debe ser mayor a cero.';
  END IF;

  SELECT organization_id INTO v_org FROM public.proveedores WHERE id = p_proveedor_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_NO_EXISTE: El proveedor no existe.';
  END IF;

  IF v_org <> public.current_user_org_id() AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_OTRA_ORG: El proveedor pertenece a otra organización.';
  END IF;

  INSERT INTO public.anticipos_proveedor
    (organization_id, proveedor_id, fecha_anticipo, monto, moneda, tipo_cambio_usd,
     metodo_pago, referencia, cuenta_bancaria_id, notas,
     estado, saldo_disponible, created_by)
  VALUES
    (v_org, p_proveedor_id, p_fecha_anticipo, p_monto, p_moneda, p_tipo_cambio_usd,
     p_metodo_pago, p_referencia, p_cuenta_bancaria_id, p_notas,
     'disponible', p_monto, v_uid)
  RETURNING * INTO v_row;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('proveedor_id', p_proveedor_id, 'monto', p_monto, 'moneda', p_moneda));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_anticipo_proveedor(uuid,numeric,public.moneda,date,numeric,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_proveedor(uuid,numeric,public.moneda,date,numeric,text,text,uuid,text) TO authenticated, service_role;

-- 6) RPC: aplicar_anticipo_a_factura
CREATE OR REPLACE FUNCTION public.aplicar_anticipo_a_factura(
  p_anticipo_id uuid,
  p_factura_id uuid,
  p_monto numeric,
  p_fecha_aplicacion date DEFAULT CURRENT_DATE
)
RETURNS public.anticipos_aplicaciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_uid uuid := auth.uid();
  v_email text;
  v_monto_convertido numeric(18,4);
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden aplicar anticipos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto a aplicar debe ser mayor a cero.';
  END IF;

  SELECT * INTO v_ant FROM public.anticipos_proveedor WHERE id = p_anticipo_id;
  IF v_ant.id IS NULL OR v_ant.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;
  IF v_ant.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo está cancelado.';
  END IF;
  IF v_ant.saldo_disponible + 0.01 < p_monto THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_SALDO: Saldo disponible (%.4f) insuficiente para aplicar %.4f.',
      v_ant.saldo_disponible, p_monto;
  END IF;

  SELECT * INTO v_fact FROM public.proveedor_facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura no existe.';
  END IF;
  IF v_fact.estado_aprobacion <> 'aprobada' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura debe estar aprobada antes de aplicar un anticipo.';
  END IF;
  IF v_fact.organization_id <> v_ant.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_ORG_MISMATCH: Anticipo y factura pertenecen a organizaciones distintas.';
  END IF;
  IF v_fact.proveedor_id IS DISTINCT FROM v_ant.proveedor_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_MISMATCH: Anticipo y factura pertenecen a proveedores distintos.';
  END IF;

  -- Convertir a la moneda de la factura reusando helper de Fase L.
  v_monto_convertido := public.convertir_monto_pago_a_factura(
    p_monto, v_ant.moneda, v_ant.tipo_cambio_usd, v_fact.moneda, v_fact.tipo_cambio_usd);

  -- Materializar pago para que triggers de recálculo (N) y sobrepago (L) apliquen.
  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
     tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
     created_by, es_anticipo_aplicado)
  VALUES
    (v_ant.organization_id, p_factura_id, p_fecha_aplicacion, p_monto, v_ant.moneda,
     v_ant.tipo_cambio_usd, v_ant.metodo_pago,
     COALESCE(v_ant.referencia,'') || ' (anticipo ' || v_ant.id::text || ')',
     v_ant.cuenta_bancaria_id, 'Aplicación de anticipo ' || v_ant.id::text,
     v_uid, true)
  RETURNING * INTO v_pago;

  INSERT INTO public.anticipos_aplicaciones
    (organization_id, anticipo_id, proveedor_factura_id, pago_proveedor_id,
     monto_aplicado, moneda_aplicada, fecha_aplicacion, created_by)
  VALUES
    (v_ant.organization_id, p_anticipo_id, p_factura_id, v_pago.id,
     p_monto, v_ant.moneda, p_fecha_aplicacion, v_uid)
  RETURNING * INTO v_ap;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_ant.organization_id, v_uid, COALESCE(v_email,''), 'aplicar_anticipo_a_factura', 'cxp',
            v_ap.id, 'Aplicación ' || v_ap.id::text,
            jsonb_build_object('anticipo_id', p_anticipo_id, 'factura_id', p_factura_id,
                               'monto', p_monto, 'moneda', v_ant.moneda,
                               'monto_convertido', v_monto_convertido,
                               'pago_id', v_pago.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en aplicar_anticipo_a_factura: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_ap;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid,uuid,numeric,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid,uuid,numeric,date) TO authenticated, service_role;

-- 7) RPC: cancelar_anticipo_proveedor
CREATE OR REPLACE FUNCTION public.cancelar_anticipo_proveedor(
  p_id uuid,
  p_motivo text
)
RETURNS public.anticipos_proveedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT * INTO v_row FROM public.anticipos_proveedor WHERE id = p_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
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
$$;

REVOKE ALL ON FUNCTION public.cancelar_anticipo_proveedor(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_anticipo_proveedor(uuid,text) TO authenticated, service_role;

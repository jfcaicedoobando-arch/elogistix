ALTER TABLE public.crm_brokers ADD COLUMN comision_kam_pct numeric(5,2)
  CHECK (comision_kam_pct IS NULL OR (comision_kam_pct >= 0 AND comision_kam_pct <= 100));
COMMENT ON COLUMN public.crm_brokers.comision_kam_pct IS '% del KAM en cuentas de este broker; NULL = el KAM conserva su % normal.';

CREATE TABLE public.liquidaciones_broker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  broker_id uuid NOT NULL REFERENCES public.crm_brokers(id) ON DELETE RESTRICT,
  periodo text NOT NULL CHECK (periodo ~ '^\d{4}-\d{2}$'),
  total_mxn numeric(14,2) NOT NULL CHECK (total_mxn > 0),
  estado text NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Pagado')),
  fecha_pago date,
  referencia text,
  creada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.liquidaciones_broker TO authenticated;
GRANT ALL ON public.liquidaciones_broker TO service_role;
ALTER TABLE public.liquidaciones_broker ENABLE ROW LEVEL SECURITY;
CREATE POLICY liquidaciones_broker_select ON public.liquidaciones_broker FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.crm_brokers b WHERE b.id = broker_id AND b.user_id = (SELECT auth.uid()))
  OR public.has_any_role_in_org((SELECT auth.uid()), ARRAY['admin_org','contador','tesorero','gerente_comercial']::public.app_role[], organization_id)
);

CREATE TABLE public.comisiones_broker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  comision_devengada_id uuid NOT NULL UNIQUE REFERENCES public.comisiones_devengadas(id) ON DELETE RESTRICT,
  pago_factura_id uuid NOT NULL,
  factura_id uuid NOT NULL,
  embarque_id uuid,
  broker_id uuid NOT NULL REFERENCES public.crm_brokers(id) ON DELETE RESTRICT,
  utilidad_prorrateada_mxn numeric(14,2) NOT NULL DEFAULT 0,
  porcentaje_aplicado numeric(5,2) NOT NULL DEFAULT 0,
  comision_mxn numeric(14,2) NOT NULL DEFAULT 0 CHECK (comision_mxn >= 0),
  estado public.estado_comision NOT NULL DEFAULT 'Devengada',
  liquidacion_id uuid REFERENCES public.liquidaciones_broker(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comisiones_broker_broker_idx ON public.comisiones_broker (broker_id, estado);
GRANT SELECT ON public.comisiones_broker TO authenticated;
GRANT ALL ON public.comisiones_broker TO service_role;
ALTER TABLE public.comisiones_broker ENABLE ROW LEVEL SECURITY;
CREATE POLICY comisiones_broker_select ON public.comisiones_broker FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.crm_brokers b WHERE b.id = broker_id AND b.user_id = (SELECT auth.uid()))
  OR public.has_any_role_in_org((SELECT auth.uid()), ARRAY['admin_org','contador','tesorero','gerente_comercial']::public.app_role[], organization_id)
);

-- Broker activo dueño de la cuenta del cliente; sólo cobros registrados desde el arranque de la fase 3.
CREATE FUNCTION public._broker_de_pago(p_org uuid, p_pago_id uuid, p_factura_id uuid)
RETURNS public.crm_brokers LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.* FROM public.pagos_factura p
    JOIN public.facturas f ON f.id = p_factura_id
    JOIN public.crm_empresas e ON e.cliente_id = f.cliente_id AND e.organization_id = p_org AND e.deleted_at IS NULL
    JOIN public.crm_brokers b ON b.id = e.broker_id AND b.activo AND b.organization_id = p_org
   WHERE p.id = p_pago_id AND p.created_at >= timestamptz '2026-11-14 01:00:00+00'
   ORDER BY e.created_at LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._broker_de_pago(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- KAM en cuenta con broker: usa el % KAM del broker salvo excepción explícita.
CREATE FUNCTION public._comision_kam_broker() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE b public.crm_brokers%ROWTYPE; v_cliente uuid;
BEGIN
  IF NEW.estado <> 'Devengada' OR NEW.vendedora_id IS NULL THEN RETURN NEW; END IF;
  b := public._broker_de_pago(NEW.organization_id, NEW.pago_factura_id, NEW.factura_id);
  IF b.id IS NULL OR b.comision_kam_pct IS NULL THEN RETURN NEW; END IF;
  SELECT cliente_id INTO v_cliente FROM public.facturas WHERE id = NEW.factura_id;
  IF EXISTS (SELECT 1 FROM public.comisiones_excepciones x
              WHERE x.organization_id = NEW.organization_id AND x.vendedora_id = NEW.vendedora_id
                AND x.activa AND x.deleted_at IS NULL
                AND ((NEW.embarque_id IS NOT NULL AND x.embarque_id = NEW.embarque_id) OR x.cliente_id = v_cliente)) THEN
    RETURN NEW;
  END IF;
  NEW.porcentaje_aplicado := b.comision_kam_pct;
  NEW.comision_mxn := GREATEST(0, ROUND(NEW.utilidad_prorrateada_mxn * b.comision_kam_pct / 100.0, 2));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_b00_comision_kam_broker BEFORE INSERT OR UPDATE ON public.comisiones_devengadas
  FOR EACH ROW EXECUTE FUNCTION public._comision_kam_broker();

-- Renglón del broker espejo de cada comisión devengada (misma utilidad cobrada).
CREATE FUNCTION public._comision_broker_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE b public.crm_brokers%ROWTYPE; cur public.comisiones_broker%ROWTYPE; v_activa boolean; v_monto numeric(14,2);
BEGIN
  SELECT * INTO cur FROM public.comisiones_broker WHERE comision_devengada_id = NEW.id FOR UPDATE;
  v_activa := NEW.estado = 'Devengada';
  IF FOUND THEN
    IF cur.estado = 'Liquidada' THEN
      IF NEW.estado IN ('Cancelada','Por recuperar') THEN
        UPDATE public.comisiones_broker SET estado = 'Por recuperar', updated_at = now() WHERE id = cur.id;
      END IF;
      RETURN NEW;
    END IF;
    IF cur.estado = 'Por recuperar' THEN RETURN NEW; END IF;
    v_monto := CASE WHEN v_activa THEN GREATEST(0, ROUND(NEW.utilidad_prorrateada_mxn * cur.porcentaje_aplicado / 100.0, 2)) ELSE 0 END;
    UPDATE public.comisiones_broker
       SET utilidad_prorrateada_mxn = NEW.utilidad_prorrateada_mxn, comision_mxn = v_monto,
           embarque_id = NEW.embarque_id,
           estado = CASE WHEN v_activa THEN 'Devengada'::public.estado_comision ELSE 'Cancelada'::public.estado_comision END,
           updated_at = now()
     WHERE id = cur.id;
    RETURN NEW;
  END IF;
  IF NOT v_activa THEN RETURN NEW; END IF;
  b := public._broker_de_pago(NEW.organization_id, NEW.pago_factura_id, NEW.factura_id);
  IF b.id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.comisiones_broker (organization_id, comision_devengada_id, pago_factura_id, factura_id, embarque_id,
    broker_id, utilidad_prorrateada_mxn, porcentaje_aplicado, comision_mxn)
  VALUES (NEW.organization_id, NEW.id, NEW.pago_factura_id, NEW.factura_id, NEW.embarque_id, b.id,
    NEW.utilidad_prorrateada_mxn, b.comision_pct,
    GREATEST(0, ROUND(NEW.utilidad_prorrateada_mxn * b.comision_pct / 100.0, 2)));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_comision_broker_sync AFTER INSERT OR UPDATE ON public.comisiones_devengadas
  FOR EACH ROW EXECUTE FUNCTION public._comision_broker_sync();

-- Portal: comisiones del broker con su estatus.
CREATE FUNCTION public.broker_mis_comisiones()
RETURNS TABLE (id uuid, organizacion text, empresa text, factura text, fecha timestamptz,
               utilidad_mxn numeric, porcentaje numeric, comision_mxn numeric, estado text, pagada boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.id, o.nombre, coalesce(cl.nombre, ''), coalesce(nullif(concat(f.serie, f.numero), ''), ''),
         c.created_at, c.utilidad_prorrateada_mxn, c.porcentaje_aplicado, c.comision_mxn, c.estado::text,
         coalesce(l.estado = 'Pagado', false)
    FROM public.comisiones_broker c
    JOIN public.crm_brokers b ON b.id = c.broker_id AND b.user_id = auth.uid()
    JOIN public.organizations o ON o.id = c.organization_id
    JOIN public.facturas f ON f.id = c.factura_id
    LEFT JOIN public.clientes cl ON cl.id = f.cliente_id
    LEFT JOIN public.liquidaciones_broker l ON l.id = c.liquidacion_id
   ORDER BY c.created_at DESC LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.broker_mis_comisiones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broker_mis_comisiones() TO authenticated;

-- Liquidación mensual (mismos roles que vendedores).
CREATE FUNCTION public.crm_generar_liquidacion_broker(p_broker_id uuid, p_periodo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_org uuid := public.org_scope(); v_total numeric(14,2); v_id uuid;
BEGIN
  IF NOT public.has_any_role_in_org(auth.uid(), ARRAY['admin_org','contador','tesorero']::public.app_role[], v_org) THEN
    RAISE EXCEPTION 'LC_BROKER_LIQUIDAR_NO_AUTORIZADO' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crm_brokers WHERE id = p_broker_id AND organization_id = v_org) THEN
    RAISE EXCEPTION 'LC_BROKER_NO_AUTORIZADO' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('comisiones_broker:' || p_broker_id::text, 0));
  SELECT coalesce(sum(comision_mxn), 0) INTO v_total FROM public.comisiones_broker
   WHERE broker_id = p_broker_id AND organization_id = v_org AND estado = 'Devengada' AND liquidacion_id IS NULL
     AND to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM') = p_periodo;
  IF v_total <= 0 THEN RAISE EXCEPTION 'LC_BROKER_SIN_DEVENGADO'; END IF;
  INSERT INTO public.liquidaciones_broker (organization_id, broker_id, periodo, total_mxn, creada_por)
  VALUES (v_org, p_broker_id, p_periodo, v_total, auth.uid()) RETURNING id INTO v_id;
  UPDATE public.comisiones_broker SET estado = 'Liquidada', liquidacion_id = v_id, updated_at = now()
   WHERE broker_id = p_broker_id AND organization_id = v_org AND estado = 'Devengada' AND liquidacion_id IS NULL
     AND to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM') = p_periodo;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.crm_generar_liquidacion_broker(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_generar_liquidacion_broker(uuid, text) TO authenticated;

CREATE FUNCTION public.crm_pagar_liquidacion_broker(p_id uuid, p_fecha date, p_referencia text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_org uuid := public.org_scope();
BEGIN
  IF NOT public.has_any_role_in_org(auth.uid(), ARRAY['admin_org','contador','tesorero']::public.app_role[], v_org) THEN
    RAISE EXCEPTION 'LC_BROKER_LIQUIDAR_NO_AUTORIZADO' USING ERRCODE = '42501';
  END IF;
  IF p_fecha IS NULL OR length(btrim(coalesce(p_referencia, ''))) = 0 THEN RAISE EXCEPTION 'LC_BROKER_PAGO_DATOS'; END IF;
  UPDATE public.liquidaciones_broker SET estado = 'Pagado', fecha_pago = p_fecha, referencia = btrim(p_referencia), updated_at = now()
   WHERE id = p_id AND organization_id = v_org AND estado = 'Pendiente';
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_BROKER_LIQUIDACION_NO_PENDIENTE'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.crm_pagar_liquidacion_broker(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_pagar_liquidacion_broker(uuid, date, text) TO authenticated;

-- Resumen interno por broker para liquidar.
CREATE FUNCTION public.crm_brokers_comisiones_resumen()
RETURNS TABLE (broker_id uuid, broker text, devengado_mxn numeric, liquidado_pendiente_mxn numeric, pagado_mxn numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.id, b.nombre,
    coalesce(sum(c.comision_mxn) FILTER (WHERE c.estado = 'Devengada'), 0),
    coalesce(sum(c.comision_mxn) FILTER (WHERE c.estado = 'Liquidada' AND l.estado = 'Pendiente'), 0),
    coalesce(sum(c.comision_mxn) FILTER (WHERE c.estado = 'Liquidada' AND l.estado = 'Pagado'), 0)
    FROM public.crm_brokers b
    LEFT JOIN public.comisiones_broker c ON c.broker_id = b.id
    LEFT JOIN public.liquidaciones_broker l ON l.id = c.liquidacion_id
   WHERE b.organization_id = public.org_scope()
     AND public.has_any_role_in_org(auth.uid(), ARRAY['admin_org','contador','tesorero','gerente_comercial']::public.app_role[], b.organization_id)
   GROUP BY b.id, b.nombre ORDER BY b.nombre LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.crm_brokers_comisiones_resumen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_brokers_comisiones_resumen() TO authenticated;

-- % del KAM por broker: sólo admin_org / gerente comercial.
CREATE FUNCTION public.crm_broker_set_porcentajes(p_broker_id uuid, p_broker_pct numeric, p_kam_pct numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_org uuid := public.org_scope();
BEGIN
  IF NOT public.has_any_role_in_org(auth.uid(), ARRAY['admin_org','gerente_comercial']::public.app_role[], v_org) THEN
    RAISE EXCEPTION 'LC_BROKER_PCT_NO_AUTORIZADO' USING ERRCODE = '42501';
  END IF;
  IF p_broker_pct IS NULL OR p_broker_pct < 0 OR p_broker_pct > 100 OR (p_kam_pct IS NOT NULL AND (p_kam_pct < 0 OR p_kam_pct > 100)) THEN
    RAISE EXCEPTION 'LC_BROKER_PCT_INVALIDO';
  END IF;
  UPDATE public.crm_brokers SET comision_pct = p_broker_pct, comision_kam_pct = p_kam_pct, updated_at = now()
   WHERE id = p_broker_id AND organization_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_BROKER_NO_AUTORIZADO' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.crm_broker_set_porcentajes(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_broker_set_porcentajes(uuid, numeric, numeric) TO authenticated;
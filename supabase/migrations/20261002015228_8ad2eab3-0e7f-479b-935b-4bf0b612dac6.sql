-- Fase 7 CRM: tableros y reportes dinámicos.

CREATE TABLE public.crm_tableros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tableros TO authenticated;
GRANT ALL ON public.crm_tableros TO service_role;
ALTER TABLE public.crm_tableros ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_tableros_leer ON public.crm_tableros FOR SELECT TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id));
CREATE POLICY crm_tableros_escribir ON public.crm_tableros FOR ALL TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id) AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id) AND public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.crm_reportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  tablero_id uuid NOT NULL REFERENCES public.crm_tableros(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  objeto text NOT NULL CHECK (objeto IN ('empresa','oportunidad','actividad','solicitud_pricing')),
  medida text NOT NULL DEFAULT 'conteo' CHECK (medida IN ('conteo','suma_monto_usd')),
  agrupacion text NOT NULL,
  filtro jsonb NOT NULL DEFAULT '{}'::jsonb,
  tipo_grafica text NOT NULL DEFAULT 'barras' CHECK (tipo_grafica IN ('barras','linea','pastel','numero','tabla')),
  posicion integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (
    (objeto = 'empresa' AND agrupacion IN ('puntaje','mes')) OR
    (objeto = 'oportunidad' AND agrupacion IN ('etapa','vendedor','modo','puntaje','mes')) OR
    (objeto = 'actividad' AND agrupacion IN ('tipo','responsable','mes')) OR
    (objeto = 'solicitud_pricing' AND agrupacion IN ('estado','complejidad','servicio','mes'))
  ),
  CHECK (medida = 'conteo' OR objeto = 'oportunidad')
);
CREATE INDEX crm_reportes_tablero_idx ON public.crm_reportes(tablero_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_reportes TO authenticated;
GRANT ALL ON public.crm_reportes TO service_role;
ALTER TABLE public.crm_reportes ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_reportes_leer ON public.crm_reportes FOR SELECT TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id));
CREATE POLICY crm_reportes_escribir ON public.crm_reportes FOR ALL TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id) AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id) AND public.has_role(auth.uid(), 'super_admin'));

-- Guardia: el reporte debe pertenecer a un tablero de la misma empresa; updated_at automático.
CREATE OR REPLACE FUNCTION public._crm_reportes_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.crm_tableros WHERE id = NEW.tablero_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'LC_REPORTE_TABLERO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.tablero_id <> OLD.tablero_id OR NEW.organization_id <> OLD.organization_id) THEN
    RAISE EXCEPTION 'LC_REPORTE_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crm_reportes_guard BEFORE INSERT OR UPDATE ON public.crm_reportes
  FOR EACH ROW EXECUTE FUNCTION public._crm_reportes_guard();
REVOKE ALL ON FUNCTION public._crm_reportes_guard() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._crm_tableros_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crm_tableros_touch BEFORE UPDATE ON public.crm_tableros
  FOR EACH ROW EXECUTE FUNCTION public._crm_tableros_touch();

-- Datos de un reporte, calculados al momento. SECURITY INVOKER: agrega sólo lo
-- que las políticas de cada tabla dejan ver a quien consulta.
CREATE OR REPLACE FUNCTION public.crm_reporte_datos(p_reporte_id uuid)
RETURNS TABLE(etiqueta text, valor numeric)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  r public.crm_reportes%ROWTYPE;
  v_desde date; v_hasta date;
  v_usd numeric; v_eur numeric;
BEGIN
  SELECT * INTO r FROM public.crm_reportes WHERE id = p_reporte_id AND deleted_at IS NULL;
  IF r.id IS NULL OR r.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_REPORTE_NO_ENCONTRADO' USING ERRCODE = 'P0001';
  END IF;
  v_desde := nullif(r.filtro->>'desde', '')::date;
  v_hasta := nullif(r.filtro->>'hasta', '')::date;
  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur
    FROM public.tipos_cambio_dof t WHERE t.usd_mxn > 0 ORDER BY t.fecha DESC LIMIT 1;

  IF r.objeto = 'empresa' THEN
    RETURN QUERY
      SELECT coalesce(k.llave, 'Sin dato'), count(*)::numeric
      FROM (
        SELECT CASE r.agrupacion
          WHEN 'puntaje' THEN e.letra_empresa_crm
          WHEN 'mes' THEN to_char(date_trunc('month', e.created_at), 'YYYY-MM')
        END AS llave
        FROM public.crm_empresas e
        WHERE e.organization_id = r.organization_id AND e.deleted_at IS NULL
          AND (v_desde IS NULL OR e.created_at::date >= v_desde)
          AND (v_hasta IS NULL OR e.created_at::date <= v_hasta)
      ) k GROUP BY 1 ORDER BY 1;

  ELSIF r.objeto = 'oportunidad' THEN
    RETURN QUERY
      SELECT coalesce(k.llave, 'Sin dato'),
        CASE WHEN r.medida = 'suma_monto_usd' THEN coalesce(sum(k.monto_usd), 0) ELSE count(*)::numeric END
      FROM (
        SELECT CASE r.agrupacion
          WHEN 'etapa' THEN ep.nombre
          WHEN 'vendedor' THEN o.vendedor_email
          WHEN 'modo' THEN o.modo
          WHEN 'puntaje' THEN o.letra_oportunidad_crm
          WHEN 'mes' THEN to_char(date_trunc('month', o.created_at), 'YYYY-MM')
        END AS llave,
        CASE
          WHEN coalesce(o.moneda, 'USD') = 'USD' THEN o.monto_estimado
          WHEN o.moneda = 'MXN' AND v_usd > 0 THEN o.monto_estimado / v_usd
          WHEN o.moneda = 'EUR' AND v_usd > 0 AND v_eur > 0 THEN o.monto_estimado * v_eur / v_usd
        END AS monto_usd
        FROM public.crm_oportunidades o
        LEFT JOIN public.crm_etapas_pipeline ep ON ep.id = o.etapa_id
        WHERE o.organization_id = r.organization_id AND o.deleted_at IS NULL
          AND (v_desde IS NULL OR o.created_at::date >= v_desde)
          AND (v_hasta IS NULL OR o.created_at::date <= v_hasta)
          AND (nullif(r.filtro->>'etapa_id', '') IS NULL OR o.etapa_id = nullif(r.filtro->>'etapa_id', '')::uuid)
          AND (nullif(r.filtro->>'vendedor', '') IS NULL OR o.vendedor_email = r.filtro->>'vendedor')
      ) k GROUP BY 1 ORDER BY 1;

  ELSIF r.objeto = 'actividad' THEN
    RETURN QUERY
      SELECT coalesce(k.llave, 'Sin dato'), count(*)::numeric
      FROM (
        SELECT CASE r.agrupacion
          WHEN 'tipo' THEN a.tipo::text
          WHEN 'responsable' THEN nullif(a.responsable_email, '')
          WHEN 'mes' THEN to_char(date_trunc('month', a.created_at), 'YYYY-MM')
        END AS llave
        FROM public.crm_actividades a
        WHERE a.organization_id = r.organization_id AND a.deleted_at IS NULL
          AND (v_desde IS NULL OR a.created_at::date >= v_desde)
          AND (v_hasta IS NULL OR a.created_at::date <= v_hasta)
      ) k GROUP BY 1 ORDER BY 1;

  ELSE -- solicitud_pricing
    RETURN QUERY
      SELECT coalesce(k.llave, 'Sin dato'), count(*)::numeric
      FROM (
        SELECT CASE r.agrupacion
          WHEN 'estado' THEN s.estado
          WHEN 'complejidad' THEN s.complejidad
          WHEN 'servicio' THEN s.servicio
          WHEN 'mes' THEN to_char(date_trunc('month', s.created_at), 'YYYY-MM')
        END AS llave
        FROM public.crm_solicitudes_pricing s
        WHERE s.organization_id = r.organization_id AND s.deleted_at IS NULL
          AND (v_desde IS NULL OR s.created_at::date >= v_desde)
          AND (v_hasta IS NULL OR s.created_at::date <= v_hasta)
      ) k GROUP BY 1 ORDER BY 1;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.crm_reporte_datos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_reporte_datos(uuid) TO authenticated, service_role;
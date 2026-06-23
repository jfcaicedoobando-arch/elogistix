
-- 1) Tabla agente_users
CREATE TABLE IF NOT EXISTS public.agente_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agente_id uuid NOT NULL REFERENCES public.costeo_agentes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agente_id)
);

CREATE INDEX IF NOT EXISTS idx_agente_users_user ON public.agente_users(user_id);
CREATE INDEX IF NOT EXISTS idx_agente_users_agente ON public.agente_users(agente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_users TO authenticated;
GRANT ALL ON public.agente_users TO service_role;

ALTER TABLE public.agente_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org staff manage agente_users"
  ON public.agente_users FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = agente_users.organization_id
        AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing','operador'))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = agente_users.organization_id
        AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing'))
  );

CREATE POLICY "Agente read own row"
  ON public.agente_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2) Helpers
CREATE OR REPLACE FUNCTION public.current_agente_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agente_id FROM public.agente_users WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_agente_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.agente_users WHERE user_id = auth.uid() LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_agente_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_agente_org() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_agente_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_agente_org() TO authenticated;

-- 3) estado_aprobacion en costeo_tarifas
ALTER TABLE public.costeo_tarifas
  ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT 'vigente'
    CHECK (estado_aprobacion IN ('borrador','vigente','rechazada'));
CREATE INDEX IF NOT EXISTS idx_costeo_tarifas_estado_aprobacion
  ON public.costeo_tarifas(estado_aprobacion);
COMMENT ON COLUMN public.costeo_tarifas.estado_aprobacion IS
  'Workflow de aprobación cuando la tarifa viene del portal del agente: borrador/vigente/rechazada.';

-- 4) Recrear vista costeo_tarifas_vigentes_v con filtro
DROP VIEW IF EXISTS public.costeo_tarifas_vigentes_v CASCADE;

CREATE VIEW public.costeo_tarifas_vigentes_v
WITH (security_invoker = on) AS
SELECT t.id, t.organization_id, t.agente_id,
       a.nombre AS agente_nombre, a.dias_credito,
       t.naviera_id, n.name AS naviera_nombre,
       t.ruta_id, r.puerto_origen_id, r.puerto_destino_id,
       po.name AS puerto_origen_nombre, pd.name AS puerto_destino_nombre,
       t.tipo_contenedor_id, tc.name AS tipo_contenedor_nombre,
       t.moneda, t.flete_base,
       COALESCE((SELECT sum(rc.monto) FROM public.costeo_tarifa_recargos rc
                 WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS recargos_total,
       t.flete_base + COALESCE((SELECT sum(rc.monto) FROM public.costeo_tarifa_recargos rc
                 WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS total_comparable,
       t.dias_libres_demoras, t.transit_time_dias,
       t.vigente_desde, t.vigente_hasta, t.estado,
       nc.id AS naviera_condicion_id,
       COALESCE(nc.tiene_carta_garantia, false) AS naviera_tiene_carta_garantia,
       nc.carta_garantia_vigente_hasta AS naviera_carta_garantia_vigente_hasta,
       (nc.tiene_carta_garantia = true
        AND nc.carta_garantia_vigente_hasta IS NOT NULL
        AND nc.carta_garantia_vigente_hasta >= CURRENT_DATE) AS naviera_carta_garantia_activa,
       nc.dias_libres_demoras_default AS naviera_dias_libres_default,
       (SELECT dt.monto_por_dia FROM public.costeo_naviera_demoras_tarifa dt
          WHERE dt.naviera_condicion_id = nc.id
            AND dt.tipo_contenedor_id = t.tipo_contenedor_id
            AND dt.desde_dia <= 6
            AND (dt.hasta_dia IS NULL OR dt.hasta_dia >= 6)
          LIMIT 1) AS naviera_demora_dia_6,
       t.dias_libres_almacenaje_lcl,
       COALESCE(t.frecuencia_override, nc.frecuencia) AS frecuencia_resuelta,
       nc.frecuencia AS naviera_frecuencia,
       t.frecuencia_override AS tarifa_frecuencia_override
  FROM public.costeo_tarifas t
  JOIN public.costeo_agentes a ON a.id = t.agente_id
  JOIN public.navieras n ON n.id = t.naviera_id
  JOIN public.costeo_rutas r ON r.id = t.ruta_id
  JOIN public.puertos po ON po.id = r.puerto_origen_id
  JOIN public.puertos pd ON pd.id = r.puerto_destino_id
  JOIN public.tipos_contenedor tc ON tc.id = t.tipo_contenedor_id
  LEFT JOIN public.costeo_navieras_condiciones nc
         ON nc.naviera_id = t.naviera_id
        AND nc.organization_id = t.organization_id
 WHERE t.estado_aprobacion = 'vigente';

GRANT SELECT ON public.costeo_tarifas_vigentes_v TO authenticated;
GRANT SELECT ON public.costeo_tarifas_vigentes_v TO service_role;

CREATE OR REPLACE FUNCTION public.get_top_tarifas(
  _ruta_id uuid, _tipo_contenedor_id uuid, _limit integer DEFAULT 3
) RETURNS SETOF public.costeo_tarifas_vigentes_v
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT v.* FROM public.costeo_tarifas_vigentes_v v
   WHERE v.ruta_id = _ruta_id
     AND v.tipo_contenedor_id = _tipo_contenedor_id
     AND v.vigente_desde <= CURRENT_DATE
     AND v.vigente_hasta >= CURRENT_DATE
   ORDER BY v.total_comparable ASC
   LIMIT _limit
$$;
GRANT EXECUTE ON FUNCTION public.get_top_tarifas(uuid, uuid, integer) TO authenticated;

-- 5) RLS para rol agente_carga
DROP POLICY IF EXISTS "Agente CRUD own tarifas" ON public.costeo_tarifas;
CREATE POLICY "Agente CRUD own tarifas" ON public.costeo_tarifas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND agente_id = public.current_agente_id()
    AND organization_id = public.current_agente_org()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_carga')
    AND agente_id = public.current_agente_id()
    AND organization_id = public.current_agente_org()
    AND estado_aprobacion IN ('borrador','rechazada')
  );

DROP POLICY IF EXISTS "Agente CRUD own recargos" ON public.costeo_tarifa_recargos;
CREATE POLICY "Agente CRUD own recargos" ON public.costeo_tarifa_recargos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND EXISTS (SELECT 1 FROM public.costeo_tarifas t
      WHERE t.id = costeo_tarifa_recargos.tarifa_id
        AND t.agente_id = public.current_agente_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_carga')
    AND EXISTS (SELECT 1 FROM public.costeo_tarifas t
      WHERE t.id = costeo_tarifa_recargos.tarifa_id
        AND t.agente_id = public.current_agente_id())
  );

DROP POLICY IF EXISTS "Agente CRUD own naviera condiciones" ON public.costeo_navieras_condiciones;
CREATE POLICY "Agente CRUD own naviera condiciones" ON public.costeo_navieras_condiciones
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND EXISTS (SELECT 1 FROM public.costeo_agentes a
      WHERE a.id = public.current_agente_id()
        AND a.proveedor_id = costeo_navieras_condiciones.proveedor_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_carga')
    AND EXISTS (SELECT 1 FROM public.costeo_agentes a
      WHERE a.id = public.current_agente_id()
        AND a.proveedor_id = costeo_navieras_condiciones.proveedor_id)
  );

DROP POLICY IF EXISTS "Agente CRUD own demoras tabulador" ON public.costeo_naviera_demoras_tarifa;
CREATE POLICY "Agente CRUD own demoras tabulador" ON public.costeo_naviera_demoras_tarifa
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND EXISTS (SELECT 1 FROM public.costeo_navieras_condiciones nc
      JOIN public.costeo_agentes a ON a.proveedor_id = nc.proveedor_id
      WHERE nc.id = costeo_naviera_demoras_tarifa.naviera_condicion_id
        AND a.id = public.current_agente_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_carga')
    AND EXISTS (SELECT 1 FROM public.costeo_navieras_condiciones nc
      JOIN public.costeo_agentes a ON a.proveedor_id = nc.proveedor_id
      WHERE nc.id = costeo_naviera_demoras_tarifa.naviera_condicion_id
        AND a.id = public.current_agente_id())
  );

DROP POLICY IF EXISTS "Agente read own embarques" ON public.embarques;
CREATE POLICY "Agente read own embarques" ON public.embarques
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND organization_id = public.current_agente_org()
    AND agente IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.costeo_agentes a
      WHERE a.id = public.current_agente_id()
        AND lower(trim(a.nombre)) = lower(trim(embarques.agente)))
  );

-- 6) RPC de aprobación
CREATE OR REPLACE FUNCTION public.agente_aprobar_tarifa(
  _tarifa_id uuid, _estado text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  IF _estado NOT IN ('vigente','rechazada','borrador') THEN
    RAISE EXCEPTION 'estado inválido: %', _estado;
  END IF;
  SELECT organization_id INTO v_org FROM public.costeo_tarifas WHERE id = _tarifa_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'tarifa no encontrada';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = v_org
        AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing','operador'))
  ) THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;
  UPDATE public.costeo_tarifas
     SET estado_aprobacion = _estado, updated_at = now()
   WHERE id = _tarifa_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.agente_aprobar_tarifa(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_aprobar_tarifa(uuid, text) TO authenticated;

-- 1) Helper SECURITY DEFINER: proveedor_id del agente autenticado
CREATE OR REPLACE FUNCTION public.current_agente_proveedor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT proveedor_id FROM public.costeo_agentes
   WHERE id = public.current_agente_id() LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_agente_proveedor_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_agente_proveedor_id() TO authenticated;

-- 2) B-084 · Backfill embarques.agente_id por nombre exacto en la misma org
DO $$
DECLARE
  v_actualizados integer;
  v_huerfanos   integer;
BEGIN
  -- El trigger tg_bloquear_embarque_cerrado_self impide tocar embarques
  -- cerrados; este backfill sólo rellena agente_id (dato de vinculación).
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.embarques e
     SET agente_id = a.id
    FROM public.costeo_agentes a
   WHERE e.agente_id IS NULL
     AND e.agente IS NOT NULL
     AND e.organization_id = a.organization_id
     AND lower(trim(e.agente)) = lower(trim(a.nombre));
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;

  SELECT count(*) INTO v_huerfanos
    FROM public.embarques e
   WHERE e.agente_id IS NULL AND e.agente IS NOT NULL;

  RAISE NOTICE 'B-084 backfill: % embarques vinculados a agente_id; % embarques con agente en texto sin match', v_actualizados, v_huerfanos;
END $$;

-- 3a) "Agente read own embarques": por agente_id
DROP POLICY IF EXISTS "Agente read own embarques" ON public.embarques;
CREATE POLICY "Agente read own embarques" ON public.embarques
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND organization_id = public.current_agente_org()
    AND agente_id IS NOT NULL
    AND agente_id = public.current_agente_id()
  );

-- 3b) documentos
DROP POLICY IF EXISTS "Agente read own documentos" ON public.documentos_embarque;
CREATE POLICY "Agente read own documentos"
  ON public.documentos_embarque FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.id = documentos_embarque.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente_id IS NOT NULL
        AND e.agente_id = current_agente_id()
    )
  );

-- 3c) notas
DROP POLICY IF EXISTS "Agente read own notas" ON public.notas_embarque;
CREATE POLICY "Agente read own notas"
  ON public.notas_embarque FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND tipo = ANY (ARRAY['nota'::tipo_nota, 'cambio_estado'::tipo_nota])
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.id = notas_embarque.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente_id IS NOT NULL
        AND e.agente_id = current_agente_id()
    )
  );

-- 3d) condiciones de naviera
DROP POLICY IF EXISTS "Agente CRUD own naviera condiciones" ON public.costeo_navieras_condiciones;
CREATE POLICY "Agente CRUD own naviera condiciones" ON public.costeo_navieras_condiciones
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND organization_id = public.current_agente_org()
    AND proveedor_id = public.current_agente_proveedor_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_carga')
    AND organization_id = public.current_agente_org()
    AND proveedor_id = public.current_agente_proveedor_id()
  );

-- 3e) tabulador de demoras
DROP POLICY IF EXISTS "Agente CRUD own demoras tabulador" ON public.costeo_naviera_demoras_tarifa;
CREATE POLICY "Agente CRUD own demoras tabulador" ON public.costeo_naviera_demoras_tarifa
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND EXISTS (SELECT 1 FROM public.costeo_navieras_condiciones nc
      WHERE nc.id = costeo_naviera_demoras_tarifa.naviera_condicion_id
        AND nc.organization_id = public.current_agente_org()
        AND nc.proveedor_id = public.current_agente_proveedor_id())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'agente_carga')
    AND EXISTS (SELECT 1 FROM public.costeo_navieras_condiciones nc
      WHERE nc.id = costeo_naviera_demoras_tarifa.naviera_condicion_id
        AND nc.organization_id = public.current_agente_org()
        AND nc.proveedor_id = public.current_agente_proveedor_id())
  );

-- 4) Lectura de rutas de su org para el agente
DROP POLICY IF EXISTS "Agente read org rutas" ON public.costeo_rutas;
CREATE POLICY "Agente read org rutas" ON public.costeo_rutas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agente_carga')
    AND organization_id = public.current_agente_org()
  );

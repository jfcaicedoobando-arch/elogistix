ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_aceptada INT NULL,
  ADD COLUMN IF NOT EXISTS aceptada_en TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS aceptada_por UUID NULL;

CREATE TABLE IF NOT EXISTS public.cotizacion_costos_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  version INT NOT NULL,
  organization_id UUID NOT NULL,
  origen_costo_id UUID NOT NULL,
  concepto TEXT NOT NULL,
  proveedor TEXT NOT NULL DEFAULT '',
  cantidad NUMERIC NOT NULL DEFAULT 1,
  unidad_medida TEXT NOT NULL DEFAULT '',
  costo_unitario NUMERIC NOT NULL DEFAULT 0,
  costo_total NUMERIC NULL,
  precio_venta NUMERIC NOT NULL DEFAULT 0,
  precio_total NUMERIC NULL,
  profit NUMERIC NULL,
  porcentaje_profit NUMERIC NULL,
  moneda TEXT NOT NULL,
  notas TEXT NOT NULL DEFAULT '',
  costeo_tarifa_id UUID NULL,
  costeo_tarifa_recargo_id UUID NULL,
  archivada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  archivada_por UUID NULL,
  motivo TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccch_cotizacion_version
  ON public.cotizacion_costos_historico(cotizacion_id, version);

GRANT SELECT, INSERT ON public.cotizacion_costos_historico TO authenticated;
GRANT ALL ON public.cotizacion_costos_historico TO service_role;

ALTER TABLE public.cotizacion_costos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros leen historico cotizacion" ON public.cotizacion_costos_historico;
CREATE POLICY "Miembros leen historico cotizacion"
ON public.cotizacion_costos_historico
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members om
  WHERE om.organization_id = cotizacion_costos_historico.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role historico cotizacion" ON public.cotizacion_costos_historico;
CREATE POLICY "Service role historico cotizacion"
ON public.cotizacion_costos_historico
FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.archivar_version_cotizacion(p_cotizacion_id UUID, p_motivo TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_version INT; v_org UUID;
BEGIN
  SELECT version, organization_id INTO v_version, v_org FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización % no encontrada', p_cotizacion_id; END IF;
  INSERT INTO cotizacion_costos_historico (
    cotizacion_id, version, organization_id, origen_costo_id, concepto, proveedor, cantidad, unidad_medida,
    costo_unitario, costo_total, precio_venta, precio_total, profit, porcentaje_profit, moneda, notas,
    costeo_tarifa_id, costeo_tarifa_recargo_id, archivada_por, motivo)
  SELECT cc.cotizacion_id, v_version, cc.organization_id, cc.id, cc.concepto, cc.proveedor, cc.cantidad, cc.unidad_medida,
    cc.costo_unitario, cc.costo_total, cc.precio_venta, cc.precio_total, cc.profit, cc.porcentaje_profit, cc.moneda, cc.notas,
    cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id, auth.uid(), p_motivo
  FROM cotizacion_costos cc WHERE cc.cotizacion_id = p_cotizacion_id AND cc.deleted_at IS NULL;
  RETURN v_version;
END $$;

CREATE OR REPLACE FUNCTION public.recotizar_cotizacion(p_cotizacion_id UUID, p_motivo TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old INT; v_new INT; v_org UUID;
BEGIN
  SELECT version, organization_id INTO v_old, v_org FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  IF coalesce(trim(p_motivo),'')='' THEN RAISE EXCEPTION 'Motivo requerido' USING ERRCODE='22023'; END IF;
  PERFORM archivar_version_cotizacion(p_cotizacion_id, p_motivo);
  v_new := v_old + 1;
  UPDATE cotizaciones SET version=v_new, estado='Borrador', updated_at=now() WHERE id=p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, user_id, accion, entidad_tipo, entidad_id, metadata)
  VALUES (v_org, auth.uid(), 'cotizacion.versionada', 'cotizacion', p_cotizacion_id,
    jsonb_build_object('version_anterior', v_old, 'version_nueva', v_new, 'motivo', p_motivo));
  RETURN jsonb_build_object('cotizacion_id', p_cotizacion_id, 'version_anterior', v_old, 'version_nueva', v_new);
END $$;

CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_version INT; v_org UUID;
BEGIN
  SELECT version, organization_id INTO v_version, v_org FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  UPDATE cotizaciones SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
    estado='Aceptada', updated_at=now() WHERE id=p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, user_id, accion, entidad_tipo, entidad_id, metadata)
  VALUES (v_org, auth.uid(), 'cotizacion.aceptada_version_fijada', 'cotizacion', p_cotizacion_id,
    jsonb_build_object('version_aceptada', v_version));
  RETURN jsonb_build_object('cotizacion_id', p_cotizacion_id, 'version_aceptada', v_version);
END $$;

CREATE OR REPLACE FUNCTION public.obtener_costos_cotizacion_version(p_cotizacion_id UUID, p_version INT DEFAULT NULL)
RETURNS SETOF JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID; v_actual INT; v_target INT;
BEGIN
  SELECT organization_id, version INTO v_org, v_actual FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_org IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  v_target := COALESCE(p_version, v_actual);
  IF v_target = v_actual THEN
    RETURN QUERY SELECT to_jsonb(cc) FROM cotizacion_costos cc
      WHERE cc.cotizacion_id = p_cotizacion_id AND cc.deleted_at IS NULL;
  ELSE
    RETURN QUERY SELECT to_jsonb(ch) FROM cotizacion_costos_historico ch
      WHERE ch.cotizacion_id = p_cotizacion_id AND ch.version = v_target;
  END IF;
END $$;

UPDATE public.cotizaciones
SET version_aceptada = 1, aceptada_en = COALESCE(aceptada_en, fecha_aceptacion, updated_at)
WHERE estado = 'Aceptada' AND version_aceptada IS NULL;

INSERT INTO public.configuracion_global (clave, valor, descripcion, categoria)
SELECT 'reconciliacion_varianza_alerta_pct', '5', 'Varianza % a partir de la cual se marca como alerta en reconciliación', 'operaciones'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion_global WHERE clave = 'reconciliacion_varianza_alerta_pct');

INSERT INTO public.configuracion_global (clave, valor, descripcion, categoria)
SELECT 'reconciliacion_varianza_critica_pct', '15', 'Varianza % a partir de la cual se marca como crítica en reconciliación', 'operaciones'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracion_global WHERE clave = 'reconciliacion_varianza_critica_pct');

-- Sprint 3 — Comisiones a vendedora

ALTER TABLE public.embarques ADD COLUMN IF NOT EXISTS vendedora_id uuid;
CREATE INDEX IF NOT EXISTS idx_embarques_vendedora_id ON public.embarques(vendedora_id);

-- vendedora_config
CREATE TABLE public.vendedora_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  porcentaje_default numeric(5,2) NOT NULL DEFAULT 0 CHECK (porcentaje_default >= 0 AND porcentaje_default <= 100),
  activa boolean NOT NULL DEFAULT true,
  fecha_alta timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedora_config TO authenticated;
GRANT ALL ON public.vendedora_config TO service_role;
ALTER TABLE public.vendedora_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendedora_config_admin_full" ON public.vendedora_config
  FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE POLICY "vendedora_config_self_read" ON public.vendedora_config
  FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() AND user_id = auth.uid());

-- estado_comision enum
CREATE TYPE estado_comision AS ENUM ('Devengada','Liquidada','Cancelada');

-- comisiones_devengadas
CREATE TABLE public.comisiones_devengadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  pago_factura_id uuid NOT NULL UNIQUE REFERENCES public.pagos_factura(id) ON DELETE CASCADE,
  embarque_id uuid REFERENCES public.embarques(id) ON DELETE SET NULL,
  factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  vendedora_id uuid,
  monto_cobrado_mxn numeric(14,2) NOT NULL DEFAULT 0,
  utilidad_prorrateada_mxn numeric(14,2) NOT NULL DEFAULT 0,
  porcentaje_aplicado numeric(5,2) NOT NULL DEFAULT 0,
  comision_mxn numeric(14,2) NOT NULL DEFAULT 0,
  estado estado_comision NOT NULL DEFAULT 'Devengada',
  liquidacion_id uuid,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_com_dev_vendedora ON public.comisiones_devengadas(vendedora_id);
CREATE INDEX idx_com_dev_estado ON public.comisiones_devengadas(estado);
CREATE INDEX idx_com_dev_liquidacion ON public.comisiones_devengadas(liquidacion_id);
CREATE INDEX idx_com_dev_org_created ON public.comisiones_devengadas(organization_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comisiones_devengadas TO authenticated;
GRANT ALL ON public.comisiones_devengadas TO service_role;
ALTER TABLE public.comisiones_devengadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "com_dev_admin_full" ON public.comisiones_devengadas
  FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE POLICY "com_dev_self_read" ON public.comisiones_devengadas
  FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() AND vendedora_id = auth.uid());

-- liquidaciones_comision
CREATE TABLE public.liquidaciones_comision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vendedora_id uuid NOT NULL,
  periodo text NOT NULL,
  total_mxn numeric(14,2) NOT NULL DEFAULT 0,
  fecha_pago date,
  metodo_pago text,
  referencia text,
  notas text,
  creada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_liq_vendedora_periodo ON public.liquidaciones_comision(vendedora_id, periodo);
CREATE INDEX idx_liq_org ON public.liquidaciones_comision(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.liquidaciones_comision TO authenticated;
GRANT ALL ON public.liquidaciones_comision TO service_role;
ALTER TABLE public.liquidaciones_comision ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liq_admin_full" ON public.liquidaciones_comision
  FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE POLICY "liq_self_read" ON public.liquidaciones_comision
  FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() AND vendedora_id = auth.uid());

CREATE TRIGGER trg_vendedora_config_updated BEFORE UPDATE ON public.vendedora_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_com_dev_updated BEFORE UPDATE ON public.comisiones_devengadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_liq_com_updated BEFORE UPDATE ON public.liquidaciones_comision
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pago RECORD; v_factura RECORD;
  v_embarque_id uuid; v_vendedora_id uuid; v_tc_embarque numeric;
  v_pct numeric(5,2); v_ingresos_mxn numeric(14,2); v_costos_mxn numeric(14,2);
  v_utilidad numeric(14,2); v_cobrado_mxn numeric(14,2);
  v_proporcion numeric(14,8); v_comision_mxn numeric(14,2); v_nota text;
BEGIN
  SELECT * INTO v_pago FROM pagos_factura WHERE id = p_pago_factura_id;
  IF NOT FOUND OR v_pago.deleted_at IS NOT NULL THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT * INTO v_factura FROM facturas WHERE id = v_pago.factura_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_embarque_id := v_factura.embarque_id;
  SELECT vendedora_id, COALESCE(tipo_cambio, 1)
    INTO v_vendedora_id, v_tc_embarque
    FROM embarques WHERE id = v_embarque_id;

  v_cobrado_mxn := COALESCE(v_pago.monto_aplicado_factura, v_pago.monto)
                   * COALESCE(v_pago.tipo_cambio, 1);

  IF v_vendedora_id IS NULL THEN
    INSERT INTO comisiones_devengadas (
      organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, nota)
    VALUES (
      v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, NULL,
      v_cobrado_mxn, 0, 0, 0, 'Devengada', 'Sin vendedora asignada al embarque')
    ON CONFLICT (pago_factura_id) DO UPDATE
      SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
          utilidad_prorrateada_mxn = 0, porcentaje_aplicado = 0,
          comision_mxn = 0, nota = EXCLUDED.nota, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT COALESCE(porcentaje_default, 0) INTO v_pct
    FROM vendedora_config
   WHERE organization_id = v_pago.organization_id
     AND user_id = v_vendedora_id AND activa = true;
  v_pct := COALESCE(v_pct, 0);

  SELECT COALESCE(SUM(total * CASE WHEN cv.moneda::text='USD' THEN v_tc_embarque ELSE 1 END), 0)
    INTO v_ingresos_mxn
    FROM conceptos_venta cv
   WHERE cv.embarque_id = v_embarque_id AND cv.deleted_at IS NULL;

  SELECT COALESCE(SUM(monto * CASE WHEN cc.moneda::text='USD' THEN v_tc_embarque ELSE 1 END), 0)
    INTO v_costos_mxn
    FROM conceptos_costo cc
   WHERE cc.embarque_id = v_embarque_id AND cc.deleted_at IS NULL;

  v_utilidad := v_ingresos_mxn - v_costos_mxn;
  v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                       THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                       ELSE 0 END;
  v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
  v_nota := CASE WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes' ELSE NULL END;

  INSERT INTO comisiones_devengadas (
    organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
    monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
    comision_mxn, estado, nota)
  VALUES (
    v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, v_vendedora_id,
    v_cobrado_mxn, ROUND(v_utilidad * v_proporcion, 2), v_pct, v_comision_mxn,
    'Devengada', v_nota)
  ON CONFLICT (pago_factura_id) DO UPDATE
    SET vendedora_id = EXCLUDED.vendedora_id,
        embarque_id = EXCLUDED.embarque_id,
        monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
        utilidad_prorrateada_mxn = EXCLUDED.utilidad_prorrateada_mxn,
        porcentaje_aplicado = EXCLUDED.porcentaje_aplicado,
        comision_mxn = EXCLUDED.comision_mxn,
        nota = EXCLUDED.nota,
        updated_at = now()
    WHERE comisiones_devengadas.estado <> 'Liquidada';
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pago_factura_comision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM calcular_comision_pago(COALESCE(NEW.id, OLD.id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_pago_factura_comision_ins ON public.pagos_factura;
CREATE TRIGGER trg_pago_factura_comision_ins
  AFTER INSERT OR UPDATE ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.trg_pago_factura_comision();

CREATE OR REPLACE FUNCTION public.generar_liquidacion_comision(
  p_vendedora_id uuid, p_periodo text, p_organization_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric(14,2); v_liq_id uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(SUM(comision_mxn), 0) INTO v_total
    FROM comisiones_devengadas
   WHERE organization_id = p_organization_id
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sin comisiones devengadas para liquidar';
  END IF;

  INSERT INTO liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn, creada_por)
  VALUES (p_organization_id, p_vendedora_id, p_periodo, v_total, auth.uid())
  RETURNING id INTO v_liq_id;

  UPDATE comisiones_devengadas
     SET estado = 'Liquidada', liquidacion_id = v_liq_id, updated_at = now()
   WHERE organization_id = p_organization_id
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  RETURN v_liq_id;
END;
$$;


CREATE TABLE public.pagos_factura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL,
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  fecha_pago date NOT NULL,
  monto numeric NOT NULL CHECK (monto > 0),
  moneda moneda NOT NULL DEFAULT 'MXN',
  tipo_cambio numeric NOT NULL DEFAULT 1 CHECK (tipo_cambio > 0),
  monto_aplicado_factura numeric NOT NULL CHECK (monto_aplicado_factura > 0),
  forma_pago text NOT NULL DEFAULT 'Transferencia',
  referencia text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX idx_pagos_factura_factura ON public.pagos_factura(factura_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pagos_factura_org_fecha ON public.pagos_factura(organization_id, fecha_pago) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_factura TO authenticated;
GRANT ALL ON public.pagos_factura TO service_role;

ALTER TABLE public.pagos_factura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted pagos_factura" ON public.pagos_factura
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (true);

CREATE POLICY "Tenant CRUD pagos_factura" ON public.pagos_factura
  FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE POLICY "Tenant viewer pagos_factura" ON public.pagos_factura
  FOR SELECT TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_role(auth.uid(), 'viewer'::app_role)
  );

CREATE POLICY "Cliente read own pagos_factura" ON public.pagos_factura
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND factura_id IN (
      SELECT f.id FROM facturas f
      WHERE f.cliente_id IN (SELECT current_user_client_ids())
    )
  );

CREATE TRIGGER update_pagos_factura_updated_at
  BEFORE UPDATE ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to recalcular estado factura
CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura_id uuid;
  v_total numeric;
  v_pagado numeric;
  v_vencimiento date;
  v_estado_actual estado_factura;
  v_nuevo_estado estado_factura;
  v_max_fecha date;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas WHERE id = v_factura_id;

  IF v_estado_actual = 'Cancelada' OR v_estado_actual = 'Borrador' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0), MAX(fecha_pago)
  INTO v_pagado, v_max_fecha
  FROM pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL;

  IF v_pagado >= v_total - 0.01 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  UPDATE facturas
  SET estado = v_nuevo_estado,
      fecha_pago = CASE WHEN v_nuevo_estado = 'Pagada' THEN v_max_fecha ELSE NULL END,
      updated_at = now()
  WHERE id = v_factura_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalcular_estado_factura
  AFTER INSERT OR UPDATE OR DELETE ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_estado_factura();

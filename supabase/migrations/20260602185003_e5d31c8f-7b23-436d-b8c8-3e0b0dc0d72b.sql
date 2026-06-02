
-- ============================================================
-- Sprint 2 – CxP: enums
-- ============================================================
CREATE TYPE estado_proveedor_factura AS ENUM ('Borrador','Vigente','Pagada','Cancelada');
CREATE TYPE estado_nota_credito_proveedor AS ENUM ('Borrador','Aprobada','Aplicada','Cancelada');
CREATE TYPE motivo_nota_credito_proveedor AS ENUM (
  'Devolucion','Bonificacion','Descuento','ErrorFacturacion','Cancelacion','Otro'
);

-- ============================================================
-- 1) proveedor_facturas
-- ============================================================
CREATE TABLE public.proveedor_facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  proveedor_id uuid NOT NULL,
  proveedor_nombre text NOT NULL DEFAULT '',
  embarque_id uuid,
  folio_proveedor text NOT NULL,
  uuid_fiscal text,
  rfc_proveedor text,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date,
  dias_credito integer NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  tipo_cambio_usd numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  iva numeric NOT NULL DEFAULT 0,
  retenciones numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  estado estado_proveedor_factura NOT NULL DEFAULT 'Borrador',
  archivo_pdf_url text,
  archivo_xml_url text,
  notas text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  UNIQUE (organization_id, proveedor_id, folio_proveedor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_facturas TO authenticated;
GRANT ALL ON public.proveedor_facturas TO service_role;

ALTER TABLE public.proveedor_facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted proveedor_facturas"
  ON public.proveedor_facturas AS RESTRICTIVE FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (true);

CREATE POLICY "Tenant CRUD proveedor_facturas"
  ON public.proveedor_facturas FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  );

CREATE POLICY "Tenant viewer proveedor_facturas"
  ON public.proveedor_facturas FOR SELECT TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND has_role(auth.uid(),'viewer')
  );

CREATE TRIGGER trg_proveedor_facturas_updated
  BEFORE UPDATE ON public.proveedor_facturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_proveedor_facturas_org ON public.proveedor_facturas(organization_id);
CREATE INDEX idx_proveedor_facturas_proveedor ON public.proveedor_facturas(proveedor_id);
CREATE INDEX idx_proveedor_facturas_embarque ON public.proveedor_facturas(embarque_id);
CREATE INDEX idx_proveedor_facturas_estado ON public.proveedor_facturas(estado);
CREATE INDEX idx_proveedor_facturas_vencimiento ON public.proveedor_facturas(fecha_vencimiento);

-- ============================================================
-- 2) proveedor_facturas_conceptos (vínculo con conceptos_costo)
-- ============================================================
CREATE TABLE public.proveedor_facturas_conceptos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  proveedor_factura_id uuid NOT NULL REFERENCES public.proveedor_facturas(id) ON DELETE CASCADE,
  concepto_costo_id uuid,
  descripcion text NOT NULL DEFAULT '',
  cantidad numeric NOT NULL DEFAULT 1,
  monto numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_facturas_conceptos TO authenticated;
GRANT ALL ON public.proveedor_facturas_conceptos TO service_role;

ALTER TABLE public.proveedor_facturas_conceptos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant CRUD proveedor_facturas_conceptos"
  ON public.proveedor_facturas_conceptos FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  );

CREATE INDEX idx_pfc_factura ON public.proveedor_facturas_conceptos(proveedor_factura_id);
CREATE INDEX idx_pfc_concepto ON public.proveedor_facturas_conceptos(concepto_costo_id);

-- ============================================================
-- 3) pagos_proveedor
-- ============================================================
CREATE TABLE public.pagos_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  proveedor_factura_id uuid NOT NULL REFERENCES public.proveedor_facturas(id) ON DELETE RESTRICT,
  fecha_pago date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  tipo_cambio_usd numeric NOT NULL DEFAULT 0,
  diferencia_cambiaria_mxn numeric,
  metodo_pago text NOT NULL DEFAULT 'Transferencia',
  referencia text NOT NULL DEFAULT '',
  cuenta_bancaria_id uuid,
  notas text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_proveedor TO authenticated;
GRANT ALL ON public.pagos_proveedor TO service_role;

ALTER TABLE public.pagos_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted pagos_proveedor"
  ON public.pagos_proveedor AS RESTRICTIVE FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (true);

CREATE POLICY "Tenant CRUD pagos_proveedor"
  ON public.pagos_proveedor FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  );

CREATE TRIGGER trg_pagos_proveedor_updated
  BEFORE UPDATE ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pagos_proveedor_factura ON public.pagos_proveedor(proveedor_factura_id);
CREATE INDEX idx_pagos_proveedor_fecha ON public.pagos_proveedor(fecha_pago);
CREATE INDEX idx_pagos_proveedor_org ON public.pagos_proveedor(organization_id);

-- ============================================================
-- 4) proveedor_notas_credito
-- ============================================================
CREATE TABLE public.proveedor_notas_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  proveedor_factura_id uuid NOT NULL REFERENCES public.proveedor_facturas(id) ON DELETE RESTRICT,
  folio_nc text NOT NULL DEFAULT '',
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric NOT NULL DEFAULT 0,
  moneda moneda NOT NULL DEFAULT 'MXN',
  motivo motivo_nota_credito_proveedor NOT NULL DEFAULT 'Otro',
  descripcion text NOT NULL DEFAULT '',
  estado estado_nota_credito_proveedor NOT NULL DEFAULT 'Borrador',
  aprobada_por uuid,
  aprobada_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_notas_credito TO authenticated;
GRANT ALL ON public.proveedor_notas_credito TO service_role;

ALTER TABLE public.proveedor_notas_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted proveedor_notas_credito"
  ON public.proveedor_notas_credito AS RESTRICTIVE FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (true);

CREATE POLICY "Tenant CRUD proveedor_notas_credito"
  ON public.proveedor_notas_credito FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  );

CREATE TRIGGER trg_proveedor_notas_credito_updated
  BEFORE UPDATE ON public.proveedor_notas_credito
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pnc_factura ON public.proveedor_notas_credito(proveedor_factura_id);
CREATE INDEX idx_pnc_estado ON public.proveedor_notas_credito(estado);

-- ============================================================
-- 5) Vista de saldo
-- ============================================================
CREATE OR REPLACE VIEW public.v_proveedor_facturas_saldo
WITH (security_invoker = true) AS
SELECT
  pf.id AS proveedor_factura_id,
  pf.organization_id,
  pf.total,
  COALESCE((
    SELECT SUM(pp.monto)
    FROM public.pagos_proveedor pp
    WHERE pp.proveedor_factura_id = pf.id
      AND pp.deleted_at IS NULL
  ), 0) AS pagado,
  COALESCE((
    SELECT SUM(nc.monto)
    FROM public.proveedor_notas_credito nc
    WHERE nc.proveedor_factura_id = pf.id
      AND nc.estado = 'Aplicada'
      AND nc.deleted_at IS NULL
  ), 0) AS notas_credito_aplicadas,
  GREATEST(
    pf.total
    - COALESCE((
        SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
        WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
      ), 0)
    - COALESCE((
        SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
        WHERE nc.proveedor_factura_id = pf.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL
      ), 0),
    0
  ) AS saldo
FROM public.proveedor_facturas pf
WHERE pf.deleted_at IS NULL;

GRANT SELECT ON public.v_proveedor_facturas_saldo TO authenticated;
GRANT SELECT ON public.v_proveedor_facturas_saldo TO service_role;

-- ============================================================
-- 6) Función para aprobar NC proveedor (audit en mismo paso)
-- ============================================================
CREATE OR REPLACE FUNCTION public.aprobar_nota_credito_proveedor(_nc_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.proveedor_notas_credito
  SET estado = 'Aprobada',
      aprobada_por = auth.uid(),
      aprobada_at = now(),
      updated_at = now()
  WHERE id = _nc_id
    AND estado = 'Borrador'
    AND (organization_id = current_user_org_id() OR has_role(auth.uid(),'super_admin'));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota de crédito no encontrada o no está en Borrador';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.aprobar_nota_credito_proveedor(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.aprobar_nota_credito_proveedor(uuid) TO authenticated;

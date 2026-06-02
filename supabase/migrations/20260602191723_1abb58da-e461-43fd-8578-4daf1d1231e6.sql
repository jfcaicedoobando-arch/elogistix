
CREATE TYPE estado_conciliacion AS ENUM ('Pendiente','Conciliado','Ignorado');

-- ============================================================
-- 1) cuentas_bancarias
-- ============================================================
CREATE TABLE public.cuentas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  banco text NOT NULL DEFAULT 'BBVA',
  alias text NOT NULL,
  numero_cuenta text NOT NULL DEFAULT '',
  clabe text NOT NULL DEFAULT '',
  moneda moneda NOT NULL DEFAULT 'MXN',
  saldo_inicial numeric NOT NULL DEFAULT 0,
  activa boolean NOT NULL DEFAULT true,
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuentas_bancarias TO authenticated;
GRANT ALL ON public.cuentas_bancarias TO service_role;

ALTER TABLE public.cuentas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted cuentas_bancarias"
  ON public.cuentas_bancarias AS RESTRICTIVE FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (true);

CREATE POLICY "Tenant CRUD cuentas_bancarias"
  ON public.cuentas_bancarias FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  );

CREATE TRIGGER trg_cuentas_bancarias_updated
  BEFORE UPDATE ON public.cuentas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cuentas_bancarias_org ON public.cuentas_bancarias(organization_id);

-- ============================================================
-- 2) bbva_movimientos (en realidad: movimientos bancarios)
-- ============================================================
CREATE TABLE public.bbva_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  cuenta_bancaria_id uuid NOT NULL REFERENCES public.cuentas_bancarias(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  concepto text NOT NULL DEFAULT '',
  referencia text NOT NULL DEFAULT '',
  cargo numeric NOT NULL DEFAULT 0,
  abono numeric NOT NULL DEFAULT 0,
  saldo numeric,
  hash_dedupe text NOT NULL,
  estado_conciliacion estado_conciliacion NOT NULL DEFAULT 'Pendiente',
  pago_factura_id uuid,
  pago_proveedor_id uuid REFERENCES public.pagos_proveedor(id) ON DELETE SET NULL,
  motivo_ignorar text NOT NULL DEFAULT '',
  conciliado_por uuid,
  conciliado_at timestamptz,
  importado_por uuid,
  importado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cuenta_bancaria_id, hash_dedupe)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bbva_movimientos TO authenticated;
GRANT ALL ON public.bbva_movimientos TO service_role;

ALTER TABLE public.bbva_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant CRUD bbva_movimientos"
  ON public.bbva_movimientos FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  );

CREATE INDEX idx_bbva_mov_cuenta ON public.bbva_movimientos(cuenta_bancaria_id);
CREATE INDEX idx_bbva_mov_fecha ON public.bbva_movimientos(fecha DESC);
CREATE INDEX idx_bbva_mov_estado ON public.bbva_movimientos(estado_conciliacion);
CREATE INDEX idx_bbva_mov_pago_factura ON public.bbva_movimientos(pago_factura_id);
CREATE INDEX idx_bbva_mov_pago_proveedor ON public.bbva_movimientos(pago_proveedor_id);


-- 1) Campo de depósito estándar por naviera
ALTER TABLE public.costeo_navieras_condiciones
  ADD COLUMN IF NOT EXISTS deposito_contenedor_usd numeric(12,2) NOT NULL DEFAULT 0
    CHECK (deposito_contenedor_usd >= 0);

-- 2) Tabla de garantías por contenedor (control operativo)
CREATE TABLE IF NOT EXISTS public.embarque_garantias_contenedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  embarque_contenedor_id uuid NOT NULL REFERENCES public.embarque_contenedores(id) ON DELETE CASCADE,
  naviera_id uuid REFERENCES public.navieras(id) ON DELETE SET NULL,
  monto_deposito_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK (monto_deposito_usd >= 0),
  tiene_carta_garantia boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','depositado','liberado','retenido')),
  fecha_deposito date,
  fecha_liberacion date,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (embarque_contenedor_id)
);

CREATE INDEX IF NOT EXISTS idx_garantias_embarque ON public.embarque_garantias_contenedor(embarque_id);
CREATE INDEX IF NOT EXISTS idx_garantias_org ON public.embarque_garantias_contenedor(organization_id);
CREATE INDEX IF NOT EXISTS idx_garantias_estado ON public.embarque_garantias_contenedor(estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.embarque_garantias_contenedor TO authenticated;
GRANT ALL ON public.embarque_garantias_contenedor TO service_role;

ALTER TABLE public.embarque_garantias_contenedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant CRUD garantias" ON public.embarque_garantias_contenedor
  FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'::app_role))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operador'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'::app_role))
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operador'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
  );

CREATE POLICY "Tenant viewer garantias" ON public.embarque_garantias_contenedor
  FOR SELECT TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'::app_role))
    AND has_role(auth.uid(),'viewer'::app_role)
  );

CREATE TRIGGER trg_garantias_updated_at
  BEFORE UPDATE ON public.embarque_garantias_contenedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Trigger: crear garantía automáticamente al insertar un contenedor
CREATE OR REPLACE FUNCTION public.crear_garantia_contenedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_naviera_id uuid;
  v_naviera_nombre text;
  v_org uuid;
  v_cond record;
  v_carta_vigente boolean := false;
  v_monto numeric(12,2) := 0;
  v_estado text := 'pendiente';
BEGIN
  SELECT e.naviera, e.organization_id INTO v_naviera_nombre, v_org
  FROM public.embarques e WHERE e.id = NEW.embarque_id;

  IF v_naviera_nombre IS NULL OR v_naviera_nombre = '' THEN
    RETURN NEW;
  END IF;

  SELECT n.id INTO v_naviera_id FROM public.navieras n
  WHERE lower(n.name) = lower(v_naviera_nombre) LIMIT 1;

  IF v_naviera_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_cond FROM public.costeo_navieras_condiciones
  WHERE organization_id = v_org AND naviera_id = v_naviera_id LIMIT 1;

  IF FOUND THEN
    v_carta_vigente := v_cond.tiene_carta_garantia
      AND (v_cond.carta_garantia_vigente_hasta IS NULL OR v_cond.carta_garantia_vigente_hasta >= CURRENT_DATE);
    IF v_carta_vigente THEN
      v_monto := 0;
      v_estado := 'liberado';
    ELSE
      v_monto := v_cond.deposito_contenedor_usd;
      v_estado := 'pendiente';
    END IF;
  END IF;

  INSERT INTO public.embarque_garantias_contenedor (
    organization_id, embarque_id, embarque_contenedor_id, naviera_id,
    monto_deposito_usd, tiene_carta_garantia, estado
  ) VALUES (
    v_org, NEW.embarque_id, NEW.id, v_naviera_id,
    v_monto, v_carta_vigente, v_estado
  )
  ON CONFLICT (embarque_contenedor_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crear_garantia_contenedor ON public.embarque_contenedores;
CREATE TRIGGER trg_crear_garantia_contenedor
  AFTER INSERT ON public.embarque_contenedores
  FOR EACH ROW EXECUTE FUNCTION public.crear_garantia_contenedor();

-- 4) Tabulador de venta de demoras al cliente
CREATE TABLE IF NOT EXISTS public.costeo_demoras_venta_tarifa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo_contenedor_id uuid NOT NULL REFERENCES public.tipos_contenedor(id),
  desde_dia integer NOT NULL CHECK (desde_dia >= 1),
  hasta_dia integer CHECK (hasta_dia IS NULL OR hasta_dia >= desde_dia),
  monto_por_dia_usd numeric(12,2) NOT NULL CHECK (monto_por_dia_usd >= 0),
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demoras_venta_lookup
  ON public.costeo_demoras_venta_tarifa(organization_id, tipo_contenedor_id, desde_dia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.costeo_demoras_venta_tarifa TO authenticated;
GRANT ALL ON public.costeo_demoras_venta_tarifa TO service_role;

ALTER TABLE public.costeo_demoras_venta_tarifa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant CRUD demoras venta" ON public.costeo_demoras_venta_tarifa
  FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'::app_role)
  )
  WITH CHECK (
    (organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'::app_role)
  );

CREATE TRIGGER trg_demoras_venta_updated_at
  BEFORE UPDATE ON public.costeo_demoras_venta_tarifa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Columnas de trazabilidad en conceptos
ALTER TABLE public.conceptos_costo
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual','demoras_auto','cotizacion','costeo_tarifa'));

ALTER TABLE public.conceptos_venta
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'manual'
    CHECK (origen IN ('manual','demoras_auto','cotizacion','costeo_tarifa'));

CREATE INDEX IF NOT EXISTS idx_conceptos_costo_origen ON public.conceptos_costo(embarque_id, origen) WHERE origen <> 'manual';
CREATE INDEX IF NOT EXISTS idx_conceptos_venta_origen ON public.conceptos_venta(embarque_id, origen) WHERE origen <> 'manual';

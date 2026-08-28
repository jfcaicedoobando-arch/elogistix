-- ============================================================
-- Ola E4 · Seguridad financiera (N3, N4, N8, N20)
-- ============================================================

-- Helper: roles internos (definer/service) que ejecutan los flujos canónicos.
CREATE OR REPLACE FUNCTION public._es_rol_interno()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_user IN ('postgres', 'service_role', 'supabase_admin');
$$;

REVOKE ALL ON FUNCTION public._es_rol_interno() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._es_rol_interno() TO service_role;

-- ------------------------------------------------------------
-- N3 · Anticipos de proveedor: sólo vía RPC canónica
-- ------------------------------------------------------------
DROP POLICY IF EXISTS anticipos_proveedor_insert_own_org ON public.anticipos_proveedor;
DROP POLICY IF EXISTS anticipos_proveedor_update_own_org ON public.anticipos_proveedor;
DROP POLICY IF EXISTS anticipos_proveedor_delete_own_org ON public.anticipos_proveedor;
DROP POLICY IF EXISTS anticipos_aplicaciones_insert_own_org ON public.anticipos_aplicaciones;
DROP POLICY IF EXISTS anticipos_aplicaciones_update_own_org ON public.anticipos_aplicaciones;
DROP POLICY IF EXISTS anticipos_aplicaciones_delete_own_org ON public.anticipos_aplicaciones;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.anticipos_proveedor FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.anticipos_aplicaciones FROM authenticated;
REVOKE ALL ON public.anticipos_proveedor FROM anon;
REVOKE ALL ON public.anticipos_aplicaciones FROM anon;
GRANT SELECT ON public.anticipos_proveedor TO authenticated;
GRANT SELECT ON public.anticipos_aplicaciones TO authenticated;
GRANT ALL ON public.anticipos_proveedor TO service_role;
GRANT ALL ON public.anticipos_aplicaciones TO service_role;

-- El cargo bancario nunca debe quedar huérfano por borrado del anticipo.
ALTER TABLE public.bbva_movimientos
  DROP CONSTRAINT IF EXISTS bbva_movimientos_anticipo_proveedor_id_fkey;
ALTER TABLE public.bbva_movimientos
  ADD CONSTRAINT bbva_movimientos_anticipo_proveedor_id_fkey
  FOREIGN KEY (anticipo_proveedor_id) REFERENCES public.anticipos_proveedor(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------
-- N4 · bbva_movimientos: inmutabilidad financiera + máquina de estados
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._bbva_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interno boolean := public._es_rol_interno();
BEGIN
  -- Inmutabilidad de los datos financieros del movimiento importado/capturado.
  IF NOT v_interno THEN
    IF NEW.cargo IS DISTINCT FROM OLD.cargo
       OR NEW.abono IS DISTINCT FROM OLD.abono
       OR NEW.saldo IS DISTINCT FROM OLD.saldo
       OR NEW.fecha IS DISTINCT FROM OLD.fecha
       OR NEW.cuenta_bancaria_id IS DISTINCT FROM OLD.cuenta_bancaria_id
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_INMUTABLE: los importes, la fecha y la cuenta de un movimiento bancario no se pueden modificar; cancela el movimiento y captúralo de nuevo'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Máquina de estados de conciliación (aplica a todos los flujos).
  IF NEW.estado_conciliacion IS DISTINCT FROM OLD.estado_conciliacion THEN
    IF NOT (
      (OLD.estado_conciliacion = 'Pendiente'  AND NEW.estado_conciliacion IN ('Conciliado','Ignorado'))
      OR (OLD.estado_conciliacion = 'Conciliado' AND NEW.estado_conciliacion = 'Pendiente')
      OR (OLD.estado_conciliacion = 'Ignorado'   AND NEW.estado_conciliacion = 'Pendiente')
    ) THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_TRANSICION_INVALIDA: no se permite pasar de % a %; regresa el movimiento a Pendiente primero',
        OLD.estado_conciliacion, NEW.estado_conciliacion
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.estado_conciliacion = 'Conciliado' AND NEW.conciliado_at IS NULL THEN
      NEW.conciliado_at := now();
    END IF;
    IF NEW.estado_conciliacion = 'Pendiente' THEN
      NEW.conciliado_at := NULL;
      NEW.conciliado_por := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._bbva_guard_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bbva_guard_update ON public.bbva_movimientos;
CREATE TRIGGER trg_bbva_guard_update
  BEFORE UPDATE ON public.bbva_movimientos
  FOR EACH ROW EXECUTE FUNCTION public._bbva_guard_update();

-- Cuenta bancaria ↔ organización.
DROP TRIGGER IF EXISTS trg_org_bbva_cuenta_bancaria_id ON public.bbva_movimientos;
CREATE TRIGGER trg_org_bbva_cuenta_bancaria_id
  BEFORE INSERT OR UPDATE OF cuenta_bancaria_id, organization_id ON public.bbva_movimientos
  FOR EACH ROW EXECUTE FUNCTION public._assert_padre_misma_org('cuenta_bancaria_id', 'cuentas_bancarias');

-- ------------------------------------------------------------
-- N20 · Cascadas financieras indebidas → RESTRICT
-- ------------------------------------------------------------
ALTER TABLE public.bbva_movimientos DROP CONSTRAINT IF EXISTS bbva_movimientos_cuenta_bancaria_id_fkey;
ALTER TABLE public.bbva_movimientos
  ADD CONSTRAINT bbva_movimientos_cuenta_bancaria_id_fkey
  FOREIGN KEY (cuenta_bancaria_id) REFERENCES public.cuentas_bancarias(id) ON DELETE RESTRICT;

ALTER TABLE public.pagos_factura DROP CONSTRAINT IF EXISTS pagos_factura_factura_id_fkey;
ALTER TABLE public.pagos_factura
  ADD CONSTRAINT pagos_factura_factura_id_fkey
  FOREIGN KEY (factura_id) REFERENCES public.facturas(id) ON DELETE RESTRICT;

ALTER TABLE public.factura_notas_credito DROP CONSTRAINT IF EXISTS factura_notas_credito_factura_id_fkey;
ALTER TABLE public.factura_notas_credito
  ADD CONSTRAINT factura_notas_credito_factura_id_fkey
  FOREIGN KEY (factura_id) REFERENCES public.facturas(id) ON DELETE RESTRICT;

ALTER TABLE public.comisiones_devengadas DROP CONSTRAINT IF EXISTS comisiones_devengadas_factura_id_fkey;
ALTER TABLE public.comisiones_devengadas
  ADD CONSTRAINT comisiones_devengadas_factura_id_fkey
  FOREIGN KEY (factura_id) REFERENCES public.facturas(id) ON DELETE RESTRICT;

ALTER TABLE public.comisiones_devengadas DROP CONSTRAINT IF EXISTS comisiones_devengadas_pago_factura_id_fkey;
ALTER TABLE public.comisiones_devengadas
  ADD CONSTRAINT comisiones_devengadas_pago_factura_id_fkey
  FOREIGN KEY (pago_factura_id) REFERENCES public.pagos_factura(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------
-- N8 · Comisiones y liquidaciones: sólo vía RPC + máquina de estados
-- ------------------------------------------------------------
DROP POLICY IF EXISTS com_dev_admin_full ON public.comisiones_devengadas;
CREATE POLICY com_dev_admin_read ON public.comisiones_devengadas
  FOR SELECT TO authenticated
  USING (
    ((organization_id = (SELECT public.current_user_org_id()))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  );

DROP POLICY IF EXISTS liq_admin_full ON public.liquidaciones_comision;
CREATE POLICY liq_admin_read ON public.liquidaciones_comision
  FOR SELECT TO authenticated
  USING (
    ((organization_id = (SELECT public.current_user_org_id()))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.comisiones_devengadas FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.liquidaciones_comision FROM authenticated;
REVOKE ALL ON public.comisiones_devengadas FROM anon;
REVOKE ALL ON public.liquidaciones_comision FROM anon;
GRANT SELECT ON public.comisiones_devengadas TO authenticated;
GRANT SELECT ON public.liquidaciones_comision TO authenticated;
GRANT ALL ON public.comisiones_devengadas TO service_role;
GRANT ALL ON public.liquidaciones_comision TO service_role;

-- CHECK de signo en importes.
ALTER TABLE public.comisiones_devengadas
  DROP CONSTRAINT IF EXISTS comisiones_devengadas_montos_chk;
ALTER TABLE public.comisiones_devengadas
  ADD CONSTRAINT comisiones_devengadas_montos_chk
  CHECK (
    comision_mxn >= 0
    AND (porcentaje_aplicado IS NULL OR (porcentaje_aplicado >= 0 AND porcentaje_aplicado <= 100))
  );

ALTER TABLE public.liquidaciones_comision
  DROP CONSTRAINT IF EXISTS liquidaciones_comision_total_chk;
ALTER TABLE public.liquidaciones_comision
  ADD CONSTRAINT liquidaciones_comision_total_chk
  CHECK (total_mxn >= 0);

-- Máquina de estados de liquidación.
CREATE OR REPLACE FUNCTION public._liquidacion_guard_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NOT (
      (OLD.estado = 'Generada' AND NEW.estado IN ('Pagada','Cancelada'))
      OR (OLD.estado = 'Pagada' AND NEW.estado = 'Cancelada')
    ) THEN
      RAISE EXCEPTION 'LC_LIQUIDACION_TRANSICION_INVALIDA: no se permite pasar la liquidación de % a %', OLD.estado, NEW.estado
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF OLD.estado = 'Cancelada' AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_CANCELADA_INMUTABLE: una liquidación cancelada no se puede modificar'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._liquidacion_guard_estado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_liquidacion_guard_estado ON public.liquidaciones_comision;
CREATE TRIGGER trg_liquidacion_guard_estado
  BEFORE UPDATE ON public.liquidaciones_comision
  FOR EACH ROW EXECUTE FUNCTION public._liquidacion_guard_estado();

-- Prohibido el borrado físico de liquidaciones y comisiones.
CREATE OR REPLACE FUNCTION public._prohibir_delete_comisiones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'LC_COMISION_DELETE_PROHIBIDO: las comisiones y liquidaciones no se borran; usa la cancelación oficial'
    USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public._prohibir_delete_comisiones() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prohibir_delete_comisiones ON public.comisiones_devengadas;
CREATE TRIGGER trg_prohibir_delete_comisiones
  BEFORE DELETE ON public.comisiones_devengadas
  FOR EACH ROW EXECUTE FUNCTION public._prohibir_delete_comisiones();

DROP TRIGGER IF EXISTS trg_prohibir_delete_liquidaciones ON public.liquidaciones_comision;
CREATE TRIGGER trg_prohibir_delete_liquidaciones
  BEFORE DELETE ON public.liquidaciones_comision
  FOR EACH ROW EXECUTE FUNCTION public._prohibir_delete_comisiones();
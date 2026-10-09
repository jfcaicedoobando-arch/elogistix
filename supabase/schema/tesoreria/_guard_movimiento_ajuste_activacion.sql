-- AUD99/121: sólo valida tipificación al confirmar/restaurar una asociación.
-- No amplía las validaciones financieras históricas de los pagos ordinarios.
CREATE OR REPLACE FUNCTION public._guard_movimiento_ajuste_activacion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- BEFORE se ejecuta antes del WITH CHECK de RLS. Validar el ámbito antes
  -- de consultar clasificaciones que el caller podría no poder leer.
  -- role/session_user conservan el caller SQL aun dentro de SECURITY DEFINER;
  -- current_user aquí sería el owner y no sirve para reconocer llamadas internas.
  IF COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text)
       NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND (public.org_scope() IS NULL OR NEW.organization_id IS DISTINCT FROM public.org_scope()) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el movimiento está fuera de la organización activa'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.pagos_proveedor WHERE id = NEW.pago_proveedor_id;
    IF FOUND AND v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de proveedor pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.pago_proveedor_lote_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.pagos_proveedor_lote WHERE id = NEW.pago_proveedor_lote_id;
    IF FOUND AND v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de pago pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.pagos_proveedor p
               WHERE p.lote_id = NEW.pago_proveedor_lote_id
                 AND p.organization_id IS DISTINCT FROM NEW.organization_id) THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote contiene registros de otra organización'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.pagos_proveedor p WHERE p.organization_id = NEW.organization_id AND p.es_ajuste
             AND (p.id = NEW.pago_proveedor_id OR p.lote_id = NEW.pago_proveedor_lote_id)) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no monetario no puede activar una asociación bancaria'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._guard_movimiento_ajuste_activacion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._guard_movimiento_ajuste_activacion() TO authenticated, service_role;

-- La baja lógica conserva evidencia y sigue su política preexistente.
DROP TRIGGER IF EXISTS trg_movimiento_ajuste_activacion ON public.bbva_movimientos;
CREATE TRIGGER trg_movimiento_ajuste_activacion
BEFORE UPDATE OF estado_conciliacion, deleted_at ON public.bbva_movimientos
FOR EACH ROW WHEN (NEW.deleted_at IS NULL AND
  (NEW.pago_proveedor_id IS NOT NULL OR NEW.pago_proveedor_lote_id IS NOT NULL))
EXECUTE FUNCTION public._guard_movimiento_ajuste_activacion();

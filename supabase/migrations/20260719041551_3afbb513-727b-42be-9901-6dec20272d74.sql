-- Fase P.2: Garantías re-evaluables con máquina de estados y bitácora

-- 1) Función de transiciones válidas
CREATE OR REPLACE FUNCTION public.transicion_garantia_valida(prev text, next text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE prev
    WHEN 'pendiente'  THEN next IN ('pendiente','depositado','retenido')
    WHEN 'depositado' THEN next IN ('depositado','liberado','retenido')
    WHEN 'retenido'   THEN next IN ('retenido','liberado')
    WHEN 'liberado'   THEN next = 'liberado'
    ELSE FALSE
  END;
$$;

-- 2) Trigger: valida transición
CREATE OR REPLACE FUNCTION public._garantia_transicion_valida_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NOT public.transicion_garantia_valida(OLD.estado, NEW.estado) THEN
      RAISE EXCEPTION 'LC_GARANTIA_TRANSICION_INVALIDA: % -> %', OLD.estado, NEW.estado
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garantia_transicion_valida ON public.embarque_garantias_contenedor;
CREATE TRIGGER trg_garantia_transicion_valida
BEFORE UPDATE OF estado ON public.embarque_garantias_contenedor
FOR EACH ROW EXECUTE FUNCTION public._garantia_transicion_valida_trg();

-- 3) Trigger: congela monto una vez depositado/retenido/liberado
CREATE OR REPLACE FUNCTION public._garantia_congelar_monto_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.estado IN ('depositado','retenido','liberado')
     AND NEW.monto_deposito_usd IS DISTINCT FROM OLD.monto_deposito_usd THEN
    RAISE EXCEPTION 'LC_GARANTIA_MONTO_CONGELADO: no se puede modificar el monto en estado %', OLD.estado
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garantia_congelar_monto ON public.embarque_garantias_contenedor;
CREATE TRIGGER trg_garantia_congelar_monto
BEFORE UPDATE ON public.embarque_garantias_contenedor
FOR EACH ROW EXECUTE FUNCTION public._garantia_congelar_monto_trg();

-- 4) Trigger: exige fechas y monto al transicionar
CREATE OR REPLACE FUNCTION public._garantia_fechas_requeridas_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'depositado' AND OLD.estado IS DISTINCT FROM 'depositado' THEN
    IF NEW.fecha_deposito IS NULL THEN
      RAISE EXCEPTION 'LC_GARANTIA_FECHA_DEPOSITO_REQUERIDA'
        USING ERRCODE = 'not_null_violation';
    END IF;
    IF COALESCE(NEW.monto_deposito_usd, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_GARANTIA_MONTO_REQUERIDO'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.estado = 'liberado' AND OLD.estado IS DISTINCT FROM 'liberado' THEN
    IF NEW.fecha_liberacion IS NULL THEN
      RAISE EXCEPTION 'LC_GARANTIA_FECHA_LIBERACION_REQUERIDA'
        USING ERRCODE = 'not_null_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garantia_fechas_requeridas ON public.embarque_garantias_contenedor;
CREATE TRIGGER trg_garantia_fechas_requeridas
BEFORE UPDATE OF estado ON public.embarque_garantias_contenedor
FOR EACH ROW EXECUTE FUNCTION public._garantia_fechas_requeridas_trg();

-- 5) Tabla bitácora
CREATE TABLE IF NOT EXISTS public.embarque_garantias_historial (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  garantia_id uuid NOT NULL REFERENCES public.embarque_garantias_contenedor(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  estado_anterior text,
  estado_nuevo text NOT NULL,
  monto_deposito_usd numeric(12,2),
  referencia_deposito text,
  notas text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_garantia_hist_garantia ON public.embarque_garantias_historial(garantia_id);
CREATE INDEX IF NOT EXISTS idx_garantia_hist_org ON public.embarque_garantias_historial(organization_id);

GRANT SELECT ON public.embarque_garantias_historial TO authenticated;
GRANT ALL ON public.embarque_garantias_historial TO service_role;

ALTER TABLE public.embarque_garantias_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read garantias historial" ON public.embarque_garantias_historial;
CREATE POLICY "Tenant read garantias historial"
ON public.embarque_garantias_historial
FOR SELECT
TO authenticated
USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));

-- 6) Trigger: bitácora en INSERT/UPDATE relevantes
CREATE OR REPLACE FUNCTION public._garantia_historial_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.embarque_garantias_historial
      (garantia_id, organization_id, estado_anterior, estado_nuevo,
       monto_deposito_usd, referencia_deposito, notas, changed_by)
    VALUES (NEW.id, NEW.organization_id, NULL, NEW.estado,
            NEW.monto_deposito_usd, NEW.referencia_deposito, NEW.notas, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.monto_deposito_usd IS DISTINCT FROM OLD.monto_deposito_usd
     OR NEW.referencia_deposito IS DISTINCT FROM OLD.referencia_deposito
     OR NEW.notas IS DISTINCT FROM OLD.notas THEN
    INSERT INTO public.embarque_garantias_historial
      (garantia_id, organization_id, estado_anterior, estado_nuevo,
       monto_deposito_usd, referencia_deposito, notas, changed_by)
    VALUES (NEW.id, NEW.organization_id, OLD.estado, NEW.estado,
            NEW.monto_deposito_usd, NEW.referencia_deposito, NEW.notas, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garantia_historial ON public.embarque_garantias_contenedor;
CREATE TRIGGER trg_garantia_historial
AFTER INSERT OR UPDATE OF estado, monto_deposito_usd, referencia_deposito, notas
ON public.embarque_garantias_contenedor
FOR EACH ROW EXECUTE FUNCTION public._garantia_historial_trg();

-- 7) RPC con gate de rol
CREATE OR REPLACE FUNCTION public.set_garantia_estado(
  p_id uuid,
  p_estado text DEFAULT NULL,
  p_fecha_deposito date DEFAULT NULL,
  p_fecha_liberacion date DEFAULT NULL,
  p_monto numeric DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS public.embarque_garantias_contenedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.embarque_garantias_contenedor;
  v_org uuid;
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_org'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'LC_GARANTIA_SIN_ROL'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM public.embarque_garantias_contenedor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_GARANTIA_NO_ENCONTRADA' USING ERRCODE = 'no_data_found';
  END IF;

  v_org := current_user_org_id();
  IF v_row.organization_id <> v_org AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_GARANTIA_ORG_MISMATCH' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.embarque_garantias_contenedor
     SET estado             = COALESCE(p_estado, estado),
         fecha_deposito     = COALESCE(p_fecha_deposito, fecha_deposito),
         fecha_liberacion   = COALESCE(p_fecha_liberacion, fecha_liberacion),
         monto_deposito_usd = COALESCE(p_monto, monto_deposito_usd),
         referencia_deposito= COALESCE(p_referencia, referencia_deposito),
         notas              = COALESCE(p_notas, notas),
         updated_at         = now()
   WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_garantia_estado(uuid, text, date, date, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_garantia_estado(uuid, text, date, date, numeric, text, text) TO authenticated, service_role;

-- ============================================================
-- Ola A · Compras: candados de sobrepago + cerrar factura sin pago
-- ============================================================

-- 1. Nuevas columnas en pagos_proveedor para diferenciar ajustes
--    (compensaciones, condonaciones, etc.) de pagos reales.
ALTER TABLE public.pagos_proveedor
  ADD COLUMN IF NOT EXISTS es_ajuste boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_ajuste text;

COMMENT ON COLUMN public.pagos_proveedor.es_ajuste IS
  'Si true, este registro es un ajuste (compensación, condonación, ajuste histórico, factura duplicada) y no un pago real de efectivo. Debe excluirse de reportes de tesorería.';

COMMENT ON COLUMN public.pagos_proveedor.motivo_ajuste IS
  'Motivo del ajuste tipificado: compensacion | condonacion | ajuste_historico | duplicada. NULL si es_ajuste=false.';

-- 2. Trigger BEFORE INSERT/UPDATE en pagos_proveedor: bloquea sobrepago.
--    Regla: sum(pagos activos) + NEW.monto + sum(NCs aplicadas) <= factura.total (+0.01 tolerancia redondeo).
CREATE OR REPLACE FUNCTION public.check_no_sobrepago_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total   numeric;
  v_pagado  numeric;
  v_ncs     numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT total INTO v_total
    FROM public.proveedor_facturas
   WHERE id = NEW.proveedor_factura_id
     AND deleted_at IS NULL;
  IF v_total IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND id IS DISTINCT FROM NEW.id;

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
    FROM public.proveedor_notas_credito
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND estado = 'Aplicada'::public.estado_nota_credito_proveedor
     AND deleted_at IS NULL;

  IF v_pagado + COALESCE(NEW.monto, 0) + v_ncs > v_total + 0.01 THEN
    RAISE EXCEPTION
      'SOBREPAGO_PROVEEDOR: el pago (%) excede el saldo pendiente. Total factura: %, ya pagado: %, notas de crédito: %.',
      NEW.monto, v_total, v_pagado, v_ncs
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_no_sobrepago ON public.pagos_proveedor;
CREATE TRIGGER trg_check_no_sobrepago
BEFORE INSERT OR UPDATE OF monto, deleted_at ON public.pagos_proveedor
FOR EACH ROW EXECUTE FUNCTION public.check_no_sobrepago_proveedor();

-- 3. RPC cerrar_factura_proveedor_sin_pago: registra un ajuste que salda la
--    factura sin movimiento real de dinero (compensación, quita, error histórico).
--    Devuelve el id del registro ajuste creado.
CREATE OR REPLACE FUNCTION public.cerrar_factura_proveedor_sin_pago(
  p_factura_id uuid,
  p_motivo     text,
  p_comentario text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org      uuid;
  v_estado   public.estado_proveedor_factura;
  v_deleted  timestamptz;
  v_moneda   public.moneda;
  v_aprob    public.estado_aprobacion_factura_proveedor;
  v_saldo    numeric;
  v_pago_id  uuid;
  v_uid      uuid := auth.uid();
  v_valid_motivos text[] := ARRAY['compensacion', 'condonacion', 'ajuste_historico', 'duplicada'];
BEGIN
  IF p_motivo IS NULL OR NOT (p_motivo = ANY(v_valid_motivos)) THEN
    RAISE EXCEPTION 'Motivo inválido. Válidos: compensacion, condonacion, ajuste_historico, duplicada.'
      USING ERRCODE = '22023';
  END IF;

  SELECT pf.organization_id, pf.estado, pf.deleted_at, pf.moneda, pf.estado_aprobacion
    INTO v_org, v_estado, v_deleted, v_moneda, v_aprob
    FROM public.proveedor_facturas pf
   WHERE pf.id = p_factura_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'La factura está en la papelera; restáurala antes.' USING ERRCODE = '22023';
  END IF;
  IF v_estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'La factura ya está cancelada.' USING ERRCODE = '22023';
  END IF;
  IF v_estado = 'Pagada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'La factura ya está pagada.' USING ERRCODE = '22023';
  END IF;
  IF v_aprob <> 'aprobada'::public.estado_aprobacion_factura_proveedor THEN
    RAISE EXCEPTION 'La factura debe estar aprobada antes de cerrarla.' USING ERRCODE = '22023';
  END IF;

  -- Verificación de permiso: mismo criterio que las policies (miembro de la org o super_admin).
  IF NOT (
    v_org = public.current_user_org_id()
    OR public.has_role(v_uid, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para cerrar esta factura.' USING ERRCODE = '42501';
  END IF;

  SELECT saldo INTO v_saldo
    FROM public.v_proveedor_facturas_saldo
   WHERE proveedor_factura_id = p_factura_id;

  IF COALESCE(v_saldo, 0) <= 0 THEN
    RAISE EXCEPTION 'La factura no tiene saldo pendiente que cerrar.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd,
    metodo_pago, referencia, notas, es_ajuste, motivo_ajuste, created_by
  ) VALUES (
    v_org, p_factura_id, CURRENT_DATE, v_saldo, v_moneda, 0,
    'Ajuste', 'Cierre sin pago: ' || p_motivo,
    COALESCE(p_comentario, ''), true, p_motivo, v_uid
  )
  RETURNING id INTO v_pago_id;

  UPDATE public.proveedor_facturas
     SET estado = 'Pagada'::public.estado_proveedor_factura,
         updated_at = now()
   WHERE id = p_factura_id;

  INSERT INTO public.bitacora_actividad(
    organization_id, usuario_id, modulo, accion, entidad_id, detalles
  ) VALUES (
    v_org, v_uid, 'cxp', 'cerrar_sin_pago', p_factura_id,
    jsonb_build_object(
      'motivo', p_motivo,
      'saldo_ajustado', v_saldo,
      'pago_ajuste_id', v_pago_id,
      'comentario', p_comentario
    )
  );

  RETURN v_pago_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cerrar_factura_proveedor_sin_pago(uuid, text, text) TO authenticated;

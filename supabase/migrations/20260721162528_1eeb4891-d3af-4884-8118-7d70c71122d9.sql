-- ============================================================
-- Perfil de cliente: fuente única de crédito
-- ============================================================

-- 1. Columna límite de crédito en MXN
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS limite_credito_mxn NUMERIC(14,2);

COMMENT ON COLUMN public.clientes.limite_credito_mxn IS
  'Límite máximo de crédito del cliente en MXN. NULL = sin límite configurado. '
  'Se valida contra la suma de saldos de facturas vivas al emitir/facturar.';

-- Constraint: no negativos.
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_limite_credito_mxn_nonneg;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_limite_credito_mxn_nonneg
  CHECK (limite_credito_mxn IS NULL OR limite_credito_mxn >= 0);

-- Índice de apoyo para el cálculo de exposición (si aún no existe).
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_estado
  ON public.facturas (cliente_id, estado)
  WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Pagada');

-- 2. RPC get_exposicion_credito_cliente
CREATE OR REPLACE FUNCTION public.get_exposicion_credito_cliente(
  p_cliente_id uuid
)
RETURNS TABLE (
  cliente_id        uuid,
  organization_id   uuid,
  dias_credito      integer,
  limite_mxn        numeric,
  en_uso_mxn        numeric,
  disponible_mxn    numeric,
  excedido          boolean,
  facturas_vivas    integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_dias integer;
  v_limite numeric;
  v_en_uso numeric := 0;
  v_facturas integer := 0;
BEGIN
  -- Autorización: cliente debe pertenecer a la org del usuario, o usuario debe ser owner.
  SELECT c.organization_id, c.dias_credito, c.limite_credito_mxn
    INTO v_org, v_dias, v_limite
  FROM public.clientes c
  WHERE c.id = p_cliente_id
    AND c.deleted_at IS NULL
    AND (
      c.organization_id = public.current_user_org_id()
      OR public.has_role(auth.uid(), 'owner'::app_role)
    );

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado o sin acceso'
      USING ERRCODE = '42501';
  END IF;

  -- Suma de saldos pendientes (MXN) de facturas vivas.
  -- Saldo = total - pagos aplicados - notas de crédito aplicadas (todo en moneda factura),
  -- convertido a MXN al TC de la factura.
  SELECT
    COALESCE(SUM(
      GREATEST(
        0,
        COALESCE(f.total, 0)
        - COALESCE(f.monto_pagado, 0)
        - COALESCE(f.monto_notas_credito, 0)
      ) * CASE
            WHEN f.moneda = 'MXN' THEN 1
            ELSE COALESCE(NULLIF(f.tipo_cambio, 0), 1)
          END
    ), 0),
    COUNT(*)
  INTO v_en_uso, v_facturas
  FROM public.facturas f
  WHERE f.cliente_id = p_cliente_id
    AND f.estado IN ('Emitida','Vencida','Parcialmente pagada','Pagada')
    AND f.deleted_at IS NULL;

  cliente_id      := p_cliente_id;
  organization_id := v_org;
  dias_credito    := v_dias;
  limite_mxn      := v_limite;
  en_uso_mxn      := ROUND(v_en_uso, 2);
  disponible_mxn  := CASE WHEN v_limite IS NULL THEN NULL ELSE ROUND(v_limite - v_en_uso, 2) END;
  excedido        := CASE WHEN v_limite IS NULL THEN false ELSE v_en_uso > v_limite END;
  facturas_vivas  := v_facturas;
  RETURN NEXT;
END;
$$;

-- Acceso: solo usuarios autenticados de la app (RPC ya valida org internamente).
REVOKE ALL ON FUNCTION public.get_exposicion_credito_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exposicion_credito_cliente(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_exposicion_credito_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exposicion_credito_cliente(uuid) TO service_role;

COMMENT ON FUNCTION public.get_exposicion_credito_cliente(uuid) IS
  'Devuelve la exposición de crédito del cliente: días, límite MXN, saldo pendiente '
  '(sumando saldos de facturas vivas convertidos a MXN), disponible y bandera excedido. '
  'Filtrado por organization_id vía RLS del caller. Usado por perfil de cliente y '
  'validación al emitir proforma/factura.';

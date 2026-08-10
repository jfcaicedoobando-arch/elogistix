-- ============================================================
-- Cobro en lote de cliente (pago múltiple CxC)
-- Espejo de `pagos_proveedor_lote` / `registrar_pago_proveedor_lote`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pagos_factura_lote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  fecha_pago date NOT NULL DEFAULT CURRENT_DATE,
  moneda public.moneda NOT NULL,
  monto_total numeric NOT NULL,
  tipo_cambio_usd numeric,
  forma_pago text NOT NULL DEFAULT '03',
  referencia text NOT NULL DEFAULT '',
  cuenta_bancaria_id uuid REFERENCES public.cuentas_bancarias(id),
  notas text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.pagos_factura_lote TO authenticated;
GRANT ALL ON public.pagos_factura_lote TO service_role;

ALTER TABLE public.pagos_factura_lote ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read pagos_factura_lote" ON public.pagos_factura_lote;
CREATE POLICY "Tenant read pagos_factura_lote"
  ON public.pagos_factura_lote FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  );

DROP POLICY IF EXISTS "Escritor financiero write pagos_factura_lote" ON public.pagos_factura_lote;
CREATE POLICY "Escritor financiero write pagos_factura_lote"
  ON public.pagos_factura_lote FOR INSERT TO authenticated
  WITH CHECK (
    (
      organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    )
    AND public.es_escritor_financiero((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Escritor financiero update pagos_factura_lote" ON public.pagos_factura_lote;
CREATE POLICY "Escritor financiero update pagos_factura_lote"
  ON public.pagos_factura_lote FOR UPDATE TO authenticated
  USING (
    (
      organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    )
    AND public.es_escritor_financiero((SELECT auth.uid()))
  )
  WITH CHECK (
    (
      organization_id = (SELECT public.current_user_org_id())
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    )
    AND public.es_escritor_financiero((SELECT auth.uid()))
  );

CREATE INDEX IF NOT EXISTS idx_pagos_factura_lote_org_fecha
  ON public.pagos_factura_lote (organization_id, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_factura_lote_cliente
  ON public.pagos_factura_lote (cliente_id);

DROP TRIGGER IF EXISTS update_pagos_factura_lote_updated_at ON public.pagos_factura_lote;
CREATE TRIGGER update_pagos_factura_lote_updated_at
  BEFORE UPDATE ON public.pagos_factura_lote
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vínculos: pago individual → lote, movimiento bancario → lote.
ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS lote_id uuid REFERENCES public.pagos_factura_lote(id);
CREATE INDEX IF NOT EXISTS idx_pagos_factura_lote_id
  ON public.pagos_factura (lote_id) WHERE lote_id IS NOT NULL;

ALTER TABLE public.bbva_movimientos
  ADD COLUMN IF NOT EXISTS pago_factura_lote_id uuid REFERENCES public.pagos_factura_lote(id);
CREATE INDEX IF NOT EXISTS idx_bbva_mov_pago_factura_lote
  ON public.bbva_movimientos (pago_factura_lote_id) WHERE pago_factura_lote_id IS NOT NULL;

-- ------------------------------------------------------------
-- Trigger de consistencia: contempla el nuevo origen.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_movimiento_pago_consistente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago_org uuid;
  v_pago_moneda text;
  v_cuenta_moneda text;
  v_vinculos int;
BEGIN
  -- Sólo puede estar vinculado a UN origen a la vez.
  v_vinculos :=
      (CASE WHEN NEW.pago_factura_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.anticipo_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_factura_lote_id IS NOT NULL THEN 1 ELSE 0 END);

  IF v_vinculos > 1 THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_DOBLE_VINCULO: un movimiento no puede vincularse a más de un origen (pago de factura, pago de proveedor, lote de pago o anticipo)'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.cuenta_bancaria_id IS NOT NULL THEN
    SELECT moneda::text INTO v_cuenta_moneda
    FROM public.cuentas_bancarias
    WHERE id = NEW.cuenta_bancaria_id AND deleted_at IS NULL;
  END IF;

  IF NEW.pago_factura_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_factura
    WHERE id = NEW.pago_factura_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de factura % no existe o está eliminado', NEW.pago_factura_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de factura pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_proveedor
    WHERE id = NEW.pago_proveedor_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor % no existe o está eliminado', NEW.pago_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de proveedor pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_proveedor_lote
    WHERE id = NEW.pago_proveedor_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_INEXISTENTE: el lote de pago % no existe o está eliminado', NEW.pago_proveedor_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de pago pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_factura_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_factura_lote
    WHERE id = NEW.pago_factura_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_COBRO_INEXISTENTE: el lote de cobro % no existe o está eliminado', NEW.pago_factura_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de cobro pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote de cobro (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.anticipo_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.anticipos_proveedor
    WHERE id = NEW.anticipo_proveedor_id;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ANTICIPO_INEXISTENTE: el anticipo % no existe', NEW.anticipo_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el anticipo pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del anticipo (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- RPC: registra el cobro en lote de forma atómica.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pago_cliente_lote(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_autorizado boolean;
  v_cliente_id uuid := (p_payload->>'cliente_id')::uuid;
  v_fecha date := COALESCE((p_payload->>'fecha_pago')::date, CURRENT_DATE);
  v_moneda public.moneda := (p_payload->>'moneda')::public.moneda;
  v_tc numeric := NULLIF(p_payload->>'tipo_cambio_usd','')::numeric;
  v_forma text := COALESCE(NULLIF(TRIM(p_payload->>'forma_pago'), ''), '03');
  v_referencia text := COALESCE(NULLIF(TRIM(p_payload->>'referencia'), ''), '');
  v_cuenta_id uuid := NULLIF(p_payload->>'cuenta_bancaria_id','')::uuid;
  v_notas text := COALESCE(p_payload->>'notas','');
  v_cuenta public.cuentas_bancarias;
  v_cliente_nombre text;
  v_total numeric := 0;
  v_lote_id uuid;
  v_renglon jsonb;
  v_factura_id uuid;
  v_monto numeric;
  v_saldo numeric;
  v_pago_id uuid;
  v_n int := 0;
  v_pagos jsonb := '[]'::jsonb;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar cobros en lote.'
      USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, nombre INTO v_org, v_cliente_nombre
  FROM public.clientes WHERE id = v_cliente_id AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_CLIENTE_NO_EXISTE: El cliente no existe.';
  END IF;

  IF v_org <> public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_CLIENTE_OTRA_ORG: El cliente pertenece a otra organización.';
  END IF;

  IF v_cuenta_id IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM public.cuentas_bancarias
    WHERE id = v_cuenta_id AND deleted_at IS NULL;

    IF v_cuenta.id IS NULL THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_CUENTA_INVALIDA: La cuenta bancaria no existe o está dada de baja.';
    END IF;
    IF v_cuenta.organization_id <> v_org THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.';
    END IF;
    IF v_cuenta.moneda <> v_moneda THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_CUENTA_DIVISA: La cuenta está en % y el cobro en %.', v_cuenta.moneda, v_moneda;
    END IF;
  END IF;

  -- Validación de renglones: tenancy, cliente, moneda y saldo real por factura.
  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    v_factura_id := (v_renglon->>'factura_id')::uuid;
    v_monto := ROUND(COALESCE((v_renglon->>'monto')::numeric, 0), 2);

    IF v_monto <= 0 THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_MONTO_INVALIDO: Cada factura del lote debe tener un importe mayor a cero.';
    END IF;

    SELECT
      f.total
      - COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                   WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL), 0)
      - COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                   WHERE nc.factura_id = f.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL), 0)
      INTO v_saldo
    FROM public.facturas f
    WHERE f.id = v_factura_id
      AND f.deleted_at IS NULL
      AND f.organization_id = v_org
      AND f.cliente_id = v_cliente_id
      AND f.moneda = v_moneda
    FOR UPDATE OF f;

    IF v_saldo IS NULL THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_FACTURA_INVALIDA: Una de las facturas no existe, no es del cliente seleccionado o está en otra moneda.';
    END IF;

    IF v_monto > ROUND(v_saldo, 2) + 0.009 THEN
      RAISE EXCEPTION 'LC_COBRO_LOTE_EXCEDE_SALDO: El importe aplicado a una factura excede su saldo pendiente.';
    END IF;

    v_total := v_total + v_monto;
    v_n := v_n + 1;
  END LOOP;

  IF v_n < 2 THEN
    RAISE EXCEPTION 'LC_COBRO_LOTE_MINIMO_FACTURAS: Un cobro en lote requiere al menos dos facturas.';
  END IF;

  INSERT INTO public.pagos_factura_lote
    (organization_id, cliente_id, fecha_pago, moneda, monto_total, tipo_cambio_usd,
     forma_pago, referencia, cuenta_bancaria_id, notas, created_by)
  VALUES
    (v_org, v_cliente_id, v_fecha, v_moneda, v_total, v_tc,
     v_forma, v_referencia, v_cuenta_id, v_notas, v_uid)
  RETURNING id INTO v_lote_id;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    v_factura_id := (v_renglon->>'factura_id')::uuid;
    v_monto := ROUND(COALESCE((v_renglon->>'monto')::numeric, 0), 2);

    INSERT INTO public.pagos_factura
      (organization_id, factura_id, fecha_pago, monto, moneda, tipo_cambio,
       monto_aplicado_factura, forma_pago, referencia, notas, created_by, lote_id)
    VALUES
      (v_org, v_factura_id, v_fecha, v_monto, v_moneda, 1,
       v_monto, v_forma, v_referencia, v_notas, v_uid, v_lote_id)
    RETURNING id INTO v_pago_id;

    v_pagos := v_pagos || jsonb_build_object('pago_id', v_pago_id, 'factura_id', v_factura_id);
  END LOOP;

  IF v_cuenta_id IS NOT NULL THEN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
       cargo, abono, hash_dedupe, estado_conciliacion,
       pago_factura_lote_id, conciliado_por, conciliado_at, importado_por)
    VALUES
      (v_org, v_cuenta_id, v_fecha,
       'Cobro en lote (' || v_n || ' facturas) — ' || COALESCE(v_cliente_nombre, 'cliente'),
       v_referencia, 0, v_total, 'cobro-lote-' || v_lote_id::text, 'Conciliado',
       v_lote_id, v_uid, now(), v_uid);
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_pago_cliente_lote', 'facturacion',
            v_lote_id, 'Cobro en lote ' || v_lote_id::text,
            jsonb_build_object('cliente_id', v_cliente_id, 'monto_total', v_total,
                               'moneda', v_moneda, 'facturas', v_n,
                               'cuenta_bancaria_id', v_cuenta_id, 'referencia', v_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_pago_cliente_lote: % %', SQLSTATE, SQLERRM;
  END;

  RETURN jsonb_build_object('lote_id', v_lote_id, 'monto_total', v_total, 'pagos', v_pagos);
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pago_cliente_lote(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_pago_cliente_lote(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_cliente_lote(jsonb) TO service_role;
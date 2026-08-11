-- Traspasos entre cuentas propias (Tesorería)
CREATE TABLE public.traspasos_bancarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  folio text NOT NULL,
  cuenta_origen_id uuid NOT NULL REFERENCES public.cuentas_bancarias(id) ON DELETE RESTRICT,
  cuenta_destino_id uuid NOT NULL REFERENCES public.cuentas_bancarias(id) ON DELETE RESTRICT,
  fecha date NOT NULL,
  monto_origen numeric NOT NULL,
  moneda_origen moneda NOT NULL,
  monto_destino numeric NOT NULL,
  moneda_destino moneda NOT NULL,
  tipo_cambio numeric NOT NULL DEFAULT 1,
  comision numeric NOT NULL DEFAULT 0,
  concepto text NOT NULL DEFAULT '',
  referencia text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'Registrado',
  motivo_cancelacion text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT traspasos_cuentas_distintas CHECK (cuenta_origen_id <> cuenta_destino_id),
  CONSTRAINT traspasos_montos_positivos CHECK (monto_origen > 0 AND monto_destino > 0 AND comision >= 0),
  CONSTRAINT traspasos_tc_positivo CHECK (tipo_cambio > 0),
  CONSTRAINT traspasos_estado_valido CHECK (estado IN ('Registrado','Cancelado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_traspasos_folio_org ON public.traspasos_bancarios(organization_id, folio);
CREATE INDEX IF NOT EXISTS idx_traspasos_org_fecha ON public.traspasos_bancarios(organization_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_traspasos_cuentas ON public.traspasos_bancarios(cuenta_origen_id, cuenta_destino_id);

GRANT SELECT, INSERT, UPDATE ON public.traspasos_bancarios TO authenticated;
GRANT ALL ON public.traspasos_bancarios TO service_role;

ALTER TABLE public.traspasos_bancarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant CRUD traspasos_bancarios" ON public.traspasos_bancarios;
CREATE POLICY "Tenant CRUD traspasos_bancarios"
ON public.traspasos_bancarios
TO authenticated
USING (
  ((organization_id = (SELECT current_user_org_id())) OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND ((SELECT has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role)))
)
WITH CHECK (
  ((organization_id = (SELECT current_user_org_id())) OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND ((SELECT has_role((SELECT auth.uid()), 'admin'::app_role)) OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role)))
);

DROP POLICY IF EXISTS "Tesoreria read traspasos_bancarios" ON public.traspasos_bancarios;
CREATE POLICY "Tesoreria read traspasos_bancarios"
ON public.traspasos_bancarios FOR SELECT TO authenticated
USING (
  organization_id = (SELECT current_user_org_id())
  AND ((SELECT has_role((SELECT auth.uid()), 'tesorero'::app_role))
    OR (SELECT has_role((SELECT auth.uid()), 'contador'::app_role))
    OR (SELECT has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role)))
);

DROP POLICY IF EXISTS "Tesoreria write traspasos_bancarios" ON public.traspasos_bancarios;
CREATE POLICY "Tesoreria write traspasos_bancarios"
ON public.traspasos_bancarios FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (SELECT current_user_org_id())
  AND ((SELECT has_role((SELECT auth.uid()), 'tesorero'::app_role))
    OR (SELECT has_role((SELECT auth.uid()), 'contador'::app_role))
    OR (SELECT has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role)))
);

DROP POLICY IF EXISTS "Tesoreria update traspasos_bancarios" ON public.traspasos_bancarios;
CREATE POLICY "Tesoreria update traspasos_bancarios"
ON public.traspasos_bancarios FOR UPDATE TO authenticated
USING (
  organization_id = (SELECT current_user_org_id())
  AND ((SELECT has_role((SELECT auth.uid()), 'tesorero'::app_role))
    OR (SELECT has_role((SELECT auth.uid()), 'contador'::app_role))
    OR (SELECT has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role)))
)
WITH CHECK (
  organization_id = (SELECT current_user_org_id())
  AND ((SELECT has_role((SELECT auth.uid()), 'tesorero'::app_role))
    OR (SELECT has_role((SELECT auth.uid()), 'contador'::app_role))
    OR (SELECT has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role)))
);

DROP TRIGGER IF EXISTS trg_traspasos_bancarios_updated ON public.traspasos_bancarios;
CREATE TRIGGER trg_traspasos_bancarios_updated
BEFORE UPDATE ON public.traspasos_bancarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Liga de cada pierna con su traspaso
ALTER TABLE public.bbva_movimientos
  ADD COLUMN IF NOT EXISTS traspaso_id uuid REFERENCES public.traspasos_bancarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bbva_movimientos_traspaso
  ON public.bbva_movimientos(traspaso_id) WHERE traspaso_id IS NOT NULL;

-- RPC: registrar traspaso (SECURITY INVOKER: la RLS de ambas tablas aplica)
CREATE OR REPLACE FUNCTION public.registrar_traspaso_bancario(
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_fecha date,
  p_monto_origen numeric,
  p_tipo_cambio numeric DEFAULT 1,
  p_comision numeric DEFAULT 0,
  p_concepto text DEFAULT '',
  p_referencia text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org uuid := current_user_org_id();
  v_uid uuid := auth.uid();
  v_origen public.cuentas_bancarias%ROWTYPE;
  v_destino public.cuentas_bancarias%ROWTYPE;
  v_tc numeric := COALESCE(NULLIF(p_tipo_cambio, 0), 1);
  v_comision numeric := COALESCE(p_comision, 0);
  v_monto_destino numeric;
  v_folio text;
  v_id uuid;
  v_concepto text := COALESCE(NULLIF(TRIM(p_concepto), ''), 'Traspaso entre cuentas propias');
BEGIN
  IF p_cuenta_origen_id = p_cuenta_destino_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_MISMA_CUENTA: la cuenta origen y destino deben ser distintas';
  END IF;
  IF COALESCE(p_monto_origen, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_MONTO_INVALIDO: el monto debe ser mayor a cero';
  END IF;
  IF v_comision < 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_COMISION_INVALIDA: la comisión no puede ser negativa';
  END IF;

  SELECT * INTO v_origen FROM public.cuentas_bancarias WHERE id = p_cuenta_origen_id;
  SELECT * INTO v_destino FROM public.cuentas_bancarias WHERE id = p_cuenta_destino_id;
  IF v_origen.id IS NULL OR v_destino.id IS NULL THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INEXISTENTE: no se encontró alguna de las cuentas';
  END IF;
  IF v_origen.organization_id <> v_destino.organization_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_ORG_DISTINTA: las cuentas pertenecen a organizaciones diferentes';
  END IF;
  IF NOT v_origen.activa OR NOT v_destino.activa THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INACTIVA: ambas cuentas deben estar activas';
  END IF;

  IF v_origen.moneda = v_destino.moneda THEN
    v_tc := 1;
    v_monto_destino := ROUND(p_monto_origen, 2);
  ELSE
    IF v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_TRASPASO_TC_REQUERIDO: captura el tipo de cambio para un traspaso entre monedas distintas';
    END IF;
    v_monto_destino := ROUND(p_monto_origen * v_tc, 2);
  END IF;

  SELECT 'TR-' || LPAD((COALESCE(MAX(NULLIF(regexp_replace(folio, '\D', '', 'g'), ''))::bigint, 0) + 1)::text, 6, '0')
    INTO v_folio
    FROM public.traspasos_bancarios
   WHERE organization_id = COALESCE(v_org, v_origen.organization_id);

  INSERT INTO public.traspasos_bancarios(
    organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
    monto_origen, moneda_origen, monto_destino, moneda_destino,
    tipo_cambio, comision, concepto, referencia, created_by
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), v_folio, p_cuenta_origen_id, p_cuenta_destino_id, p_fecha,
    ROUND(p_monto_origen, 2), v_origen.moneda, v_monto_destino, v_destino.moneda,
    v_tc, ROUND(v_comision, 2), v_concepto, COALESCE(p_referencia, ''), v_uid
  ) RETURNING id INTO v_id;

  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
    v_concepto || ' → ' || v_destino.banco || ' ' || v_destino.alias, COALESCE(p_referencia, ''),
    ROUND(p_monto_origen, 2), 0, 'traspaso-' || v_id::text || '-origen',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );

  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_destino.organization_id), p_cuenta_destino_id, p_fecha,
    v_concepto || ' ← ' || v_origen.banco || ' ' || v_origen.alias, COALESCE(p_referencia, ''),
    0, v_monto_destino, 'traspaso-' || v_id::text || '-destino',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );

  IF ROUND(v_comision, 2) > 0 THEN
    INSERT INTO public.bbva_movimientos(
      organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
      cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
      importado_por, traspaso_id
    ) VALUES (
      COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
      'Comisión bancaria por traspaso ' || v_folio, COALESCE(p_referencia, ''),
      ROUND(v_comision, 2), 0, 'traspaso-' || v_id::text || '-comision',
      'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
    );
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text) TO authenticated, service_role;

-- RPC: cancelar traspaso
CREATE OR REPLACE FUNCTION public.cancelar_traspaso_bancario(
  p_traspaso_id uuid,
  p_motivo text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_estado text;
BEGIN
  SELECT estado INTO v_estado
    FROM public.traspasos_bancarios
   WHERE id = p_traspaso_id AND deleted_at IS NULL;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'LC_TRASPASO_INEXISTENTE: el traspaso no existe o no tienes acceso';
  END IF;
  IF v_estado = 'Cancelado' THEN
    RAISE EXCEPTION 'LC_TRASPASO_YA_CANCELADO: el traspaso ya está cancelado';
  END IF;

  UPDATE public.bbva_movimientos
     SET deleted_at = now(), deleted_by = v_uid
   WHERE traspaso_id = p_traspaso_id AND deleted_at IS NULL;

  UPDATE public.traspasos_bancarios
     SET estado = 'Cancelado',
         motivo_cancelacion = COALESCE(NULLIF(TRIM(p_motivo), ''), 'Cancelado por el usuario'),
         deleted_at = now()
   WHERE id = p_traspaso_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_traspaso_bancario(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_traspaso_bancario(uuid, text) TO authenticated, service_role;
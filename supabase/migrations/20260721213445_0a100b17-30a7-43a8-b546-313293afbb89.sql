-- 1) crear_garantia_contenedor: preferir tarifa aplicada al embarque para resolver naviera
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
  v_tarifa_id uuid;
  v_cond record;
  v_carta_vigente boolean := false;
  v_monto numeric(12,2) := 0;
  v_estado text := 'pendiente';
BEGIN
  SELECT e.naviera, e.organization_id, e.tarifa_id_aplicada
    INTO v_naviera_nombre, v_org, v_tarifa_id
  FROM public.embarques e WHERE e.id = NEW.embarque_id;

  -- 1) Preferir naviera de la tarifa aplicada
  IF v_tarifa_id IS NOT NULL THEN
    SELECT t.naviera_id INTO v_naviera_id
    FROM public.costeo_tarifas t
    WHERE t.id = v_tarifa_id;
  END IF;

  -- 2) Fallback: match por nombre en embarques.naviera
  IF v_naviera_id IS NULL AND v_naviera_nombre IS NOT NULL AND v_naviera_nombre <> '' THEN
    SELECT n.id INTO v_naviera_id FROM public.navieras n
    WHERE lower(n.name) = lower(v_naviera_nombre) LIMIT 1;
  END IF;

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
      v_monto := COALESCE(v_cond.deposito_contenedor_usd, 0);
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

-- 2) calc_fecha_limite_devolucion_garantia: preferir dias_libres_demoras de la tarifa
CREATE OR REPLACE FUNCTION public.calc_fecha_limite_devolucion_garantia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias int;
  v_dias_tarifa int;
  v_org_id uuid;
  v_tarifa_id uuid;
BEGIN
  IF NEW.fecha_deposito IS NULL OR NEW.naviera_id IS NULL THEN
    NEW.fecha_limite_devolucion := NULL;
    RETURN NEW;
  END IF;

  SELECT e.organization_id, e.tarifa_id_aplicada INTO v_org_id, v_tarifa_id
  FROM embarques e WHERE e.id = NEW.embarque_id;

  IF v_tarifa_id IS NOT NULL THEN
    SELECT t.dias_libres_demoras INTO v_dias_tarifa
    FROM costeo_tarifas t WHERE t.id = v_tarifa_id;
  END IF;

  IF v_dias_tarifa IS NOT NULL AND v_dias_tarifa > 0 THEN
    v_dias := v_dias_tarifa;
  ELSE
    SELECT nc.dias_libres_demoras_default INTO v_dias
    FROM costeo_navieras_condiciones nc
    WHERE nc.naviera_id = NEW.naviera_id
      AND nc.organization_id = v_org_id
    LIMIT 1;
  END IF;

  IF v_dias IS NULL THEN
    NEW.fecha_limite_devolucion := NULL;
  ELSE
    NEW.fecha_limite_devolucion := NEW.fecha_deposito + (v_dias || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) RPC: refrescar garantías pendientes desde tarifa/condición
CREATE OR REPLACE FUNCTION public.refrescar_garantia_desde_tarifa(p_embarque_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_naviera_nombre text;
  v_tarifa_id uuid;
  v_naviera_id uuid;
  v_cond record;
  v_carta_vigente boolean := false;
  v_monto numeric(12,2) := 0;
  v_estado text := 'pendiente';
  v_updated int := 0;
BEGIN
  SELECT e.organization_id, e.naviera, e.tarifa_id_aplicada
    INTO v_org, v_naviera_nombre, v_tarifa_id
  FROM public.embarques e WHERE e.id = p_embarque_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_EMBARQUE_NO_ENCONTRADO';
  END IF;

  IF NOT (v_org = current_user_org_id() OR has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO';
  END IF;

  -- Resolver naviera desde tarifa o por nombre
  IF v_tarifa_id IS NOT NULL THEN
    SELECT t.naviera_id INTO v_naviera_id
    FROM public.costeo_tarifas t WHERE t.id = v_tarifa_id;
  END IF;

  IF v_naviera_id IS NULL AND v_naviera_nombre IS NOT NULL AND v_naviera_nombre <> '' THEN
    SELECT n.id INTO v_naviera_id FROM public.navieras n
    WHERE lower(n.name) = lower(v_naviera_nombre) LIMIT 1;
  END IF;

  IF v_naviera_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_cond FROM public.costeo_navieras_condiciones
  WHERE organization_id = v_org AND naviera_id = v_naviera_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_carta_vigente := v_cond.tiene_carta_garantia
    AND (v_cond.carta_garantia_vigente_hasta IS NULL OR v_cond.carta_garantia_vigente_hasta >= CURRENT_DATE);

  IF v_carta_vigente THEN
    v_monto := 0;
    v_estado := 'liberado';
  ELSE
    v_monto := COALESCE(v_cond.deposito_contenedor_usd, 0);
    v_estado := 'pendiente';
  END IF;

  UPDATE public.embarque_garantias_contenedor g
     SET monto_deposito_usd = v_monto,
         tiene_carta_garantia = v_carta_vigente,
         naviera_id = v_naviera_id,
         estado = CASE WHEN v_carta_vigente THEN 'liberado' ELSE g.estado END
   WHERE g.embarque_id = p_embarque_id
     AND g.estado = 'pendiente';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.refrescar_garantia_desde_tarifa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refrescar_garantia_desde_tarifa(uuid) TO authenticated, service_role;
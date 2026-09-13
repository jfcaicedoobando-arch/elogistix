-- Espejo canónico de public.set_garantia_estado (A-1).
-- Fuente vigente: 20260913005047_3264e7eb-6cf0-414a-9af4-28b0945bc7b7.sql
-- Vigilado por `bun run audit:schema-functions`.

CREATE OR REPLACE FUNCTION public.set_garantia_estado(
  p_id uuid,
  p_estado text DEFAULT NULL::text,
  p_fecha_deposito date DEFAULT NULL::date,
  p_fecha_liberacion date DEFAULT NULL::date,
  p_monto numeric DEFAULT NULL::numeric,
  p_referencia text DEFAULT NULL::text,
  p_notas text DEFAULT NULL::text)
RETURNS embarque_garantias_contenedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.embarque_garantias_contenedor;
  v_org uuid;
  v_estado_emb text;
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

  -- A-1: un embarque Cerrado ya tiene snapshot y P&L congelados.
  IF current_setting('app.bypass_cierre', true) <> 'on' THEN
    v_estado_emb := public._assert_embarque_abierto_locked(v_row.embarque_id);
    IF v_estado_emb = 'Cerrado' THEN
      RAISE EXCEPTION 'LC_EMBARQUE_CERRADO: el embarque está cerrado; reábrelo antes de modificar la garantía.'
        USING ERRCODE = 'check_violation';
    END IF;
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
$function$;

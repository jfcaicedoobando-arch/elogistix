-- Fuente canónica. Forward: 20261006230000_proforma_operativa_consistencia.sql.
CREATE OR REPLACE FUNCTION public.sync_embarque_tiene_proforma_from_concepto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_proformas uuid[];
  v_lock_key bigint;
  v_embarques uuid[];
  v_actuales uuid[];
  v_embarque uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_proformas := ARRAY[NEW.proforma_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_proformas := ARRAY[OLD.proforma_id];
  ELSE
    IF OLD.proforma_id IS NOT DISTINCT FROM NEW.proforma_id
       AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
      RETURN NEW;
    END IF;
    v_proformas := ARRAY[OLD.proforma_id, NEW.proforma_id];
  END IF;
  -- Ordenar las claves bigint reales mantiene el orden incluso ante colisiones
  -- del hash. No tomamos un row lock de proforma después de bloquear conceptos.
  FOR v_lock_key IN
    SELECT DISTINCT hashtextextended('proforma-operativa:' || id::text, 0) AS lock_key
    FROM unnest(v_proformas) AS x(id) WHERE id IS NOT NULL ORDER BY lock_key
  LOOP
    PERFORM pg_advisory_xact_lock(v_lock_key);
  END LOOP;
  SELECT array_agg(DISTINCT embarque_id ORDER BY embarque_id) INTO v_embarques
  FROM public.proformas WHERE id = ANY(v_proformas) AND embarque_id IS NOT NULL;
  PERFORM 1 FROM public.embarques
  WHERE id = ANY(v_embarques) ORDER BY id FOR NO KEY UPDATE;
  -- Si otra transacción movió la proforma mientras esperábamos, no añadir un
  -- bloqueo fuera de orden ni escribir un agregado del embarque equivocado.
  SELECT array_agg(DISTINCT embarque_id ORDER BY embarque_id) INTO v_actuales
  FROM public.proformas WHERE id = ANY(v_proformas) AND embarque_id IS NOT NULL;
  IF v_actuales IS DISTINCT FROM v_embarques THEN
    RAISE EXCEPTION 'LC_PROFORMA_VINCULO_CAMBIO: la proforma cambió de embarque; vuelve a intentar la operación'
      USING ERRCODE = '40001';
  END IF;
  FOREACH v_embarque IN ARRAY COALESCE(v_embarques, ARRAY[]::uuid[]) LOOP
    PERFORM public.recompute_embarque_tiene_proforma(v_embarque);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fuente canónica. Forward: 20261006230000_proforma_operativa_consistencia.sql.
CREATE OR REPLACE FUNCTION public.sync_embarque_tiene_proforma() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ids uuid[];
  v_embarque uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_ids := ARRAY[NEW.embarque_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_ids := ARRAY[OLD.embarque_id];
  ELSE
    IF (OLD.embarque_id, OLD.deleted_at, OLD.estado_proforma,
        OLD.estado_aprobacion, OLD.estado_cliente, OLD.estado_revision, OLD.consolidada_en)
       IS NOT DISTINCT FROM
       (NEW.embarque_id, NEW.deleted_at, NEW.estado_proforma,
        NEW.estado_aprobacion, NEW.estado_cliente, NEW.estado_revision, NEW.consolidada_en) THEN
      RETURN NEW;
    END IF;
    v_ids := ARRAY[OLD.embarque_id, NEW.embarque_id];
  END IF;
  -- La clave de proforma también existe cuando embarque_id es NULL.
  -- Serializa el vínculo con cambios de conceptos antes de resolver el agregado.
  PERFORM pg_advisory_xact_lock(hashtextextended('proforma-operativa:' || COALESCE(NEW.id, OLD.id)::text, 0));
  -- Ambos extremos se bloquean juntos en el mismo orden, incluso al mover.
  PERFORM 1 FROM public.embarques
  WHERE id = ANY(v_ids) ORDER BY id FOR NO KEY UPDATE;
  FOR v_embarque IN SELECT DISTINCT id FROM unnest(v_ids) AS x(id)
    WHERE id IS NOT NULL ORDER BY id
  LOOP
    PERFORM public.recompute_embarque_tiene_proforma(v_embarque);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $patch$
DECLARE v_def text; v_old text := 'SET embarque_id = v_embarque_id, estado = ''En operación''::estado_cotizacion, updated_at = now()';
BEGIN
  v_def := pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure);
  IF position(v_old IN v_def) = 0 THEN RAISE EXCEPTION 'No coincide la asignación de estado esperada en crear_embarque_borrador_core'; END IF;
  EXECUTE replace(v_def, v_old, 'SET embarque_id = v_embarque_id, updated_at = now()');
  v_def := pg_get_functiondef('public.sync_cotizacion_embarque_link()'::regprocedure);
  IF position('NEW.estado <> ''Borrador''::estado_embarque' IN v_def) = 0 THEN RAISE EXCEPTION 'No coincide el criterio esperado en sync_cotizacion_embarque_link'; END IF;
  EXECUTE replace(v_def, 'NEW.estado <> ''Borrador''::estado_embarque', 'NEW.estado NOT IN (''Borrador''::estado_embarque, ''Cotización''::estado_embarque, ''Cancelado''::estado_embarque)');
END $patch$;
CREATE OR REPLACE TRIGGER trg_sync_cotizacion_embarque_link
AFTER INSERT OR UPDATE OF cotizacion_id, deleted_at, estado ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public.sync_cotizacion_embarque_link();
-- =============================================================
-- embarque_confirmado_minimos.sql
--
-- Regla de negocio (v13.823.321): al pasar un embarque a `Confirmado`,
-- `avanzar_estado_embarque` exige los mismos mínimos que la UI marca con `*`:
-- shipper, consignatario, ETD, ETA, peso > 0 y los datos propios del modo
-- (marítimo: naviera + BL master u house + contenedor salvo LCL; aéreo:
-- aerolínea + MAWB; terrestre: transportista). El bloqueo se reporta como
-- `LC_CONFIRMADO_INCOMPLETO: <lista>`.
--
-- Este guard verifica el código instalado (pg_get_functiondef) para no
-- depender de auth.uid(), roles ni datos reales, y confirma que los candados
-- de tenant, idempotencia y concurrencia siguen intactos.
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/embarque_confirmado_minimos.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'avanzar_estado_embarque'
    AND pg_get_function_identity_arguments(p.oid) = 'p_embarque_id uuid, p_nuevo_estado text, p_usuario_email text, p_tipo_evento text, p_descripcion_evento text, p_request_id uuid';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'FALLO: no existe public.avanzar_estado_embarque con la firma esperada';
  END IF;

  -- Mínimos de confirmación
  IF position('LC_CONFIRMADO_INCOMPLETO' IN v_src) = 0 THEN
    RAISE EXCEPTION 'FALLO: falta el guard LC_CONFIRMADO_INCOMPLETO al confirmar';
  END IF;
  IF position('v_emb.shipper' IN v_src) = 0
     OR position('v_emb.consignatario' IN v_src) = 0
     OR position('v_emb.etd IS NULL' IN v_src) = 0
     OR position('v_emb.eta IS NULL' IN v_src) = 0 THEN
    RAISE EXCEPTION 'FALLO: el guard de Confirmado no revisa shipper/consignatario/ETD/ETA';
  END IF;
  IF position('peso mayor a 0 kg' IN v_src) = 0
     OR position('BL master u house' IN v_src) = 0
     OR position('MAWB' IN v_src) = 0
     OR position('transportista' IN v_src) = 0 THEN
    RAISE EXCEPTION 'FALLO: el guard de Confirmado perdió mínimos operativos previos';
  END IF;
  -- LCL sigue exento de contenedor obligatorio
  IF position('LCL' IN v_src) = 0 THEN
    RAISE EXCEPTION 'FALLO: se perdió la excepción de contenedor para LCL';
  END IF;

  -- Candados que NO deben relajarse
  IF position('idempotency_claim' IN v_src) = 0 OR position('idempotency_store' IN v_src) = 0 THEN
    RAISE EXCEPTION 'FALLO: se perdió la idempotencia de avanzar_estado_embarque';
  END IF;
  IF position('_assert_writer' IN v_src) = 0 THEN
    RAISE EXCEPTION 'FALLO: se perdió la validación de tenant (_assert_writer)';
  END IF;
  IF position('FOR UPDATE' IN v_src) = 0 OR position('LC_ESTADO_CONCURRENTE' IN v_src) = 0 THEN
    RAISE EXCEPTION 'FALLO: se perdió el candado de concurrencia';
  END IF;
  IF position('assert_transicion_embarque' IN v_src) = 0 THEN
    RAISE EXCEPTION 'FALLO: se perdió la validación de la máquina de estados';
  END IF;

  RAISE NOTICE 'OK: avanzar_estado_embarque exige los mínimos de Confirmado y conserva sus candados';
END $$;

-- El guard debe estar cerrado a anónimos.
DO $$
DECLARE
  v_anon boolean;
BEGIN
  SELECT has_function_privilege('anon',
    'public.avanzar_estado_embarque(uuid, text, text, text, text, uuid)', 'EXECUTE')
    INTO v_anon;
  IF v_anon THEN
    RAISE EXCEPTION 'FALLO: anon puede ejecutar avanzar_estado_embarque';
  END IF;
  RAISE NOTICE 'OK: anon no puede ejecutar avanzar_estado_embarque';
END $$;

ROLLBACK;

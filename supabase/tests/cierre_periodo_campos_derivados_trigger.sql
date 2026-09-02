-- =============================================================
-- cierre_periodo_campos_derivados_trigger.sql
-- Cubre `_assert_periodo_abierto()` (Defecto 3): dentro de un periodo
-- cerrado sólo pueden cambiar columnas derivadas allowlisted; el resto
-- (monto/total) y el soft-delete deben rechazarse.
-- Todo dentro de BEGIN…ROLLBACK.
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre) VALUES
  ('cdcd0000-0000-4000-8000-000000000001'::uuid, 'Cierre Trig Org');

INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
  ('cdcd0000-0000-4000-8000-0000000000c1'::uuid,
   'cdcd0000-0000-4000-8000-000000000001'::uuid, 'Cliente Trig', 'trig@test.mx');

INSERT INTO public.facturas
  (id, organization_id, cliente_id, numero, cliente_nombre, moneda, tipo_cambio,
   subtotal, total, estado, fecha_emision, fecha_vencimiento)
VALUES
  ('cdcd0000-0000-4000-8000-0000000000f1'::uuid,
   'cdcd0000-0000-4000-8000-000000000001'::uuid,
   'cdcd0000-0000-4000-8000-0000000000c1'::uuid,
   'TRIG-1', 'Cliente Trig', 'MXN'::moneda, 1, 1000, 1000,
   'Emitida'::estado_factura, '2026-01-15'::date, '2026-02-15'::date);

INSERT INTO public.configuracion (organization_id, categoria, clave, valor)
VALUES ('cdcd0000-0000-4000-8000-000000000001'::uuid, 'contabilidad',
        'cierre_periodo_fecha', to_jsonb('2026-01-31'::text));

-- Campo allowlisted (estado, columna derivada) ⇒ permitido.
DO $ok$
BEGIN
  UPDATE public.facturas SET estado = 'Pagada'::estado_factura
   WHERE id = 'cdcd0000-0000-4000-8000-0000000000f1'::uuid;
  RAISE NOTICE '✓ campo derivado (estado) se actualiza dentro de periodo cerrado';
END
$ok$ LANGUAGE plpgsql;

-- Campo NO permitido y no fiscal-inmutable (cliente_nombre) ⇒ rechazado por
-- el trigger de periodo. (No usamos `total`/`moneda`/etc. porque, al estar la
-- factura ya emitida, el trigger `trg_bloquear_factura_emitida` los rechaza
-- primero con `factura_inmutable`; aquí probamos específicamente el bloqueo
-- por periodo cerrado sobre un campo no fiscal y no derivado.)
DO $bloqueo_campo$
BEGIN
  BEGIN
    UPDATE public.facturas SET cliente_nombre = 'Otro Cliente'
     WHERE id = 'cdcd0000-0000-4000-8000-0000000000f1'::uuid;
    RAISE EXCEPTION 'FALLO: se modificó cliente_nombre en periodo cerrado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_PERIODO_CERRADO_CAMPO%' THEN
      RAISE EXCEPTION 'FALLO: error inesperado %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ campo no permitido (cliente_nombre) rechazado en periodo cerrado';
END
$bloqueo_campo$ LANGUAGE plpgsql;

-- Soft-delete ⇒ rechazado incluso sin tocar la fecha. En una factura ya
-- emitida gana el guard previo `LC_FACTURA_DELETE_EMITIDA` (regla de negocio
-- más restrictiva), así que se aceptan ambos códigos: lo que importa es que la
-- baja lógica NO pase dentro del periodo cerrado.
DO $bloqueo_delete$
BEGIN
  BEGIN
    UPDATE public.facturas SET deleted_at = now()
     WHERE id = 'cdcd0000-0000-4000-8000-0000000000f1'::uuid;
    RAISE EXCEPTION 'FALLO: se pudo hacer soft-delete en periodo cerrado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_PERIODO_CERRADO%'
       AND SQLERRM NOT LIKE 'LC_FACTURA_DELETE_EMITIDA%' THEN
      RAISE EXCEPTION 'FALLO: error inesperado %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ soft-delete rechazado en periodo cerrado sin tocar la fecha';
END
$bloqueo_delete$ LANGUAGE plpgsql;

-- Guard estructural: la rama de soft-delete del trigger de periodo sigue
-- existiendo (que otro guard gane primero no debe enmascarar su remoción).
DO $guard$
DECLARE
  v_src text;
BEGIN
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = '_assert_periodo_abierto'
   LIMIT 1;
  IF v_src IS NULL OR v_src NOT LIKE '%deleted_at%' THEN
    RAISE EXCEPTION 'REGRESIÓN: _assert_periodo_abierto perdió la rama de soft-delete';
  END IF;
  RAISE NOTICE '✓ _assert_periodo_abierto conserva la rama de soft-delete';
END
$guard$ LANGUAGE plpgsql;


ROLLBACK;

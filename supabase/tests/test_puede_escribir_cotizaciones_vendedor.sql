-- =============================================================
-- test_puede_escribir_cotizaciones_vendedor.sql · FIX VF-03
--
-- Verifica que el rol `vendedor` (SALES en
-- src/lib/access/permissionMatrix.ts) tiene escritura en cotizaciones
-- vía public.puede_escribir_cotizaciones(), y que el permiso no se abrió
-- de más (usuario sin rol y sesión anónima siguen en false).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/test_puede_escribir_cotizaciones_vendedor.sql
-- =============================================================

BEGIN;

DO $fixture$
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    ('c5555555-5555-5555-5555-555555555555', 'vf03-vendedor@test.mx'),
    ('c6666666-6666-6666-6666-666666666666', 'vf03-sinrol@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES ('c5555555-5555-5555-5555-555555555555', 'vendedor')
  ON CONFLICT DO NOTHING;
END
$fixture$ LANGUAGE plpgsql;

-- VF-03a: vendedor SÍ puede escribir cotizaciones.
DO $$
BEGIN
  IF NOT public.puede_escribir_cotizaciones('c5555555-5555-5555-5555-555555555555'::uuid) THEN
    RAISE EXCEPTION 'TEST FAIL: VF-03 - puede_escribir_cotizaciones() rechazó al rol vendedor';
  END IF;
  RAISE NOTICE 'OK VF-03a: vendedor puede escribir cotizaciones';
END
$$ LANGUAGE plpgsql;

-- VF-03b: usuario sin rol sigue sin escritura.
DO $$
BEGIN
  IF public.puede_escribir_cotizaciones('c6666666-6666-6666-6666-666666666666'::uuid) THEN
    RAISE EXCEPTION 'TEST FAIL: VF-03 - puede_escribir_cotizaciones() aceptó a un usuario sin rol';
  END IF;
  RAISE NOTICE 'OK VF-03b: usuario sin rol sigue sin escritura';
END
$$ LANGUAGE plpgsql;

-- VF-03c: sesión anónima (user NULL) sigue en false.
DO $$
BEGIN
  IF public.puede_escribir_cotizaciones(NULL) IS NOT FALSE THEN
    RAISE EXCEPTION 'TEST FAIL: VF-03 - puede_escribir_cotizaciones(NULL) no es false';
  END IF;
  RAISE NOTICE 'OK VF-03c: NULL sigue en false';
END
$$ LANGUAGE plpgsql;

ROLLBACK;

-- VB-01: normalización de razón social Unicode-safe.
--
-- El trigger `trg_clientes_nombre_mayusculas` / `trg_proveedores_nombre_mayusculas`
-- (20260804224635_79f330bb-194b-4738-bd21-11519d981e49.sql) usa `upper()` a secas.
-- `upper()` sigue la locale de la base: en instalaciones con locale C/POSIX es
-- ASCII-only y produce mojibake tipo "BAJíO" (la "í" nunca sube a "Í").
--
-- Fix: redefinir `_normalizar_razon_social()` para forzar una collation ICU
-- (`und`, reglas Unicode de case-mapping) cuando ICU está disponible, con
-- fallback a `upper()` estándar si el servidor no tiene ICU.
--
-- NOTA: los nombres ya corruptos en datos existentes son tarea de datos/seed,
-- fuera del alcance de este parche (este fix detiene la corrupción futura).

-- Collation ICU Unicode (creada sólo si el servidor soporta ICU y no existe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_collation
     WHERE collname = 'lc_unicode_upper' AND collnamespace = 'public'::regnamespace
  ) THEN
    BEGIN
      CREATE COLLATION public.lc_unicode_upper (provider = icu, locale = 'und');
    EXCEPTION WHEN OTHERS THEN
      -- Sin ICU disponible: la función caerá al upper() estándar.
      RAISE NOTICE 'ICU no disponible; _normalizar_razon_social usará upper() estándar';
    END;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._normalizar_razon_social()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nombre IS NOT NULL THEN
    BEGIN
      -- Collation ICU: mayúsculas Unicode completas (Í, Ó, Ñ, Ü, …)
      -- independientemente de la locale de la base de datos.
      NEW.nombre := upper(
        regexp_replace(btrim(NEW.nombre), '\s+', ' ', 'g') COLLATE "lc_unicode_upper"
      );
    EXCEPTION WHEN undefined_object OR undefined_function THEN
      -- Fallback si la collation ICU no existe (servidor sin ICU).
      NEW.nombre := upper(regexp_replace(btrim(NEW.nombre), '\s+', ' ', 'g'));
    END;
  END IF;
  RETURN NEW;
END;
$$;

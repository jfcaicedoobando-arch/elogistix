DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_collation
     WHERE collname = 'lc_unicode_upper' AND collnamespace = 'public'::regnamespace
  ) THEN
    BEGIN
      CREATE COLLATION public.lc_unicode_upper (provider = icu, locale = 'und');
    EXCEPTION WHEN OTHERS THEN
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
      NEW.nombre := upper(
        regexp_replace(btrim(NEW.nombre), '\s+', ' ', 'g') COLLATE "lc_unicode_upper"
      );
    EXCEPTION WHEN undefined_object OR undefined_function THEN
      NEW.nombre := upper(regexp_replace(btrim(NEW.nombre), '\s+', ' ', 'g'));
    END;
  END IF;
  RETURN NEW;
END;
$$;
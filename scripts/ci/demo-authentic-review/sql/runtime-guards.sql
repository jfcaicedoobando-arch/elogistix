CREATE FUNCTION public._guard_soft_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_new jsonb;
  v_uid uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.papelera_restore', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at THEN
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'LC_RESTORE_DIRECTO: para restaurar este registro usa la Papelera'
      USING ERRCODE = 'P0001';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_DELETED_AT_INMUTABLE: la fecha de borrado de un registro en papelera no se puede modificar'
      USING ERRCODE = 'P0001';
  END IF;
  v_uid := auth.uid();
  v_new := to_jsonb(NEW) || jsonb_build_object('deleted_at', now());
  IF v_new ? 'deleted_by' AND v_uid IS NOT NULL THEN
    v_new := v_new || jsonb_build_object('deleted_by', v_uid);
  END IF;
  NEW := jsonb_populate_record(NEW, v_new);
  RETURN NEW;
END;
$$;
CREATE FUNCTION public._assert_email_unico_org() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_dup int;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.email IS NOT DISTINCT FROM NEW.email THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'clientes' THEN
    SELECT count(*) INTO v_dup
    FROM public.clientes c
    WHERE c.organization_id = NEW.organization_id
      AND c.deleted_at IS NULL
      AND c.id <> NEW.id
      AND lower(btrim(coalesce(c.email, ''))) = lower(btrim(NEW.email));
  ELSE
    SELECT count(*) INTO v_dup
    FROM public.contactos_cliente c
    WHERE c.organization_id = NEW.organization_id
      AND c.deleted_at IS NULL
      AND c.id <> NEW.id
      AND lower(btrim(coalesce(c.email, ''))) = lower(btrim(NEW.email));
  END IF;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'LC_EMAIL_DUPLICADO: el correo % ya está registrado en esta organización.', NEW.email
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public._normalizar_email() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := NULLIF(lower(btrim(NEW.email)), '');
  END IF;
  RETURN NEW;
END;
$$;

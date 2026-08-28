-- Ola 7 (M3): normalización y unicidad de correos por organización
CREATE OR REPLACE FUNCTION public._normalizar_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := NULLIF(lower(btrim(NEW.email)), '');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._assert_email_unico_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_dup int;
BEGIN
  IF NEW.email IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Sólo validamos cuando el correo cambia (o es un registro nuevo):
  -- los duplicados históricos quedan intactos.
  IF TG_OP = 'UPDATE' AND OLD.email IS NOT DISTINCT FROM NEW.email THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'clientes' THEN
    SELECT count(*) INTO v_dup
    FROM public.clientes c
    WHERE c.organization_id = NEW.organization_id
      AND c.deleted_at IS NULL
      AND c.id <> NEW.id
      AND lower(btrim(coalesce(c.email, ''))) = NEW.email;
  ELSE
    SELECT count(*) INTO v_dup
    FROM public.contactos_cliente c
    WHERE c.organization_id = NEW.organization_id
      AND c.deleted_at IS NULL
      AND c.id <> NEW.id
      AND lower(btrim(coalesce(c.email, ''))) = NEW.email;
  END IF;

  IF v_dup > 0 THEN
    RAISE EXCEPTION 'LC_EMAIL_DUPLICADO: el correo % ya está registrado en esta organización.', NEW.email
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_normalizar_email ON public.clientes;
CREATE TRIGGER trg_clientes_normalizar_email
BEFORE INSERT OR UPDATE OF email ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public._normalizar_email();

DROP TRIGGER IF EXISTS trg_clientes_email_unico ON public.clientes;
CREATE TRIGGER trg_clientes_email_unico
BEFORE INSERT OR UPDATE OF email ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public._assert_email_unico_org();

DROP TRIGGER IF EXISTS trg_contactos_cliente_normalizar_email ON public.contactos_cliente;
CREATE TRIGGER trg_contactos_cliente_normalizar_email
BEFORE INSERT OR UPDATE OF email ON public.contactos_cliente
FOR EACH ROW EXECUTE FUNCTION public._normalizar_email();

DROP TRIGGER IF EXISTS trg_contactos_cliente_email_unico ON public.contactos_cliente;
CREATE TRIGGER trg_contactos_cliente_email_unico
BEFORE INSERT OR UPDATE OF email ON public.contactos_cliente
FOR EACH ROW EXECUTE FUNCTION public._assert_email_unico_org();

-- Ola 7 (M5): cronología de eventos de embarque
CREATE OR REPLACE FUNCTION public._validar_cronologia_evento_embarque()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_zarpe timestamptz;
  v_arribo timestamptz;
  v_reales text[] := ARRAY[
    'Zarpe','Arribo a Puerto','Descarga','Despacho Aduanal','Liberación','Entrega'
  ];
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo::text = ANY (v_reales) AND NEW.fecha > now() + interval '1 day' THEN
    RAISE EXCEPTION 'LC_EVENTO_FECHA_FUTURA: el evento "%" no puede registrarse con fecha futura.', NEW.tipo
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT min(e.fecha) INTO v_zarpe
  FROM public.eventos_embarque e
  WHERE e.embarque_id = NEW.embarque_id
    AND e.deleted_at IS NULL
    AND e.id <> NEW.id
    AND e.tipo = 'Zarpe';

  IF v_zarpe IS NOT NULL
     AND NEW.tipo::text IN ('Arribo a Puerto','Descarga','Despacho Aduanal','Liberación','Entrega')
     AND NEW.fecha < v_zarpe THEN
    RAISE EXCEPTION 'LC_EVENTO_ORDEN_INVALIDO: "%" no puede ser anterior al zarpe (%).', NEW.tipo, v_zarpe
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.tipo::text = 'Entrega' THEN
    SELECT min(e.fecha) INTO v_arribo
    FROM public.eventos_embarque e
    WHERE e.embarque_id = NEW.embarque_id
      AND e.deleted_at IS NULL
      AND e.id <> NEW.id
      AND e.tipo = 'Arribo a Puerto';

    IF v_arribo IS NOT NULL AND NEW.fecha < v_arribo THEN
      RAISE EXCEPTION 'LC_EVENTO_ORDEN_INVALIDO: la entrega no puede ser anterior al arribo (%).', v_arribo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._normalizar_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._assert_email_unico_org() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._validar_cronologia_evento_embarque() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_eventos_embarque_cronologia ON public.eventos_embarque;
CREATE TRIGGER trg_eventos_embarque_cronologia
BEFORE INSERT OR UPDATE OF fecha, tipo ON public.eventos_embarque
FOR EACH ROW EXECUTE FUNCTION public._validar_cronologia_evento_embarque();
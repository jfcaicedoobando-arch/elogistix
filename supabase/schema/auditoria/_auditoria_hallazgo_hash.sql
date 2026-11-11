CREATE OR REPLACE FUNCTION public._auditoria_hallazgo_hash(p_texto text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path TO ''
AS $$
DECLARE
  caracter text;
  codigo integer;
  hash bigint := 5381;
  resultado text := '';
  alfabeto constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
BEGIN
  FOREACH caracter IN ARRAY string_to_array(p_texto, NULL) LOOP
    codigo := ascii(caracter);
    IF codigo > 65535 THEN
      hash := (hash * 33 + 55296 + (codigo - 65536) / 1024) % 4294967296;
      codigo := 56320 + (codigo - 65536) % 1024;
    END IF;
    hash := (hash * 33 + codigo) % 4294967296;
  END LOOP;

  LOOP
    resultado := substr(alfabeto, (hash % 36)::integer + 1, 1) || resultado;
    hash := hash / 36;
    EXIT WHEN hash = 0;
  END LOOP;
  RETURN resultado;
END;
$$;

REVOKE ALL ON FUNCTION public._auditoria_hallazgo_hash(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._auditoria_hallazgo_hash(text) TO authenticated, service_role;

## Diagnóstico

El job de CI **"RLS tests result / Apply migrations"** falla con:

```
ERROR: function public.generar_expediente(text) does not exist
```

Causa: la migración `20260624192903…sql` (la que agrega el overload `generar_expediente(tipo_operacion)`) hace `SELECT public.generar_expediente(tipo_op::text)` dentro de su cuerpo. En prod el overload `generar_expediente(text)` existe (lo confirmé con `pg_proc`), pero **no fue creado por ninguna migración** — vive sólo en el snapshot productivo. CI arranca desde cero y aplica migraciones secuencialmente, así que cuando llega al overload nuevo no encuentra el `text` y aborta.

Confirmación en prod (no se toca):
```
generar_expediente(tipo_op text)              -- LANGUAGE plpgsql, SECURITY DEFINER
generar_expediente(tipo_op tipo_operacion)    -- LANGUAGE sql,    SECURITY DEFINER (lo agregamos nosotros)
```

## Solución

Nueva migración `…_register_generar_expediente_text.sql` que registra el overload `text` con el mismo cuerpo exacto que ya está en prod (idempotente con `CREATE OR REPLACE`, así no rompe nada al re-aplicarse). Va **antes** de cualquier llamada — pero como va a quedar con timestamp más reciente, basta con que también `CREATE OR REPLACE`-emos el overload `tipo_operacion` para que el orden interno no importe (la búsqueda de funciones es resolución por nombre al ejecutar, no al crear).

Detalle clave: `CREATE OR REPLACE FUNCTION` para el overload `tipo_operacion` con `SELECT public.generar_expediente(tipo_op::text)` ya no fallará si en el mismo archivo creamos primero el `text`. Como precaución, este nuevo archivo declara ambos en orden: primero el `text`, luego re-declara el `tipo_operacion`.

```sql
-- 1) Registra el cuerpo real que ya existe en prod (idempotente)
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE prefijo text; consecutivo int;
BEGIN
  consecutivo := nextval('embarque_consecutivo_seq');
  CASE tipo_op
    WHEN 'Importación' THEN prefijo := 'IMP';
    WHEN 'Exportación' THEN prefijo := 'EXP';
    WHEN 'Nacional'    THEN prefijo := 'NAC';
    ELSE prefijo := 'GEN';
  END CASE;
  RETURN 'EL' || prefijo || lpad(consecutivo::text, 5, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(text) TO authenticated, service_role;

-- 2) Re-asegura el overload por enum (idempotente)
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op public.tipo_operacion)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.generar_expediente(tipo_op::text); $$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) TO authenticated, service_role;
```

En prod no cambia comportamiento (es el mismo cuerpo ya existente). En CI desbloquea el pipeline.

## Versión

- `src/constants/appVersion.ts` → `13.135.37`
- `CHANGELOG.md` → `[13.135.37]`: "fix(ci): registra `generar_expediente(text)` como migración (existía en prod sin migración correspondiente) para desbloquear el job de RLS tests."

## Fuera de alcance

- Reescribir el código que llama `generar_expediente(...)`.
- Revisar otras funciones potencialmente "no migradas" (sería un barrido aparte; aviso si quieres que lo haga después).

# Fix: cambio de estado del embarque rompe por cast text → enum

## Diagnóstico

Al avanzar el estado del embarque, el frontend llama al RPC `public.avanzar_estado_embarque(...)`. Dentro de esa función:

```sql
INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ...)
VALUES (p_embarque_id, p_tipo_evento, p_descripcion_evento, ...);
```

`p_tipo_evento` es `text`, pero `eventos_embarque.tipo` es del enum `tipo_evento_tracking`. PostgreSQL no hace cast implícito entre `text` y un enum custom en un INSERT, por lo que lanza:

> column "tipo" is of type tipo_evento_tracking but expression is of type text

La línea de `notas_embarque` tampoco está casteada (`'cambio_estado'` literal funciona por coerción de literal, pero conviene blindarla también).

## Solución

Migración que vuelve a crear `public.avanzar_estado_embarque` con casts explícitos:

- `p_tipo_evento::tipo_evento_tracking` al insertar en `eventos_embarque`.
- `'cambio_estado'::tipo_nota` al insertar en `notas_embarque` (defensivo).

El resto de la función (idempotencia, validación de organización, UPDATE de estado, respuesta JSON) queda igual.

### Archivos a tocar

1. **Nueva migración** `supabase/migrations/<timestamp>_fix_avanzar_estado_embarque_cast.sql` con el `CREATE OR REPLACE FUNCTION` corregido.
2. **`src/constants/appVersion.ts`** → bump a `8.222.0`.
3. **`src/content/changelog/v8/chunks/0.ts`** y **`src/content/changelogData.ts`** → entrada `8.222.0`.

## Validación

- Desde la sesión de Valeria, avanzar el estado del embarque `30525762…`: la operación debe completar sin error y registrar la nota + evento.
- Verificar en DB que se creó la fila en `eventos_embarque` con `tipo` correcto y la nota en `notas_embarque`.

## Detalles técnicos

- Sólo cambia el cuerpo del RPC; firma, permisos y `SECURITY DEFINER` se conservan.
- No se requiere cambiar `src/services/embarque/mutations.ts` ni el hook que llama el RPC: siguen mandando `tipo_evento` como string.

## Resumen de Sentry

4 issues abiertos en últimos 7 días:

1. **JAVASCRIPT-REACT-1P** (2 eventos, real) — `column "user_id" of relation "notificaciones_internas" does not exist` al crear borrador de embarque desde una cotización aceptada.
2. **JAVASCRIPT-REACT-1N / 1M** — errores minificados (`<unknown>`, `zF`) sin stack útil; 1 evento cada uno hace 49 min. Sin acción ahora.
3. **JAVASCRIPT-REACT-1K** — "Invalid login credentials". Es el mensaje normal cuando alguien teclea mal la contraseña; no es bug.

Sólo el #1 es bug real. Procedo a arreglarlo.

## Causa raíz #1

Analogía: la función SQL `crear_embarque_borrador_desde_cotizacion` mete una carta al buzón de notificaciones, pero usa nombres viejos de las casillas del sobre. La tabla `notificaciones_internas` tiene las columnas `usuario_id` y `enlace`, pero la función intenta insertar en `user_id` y `link`. Postgres tira el INSERT y revienta todo el flujo de "Convertir cotización en embarque".

```sql
-- Tabla real:
usuario_id uuid, enlace text  ...
-- Función actual (incorrecta):
INSERT INTO notificaciones_internas (organization_id, user_id, ..., link) ...
```

## Solución

1. **Migración SQL** — reemplazar `CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid)` cambiando sólo el INSERT final a:
   ```sql
   INSERT INTO public.notificaciones_internas (
     organization_id, usuario_id, tipo, titulo, mensaje, enlace
   )
   SELECT v_cot.organization_id, om.user_id, 'cotizacion_borrador_embarque',
          'Borrador de embarque creado',
          'Se generó el borrador ' || v_expediente || ' desde la cotización ' || v_cot.folio,
          '/embarques/' || v_embarque_id::text
   FROM public.organization_members om
   WHERE om.organization_id = v_cot.organization_id
     AND om.role IN ('admin'::app_role, 'operador'::app_role)
     AND om.user_id <> auth.uid();
   ```
   El resto del cuerpo queda igual. La sobrecarga de 4 args (`p_decision, ...`) ya delega en esta, no necesita cambios.

2. **Versión + changelog**
   - `src/constants/appVersion.ts` → `13.135.30`
   - `CHANGELOG.md` → entrada `[13.135.30]` describiendo el fix.

## Validación

- Volver a abrir la cotización aceptada en preview y reintentar "Crear embarque desde cotización" → ya no debe lanzar `column user_id ... does not exist`.
- Marcar el issue de Sentry como resuelto sólo después de confirmar (lo dejo al usuario o automatizado en un commit posterior).

## Fuera de alcance

- No tocamos los issues `<unknown>`/`zF` (sin stack útil; esperar más eventos con sourcemaps).
- No tocamos "Invalid login credentials" (no es bug).

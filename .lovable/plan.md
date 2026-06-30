## Diagnóstico

El error `column "user_id" of relation "bitacora_actividad" does not exist` (42703) ocurre porque la RPC `set_facturapi_api_key` (y otras 7 funciones) intenta insertar en `bitacora_actividad` con columnas que no existen en la tabla.

**Esquema real de `bitacora_actividad`:**
`id, organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles (jsonb), created_at`

**Lo que las funciones intentan insertar (incorrecto):**
`user_id`, `entidad_tipo`, `entidad`, `descripcion`, `detalle`, `metadata`

Es deuda histórica: las funciones se escribieron contra un esquema anterior y nunca se sincronizaron. La razón de que no haya explotado antes es que muchas no se disparan a diario; el usuario lo vio ahora al intentar guardar una API key de FacturApi.

## Funciones afectadas (8)

1. `set_facturapi_api_key` ← causa el error reportado
2. `clear_facturapi_api_key`
3. `convertir_proformas_a_factura`
4. `recotizar_cotizacion`
5. `aceptar_cotizacion_version`
6. `portal_responder_cotizacion`
7. `solicitar_reaprobacion_tarifa`
8. `duplicar_factura_para_sustitucion`

## Solución

Una sola migración que hace `CREATE OR REPLACE FUNCTION` de cada una con el `INSERT` corregido. Mapeo:

```text
user_id        → usuario_id
entidad_tipo   → modulo           (texto descriptivo del dominio)
entidad        → modulo
descripcion    → detalles->>'descripcion'   (se mete dentro del jsonb)
detalle        → detalles
metadata       → detalles
```

`usuario_email` se llena con `(SELECT email FROM auth.users WHERE id = auth.uid())` o `''` si auth.uid() es null (caso edge functions con `service_role`). `entidad_nombre` queda `''` cuando la función no maneja un nombre humano.

No se altera lógica de negocio, sólo el `INSERT` final de cada función. Las llamadas desde el front no cambian.

## Verificación

- Tras la migración: probar guardar API key sandbox en `/configuracion` → debe responder OK y aparecer una fila en `bitacora_actividad` con `accion='facturapi_api_key_actualizada'`.
- Smoke test: convertir una proforma a factura y recotizar una cotización para confirmar que esas dos rutas siguen funcionando.

## Versionado

- Bump a `13.141.6` (patch).
- Entrada en `CHANGELOG.md` documentando el fix y listando las 8 RPCs corregidas.
- Resolver issue Sentry `JAVASCRIPT-REACT-1...` correspondiente con razón "fixed in 13.141.6".

## Analogía

Imagina que tienes 8 formularios de papel que llenas a mano y los metes en un buzón. Hace un tiempo cambiaron el buzón y ahora sólo acepta sobres con ciertos campos en el dorso (`usuario_id`, `modulo`, `detalles`). Los formularios siguen usando los campos viejos (`user_id`, `entidad_tipo`, `metadata`), así que el buzón los rechaza. La migración reimprime los 8 formularios con los campos nuevos sin cambiar nada del contenido. ¿Procedo?

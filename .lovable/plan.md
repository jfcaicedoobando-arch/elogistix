## Contexto

Marta (gerente_operaciones) intentó dar clic en "Aceptar (manual)" o "Rechazar (manual)" en `/proformas/…` y la app le mostró un toast/pantalla de error: *"You do not have permission to change the customer status on this proforma."* (traducción visible del mensaje que devuelve el backend).

## Causa raíz

Hay **inconsistencia entre el frontend y el RPC de la base de datos** sobre quién puede cambiar manualmente el estado del cliente en una proforma:

| Capa | Roles permitidos |
|---|---|
| Frontend — `src/hooks/shared/usePermissions.ts:136` (`RESPONDER_PROFORMA_MANUAL`) | `super_admin`, `admin_org`, `admin`, `gerente_comercial`, `gerente_operaciones` |
| DB — RPC `actualizar_estado_cliente_proforma` (migración `20260702174034`, línea 78) | `admin`, `admin_org`, `contador`, `operador` (+ `super_admin` global) |

- El frontend le muestra los botones a Marta porque su rol (`gerente_operaciones`) está en la lista.
- La DB rechaza el UPDATE porque los gerentes no están en la lista del guardia.
- Nota: la política de v13.145.8 (visible en el comentario de `usePermissions.ts:134`) fue: "sólo admins y gerentes deben poder responder manualmente". La migración del RPC (creada meses después) copió la lista vieja (contador/operador) y **se olvidó de reflejar** la política v13.145.8. Este es el desfase que hay que corregir.

## Plan

### Paso 1 — Alinear el RPC con el frontend

Nueva migración SQL que redefine `public.actualizar_estado_cliente_proforma(uuid, text, text)` para que su chequeo de rol coincida exactamente con `RESPONDER_PROFORMA_MANUAL` del frontend:

```sql
CREATE OR REPLACE FUNCTION public.actualizar_estado_cliente_proforma(...)
...
SELECT EXISTS (
  SELECT 1 FROM public.organization_members om
   WHERE om.user_id = auth.uid()
     AND om.organization_id = v_proforma.organization_id
     AND om.role IN (
       'admin'::app_role,
       'admin_org'::app_role,
       'gerente_operaciones'::app_role,
       'gerente_comercial'::app_role
     )
) OR public.has_role(auth.uid(), 'super_admin'::app_role) INTO v_is_authorized;
```

- Se **quitan** `contador` y `operador` de la lista (siguiendo la política v13.145.8 declarada en `usePermissions.ts`).
- Se **añaden** `gerente_operaciones` y `gerente_comercial`.
- El resto del cuerpo del RPC no cambia (misma bitácora, mismo update, misma liberación de conceptos en rechazo, mismos `REVOKE`/`GRANT EXECUTE`).
- Se traduce al español el mensaje de excepción (ya está en español: *"No tienes permisos para cambiar el estado del cliente en esta proforma."*), pero el `RespuestaClienteManualDialog.tsx:63` ya intercepta el texto con la regex `/no tienes permisos|permission denied|.../i`, así que el usuario verá un toast en español, no la pantalla técnica de ErrorBoundary. Confirmar leyendo ese archivo antes de aplicar.

### Paso 2 — Test unitario del catálogo de permisos

Añadir un test en `src/hooks/shared/__tests__/usePermissions.responderProforma.test.ts` que verifique que **`gerente_operaciones` y `gerente_comercial`** están en `RESPONDER_PROFORMA_MANUAL` y que `contador`/`operador`/`vendedor`/`viewer` no lo están. Sirve como red de seguridad para que nadie vuelva a divergir la lista sin darse cuenta.

Este es el único test que puedo escribir con Vitest para prevenir la regresión; el chequeo real está en Postgres y se validaría manualmente (con Marta o con un usuario de prueba con rol `gerente_operaciones`).

### Paso 3 — Bump y changelog

- `APP_VERSION` → `13.300.10` (`src/constants/appVersion.ts`).
- Entrada en `CHANGELOG.md`: describe el desfase, la migración y menciona v13.145.8 como la política que se termina de aplicar.

## Detalles técnicos

- La migración usa `CREATE OR REPLACE FUNCTION` con la misma firma `(uuid, text, text)` que la migración `20260702174034`, así que no hay que re-`GRANT` (los grants se preservan para `authenticated`).
- El único cambio funcional dentro del RPC son las 4 líneas del `role IN (...)`.
- No se toca la política RLS de `public.proformas` — el RPC ya es `SECURITY DEFINER` y ese es el único camino de escritura para `estado_cliente` desde la app.
- Fuera de alcance: revisar si otros RPCs (`portal_responder_proforma`, RPCs de embarque, etc.) tienen el mismo desfase — no aparece en el reporte y ese análisis sería un sprint aparte.

## Verificación

- Correr `bun run audit:tests` y la suite de Vitest tras añadir el nuevo test.
- Correr Playwright con la cuenta de auditoría (`mem://reference/audit-login`), impersonar a un `gerente_operaciones` sobre una proforma pendiente y confirmar que el clic en "Aceptar (manual)" ya no produce el toast rojo (respuesta 200 en la red y el badge de estado_cliente cambia a "Aceptada").

## Riesgos

- Bajo. Quitar `contador`/`operador` de la lista es un endurecimiento (no una apertura) y coincide con la política que ya declara el frontend. Si algún cliente esperaba que su contador aceptara manualmente proformas, se detectará rápidamente y podemos volver a añadir el rol en una migración de una línea.

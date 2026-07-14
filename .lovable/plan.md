## Hallazgo de Sentry (últimas 24 h)

Sólo hay **1 issue abierto**: `JAVASCRIPT-REACT-2E` — 1 evento, 1 usuario.

- **Mensaje:** `No tienes permisos para cambiar el estado del cliente en esta proforma.`
- **Origen:** RPC del backend `actualizar_..._proforma` (guardia de autorización correcta).
- **Ruta:** `/proformas/:id`, disparado desde `RespuestaClienteManualDialog.tsx` cuando un `gerente_operaciones` intenta "Marcar aceptada/rechazada por el cliente".
- **Diagnóstico:** No es un bug. El backend está haciendo su trabajo. El problema es que se está reportando como **error crítico a Sentry** (contamina la cuota y las alertas) y el mensaje al usuario aparece con severidad "Error" en lugar de "Advertencia".

## Analogía

Es como si la puerta con cerrojo (RLS del backend) hiciera sonar la alarma de incendios cada vez que alguien sin llave intenta entrar. Queremos que la puerta siga cerrada, pero que sólo muestre un cartel amable — no que llame a los bomberos.

## Plan

### 1. Convertir el error en advertencia local (fix puntual)
- Archivo: `src/features/proformas/components/RespuestaClienteManualDialog.tsx`
- En el `catch` de `handleConfirmar`, detectar si el mensaje contiene `"no tienes permisos"` (case-insensitive) y usar `notifyWarning` en lugar de `notifyError`. Así el usuario ve un toast amarillo claro y **no se envía a Sentry**.
- El resto de errores (red, servidor, etc.) siguen reportándose normalmente.

### 2. Filtro global preventivo en `notifyError`
- Archivo: `src/components/shared/utils/appFeedback.ts`
- Añadir un pequeño helper `isAuthorizationError(err)` que reconoce mensajes como `no tienes permisos`, `permission denied`, `not authorized`. Cuando detecta este patrón, **omite `reportCaughtError`** (Sentry) aunque igual muestra el toast al usuario.
- Beneficio: cualquier otro call site que en el futuro tope con un guard del backend hereda el filtro sin código extra.

### 3. Resolver el issue en Sentry
- Marcar `JAVASCRIPT-REACT-2E` como `resolved` vía `update_issue` en el mismo turno del fix (regla de memoria).

### 4. Tests
- Añadir un test unitario en `appFeedback.test.ts` que verifica que `notifyError` con un `Error("No tienes permisos ...")` **no invoca** `reportCaughtError`, y con `Error("Network fail")` sí lo hace.

### 5. Versionado y changelog
- Bump `APP_VERSION` → `13.300.7`.
- Entrada en `CHANGELOG.md`: fix Sentry noise por errores de autorización de proforma + resolución del issue.

## Detalles técnicos

```ts
// appFeedback.ts
function isAuthorizationError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return /no tienes permisos|permission denied|not authorized|forbidden/i.test(msg);
}

if (error !== undefined && error !== null && !isAuthorizationError(error)) {
  reportCaughtError(error, { ... }, { ... });
}
```

```tsx
// RespuestaClienteManualDialog.tsx
} catch (e) {
  const msg = (e as Error).message ?? "";
  if (/no tienes permisos/i.test(msg)) {
    notifyWarning(toast, { title: "Acción no permitida", description: msg });
  } else {
    notifyError(toast, { title: "Error al actualizar", description: msg, error: e, method: "PROFORMAS_RESPUESTA_MANUAL" });
  }
}
```

## Fuera de alcance
- No se toca la RPC ni las políticas RLS — el backend está correcto.
- No se ocultan botones por rol en este sprint (la UI ya asume que roles operativos pueden intentar la acción; el fix respeta esa expectativa).

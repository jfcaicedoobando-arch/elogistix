## Problema

El shard 14 falla en `useEmbarqueEstadoActions.branches.test.tsx`:

```
FAIL sync automático > dispara syncEstado cuando el estado calculado difiere del actual
Number of calls: 0
```

## Causa

En v13.209.3 se añadió un gate al `useEffect` de sync automático para evitar el error RLS 42501 en `eventos_embarque` cuando un rol sin permisos (p. ej. `contador`) abre el detalle:

```ts
const puedeSincronizarEstado = isAdmin || isSuperAdmin || canEditOperations;
...
if (!puedeSincronizarEstado) return;
```

El test mock de `usePermissions` sólo expone `{ isAdmin, canEditFinance }`, así que `canEditOperations` e `isSuperAdmin` quedan `undefined` y el gate bloquea el sync en el escenario esperado.

## Fix (solo test)

Actualizar `src/features/embarques/hooks/__tests__/useEmbarqueEstadoActions.branches.test.tsx`:

1. Ampliar el objeto `h.perms` y su reset en `beforeEach` para incluir `canEditOperations` e `isSuperAdmin` (default `false`), reflejando la firma real del hook.
2. En el `describe("sync automático")`:
   - Caso "dispara syncEstado…": setear `h.perms.canEditOperations = true` antes del `renderH`, porque ahora el sync automático requiere permiso de operaciones.
   - Caso "NO dispara sync…": dejarlo como está (sin permisos → sigue sin disparar, cubre además la rama del nuevo gate).
3. Añadir un test extra opcional: "no dispara sync cuando el usuario carece de permisos (rol contador)" para blindar la regresión del error de producción reportado.

## Fuera de alcance

- No se modifica `useEmbarqueEstadoActions.ts` — el gate es correcto y arregla el bug real (RLS `eventos_embarque`).
- No hay cambios en RLS, BD, ni en el flujo de sync.
- No se bumpea `APP_VERSION` porque es sólo un ajuste de test; se registra una línea breve en `CHANGELOG.md` bajo la versión `13.209.3` existente (patch de test).

## Analogía

El código nuevo es un candado en la puerta: sólo abre para admin/super_admin/operaciones. El test antiguo probaba la puerta sin darle llave; ahora le entregamos la llave correcta al caso que debe abrir, y agregamos un caso que verifica que quien no tiene llave se queda fuera (que es justo el bug que reportó el contador).

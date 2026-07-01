## Sentry: `JAVASCRIPT-REACT-1V` — RLS violation en `tracking_links`

### Analogía
El rol **contador** es como un auditor con permiso para *leer* la carpeta de embarques pero no para imprimir stickers públicos. En la app le mostramos el botón "Compartir tracking", él le da clic, y la BD (guardia RLS) le rechaza el INSERT en `tracking_links` → Sentry captura la excepción.

### Diagnóstico
- Error: `new row violates row-level security policy for table "tracking_links"` (code `42501`).
- Usuario con `effective_role = contador` en `/embarques/:id`.
- La policy `Org staff manage tracking_links` sólo permite `admin`, `operador`, `super_admin`, `is_org_admin`. Contador queda fuera **por diseño** (es un rol de lectura para embarques, agregado recientemente).
- El botón "Compartir tracking" se muestra en `EmbarqueDetalleHeaderActions.tsx` sin gating por rol → al hacer clic, `useCreateTrackingLink` intenta el INSERT y explota.

### Solución
Mantener el rol contador como read-only y **ocultar** los botones que hacen mutaciones sobre el embarque para ese rol. Empezamos con el que falló (Compartir tracking); dejamos preparado el patrón para replicar a Avanzar estado / Duplicar / Eliminar / Reabrir si aparecen en Sentry.

### Cambios

1. `src/features/embarques/components/EmbarqueDetalleHeaderActions.tsx`
   - Leer `useEffectiveRole()` (ya existe en el proyecto) y calcular `isReadOnly = effectiveRole === 'contador'`.
   - Envolver el botón "Compartir tracking" en `!isReadOnly && (...)`.
   - Aplicar mismo gating a "Avanzar estado", "Duplicar", "Eliminar", "Reabrir" para consistencia (contador nunca debería verlos).

2. `src/features/embarques/hooks/useEmbarqueDetalleTracking.ts`
   - Añadir guard: si `effectiveRole === 'contador'`, `handleCompartirTracking` muestra un `notifyError` con mensaje "No tienes permisos para generar enlaces públicos" y **no** intenta el INSERT. Defensa en profundidad por si el botón se muestra vía tab externo.

3. `src/lib/observability/sentry/dropPredicate.ts`
   - Filtrar errores Postgres con `code === '42501'` (RLS denied). No son bugs; son permisos correctos y saturan Sentry.
   - Test unitario nuevo en `dropPredicate.test.ts` con un error `{ code: '42501', message: '...' }`.

4. `src/features/embarques/hooks/__tests__/useEmbarqueDetalleTracking.test.tsx`
   - Nuevo caso: rol contador → no llama a `mutateAsync` y muestra toast de permiso.

5. Sentry: marcar `JAVASCRIPT-REACT-1V` como resuelto en `13.142.9`.

6. `CHANGELOG.md` + bump `APP_VERSION` → `13.142.9`.

### Fuera de alcance
- No modifico la RLS policy (dar `contador` permiso de INSERT contradice el diseño del rol lectura).
- No cambio otros botones de otras pantallas hasta ver evidencia en Sentry o feedback del usuario.

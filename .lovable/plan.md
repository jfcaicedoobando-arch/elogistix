## Resumen de la auditoría

Se confirmaron **13 instancias** del mismo bug de doble-toast en 9 archivos. El subagente además marcó 4 sospechosos y validó que los hooks recién corregidos (`Usuarios.tsx`) ya están limpios.

**Mecánica:** TanStack Query **acumula** los callbacks pasados a `mutation.mutate(vars, { onSuccess, onError })` sobre los definidos en `useMutation({ onSuccess, onError })`. Cuando ambas capas notifican, el usuario ve dos toasts. Analogía: el hook es el repartidor que ya tocó el timbre; el componente vuelve a tocarlo cuando recibe la pizza.

## Convención a establecer

**El toast vive exclusivamente en el hook de mutación** (`useMutation.onSuccess`/`onError`). Los componentes pueden seguir pasando callbacks por `mutate(vars, { onSuccess })` pero sólo para reacciones locales (cerrar diálogo, limpiar form, redirigir). Nunca para notificar.

## Lista de cambios (13 hallazgos en 9 archivos)

| # | Archivo a editar | Acción |
|---|---|---|
| 1 | `src/features/admin/components/AgregarMiembroOrgDialog.tsx` (~L44) | Quitar `notifySuccess`/`notifyError` del `try/catch`; conservar cierre del diálogo en `onSuccess`/`onSettled` sin toast |
| 2 | `src/features/admin/components/usuario/NuevoUsuarioDialog.tsx` (L78, L84) | Quitar `onSuccess`/`onError` con toast del segundo arg de `createUser.mutate` |
| 3 | `src/features/cliente/components/TabPortalCliente.tsx` (L61, L71-72) | Quitar callbacks de toast de `revokeMutation.mutate` y `resendMutation.mutate` |
| 4 | `src/features/comisiones/components/TabVendedorasConfig.tsx` (L50-53, L61, L164) | Quitar 3 pares de `onSuccess: toast.success`/`onError: notifyError` |
| 5 | `src/features/comisiones/components/DialogRegistrarPagoLiquidacion.tsx` (L32-33) | Quitar callbacks de toast |
| 6 | `src/features/comisiones/components/DialogGenerarLiquidacion.tsx` (L32-33) | Quitar callbacks de toast |
| 7 | `src/features/cxp/routes/Cxp.tsx` (L148-149) | Quitar `onSuccess`/`onError` con toast de `eliminar.mutateAsync` |
| 8 | `src/features/tesoreria/components/PanelConciliacionMovimiento.tsx` (L47-48, L58-59, L66-67) | Quitar 3 pares de callbacks |

Para cada uno: si el callback además hacía algo no-toast (cerrar diálogo, reset de form), preservar esa lógica y borrar sólo la línea de `toast.*`/`notifySuccess`/`notifyError`. Eliminar imports muertos (`toast`, `notifySuccess`, `notifyError`, `useToast`, `getErrorMessage`) cuando queden sin uso.

## Revisión manual adicional (sospechosos)

Antes de cerrar, abrir y validar estos 4. Si presentan el mismo patrón, corregir en el mismo lote:

- `src/features/tesoreria/routes/TesoreriaConciliacion.tsx`
- `src/features/admin/hooks/useAdminUsuariosController.ts:35`
- `src/features/facturacion/hooks/useFacturacionPageController.ts:74`
- `src/features/embarques/components/TabDemoras.tsx:67`

## Guardrail para prevenir regresiones

Añadir test de arquitectura en `src/__tests__/architecture/no-double-toast-on-mutate.test.ts`:

- Escanea `src/features/**/*.tsx` (excluye `__tests__/`).
- Para cada `.mutate(` o `.mutateAsync(` con un segundo argumento `{ ... }`, busca dentro de ese objeto las llaves `onSuccess`/`onError`/`onSettled` y prohibe que su cuerpo contenga `toast`, `notifySuccess`, `notifyError`, `notifyWarning` o `notifyInfo`.
- Una allowlist mínima por path para excepciones justificadas (vacía al inicio).
- Falla CI con file:line y un mensaje que cita la convención.

Esto convierte la convención en código y evita reaparecer el bug en cada feature nueva.

## Verificación

- `bunx vitest run src/features/admin src/features/cliente src/features/comisiones src/features/cxp src/features/tesoreria src/__tests__/architecture` → todo verde.
- `bun run audit:tests` sin violaciones.
- Smoke manual: eliminar un miembro, crear un usuario, revocar acceso de portal, configurar vendedora, generar/pagar liquidación, conciliar/ignorar/desconciliar movimiento, eliminar factura CxP → **un solo toast por acción**.

## Changelog y versión

- Bump `APP_VERSION` a `13.86.0` (cierra el bug clase a nivel app).
- Entrada en `CHANGELOG.md`:
  - `fix(toasts) eliminación masiva de doble-toast en 9 pantallas` con la lista de los 13 sitios.
  - `test(arch) guardrail anti doble-toast en mutaciones`.

## Fuera de alcance

- No tocar los hooks (ya notifican correctamente).
- No cambiar copies ni internacionalización de los toasts.
- No refactorizar los formularios ni la lógica de mutación.

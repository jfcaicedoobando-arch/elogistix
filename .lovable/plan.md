## Contexto

En `/proformas` el filtro por estado tiene tres opciones (**Todas · Pendientes · Facturadas**). Con el nuevo flujo "aceptada por cliente → factura", `estado_proforma = 'pendiente'` deja de tener un significado accionable — todas las no facturadas son "pendientes", así que la pestaña es ruido.

Además, hoy los botones **"Aceptar (manual)"** y **"Rechazar (manual)"** en el detalle de proforma están visibles para cualquiera que abra la proforma. Deben quedar restringidos a **admins y gerentes**.

## Cambios

### 1. Eliminar pestaña "Pendientes" del listado

- `src/features/facturacion/hooks/useTabProformasState.ts`
  - `FiltroEstadoProforma`: pasa de `"todas" | "pendiente" | "facturada"` a `"todas" | "facturada"`.
  - Quitar `counts.pendiente` (o dejarlo pero sin usarse — preferimos quitarlo).
  - El filtrado por `pendiente` desaparece; el resto se mantiene.
- `src/features/facturacion/components/TabProformas.tsx`
  - Quitar el `<ToggleGroupItem value="pendiente">Pendientes ({c.counts.pendiente})</ToggleGroupItem>`.
- Ajustar tests que referencian el filtro `pendiente` en el listado (si existen).

### 2. Restringir "Aceptar/Rechazar (manual)" a admins y gerentes

- `src/hooks/shared/usePermissions.ts`
  - Añadir nueva capability `canResponderProformaManual` con la lista:
    `super_admin`, `admin_org`, `admin`, `gerente_comercial`, `gerente_operaciones`.
  - Exportarla en el retorno del hook.
- `src/features/proformas/components/AccionesProforma.tsx`
  - Consumir `canResponderProformaManual` desde `usePermissions()`.
  - En `computarFlags`, `puedeResponder` sólo es `true` si además el rol tiene el permiso.
  - `mostrarHint` (texto explicativo "Requiere que el cliente acepte…") sigue mostrándose para todos, para no dejar a otros roles sin contexto de por qué no ven el botón "Convertir a factura".

### 3. Versionado y changelog

- Bump `APP_VERSION` a `13.145.8`.
- `CHANGELOG.md`: entrada `13.145.8` documentando ambos cambios.

## Detalles técnicos

- La columna `estado_proforma` conserva `pendiente | facturada` en BD — sólo se oculta como filtro en la UI. No hay migración.
- `puedeConvertir` sigue dependiendo de `estado_cliente = 'aceptada'` + `canEmitirFactura` (sin cambios).
- El diálogo `RespuestaClienteManualDialog` no cambia; el gate se hace en el punto de invocación (botones).
- Tests: agregar/ajustar unit test de `usePermissions` para la nueva capability; smoke test de `AccionesProforma` verificando que los botones manuales sólo se renderizan con el permiso.

## Fuera de alcance

- No se toca el flujo de portal público del cliente.
- No se cambia la lógica de aprobación interna (`estado_revision`), que ya quedó desacoplada del paso a factura.

## Objetivo

Resolver el caso del embarque cerrado sin proforma y prevenir que vuelva a pasar, sin meter un candado rígido que estorbe al usuario.

## Cambios

### 1. Reabrir embarque (solo Admin / Global Admin)

- **Backend**: nueva RPC `reabrir_embarque(p_embarque_id, p_request_id)`:
  - `SECURITY DEFINER`, valida org y exige rol `admin` / `global_admin` vía `has_role`.
  - Solo procede si `estado = 'Cerrado'`. Cambia estado a `'Entregado'`.
  - Inserta `notas_embarque` (`tipo='cambio_estado'`, contenido "Embarque reabierto desde Cerrado").
  - Inserta `eventos_embarque` (`tipo='Otro'`, descripción "Embarque reabierto por administrador").
  - Idempotencia con `idempotency_claim` / `idempotency_store`.
- **Frontend**:
  - `src/features/embarques/services/mutations.ts` → `reabrirEmbarqueRpc`.
  - `src/features/embarques/hooks/useEmbarqueEstadoActions.ts` → `handleReabrir` + mutación `useReabrirEmbarque` en `useEmbarques`.
  - `EmbarqueDetalleHeader.tsx`: botón secundario "Reabrir embarque" visible solo si `estado === 'Cerrado'` && rol Admin (usa `useUserRole` / `useAuth`). Con `AlertDialog` de confirmación.
  - Registra `registrarActividad` con acción `reabrir_embarque`.

### 2. Candado soft al cerrar sin proforma

- **Frontend** en `useEmbarqueEstadoActions.handleAvanzarEstado`:
  - Si `siguiente === 'Cerrado'`, contar conceptos de venta con `estado_facturacion !== 'en_proforma'`.
  - Si > 0 → abrir `AlertDialog`: "Este embarque tiene N conceptos sin proforma. ¿Cerrar de todas formas?" con `confirmar` / `cancelar`.
  - Solo prosigue con la RPC tras confirmación. No bloqueo de backend (queda como advertencia operativa).
- Refactor mínimo: el dialog se renderiza desde `EmbarqueDetalleHeader` controlado por estado local del controller `useEmbarqueDetalleActions`.

### 3. Permitir Cerrados en el selector de proforma

- `src/features/embarques/services/queries/expedientes.ts:18` → quitar `.neq("estado","Cerrado")`.
- En la UI del `ExpedientePicker` (donde se renderiza la lista), agregar `Badge variant="secondary"` con texto "Cerrado" cuando aplique para que el operador sepa que está facturando un embarque ya cerrado.
- No tocar la RPC de generación de proforma (no valida estado, ya funciona).

### 4. Arreglo puntual del embarque ya cerrado

Una vez aprobado el plan: el usuario podrá usar el nuevo botón "Reabrir embarque" para liberar el caso actual sin necesidad de migración manual.

### 5. Tests

- `mutations.test.ts` → cubrir `reabrirEmbarqueRpc` (éxito, no admin, embarque no cerrado).
- `useEmbarqueEstadoActions.test.tsx` (nuevo) → advertencia al cerrar con conceptos pendientes / sin pendientes.
- `expedientes.test` o equivalente → snapshot ya no excluye Cerrado.

### 6. Versionado y memoria

- `APP_VERSION` → bump menor (12.59.0).
- `CHANGELOG.md` (root) → entrada `## [12.59.0]` con los 3 cambios.
- Actualizar `mem://features/shipment-management`: documentar reapertura admin + advertencia soft + picker incluye Cerrados.

## Detalles técnicos

```text
RPC reabrir_embarque
  ├─ has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'global_admin')
  ├─ estado actual == 'Cerrado'           (sino RAISE EXCEPTION)
  ├─ UPDATE embarques SET estado='Entregado'
  ├─ INSERT notas_embarque   (cambio_estado)
  └─ INSERT eventos_embarque (Otro)
```

```text
handleAvanzarEstado(siguiente)
  └─ if siguiente == 'Cerrado'
       └─ contar conceptos venta sin proforma → si >0 → abrir AlertDialog
            ├─ Cancelar → no-op
            └─ Confirmar → avanzarEstado.mutateAsync(...)
```

## Fuera de alcance

- Bloqueo duro en backend al cerrar (descartado por preferencia soft).
- Reapertura por roles distintos a Admin (descartado).
- Página de bitácora dedicada para reaperturas (queda en bitácora general existente).

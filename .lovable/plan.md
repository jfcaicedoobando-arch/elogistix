
# Cierre de embarque: separar operativo de administrativo

Hoy el botón "Avanzar estado" del header permite a cualquier rol con permiso de avance brincar de EIR/Entregado a Cerrado sin pasar por el checklist financiero. Unificamos todo bajo `validar_cierre_embarque` y separamos roles.

## Reglas nuevas

### Roles
- **Operativos** (operador, coordinador_logistico, customer_service, viewer): su flujo termina en **EIR** (marítimo) o **Entregado** (resto). No cierran.
- **Administración/Finanzas** (admin, contador, tesorero, ejecutivo_cobranza, super_admin): son los únicos que pueden cerrar.

### Botón "Avanzar estado" en el header (`EmbarqueDetalleHeaderActions`)
- Cuando el siguiente estado calculado es **Cerrado**:
  - Si el rol NO es admin/finanzas → el botón desaparece (último estado visible para el operador es EIR/Entregado).
  - Si el rol SÍ es admin/finanzas → el botón aparece, pero **deshabilitado** mientras `validar_cierre_embarque.puede_cerrar === false`. Tooltip: "Hay pendientes administrativos. Ver Tab Cierre."
  - Cuando el checklist está OK, el botón funciona como atajo y dispara la misma RPC `cerrar_embarque` que usa el Tab Cierre (con su confirmación "CERRAR" inline, no diálogo).
- Quitamos `warnCierreOpen` (aviso "sin proforma") porque ya está cubierto por el check unificado.

### Tab Cierre (`TabCierre.tsx`)
- Visible para todos los roles (incluido operativo).
- El checklist sigue siendo de sólo lectura para quien no puede cerrar.
- El botón "Cerrar embarque" queda oculto para operativos (hoy ya está deshabilitado; lo escondemos para reducir ruido).
- Para admin/finanzas no cambia.

### RPC `cerrar_embarque` (backend)
- Ya valida `puede_cerrar` server-side, así que ningún rol puede saltarse el checklist aunque modifique el front. Confirmamos que sigue así (no cambia, solo verificamos).

## Archivos a tocar

- `src/features/embarques/hooks/useEmbarqueEstadoActions.ts` — gatear el avance a Cerrado por rol y por `puede_cerrar`. Quitar warnCierre.
- `src/features/embarques/components/EmbarqueDetalleHeader.tsx` y `EmbarqueDetalleHeaderActions.tsx` — calcular `puedeAvanzarACerrado` (rol financiero + validación), pasar tooltip explicativo.
- `src/features/embarques/components/EmbarqueHeaderDialogs.tsx` — eliminar el diálogo "cierre sin proforma".
- `src/features/embarques/components/TabCierre.tsx` — ocultar el botón Cerrar/Reabrir cuando el rol no aplique (hoy queda deshabilitado, ahora se oculta).
- `src/hooks/shared/usePermissions.ts` — verificar si existe `canCloseEmbarque`; si no, agregar helper que combine `isAdmin || canEditFinance`.
- Tests:
  - `TabCierre.rules.test` — caso operador no ve botón.
  - Test nuevo del header: operador no ve botón cuando siguiente=Cerrado; admin lo ve deshabilitado si validación falla.
- `APP_VERSION` → `13.89.1` y entrada en `CHANGELOG.md`.

## Lo que el usuario verá

- **Operador termina embarque marítimo:** llega a EIR, ve el badge `Admin pendiente · N`, ya no aparece "Avanzar estado". El Tab Cierre muestra el checklist en sólo lectura.
- **Administración entra al embarque:** ve el mismo badge; si todo está ✅ aparece el botón "Avanzar a Cerrado" en el header como atajo, o puede ir al Tab Cierre y usar el flujo completo con confirmación "CERRAR".
- **Si admin intenta cerrar con pendientes:** botón deshabilitado con tooltip que apunta al Tab Cierre.

Sin cambios de schema, sin migración.

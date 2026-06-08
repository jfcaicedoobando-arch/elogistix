# Bloqueo de eliminación de embarques con dependencias financieras

## Objetivo
Antes de eliminar un embarque desde `DialogEliminarEmbarque.tsx`, verificar si existen facturas (CxC/CxP), notas de crédito o pagos asociados. Si los hay, bloquear el borrado y mostrar al usuario qué documentos debe cancelar primero.

## Tablas involucradas (verificado en DB)
- `facturas` (CxC) — tiene `embarque_id`
- `proveedor_facturas` (CxP) — tiene `embarque_id`
- `factura_notas_credito` — ligada vía `factura_id` → `facturas`
- `proveedor_notas_credito` — ligada vía `factura_id` → `proveedor_facturas`
- `pagos_factura` — ligada vía `factura_id` → `facturas`
- `pagos_proveedor` — ligada vía `factura_id` → `proveedor_facturas`

## Cambios

### 1. Nuevo hook `useEmbarqueDependenciasFinancieras(embarqueId, enabled)`
`src/features/embarques/hooks/queries/useEmbarqueDependenciasFinancieras.ts`

- Ejecuta en paralelo (Promise.all) consultas con `head: true, count: 'exact'`:
  - `facturas` where `embarque_id = X` → devuelve `{ count, folios[] }` (select `folio, serie, estatus` limit 20)
  - `proveedor_facturas` where `embarque_id = X` → `{ count, folios[] }`
  - Para las facturas encontradas, contar `factura_notas_credito`, `proveedor_notas_credito`, `pagos_factura`, `pagos_proveedor` por `factura_id IN (...)`.
- Retorna estructura:
  ```ts
  {
    tieneDependencias: boolean,
    cxc: { count, folios: string[] },
    cxp: { count, folios: string[] },
    notasCredito: number,
    pagos: number,
  }
  ```
- Usa `useQuery` con `enabled` (solo dispara cuando se abre el diálogo).

### 2. Refactor `DialogEliminarEmbarque.tsx`
- Llamar al hook con `enabled = open`.
- **Estados del diálogo Paso 1:**
  - `isLoading`: mostrar "Verificando dependencias..." y deshabilitar el botón "Sí, eliminar".
  - `tieneDependencias === true`: reemplazar el contenido por una alerta informativa (icono ⛔) que liste folios de facturas CxC/CxP, conteo de NC y pagos, con texto: *"No es posible eliminar este embarque porque tiene documentos financieros asociados. Cancela primero las siguientes facturas:"*. Footer solo con botón "Entendido" (cierra el diálogo). No permitir avanzar a Paso 2.
  - `tieneDependencias === false`: flujo actual de doble confirmación.
- Mantener `handleEliminar` igual; el bloqueo es preventivo en UI.

### 3. Defensa extra (opcional, recomendado)
En `handleEliminar`, antes de `mutateAsync`, re-validar `tieneDependencias` por si el estado cambió entre carga y click. Si ahora existe, abortar con `notifyError`.

### 4. Changelog y versión
- `CHANGELOG.md`: nueva entrada `[12.61.13]` describiendo el bloqueo preventivo.
- `src/constants/appVersion.ts`: bump a `12.61.13`.

## Detalles técnicos
- Usar `supabase.from('facturas').select('folio, serie, estatus', { count: 'exact' }).eq('embarque_id', id).limit(20)` para obtener tanto conteo como folios en una sola query.
- Filtrar NC y pagos solo si hay facturas (evitar `.in('factura_id', [])` vacío).
- Respetar `power-of-10`: cleanup no aplica (es react-query), manejar `error` de cada query, sin `any`.
- Sin cambios en lógica de backend ni en el RPC `eliminarEmbarqueRpc`.

## Fuera de alcance
- Modificar el RPC de eliminación en Postgres (la guardia es en UI/UX; el RPC sigue siendo la última defensa vía FKs).
- Permitir "cancelar todo en cascada" desde el diálogo.

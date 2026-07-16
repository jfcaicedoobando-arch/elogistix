## Contexto

F975 tiene `sustituida_por = F988`, pero F988 fue **cancelada** en el SAT (`estado = 'Cancelada'`, `cancellation_status = 'accepted'`). Hoy la UI y el RPC bloquean cualquier acción sobre F975 porque asumen que un `sustituida_por` presente = sustitución vigente. Esto es incorrecto: si la sustituta fue cancelada, la original vuelve a estar "sola" y debe poder cancelarse (motivo 01 con otra sustituta, o motivo 02) o re-sustituirse.

Analogía: si emitiste un pasaporte duplicado pero luego lo invalidaron, el original vuelve a ser el único válido y la ventanilla debe atenderte otra vez.

## Cambios

### 1. Backend — RPC `duplicar_factura_para_sustitucion`
Migración nueva: cambiar la guarda `factura_ya_sustituida` para que sólo dispare si la sustituta existente **no** está en estado `Cancelada`/`Sustituida`. Si la sustituta anterior está cancelada, se permite crear una nueva y se sobrescribe `sustituida_por` con el nuevo borrador (además el nuevo borrador copia `sustituye_a` como hoy).

### 2. Frontend — Flags de UI
`src/features/facturacion/services/detail.ts`
- Agregar al SELECT una relación `sustituida_por_ref:facturas!facturas_sustituida_por_fkey(id, estado, numero)` para saber el estado de la sustituta.

`src/features/facturacion/domain/facturaFlags.ts`
- `FacturaFlagsInput` gana `sustituida_por_ref?: { estado } | null`.
- `puedeCambiarCfdi` deja de bloquear cuando la sustituta está `Cancelada` o `Sustituida`. Regla: bloquear sólo si existe una sustituta **viva** (estado distinto de esos dos).

### 3. UI — Banner informativo
En `FacturaDetalleActionsBar.tsx` (o el header ya existente), cuando `sustituida_por` está presente **pero** la sustituta fue cancelada, mostrar un aviso corto: "La sustituta F988 fue cancelada — esta factura vuelve a estar disponible para cancelación/sustitución." Con link a la sustituta cancelada.

### 4. Tests
- `facturaFlags.test.ts`: casos nuevos
  - `sustituida_por` presente + `sustituida_por_ref.estado = 'Cancelada'` → `puedeCancelarCfdi` y `puedeSustituirCfdi` en `true`.
  - `sustituida_por` presente + `sustituida_por_ref.estado = 'Emitida'` → siguen en `false` (regresión).

### 5. Housekeeping
- Bump `APP_VERSION` a `13.301.30`.
- Entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se modifica el flujo de emisión ni la lógica de `sustituye_a`/`related_documents` v2 de FacturAPI (ya corregido en 13.301.27).
- No se toca `DialogSustituirFactura` (ya redirige a la sustituta existente si el error `factura_ya_sustituida` sigue apareciendo por otras causas).

## Regla

Para avanzar un embarque de **En Tránsito → Arribo** se deben cumplir 2 condiciones:
1. Documentos requeridos completos (sin `documentos_embarque` con `estado='Pendiente'` y `deleted_at IS NULL`).
2. Registrar la fecha de llegada real (flujo actual).

Si el operador intenta "Marcar Llegada real" con documentos pendientes, se muestra un **toast de advertencia** ("Faltan N documentos por completar antes de marcar la llegada"), no se persiste nada, y no avanza a Arribo.

## Cambios

**`TrackingNuevoEventoForm.tsx`** (único archivo con lógica):
- Antes de invocar `actualizarFechaLlegada.mutateAsync` en el submit del modo `"llegada"`, consultar `documentos_embarque` del embarque:
  - `select("id", { count: "exact", head: true }).eq("embarque_id", embarqueId).eq("estado","Pendiente").is("deleted_at", null)`
  - Si `count > 0`: `notifyError(toast, { title: "Documentos incompletos", description: "Hay N documentos pendientes. Súbelos antes de marcar la llegada real." })` y `return` (no cerrar el modal para que reintente después).
- No se toca `MarcarLlegadaForm.tsx` ni la mutación; la validación vive en el submit handler.

**Versionado/bitácora**:
- `src/constants/appVersion.ts` → `13.214.5`.
- `CHANGELOG.md` → entrada `[13.214.5]` describiendo la nueva precondición.

## Fuera de alcance

- El botón sigue habilitado (mostrar toast al submit es lo pedido; no bloqueamos el botón).
- No se agrega trigger de BD (la regla es a nivel UI para dar mensaje amigable).
- Documentos "requeridos" = todos los que existen en `documentos_embarque` con estado `Pendiente` (no se cambia el catálogo).

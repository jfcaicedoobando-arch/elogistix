## Objetivo
Dejar de reservar folio (`expediente`, tipo `ELIMP00335`) cuando se crea un **borrador** de embarque desde una cotización. El folio se reserva únicamente cuando el borrador avanza a **Confirmado**. Así ya no se queman consecutivos en borradores que nunca se materializan.

## Cambios en base de datos

1. **`crear_embarque_borrador_core` (RPC)** — quitar la llamada a `public.generar_expediente(...)` y guardar `expediente = NULL` en el `INSERT` de `public.embarques`. Ajustar el mensaje de bitácora para decir `"Se generó un borrador de embarque desde la cotización <folio_cot>"` (sin expediente).

2. **`avanzar_estado_embarque` (RPC)** — cuando la transición sea `Borrador → Confirmado` y el embarque tenga `expediente IS NULL`, reservar el folio con `public.generar_expediente(tipo)` dentro de la misma transacción, actualizar `embarques.expediente` y registrarlo en la nota/evento. Idempotente vía el `p_request_id` existente.

3. **`embarques.expediente`** — permitir `NULL` (verificar la columna; si tiene `NOT NULL`, migrar a nullable). Mantener el `UNIQUE (organization_id, expediente)` — Postgres ya permite múltiples `NULL` en un índice único.

4. **`eliminar_embarque_completo`** — sin cambios estructurales; sigue funcionando con `expediente NULL`.

## Cambios en frontend

Los borradores tienen que ser identificables aunque no tengan folio. Se define un **label derivado**:

```text
expediente ?? `Borrador ${embarque.id.slice(0, 8)}`
```

Puntos a tocar (todos consumen el mismo helper nuevo `labelExpediente(embarque)` en `src/features/embarques/domain/labelExpediente.ts`):

- `src/features/embarques/services/columns.ts` — columna "Expediente" de la tabla.
- `src/features/embarques/hooks/useEditarEmbarqueWizard.ts` — toast `"<expediente> guardado correctamente"`.
- `src/features/embarques/hooks/useNuevoEmbarqueWizard.ts` y `useNuevoEmbarqueExpediente.ts` — encabezados/toasts.
- `src/features/embarques/services/bitacoraEmbarque.ts`, `dashboardOperador.ts`, `tracking/*`, `documentos.ts` — cualquier plantilla de texto que hoy asuma `expediente` no-nulo.
- Detalle de embarque (breadcrumb/título) — mostrar `"Borrador — sin folio"` cuando aplique, y un badge sutil `"Folio pendiente"`.
- Búsqueda global (`buscar_global` RPC) — ya filtra por `folio`/`expediente`; verificar que no se rompe con `NULL` (`ILIKE` sobre `NULL` da falso, es seguro).

## Tests

- **Unit / RPC:** nueva prueba en `supabase/tests` (o el equivalente de vitest sobre mocks) verificando:
  - `crear_embarque_borrador_core` produce `expediente = NULL`.
  - `avanzar_estado_embarque` con `estado_nuevo = 'Confirmado'` sobre un borrador sin folio asigna un `expediente` no nulo y consecutivo.
  - Segunda invocación con mismo `p_request_id` no reserva un segundo folio (idempotencia).
- **Regression E2E (Playwright):** `quote-to-shipment.spec.ts` — crear borrador → verificar UI muestra "Borrador — sin folio" → avanzar a Confirmado → verificar folio `ELIMP…` aparece.
- **Guardrail:** test que asegura que dos borradores creados en secuencia y luego confirmados en orden inverso reciben folios en el orden en que se confirman (no en el que se crearon).

## Bitácora y notas
- Al crear borrador: `"Borrador creado desde cotización COT-2026-XXXX"` (sin expediente).
- Al confirmar: `"Folio ELIMP00XXX asignado al confirmar el embarque"`.

## Migración de datos existentes
No se toca lo ya creado. Los borradores actuales conservan su `expediente` reservado. La nueva política solo aplica a borradores creados a partir del despliegue.

## Versionado
`APP_VERSION` → `13.303.42`. Entrada en `CHANGELOG.md` describiendo la nueva política de reserva de folio.

## Riesgos y notas
- **Búsqueda / links directos:** cualquier lugar que resuelva un embarque por `expediente` seguirá funcionando; solo hay que evitar que la UI intente copiar/compartir folio cuando aún no existe (se oculta el botón "Copiar folio" en borradores).
- **Reportes y exports:** columnas de expediente mostrarán `—` en borradores; ya se maneja en el helper `labelExpediente`.
- **No aplica al modo "crear embarque libre"** porque ya fue eliminado en v13.303.26 (tarifa-first).

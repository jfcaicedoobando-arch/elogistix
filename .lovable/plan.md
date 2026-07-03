## Objetivo
Mostrar las **notas** capturadas al crear la proforma dentro de la vista de detalle (`/proformas/:id`).

## Contexto
- La columna `proformas.notas` ya se guarda al crear la proforma (via RPC `crearProforma`) y se lee en `fetchProformaPorId` porque el `select` es `*`.
- La página `ProformaDetalle.tsx` no la renderiza en ningún lado, así que el usuario no puede ver el texto que escribió.

## Cambios
1. **`src/features/proformas/components/ProformaDetalleCards.tsx`**
   - Añadir un componente `NotasCard` que reciba `notas: string | null` y renderice una `Card` con título "Notas" y el texto en `whitespace-pre-line` (respeta saltos de línea). Si `notas` es vacío/`null`, la card no se renderiza (retorna `null`).
2. **`src/features/proformas/routes/ProformaDetalle.tsx`**
   - Importar `NotasCard` y colocarla debajo de `DatosGeneralesCard` (antes de la tabla de conceptos) pasando `proforma.notas`.

## Housekeeping
- Bump `APP_VERSION` (patch) en `src/constants/appVersion.ts`.
- Agregar entrada en `CHANGELOG.md` con la fecha de hoy describiendo "Mostrar notas de la proforma en la vista de detalle".

## Fuera de alcance
- No se modifica la creación/edición de proformas ni el PDF (las notas ya aparecen en el PDF).
- No se toca lógica de negocio ni servicios; sólo presentación.

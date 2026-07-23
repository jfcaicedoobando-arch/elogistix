## Problema

En el modal **Detalle de factura de proveedor**, el campo "Embarque" (sección Referencias fiscales) muestra los primeros 8 caracteres del UUID (ej. `a3f8c1b2…`) en vez del expediente legible (ej. `LC-2026-0281`).

Origen: `src/features/cxp/components/InfoFacturaSection.blocks.tsx:108` imprime `f.embarque_id.slice(0, 8)` porque el service `proveedorFacturas` sólo trae el `embarque_id` (FK) y no el `expediente` del embarque.

## Cambios

1. **Service** — `src/features/cxp/services/proveedorFacturas.helpers.ts`
   - Añadir `embarques(expediente)` al `PROVEEDOR_FACTURAS_SELECT`.
   - Extender el tipo `Joined` con `embarques: { expediente: string } | null`.

2. **Tipo `FacturaCxP`** — `src/features/cxp/services/proveedorFacturas.ts`
   - Agregar `embarque_expediente: string | null` junto al ya existente `embarque_id`.
   - Mapear el valor en el `map(f => ...)` del helper (`proveedorFacturas.helpers.ts` línea ~127).

3. **UI** — `src/features/cxp/components/InfoFacturaSection.blocks.tsx`
   - Renderizar `f.embarque_expediente` como link a `/embarques/{f.embarque_id}` (mismo patrón que ya se usa para IDs clicables en el detalle).
   - Fallback: si no hay expediente pero sí `embarque_id`, mostrar "Sin expediente" en muted (no exponer UUID).
   - Si no hay embarque vinculado: "—".

4. **Versionado**
   - `APP_VERSION` → `13.309.34`.
   - Entrada en `CHANGELOG.md`.

## Fuera de alcance

- Otros lugares donde ya se muestra expediente correctamente (`SugerirEmbarqueBlock`, `VincularListaConceptos`) no requieren cambios.
- No se toca lógica de negocio, RLS ni backend.

## Verificación

- Typecheck (`tsgo`).
- Abrir manualmente factura FP-000039 (o similar con embarque vinculado): debe mostrar el expediente y ser clicable.

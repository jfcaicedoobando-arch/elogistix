

## Link existing cotización when creating a new embarque

### Overview
Add an optional searchable combobox at the top of Step 1 (Datos Generales) that lets the user pick an accepted cotización. Selecting one pre-fills form fields and stores `cotizacion_id`. On save, the linked cotización's estado changes to `Embarcada`.

### Changes

**1. `src/hooks/useCotizaciones.ts` — new hook**
Add `useCotizacionesAceptadas()` that queries cotizaciones with `estado = 'Aceptada'`, selecting only fields needed for the combobox and pre-fill: `id, folio, cliente_id, cliente_nombre, modo, tipo, incoterm, descripcion_mercancia, tipo_carga, tipo_contenedor, peso_kg, volumen_m3, piezas, operador, origen, destino, notas`.

**2. `src/pages/NuevoEmbarque.tsx`**
- Add state: `cotizacionVinculada` (selected `CotizacionRow | null`).
- Pass `cotizacionVinculada`, `setCotizacionVinculada`, and the list of accepted cotizaciones as props to `StepDatosGenerales`.
- When a cotización is selected, call `methods.setValue(...)` for all mapped fields.
- When deselected (X button), reset those fields to defaults.
- In `handleFinish`: include `cotizacion_id` in the embarque payload. After successful create, if `cotizacion_id` exists, update cotización estado to `'Embarcada'` and invalidate cotizaciones queries.

**3. `src/components/embarque/StepDatosGenerales.tsx`**
- Add a new section at the very top of the card, before all existing fields.
- Render a Popover-based combobox using the existing `Command` components (cmdk) — same pattern as other searchable selects in the app.
- The combobox shows each cotización as: `{folio} — {cliente_nombre} ({origen} → {destino})`.
- Filters by folio or cliente_nombre as the user types.
- When selected, show a green badge: `✓ Vinculada a {folio} — {cliente}` with an X button to desvincular.
- New props: `cotizacionesAceptadas`, `cotizacionVinculada`, `onVincularCotizacion`, `onDesvincularCotizacion`.

**4. `src/hooks/useEmbarqueMutations.ts`**
- In `useCreateEmbarque`, add `cotizacion_id?: string` to the input type. The `cotizacion_id` is already part of the `embarques` table insert type, so it flows through naturally.
- Update `onSuccess` to also invalidate `queryKeys.cotizaciones.all`.

### Field mapping (cotización → form)
| Cotización field | Form field |
|---|---|
| cliente_id | clienteId |
| modo | modo |
| tipo | tipo |
| incoterm | incoterm |
| descripcion_mercancia | descripcionMercancia |
| tipo_carga | tipoCarga |
| tipo_contenedor | tipoContenedor |
| peso_kg | pesoKg (as string) |
| volumen_m3 | volumenM3 (as string) |
| piezas | piezas (as string) |
| operador | (not in form — skip) |
| origen | puertoOrigen |
| destino | puertoDestino |
| notas | (no field in embarque form — skip) |

### Flow
1. User opens "Nuevo Embarque"
2. Optionally searches and selects an accepted cotización
3. Fields auto-populate, green badge confirms link
4. User can clear the link with X (fields reset)
5. On save: embarque created with `cotizacion_id`, then cotización updated to `Embarcada`
6. If no cotización linked, embarque created normally (no change)


## Contexto

La capacidad de cargar varias tarifas a la vez (1 captura → N rutas) **ya está implementada** en la app tradicional, dentro del modal de "Nueva tarifa" (`TarifaForm`), exactamente igual que en el portal de agentes. Cuando no hay `tarifaId` (alta o duplicado), el componente entra en modo `multiple = true` y el selector de ruta se reemplaza por `MultiRutaSelect`, ejecutando la mutación `crearMultiples`.

El problema reportado es de **descubribilidad**: los usuarios no se dan cuenta de que pueden seleccionar varias rutas. Esta intervención es 100% UI/presentación — no toca lógica de mutaciones, RLS ni servicios.

## Cambios propuestos (sólo presentación)

### 1. `src/features/costeo/routes/CosteoTarifas.tsx`
- Cambiar el label del botón principal de **"Nueva tarifa"** a **"Nueva(s) tarifa(s)"**.
- Agregar un `title`/tooltip: "Puedes seleccionar varias rutas para crear varias tarifas con la misma captura."

### 2. `src/features/costeo/components/TarifaForm.tsx`
- Cuando `multiple === true`, pasar una `description` al `FormDialogShell` que diga:
  > "Captura la tarifa una sola vez y elige una o varias rutas para generarlas en lote."
- Mantener la descripción actual cuando es edición.

### 3. `src/features/costeo/components/TarifaFormFields.tsx` (`RutaTipoFields`)
- En modo `multiple`, debajo del `MultiRutaSelect` mostrar un texto ayuda muted:
  > "Tip: selecciona varias rutas para crear una tarifa en cada una con los mismos datos."
- Si `rutaIds.length > 1`, mostrar un `Badge` informativo: "Se crearán N tarifas" junto al label.

### 4. `src/features/costeo/components/MultiRutaSelect.tsx`
- Cambiar el placeholder del trigger cuando está vacío a "Selecciona una o varias rutas…" (hoy probablemente dice algo más genérico).

### 5. Versionado y changelog
- Bump `src/constants/appVersion.ts` → `13.135.47`.
- Entrada en `CHANGELOG.md`:
  > **UX:** El modal de Nueva tarifa en /costeo/tarifas ahora deja claro que admite carga multi-ruta (mismo flujo que ya usa el portal de agentes).

## Lo que NO se toca

- `useTarifaSubmit`, `useCosteoTarifaMutations`, servicios y RLS quedan iguales.
- El portal de agentes (`AgenteTarifaForm`) no se modifica.
- No se introduce importación CSV (sería otro alcance).

## Validación

- `bun run lint -- --max-warnings 0`
- `bun run build`
- Verificación visual rápida con Playwright en `/costeo/tarifas` abriendo el modal y confirmando el nuevo copy y badge cuando se seleccionan ≥2 rutas.

## Analogía

Hoy el modal es como un buffet con varios platillos abiertos, pero el letrero de la entrada sólo decía "comida"; vamos a cambiar el letrero a "buffet, puedes servirte varios" para que la gente sepa que la opción siempre estuvo ahí.

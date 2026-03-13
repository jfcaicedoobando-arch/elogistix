

# Cotización Wizard UI Polish — v5.19.0

## Changes

### 1. Wrap dimension tables in a styled Card (LCL + Aérea)

In `SeccionMercanciaMaritimeLCL.tsx` and `SeccionMercanciaAerea.tsx`, wrap the dimensions `<div>` (label + table + totals) inside a `<Card className="bg-muted/40">` with a `<CardHeader>` titled "Dimensiones LCL" / "Dimensiones Aéreas". This visually separates the dimension grid from the wrapper fields above.

### 2. Move optional fields into an Accordion (Step 1)

In `CotizacionWizardLayout.tsx`, replace the standalone "Notas Adicionales" Card and "Número de Embarques" Card with a single Shadcn `<Accordion type="multiple">` containing two `<AccordionItem>`s:
- **Número de Embarques** — the container count input
- **Notas Adicionales** — the textarea

This collapses them by default, reducing scroll length on Step 1.

Also move the "Descripción Adicional" textarea and "Seguro" (if present) from `SeccionMercanciaWrapper.tsx` into the same accordion pattern — but since `SeccionMercanciaWrapper` is shared, we'll move its "Descripción Adicional" textarea into an internal `<Accordion>` within the wrapper itself, keeping it collapsed by default.

### 3. Auto-focus first input per step

In `CotizacionWizardLayout.tsx`, add a `useEffect` keyed on `w.currentStep` that queries the scrollable content container for the first visible `input, select, textarea, [role="combobox"]` and calls `.focus()` on it. This handles all 4 steps generically without modifying individual section components.

## Files Modified

- `src/components/cotizacion/SeccionMercanciaMaritimeLCL.tsx` — wrap dimensions in Card
- `src/components/cotizacion/SeccionMercanciaAerea.tsx` — wrap dimensions in Card
- `src/components/cotizacion/SeccionMercanciaWrapper.tsx` — move "Descripción Adicional" into Accordion
- `src/components/cotizacion/CotizacionWizardLayout.tsx` — Accordion for optional fields + auto-focus useEffect


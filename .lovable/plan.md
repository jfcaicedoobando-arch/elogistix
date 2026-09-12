# COT-2026-0245: costos sin proveedor bloquean el embarque

## Qué está pasando

Los tres costos de la COT-2026-0245 (Flete Aéreo 3,588 USD, Cargos Origen 446.80 USD, Cargos Destino 174 USD) se guardaron **con el campo Proveedor vacío**. Están en la base, no se perdieron.

Al vincular la cotización al nuevo embarque, cada costo llega sin proveedor de catálogo y el paso de Costos y precios sólo cuenta como válido un renglón que tenga proveedor + concepto + monto. Con cero renglones válidos aparece el error "agrega al menos uno con proveedor, concepto y monto" y el wizard no deja avanzar, aunque los importes sí estén en pantalla.

La cotización nunca pide el proveedor (es un campo de texto libre y opcional), pero el embarque sí lo exige: ahí está la fricción. Hoy hay 96 renglones de costo de cotización sin proveedor en la organización, así que no es un caso aislado.

## Qué se va a hacer

1. **Desbloquear la creación del embarque**: un costo con concepto y monto válidos ya cuenta como válido aunque le falte el proveedor. El renglón se marca visualmente como "Falta proveedor" y se avisa una vez, con nombre del concepto, para que se asigne en el expediente. El nombre heredado de la cotización se sigue guardando cuando existe.
2. **Pedir el proveedor al cotizar**: el paso de costos internos de la cotización no deja guardar un renglón con importe si el campo Proveedor está vacío, con el mensaje señalando el concepto. Así deja de generarse el problema.
3. **Las cotizaciones ya guardadas sin proveedor siguen funcionando**: por el punto 1 pueden convertirse a embarque hoy mismo, sin tocar sus datos.

## Detalles técnicos

- `src/features/embarques/domain/embarqueWizardCostos.ts`: `validarConceptosCosto` deja de exigir `proveedorId` para contar renglones válidos; conserva la validación de `monto < 0` y el mínimo de un renglón con concepto.
- `src/lib/domain/errorCatalog.ts`: se ajusta el texto de `4.costos.minOne` (deja de mencionar proveedor como obligatorio).
- `src/features/embarques/components/conceptos/FilaCostoPrecio.tsx`: badge/hint "Falta proveedor" cuando `!proveedorId` y no hay nombre heredado; sin cambios de cálculo.
- `src/features/embarques/components/StepCostosPrecios.tsx`: `Alert` informativo cuando hay renglones sin proveedor, con la lista de conceptos.
- `src/features/cotizacion`: validación del paso 2 que exige `proveedor` no vacío en filas con `costo_unitario > 0` (junto a las validaciones actuales del paso), con mensaje por concepto.
- Sin cambios en base de datos, migraciones, RPCs, RLS, permisos, importes, IVA, tipos de cambio ni en `buildConceptosCostoPayload` (sigue enviando `proveedor_id: null` + nombre heredado).
- Pruebas: casos nuevos en las suites de `embarqueWizardCostos` (costo sin proveedor válido, monto negativo inválido) y en la validación del paso 2 de cotización (bloquea sin proveedor, pasa con proveedor).
- Validación local: typecheck, ESLint focalizado, pruebas focalizadas de embarques y cotización, `audit:manifest`, build. CI/RLS/E2E completos quedan para GitHub Actions.

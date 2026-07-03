## Objetivo

1. Eliminar la información duplicada detectada en `/proformas/:id`.
2. Alinear la vista con el design language del resto de la app (PageContainer, header suelto, `CardTitle text-lg`, card "Datos generales" unificada).
3. Arreglar las fallas de CI del run 28680304319:
   - **Power of 10 #4**: `ProformaDetalle.tsx` = 210 líneas (límite 200).
   - **SAFE-CAST**: `TimelineProforma.tsx:34` tiene `as unknown as` sin marcador.
   - **Lint complexity**: `ProformaDetalle` (24>16), `FacturaDatosFiscalesCard` (18>16), `FacturaDetalle` (17>16).
   - **Audit report**: 1 HIGH cast (la misma línea de TimelineProforma).
   - **Coverage bajo umbral**: functions 28.76<30, statements 37.73<38, branches 32.43<34.

## 1. Duplicaciones a eliminar

- **Fecha emisión** → sólo en la nueva card "Datos generales" (se quita del header). En Timeline el hito "Emitida" se conserva por ser marca de estado.
- **Vigencia** → sólo en "Datos generales" (se quita del header).
- **BL House / HAWB** → sólo en la card "Datos del embarque" (se quita del header).
- **BL Master / MAWB** y **Ejecutivo** → sólo en "Datos generales".

## 2. Alineación con el design language

- Cambiar el contenedor de la ruta de `<div className="max-w-6xl mx-auto">` por `<PageContainer>` (como Cotización/Factura).
- Header suelto (sin `Card` wrapper) siguiendo el patrón de `FacturaDetalleHeader`: `h1` folio + `EstadoBadges` + subtítulo `cliente • Exp: expediente` + `TotalDestacado`.
- Homologar `CardTitle` de todas las cards de proforma a `text-lg` (hoy están en `text-sm`).
- Etiquetas `<span className="text-muted-foreground">` sin uppercase; valores `font-medium`.

## 3. Card unificada "Datos generales"

Renombrar `TerminosPagoCard.tsx` → `ProformaDatosGeneralesCard.tsx`. Contenido en grid `grid-cols-2 md:grid-cols-4`:

- Fecha emisión
- Vigencia (emisión + 30 d)
- Ejecutivo
- BL Master / MAWB
- Días crédito
- Método de pago (Transferencia electrónica)
- Folio factura externa

## 4. Reducción de tamaño y complejidad de `ProformaDetalle.tsx`

Se saca todo lo no-orquestal del route para dejarlo ≤ 200 líneas y con complejidad ≤ 16:

- **`src/features/proformas/components/detalle/conceptoColumns.ts`** — definición pura de `conceptoColumns` (JSX de celdas incluido).
- **`src/features/proformas/components/detalle/ProformaDetalleHeader.tsx`** — header suelto (folio + badges + cliente/exp + total).
- **`src/features/proformas/domain/proformaClienteEstado.ts`** — helper puro `resolveEstadoCliente(raw)` que devuelve `"pendiente" | "aceptada" | "rechazada"` a partir de `raw.estado_cliente`, y `resolveAceptadaPor(raw)`. Mueve ahí la coerción con SAFE-CAST. Con esto la route deja de tener ternarios/branches redundantes.

El route resultante queda con: loading, error, deriva de flags, y llamados a los sub-componentes — bajo 200 líneas y con < 16 branches.

## 5. Marcador SAFE-CAST en `TimelineProforma.tsx`

Refactor: en vez de castear inline (`proforma as unknown as ExtraFields`), consumir los campos vía `resolveEstadoCliente`/`resolveTimelineFields` en el helper puro nuevo (mismo archivo del punto 4) que ya lleva el marcador `// SAFE-CAST:` en la línea del cast. El componente `TimelineProforma` recibe los campos ya normalizados por props → sin cast en el JSX.

## 6. Reducir complejidad de facturación (regresiones pre-existentes)

- **`FacturaDatosFiscalesCard.tsx`** (18 → ≤ 16): extraer los `<Select>` "Uso CFDI" / "Forma pago" / "Método pago" a un componente `FacturaDatosFiscalesSelectors.tsx`.
- **`FacturaDetalle.tsx`** (17 → ≤ 16): extraer la deriva de flags (`esBorrador`, `puedeEditar…`, `sinTimbrar`, `puedeEliminarBorrador`) a un helper puro `deriveFacturaFlags(factura, canEdit)` en `src/features/facturacion/domain/facturaFlags.ts`.

## 7. Coverage: cubrir el código nuevo

Nuevos tests (todos puros, ≤ 30 líneas cada uno):

- `src/features/proformas/domain/__tests__/proformaDetalleHelpers.test.ts` — `vigenciaPlus30` (formato + ISO inválido), `resumirContenedores` (0, 1-3, 4+ agrupado), `resolverUbicacion` (prioridad Port > Airport > City).
- `src/features/proformas/domain/__tests__/proformaClienteEstado.test.ts` — casos `pendiente` (default), `aceptada`, `rechazada`, valor inválido.
- `src/features/facturacion/domain/__tests__/facturaFlags.test.ts` — matriz `estado × facturapi_id × canEdit` para `deriveFacturaFlags`.

Con estas 3 archivos + splits, la parte productiva reduce líneas no cubiertas y sube functions/statements/branches por encima del umbral. Si tras el bump aún faltan décimas, agregar un smoke test render de `ProformaDatosGeneralesCard` que ejercita las 7 celdas.

## 8. Housekeeping

- Bump `APP_VERSION` a `13.164.1`.
- Entrada en `CHANGELOG.md`:
  ```
  ## [13.164.1] - 2026-07-04
  - fix(proformas): elimina duplicaciones (fecha emisión, vigencia, BL House) y unifica card "Datos generales".
  - refactor(proformas): route ≤200 líneas y complejidad ≤16 (split de conceptoColumns, header y helpers de estado).
  - refactor(proformas): elimina cast sin SAFE-CAST en TimelineProforma (normalización vía helper puro).
  - refactor(facturacion): reduce complejidad de FacturaDatosFiscalesCard (18→≤16) y FacturaDetalle (17→≤16).
  - test(proformas,facturacion): coverage para helpers puros nuevos.
  - style(proformas): PageContainer + header suelto + CardTitle text-lg (alineado con Cotización/Factura).
  ```

## Fuera de alcance

- No se cambia la query de proforma ni el PDF.
- No se tocan las notas legacy con BL embebido.
- No se ajustan los umbrales de coverage en `vitest.config.ts` (memory rule: escribir tests, no bajar umbral).

## Archivos afectados (resumen)

Nuevos:
- `src/features/proformas/components/detalle/ProformaDetalleHeader.tsx`
- `src/features/proformas/components/detalle/ProformaDatosGeneralesCard.tsx` (renombra `TerminosPagoCard.tsx`)
- `src/features/proformas/components/detalle/conceptoColumns.ts`
- `src/features/proformas/domain/proformaClienteEstado.ts`
- `src/features/facturacion/components/detalle/FacturaDatosFiscalesSelectors.tsx`
- `src/features/facturacion/domain/facturaFlags.ts`
- `src/features/proformas/domain/__tests__/proformaDetalleHelpers.test.ts`
- `src/features/proformas/domain/__tests__/proformaClienteEstado.test.ts`
- `src/features/facturacion/domain/__tests__/facturaFlags.test.ts`

Editados:
- `src/features/proformas/routes/ProformaDetalle.tsx`
- `src/features/proformas/components/detalle/ClienteBillToCard.tsx` (CardTitle text-lg)
- `src/features/proformas/components/detalle/EmbarqueDatosCard.tsx` (CardTitle text-lg)
- `src/features/proformas/components/detalle/TimelineProforma.tsx` (props normalizadas, sin cast)
- `src/features/proformas/components/ProformaDetalleCards.tsx` (CardTitle text-lg en TotalesCard, NotasCard, FacturaAsociadaCard)
- `src/features/facturacion/components/detalle/FacturaDatosFiscalesCard.tsx`
- `src/features/facturacion/routes/FacturaDetalle.tsx`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

Borrados: `TerminosPagoCard.tsx` (reemplazado).

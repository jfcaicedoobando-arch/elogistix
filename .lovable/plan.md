
# Alinear detalle de facturas emitidas y recibidas (estándar Odoo/QuickBooks)

Ambas pantallas ya comparten la base (`DetailHeader` + `DocumentoStatusStepper` + `DocumentoKpiStrip` + `DocumentoTabs` + riel de historial). Lo que falta es **paridad real**: hoy divergen en nombres de KPIs, nombres/orden de pestañas, subtítulo del encabezado y vocabulario de campos fiscales.

## 1. Vocabulario único de KPIs

Hoy: emitida muestra `Total · Cobrado · Saldo · Vencimiento`; recibida muestra `Total factura · Pagado · Saldo pendiente · Vencimiento`.

Se creará un constructor compartido en `src/lib/domain/documentoKpis.ts` con las etiquetas canónicas (estilo Odoo):

| Posición | Emitida | Recibida |
|---|---|---|
| 1 | Total | Total |
| 2 | Cobrado | Pagado |
| 3 | Importe pendiente | Importe pendiente |
| 4 | Vence el | Vence el |

Mismos tonos (verde liquidado, ámbar con saldo, rojo vencido) y mismo `hint` (`N días de crédito` / `N días vencida`). `facturaKpis.ts` y `facturaProveedorKpis.ts` pasan a ser adaptadores delgados sobre ese constructor.

## 2. Pestañas con nombres y orden espejo

Orden único en ambas: **Conceptos · Contraparte y fiscal · Cobros/Pagos · Notas de crédito · Documentos**.

- Emitida: "Cliente y fiscal" → "Cliente y datos fiscales"; "Cobros" conserva nombre pero gana contador.
- Recibida: "Proveedor y fiscal" → "Proveedor y datos fiscales"; "Pagos y anticipos" → "Pagos" (los anticipos siguen dentro, como bloque titulado "Anticipos aplicados").
- Contadores (`count`) en Conceptos, Cobros/Pagos y Notas de crédito en ambas.
- Nueva pestaña **Documentos** en las dos: en recibida agrupa los adjuntos existentes (`AdjuntoRow`, PDF/XML); en emitida agrupa PDF/XML del CFDI y el acuse de cancelación.

## 3. Encabezado espejo

Un subtítulo con el mismo patrón de "chips" de contexto en ambas: **Contraparte · Folio del documento · Fecha de emisión · Expediente · Proforma** (los que apliquen), con las mismas etiquetas (`Exp.:`, `Proforma:`, `Folio prov.:`) y el mismo separador. En el bloque `trailing`, ambas mostrarán **Total** y, cuando haya saldo, la línea **Pendiente** (hoy sólo la emitida la muestra).

## 4. Stepper con subestados

`documentoEstados.ts` gana un campo opcional `subEtiqueta` para reflejar en el paso actual "Parcialmente pagada" o "Vencida" (emitida) y "Parcialmente pagada" / "Vencida" (recibida), como hace Odoo con la barra de estado. Sin cambios de reglas de negocio: sólo lectura del estado ya calculado.

## 5. Nombres de campos fiscales

Unificar etiquetas en las tarjetas de ambas pantallas: `Folio fiscal (UUID)`, `Uso del CFDI`, `Forma de pago`, `Método de pago`, `Condiciones de pago`, `Moneda y tipo de cambio`, `RFC`. Se ajustan `FacturaTimbradoCard` / `FacturaResumenCard` (emitidas) e `InfoFacturaSection` (recibidas) para que digan lo mismo en el mismo orden.

## 6. Pruebas y cierre

- Tests unitarios del constructor compartido de KPIs y de `documentoEstados` (incluyendo subestados).
- Test de render que verifica que ambas pantallas exponen los mismos `id` de pestaña.
- Verificación visual en FullHD (1920×1080) con Playwright de las dos pantallas.
- `CHANGELOG.md` + bump de `APP_VERSION` a `13.350.0`.

## Detalles técnicos

- Archivos nuevos: `src/lib/domain/documentoKpis.ts`, pestaña de documentos por dominio, tests asociados.
- Archivos tocados: `documentoEstados.ts`, `DocumentoStatusStepper.tsx`, `facturaKpis.ts`, `facturaProveedorKpis.ts`, `FacturaDetalleBody.tsx`, `FacturaDetalleHeader.tsx`, `FacturaProveedorTabs.tsx`, `FacturaProveedorHeader.tsx`, tarjetas fiscales.
- Sin cambios de base de datos, RPCs ni reglas de negocio: es trabajo de presentación.
- Se respetan tokens semánticos, límite de 200 líneas por componente y el patrón `FormDialogShell` en los modales existentes (no se tocan).

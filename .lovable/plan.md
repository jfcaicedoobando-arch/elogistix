# Auditoría visual 1366×768 — Detalle de Factura emitida, Factura de proveedor y Proforma

Capturas tomadas con sesión real a 1366×768 en:
`/facturacion/:id` (F1009), `/compras/facturas/:id` (FP-000054) y `/proformas/:id` (PRO-2026-1002).

## Qué encontré

**1. Los tres detalles usan tres anatomías distintas**

```text
Factura emitida   [icono+folio][badges][acciones en fila]  [TOTAL arriba-derecha]
                  [stepper 3 renglones apilados]
                  [KPI strip 4]  [tabs 5]  [rail Historial fijo]

Factura proveedor [icono+folio+badges][stepper 1 renglón]  [barra acción derecha]
                  [KPI strip 4]  [tabs 5 -> se parten en 2 renglones]
                  [rail Historial colapsado y vacío]

Proforma          [icono+folio+badges]  [Total arriba-derecha][2 botones]
                  sin stepper, sin KPI strip, sin tabs
                  [2 columnas de tarjetas + Historial + Actividad]
```

**2. Problemas concretos a 1366×768**
- Factura emitida: la metadata del encabezado (cliente, fechas, expediente, proforma) queda en una columna angosta de ~170 px y se parte en 6 renglones; el stepper baja a 3 renglones. El encabezado ocupa casi media pantalla antes de ver un concepto.
- Factura de proveedor: las 5 pestañas no caben en la columna principal (el rail de 22 rem la deja en ~640 px) y "Documentos" salta a un segundo renglón.
- Factura de proveedor: el rail "Historial" está colapsado y deja ~300 px de blanco a la derecha; en la emitida el mismo rail está siempre abierto.
- Duplicación: el TOTAL y el pendiente aparecen en el encabezado y otra vez en el KPI strip.
- Proforma: no tiene KPI strip ni stepper; el estado se ve solo como badge y el timeline vive abajo a la derecha, fuera de vista.

**3. Inconsistencias de lenguaje visual**
- Títulos de sección: "Desglose de conceptos" (Title case, con icono) vs "CONCEPTOS DE LA FACTURA (4)" (mayúsculas) vs "Conceptos (1)".
- Tablas de conceptos: columnas, orden y formato distintos (IVA como chip vs texto; con/sin columna Embarque; numeración # solo en CxP).
- Totales: 3 tarjetas al pie en emitida, renglón "Totales" en CxP, bloque Subtotal/IVA/Total en proforma.
- Acciones: fila de 5 botones sueltos (emitida) vs barra de acción agrupada con estado (CxP) vs 2 botones (proforma).

## Qué propongo

### A. Un shell único de documento
Crear `DocumentoDetalleShell` en `src/components/shared/documento/` que componga siempre el mismo orden:
encabezado → stepper → KPI strip → tabs (izq) + rail (der). Los tres detalles pasan a usarlo.

### B. Encabezado homologado (`DetailHeader`)
- Fila 1: icono + folio + badges de estado + (derecha) barra de acción agrupada, con la acción primaria a la derecha en los tres (Registrar pago / Registrar pago / Descargar PDF) y el resto dentro de "Más acciones".
- Fila 2: metadata en línea separada por puntos (contraparte · folio/expediente · fecha), con `truncate`, en vez de la columna angosta actual.
- Quitar el bloque TOTAL/Pendiente del encabezado: esa información ya vive en el KPI strip.
- Stepper siempre en un solo renglón con scroll horizontal si no cabe.

### C. KPI strip en los tres
Proforma estrena strip con: Total · IVA · Vigencia · Estado de facturación, usando `buildKpisDocumento`.

### D. Tabs en los tres, con los mismos nombres
| Emitida | Proveedor | Proforma |
|---|---|---|
| Conceptos | Conceptos | Conceptos |
| Cliente y datos fiscales | Proveedor y datos fiscales | Cliente y datos generales |
| Cobros | Pagos | Facturación |
| Notas de crédito | Notas de crédito | — |
| Documentos | Documentos | Documentos |

Para que 5 pestañas quepan a 1366 px: el rail baja de `22rem` a `20rem`, y `DocumentoTabs` usa scroll horizontal en vez de wrap.

### E. Rail unificado
Rail siempre visible y siempre expandido, con el mismo título "Historial y actividad" y el mismo componente de timeline en los tres (hoy son tres componentes distintos: `FacturaBitacoraCard`, `Historial` colapsable de CxP, `TimelineProforma` + `Actividad`).

### F. Tabla de conceptos compartida
Una sola tabla (`ConceptosDocumentoTable`) con columnas: `# · Descripción · Embarque (opcional) · Cant. · P. unitario · IVA · Importe` y el mismo pie de totales (Subtotal / IVA / Total) en los tres módulos.

### G. Tipografía y microcopy
- Todos los títulos de sección con el mismo componente: Title case, tamaño y peso únicos, icono opcional, contador entre paréntesis.
- Mismo formato de moneda y de fecha (DD/MM/YYYY) y mismo texto de vencimiento ("Vence el … · N días de crédito").

## Detalles técnicos
- Archivos principales: `FacturaDetalleView/Header/Body.tsx`, `FacturaProveedorDetalle.tsx` + `FacturaProveedorHeader.tsx` + `FacturaProveedorTabs.tsx`, `ProformaDetalle*` en `src/features/proformas/components/detalle/`.
- Compartidos a tocar/crear: `DetailHeader.tsx`, `DocumentoLayout.tsx`, `DocumentoTabs.tsx`, `DocumentoKpiStrip.tsx`, nuevo `DocumentoDetalleShell.tsx` y `ConceptosDocumentoTable.tsx`.
- Solo capa de presentación: sin cambios de RPC, RLS ni de lógica de negocio.
- Respetar Power of 10 (componentes ≤200 líneas) y tokens semánticos (nada de `emerald-*`/`amber-*` sueltos).
- Verificación: nueva captura Playwright a 1366×768 de las tres rutas + `bunx vitest run` de las pruebas de arquitectura/DetailHeader.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION`.

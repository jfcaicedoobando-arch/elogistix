# Auditoría: Módulo de Compras

Alcance auditado: **Proveedores** (`/proveedores`), **Facturas de proveedor / CxP** (`/cxp`), **Por capturar** (`/cxp/por-capturar`).

---

## 1. Diagnóstico — ¿qué tan complicado/confuso está?

### Lo que SÍ está bien

- Captura de factura con CFDI XML auto-llenado (mejor que muchos ERPs SMB).
- Vínculo factura↔embarque desde el mismo diálogo.
- Bandeja "Por capturar" partiendo del presupuesto del embarque (flujo correcto).
- Separación limpia: rutas cortas (<200 líneas), hooks aislados, tests.
- KPIs y filtros ya existen en CxP.

### Fricciones / confusiones detectadas


| #   | Problema                                                                                                                                                 | Dónde se siente                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| F1  | **Tres rutas separadas sin "hub" de Compras.** El usuario no percibe que Proveedores + CxP + Por capturar son el mismo módulo.                           | Sidebar / navegación           |
| F2  | **No hay Orden de Compra (PO).** Se salta del presupuesto a la factura. Sin PO no hay aprobación previa ni *three-way match* (PO ↔ recepción ↔ factura). | Flujo completo                 |
| F3  | **No hay flujo de aprobación** de facturas (>X monto requiere visto bueno).                                                                              | `DialogNuevaFacturaProveedor`  |
| F4  | **Pagos = registro manual.** No hay propuesta de pago / lote de pagos / generación de layout bancario (SPEI BBVA, aunque ya existe `bbva_movimientos`).  | `DialogRegistrarPagoProveedor` |
| F5  | **Conciliación bancaria desconectada.** `bbva_movimientos` existe pero no se ata a `pagos_proveedor`.                                                    | Backend                        |
| F6  | **Notas de crédito de proveedor** existen en tabla (`proveedor_notas_credito`) pero no hay UI para aplicarlas contra factura.                            | UI                             |
| F7  | **Sin antigüedad de saldos (aging 0-30/31-60/61-90/90+).** Solo hay total pendiente.                                                                     | CxP                            |
| F8  | **Sin cierre/bloqueo por periodo.** Cualquiera puede editar facturas de meses cerrados.                                                                  | Backend                        |
| F9  | **Validación de duplicados débil.** No se bloquea capturar dos veces el mismo `folio + RFC + fecha`.                                                     | `useNuevaFacturaProveedorForm` |
| F10 | **Por capturar y CxP usan diseños distintos** (Table vanilla vs DataTable, headers distintos, KPIs distintos). Rompe consistencia.                       | UX                             |
| F11 | **Acciones en fila escondidas**: en CxP el botón "Capturar factura" está arriba; en Por capturar está por fila. Inconsistente.                           | UX                             |
| F12 | **Sin búsqueda global por RFC/folio** que cruce los 3 submódulos.                                                                                        | Navegación                     |
| F13 | **Catálogo de proveedores sin "salud del proveedor"**: días promedio de pago, % facturas con problemas, saldo vivo. Hoy solo es directorio.              | `/proveedores/:id`             |
| F14 | **Sin recordatorios de retenciones/DIOT** (México). El usuario captura IVA/ret pero no hay reporte DIOT ni complemento de pago tracking.                 | Reportes                       |
| F15 | **Complemento de Pago (CFDI 4.0)** — no se registra ni se solicita al proveedor. Es obligatorio en MX.                                                   | Backend + UI                   |


### Veredicto

No está "muy complicado": el problema es **incompleto, no enredado**. Está al nivel de **un buen QuickBooks/Contpaq básico**, pero le faltan piezas para estar al nivel de **SAP Business One / Odoo / NetSuite**: PO, aprobaciones, three-way match, propuesta de pago, conciliación bancaria, DIOT/complementos de pago.

---

## 2. Hoja de ruta priorizada (de mayor impacto a menor)

### Fase A — Coherencia (1-2 entregas, sin backend)

1. **Hub de Compras**: ruta `/compras` con tabs (Resumen · Proveedores · Por capturar · Facturas · Pagos). Mantener rutas actuales como deep-links.
2. **Unificar UI**: que `CxpPorCapturar` use `DataTable`, `PageHeader` y `KpiCards` igual que `Cxp.tsx`.
3. **Búsqueda global** (Ctrl+K) que indexe RFC, folio proveedor, nombre.
4. **Validar duplicados** en captura: `unique (organization_id, proveedor_id, folio_proveedor, fecha)`.

### Fase B — Operación (cambios backend + UI)

5. **Aging de CxP** (0-30/31-60/61-90/90+) en KPIs y reporte PDF.
6. **Aprobación de facturas**: campos `aprobada_por`, `aprobada_at`, umbral configurable; bloqueo de pago si no está aprobada.
7. **Notas de crédito**: UI para emitir/aplicar contra factura, afectando saldo.
8. **Salud del proveedor** en `/proveedores/:id`: DPO, saldo vivo, top conceptos, últimos pagos.

### Fase C — Diferenciadores ERP

9. **Órdenes de Compra (PO)**: nueva entidad `ordenes_compra` ligada a embarque/presupuesto → recepción → factura (three-way match).
10. **Propuesta de pago semanal**: selecciona facturas vencidas/por vencer, agrupa por proveedor, genera layout SPEI BBVA y registra pagos en lote.
11. **Conciliación bancaria**: matching automático `bbva_movimientos` ↔ `pagos_proveedor` por monto/referencia/fecha.
12. **Cierre de periodo**: tabla `periodos_contables` + RLS que bloquea edición de facturas con fecha en periodo cerrado.

### Fase D — Cumplimiento México

13. **Complemento de Pago CFDI 4.0**: solicitud, recepción XML, validación contra pago.
14. **Reporte DIOT** mensual (proveedores, retenciones, tipo de operación).
15. **Validación de RFC en lista 69/69-B SAT** (EFOS) al alta de proveedor.

---

## 3. Quick wins (1-2 horas cada uno) si quieres empezar ya

- Unificar header/KPIs/tabla de **Por capturar** con el patrón de `Cxp.tsx` (`PageHeader`, `CxpKpiCards`, `DataTable`).
- Agregar columna **antigüedad** y badge "Vencida X días" en `cxpColumns.tsx`.
- Validar `folio_proveedor + proveedor + fecha` duplicado antes de insertar.
- Reporte PDF con **aging buckets** en `ReporteCarteraDocument`.
- Botón "Ver factura" en cada fila de **Por capturar** cuando ya tiene factura capturada (hoy solo muestra contador).

---

## 4. ¿Qué te recomiendo hacer primero?

Sugerencia: arrancar con **Fase A (coherencia) + 3 quick wins**. Eso da sensación de "módulo completo" sin tocar backend pesado. Luego decides si vamos a Órdenes de Compra (es el salto grande hacia ERP real).

¿Quieres que prepare el plan de implementación de la Fase A, o prefieres atacar primero alguna fase/punto específico (ej. Órdenes de Compra, o el reporte DIOT)?

NO VAMOS A IMPLEMENTAR ORDENES DE COMPRA POR AHORA.
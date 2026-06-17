# Auditoría — Módulo Pre-Facturación

## Workflow actual

```text
Embarque cerrado
   │
   ▼
[1] Por aprobar  → proformas auto-generadas, agrupadas por expediente/contenedor
   │              · Consolidar y aprobar  ó  Aprobar individual
   ▼
[2] Proformas    → histórico (pendientes + facturadas), sin acciones masivas
   │
   ▼
[3] Facturas emitidas → tabla + export CSV + layout contable
   │
   ▼
[4] Cobranza     → KPIs (saldo MXN/USD, vencido, por vencer 7d), pagos, NC, PDF cartera
   │
   ▼
[5] Pagos a proveedores → CxP: lista plana de gastos pendientes, "marcar pagado"
```

Filtro global de fechas (`DateRangeFilter`) aplica a tabs 1-3 y 5; **no aplica** a Cobranza (vive con sus propios filtros). Alerta del "Hueco de Facturación" (ETD +5 días sin factura) existe como componente (`HuecoFacturacionCard`) pero **no está montada en la página** — sólo se menciona en la guía.

## Hallazgos

### Funcionales
1. **Hueco de Facturación huérfano**: el `HuecoFacturacionCard` + `HuecoFacturacionDetalleDialog` están construidos y testeados pero `Facturacion.tsx` no los renderiza. El usuario lee sobre el "hueco" en la guía y no lo encuentra.
2. **Tab 2 (Proformas) duplica Tab 1**: muestra el mismo dataset sin acciones nuevas. Hoy obliga a saltar de tab para ver "qué pasó con la proforma que aprobé".
3. **Sin acciones masivas en Facturas emitidas**: no se puede marcar varias como enviadas al cliente, descargar PDFs en lote, ni reenviar por correo.
4. **Cobranza desconectada del filtro de fechas**: el `DateRangeFilter` del header no afecta KPIs ni tabla. Inconsistente para quien filtra "junio 2026" y ve cartera total.
5. **Pagos a proveedores (Tab 5) es sólo "marcar pagado"**: no hay agrupación por proveedor, total adeudado, próximo vencimiento, ni link a la factura del proveedor. Es CxP sin ser CxP.
6. **Sin vista de "Listo para facturar" formal**: el flujo asume que aprobar = facturar, pero no hay paso intermedio para asignar serie/folio, validar RFC/CSF del cliente, ni revisar uso CFDI antes de timbrar.
7. **Pago parcial en USD/MXN sin conciliación de tipo de cambio visible**: `DialogRegistrarPago` permite pago, pero la cobranza no muestra el TC histórico usado vs. TC del día (riesgo de diferencias cambiarias no detectadas).
8. **Sin recordatorios de cobranza desde la UI**: ya existe `cxc-recordatorios` (edge function), pero no hay botón "enviar recordatorio" por fila ni vista de "últimos recordatorios enviados".
9. **Notas de crédito**: dialog existe pero no hay tab/vista consolidada de NCs emitidas + saldo afectado.
10. **Proformas pendientes sin filtro por cliente/operador/antigüedad**: sólo búsqueda libre; con volumen alto se vuelve difícil priorizar.

### UX / consistencia
11. **Badges en tabs**: sólo tab 1 muestra count. Tabs 3, 4, 5 también podrían (facturas vencidas, gastos vencidos, etc.).
12. **El filtro de fechas se monta dentro de cada tab** (`{dateBar}` repetido 4 veces) en lugar de vivir arriba de los tabs — costoso visualmente y se re-renderea.
13. **`TabProformas` y `TabProformasPendientes` viven en paralelo** pero comparten 80% lógica; oportunidad de consolidar en una vista con switch "Pendientes / Todas".
14. **Tab "5. Pagos a proveedores" mezcla conceptos**: el módulo se llama "Pre-Facturación" pero incluye CxP. Debería extraerse a `/cxp` o renombrarse el módulo a "Facturación y pagos".

### Técnicas
15. `useFacturacionPageController` mezcla estado de facturas + gastos + proformas pendientes; tira de las 3 queries aunque sólo se vea un tab. Lazy fetching por tab activo ahorraría.
16. `fetchClienteFinancials` (no en este módulo pero usado en otros) trae **todas** las filas de `profit_por_cliente` para filtrar 1 cliente en cliente; no escalable — patrón a evitar también aquí.
17. **`HuecoFacturacionCard` y `TabProyeccion` parecen no estar en routing** (`TabProyeccion.tsx` existe pero no se importa en `Facturacion.tsx`). Trabajo construido y no expuesto.

## Mejoras propuestas (priorizadas)

### Quick wins (1-2 días)
- **A. Montar `HuecoFacturacionCard` arriba de los tabs** (colapsable, sólo si hay filas). Cierra el gap entre guía y UI.
- **B. Mover `DateRangeFilter` arriba de `<Tabs>`** una sola vez; aplicarlo también a Cobranza.
- **C. Badges en tabs**: facturas vencidas en "Cobranza", gastos vencidos en "Pagos prov.", facturas del rango en "Facturas".
- **D. Filtros por cliente y antigüedad en Tab 1** (Por aprobar): select cliente + chips ">7 días", ">15 días".
- **E. Exponer `TabProyeccion`** como tab opcional o card colapsable ("Cierre proyectado del mes").

### Medianas (3-5 días)
- **F. Acciones masivas en Facturas emitidas**: descargar PDFs ZIP, enviar por email, marcar como "enviada al cliente".
- **G. Vista "Notas de crédito"** dentro de Cobranza: histórico + filtro por cliente, totales por moneda.
- **H. Recordatorios de cobranza desde UI**: botón "Enviar recordatorio" por fila + columna "Último recordatorio" en tabla de cobranza.
- **I. Conciliación de TC en pagos**: mostrar TC factura vs TC pago y diferencia cambiaria en `DialogRegistrarPago` y en detalle.
- **J. Lazy queries por tab activo** en `useFacturacionPageController` (usar `enabled: activeTab === 'x'`).

### Estructurales (1-2 semanas)
- **K. Paso "Listo para facturar"**: entre "Aprobada" y "Emitida" — valida RFC/CSF, uso CFDI, serie/folio, método de pago; permite editar antes de timbrar.
- **L. Consolidar Tab 1 + Tab 2** en una sola vista con toggle "Pendientes | Aprobadas | Todas" + columna estado, eliminando duplicación.
- **M. Renombrar "Pagos a proveedores" → mover a módulo CxP** con su propio dashboard (agrupado por proveedor, vencimientos, conciliación bancaria BBVA ya existe en tablas).
- **N. Dashboard ejecutivo del módulo**: card superior con "Facturado mes / Por facturar / Cobrado / Por cobrar / Vencido" y mini-gráfica de tendencia.

## Notas técnicas
- Componentes existentes pero no renderizados: `HuecoFacturacionCard`, `HuecoFacturacionDetalleDialog`, `TabProyeccion`, `CierreCard`. Revisar `knip` para confirmar si son dead code o pending wiring antes de borrar.
- `useFacturacionPageController` ya está cerca del límite Power-of-10; si se agrega lazy fetching por tab conviene extraer `useFacturasTabController` y `useCxPTabController`.
- `TabCobranza` (152 LOC) cabe aún; agregar columna de recordatorios + TC obligaría a sub-extraer `cobranzaFilters`.

## ¿Qué construimos primero?

Sugiero arrancar con el bloque **Quick wins A-E** (un solo cambio coherente: el filtro de fechas global, Hueco visible, badges, filtros del Tab 1, proyección expuesta). Luego decidimos entre el bloque mediano (F-J) o ir directo al estructural K (Listo para facturar) si la prioridad es timbrado real.

Dime qué bloque te interesa y armo el plan de implementación detallado.

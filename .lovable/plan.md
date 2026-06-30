
# Plan: Soporte para Embarques Marítimos CIF

## Contexto

Hoy el wizard de cotización trata FOB y CIF igual: pide tarifa marítima, auto-carga el flete como costo, y los conceptos de venta se capturan manualmente. En CIF, el proveedor en origen ya incluye flete + seguro hasta puerto destino, por lo que Libre Carga **sólo** cotiza gastos locales en destino. Necesitamos que el wizard, el detalle del embarque y la facturación/P&L reflejen esto sin romper el flujo FOB existente.

## Reglas de negocio (acordadas)

1. CIF marítimo: el flete internacional y el seguro **no** se cotizan al cliente; ya vienen incluidos por el proveedor origen.
2. Libre Carga **sí** cotiza: THC destino, despacho aduanal, maniobras destino, flete terrestre destino, almacenaje, demoras destino, honorarios, etc.
3. La responsabilidad/riesgo termina en puerto destino — afecta lo que se ve en seguros y timeline.
4. El cambio aplica a Wizard de cotización + detalle de embarque + P&L/Facturación.

## Cambios por capa

### A. Wizard de cotización (Paso 1 — Datos Generales)

- `SeccionDatosGeneralesCotizacion.tsx`: cuando `modo === "maritimo"` y `incoterm === "CIF"`, mostrar un banner informativo: *"Embarque CIF: el flete y seguro internacional los provee el shipper en origen. Sólo se cotizarán gastos locales destino."*
- `PasoDatosGenerales.tsx`:
  - Ocultar `TarifaVinculadaPanel` y `SeccionCondicionesComerciales` cuando es CIF marítimo (no aplica vincular tarifa marítima ni capturar seguro Libre Carga).
  - Reemplazar por un bloque ligero `SeccionInformacionShipperCIF` que capture: nombre del shipper/exportador, naviera (informativo), Master BL si lo tienen, valor de la mercancía declarada y póliza de seguro origen (texto libre).
- `usePaso1SectionStatus.ts`: ajustar la sección "tarifa" para que en CIF no sea requerida; en su lugar requerir el bloque shipper.

### B. Paso 2 — Costos internos / P&L

- `buildCostosDesdeTarifa.ts`: si CIF, no auto-cargar flete ni recargos marítimos (no hay tarifa vinculada).
- `CONCEPTOS_COSTO_USD`: filtrar para CIF y ocultar `"Flete Marítimo"` y `"Seguro"` del catálogo seleccionable (siguen existiendo para FOB).
- Mostrar al inicio del paso un *checklist sugerido* de conceptos típicos CIF destino (THC, despacho, maniobras, flete terrestre, almacenaje, honorarios) que el usuario puede agregar con un clic.

### C. Paso 3 — Conceptos de venta

- Mismo catálogo sugerido CIF destino para conceptos de venta.
- Validación suave: si CIF y aparece un concepto cuyo nombre contiene "flete marítimo" o "seguro internacional", mostrar warning (no bloqueante) por si fue un error.

### D. Detalle del embarque

- `EmbarqueDetalleTabs.tsx` / `ResumenCards.tsx`: badge visible "CIF — Flete pagado en origen" junto al campo Incoterm.
- `TabCostos`: separador visual con leyenda *"Sólo gastos locales destino"* cuando es CIF, y ocultar columna/sección de "Flete marítimo" si está vacía.
- `TabSeguros`: cuando es CIF, mostrar aviso *"Seguro contratado por shipper origen"* y permitir registrar póliza informativa (no obligatoria, no entra al P&L de Libre Carga).
- Validador de cierre (`validar_cierre_embarque`): en CIF no exigir documento de seguro ni costo de flete marítimo.

### E. Facturación y P&L

- `TabPnl` / `TabPnlContenedor`: el P&L se calcula igual (ingresos − costos), pero al ser CIF el flete no aparece en ninguno de los dos lados, por lo que el margen refleja sólo gastos destino. Agregar tooltip *"P&L CIF: excluye flete y seguro internacional"*.
- Facturación: sin cambios estructurales (los conceptos de venta capturados son los que se facturan). Sólo se valida que el PDF de la factura/proforma muestre el incoterm CIF en el bloque de condiciones.

### F. PDF de cotización

- `cotizacionSections.tsx`: en CIF, ocultar la línea "Flete marítimo incluido" y agregar nota legal: *"Términos CIF (Incoterms® 2020): el vendedor en origen cubre flete y seguro hasta puerto destino. Los conceptos cotizados corresponden únicamente a servicios locales en destino."*

### G. Base de datos

- Sin nuevas tablas. Sólo:
  - Migración para flexibilizar `validar_cierre_embarque` (no exigir flete marítimo cuando `incoterm = 'CIF'`).
  - Trigger informativo: si insertan un `conceptos_costo` con concepto "Flete Marítimo" en embarque CIF, agregar `nota` automática (no bloquea).

## Detalles técnicos

- Crear helper `esIncotermSinFleteVenta(incoterm, modo)` en `src/features/cotizacion/utils/incotermRules.ts` que devuelva `true` para CIF/CFR/CIP/CPT/DAP/DDP marítimo. Esto permite extender después a otros incoterms "C/D" sin tocar componentes.
- Mantener tipos: `Incoterm` ya existe en el enum de Supabase; no cambia.
- Tests:
  - Unit: `incotermRules.test.ts` (matriz por incoterm).
  - Unit: `buildCostosDesdeTarifa.test.ts` debe retornar `[]` en CIF.
  - RTL: paso 1 en CIF oculta tarifa y muestra bloque shipper.
  - Migración: prueba RPC `validar_cierre_embarque` con embarque CIF sin flete pasa.

## Fuera de alcance

- Otros incoterms "C/D" (CFR, CIP, DAP, DDP) — el helper los contempla pero el rollout visual/UX sólo se valida con CIF en esta entrega.
- Importación masiva o migración de cotizaciones FOB históricas a CIF.
- Cambios en el portal de clientes (lo verá igual, sólo con menos conceptos).

## Versionado

Bump menor (`13.142.0`) por feature visible al usuario. Entrada en `CHANGELOG.md` describiendo el flujo CIF.

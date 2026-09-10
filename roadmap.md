# Roadmap

## Pulido visual de Tarifas marítimas 13.823.268
- [x] Compactar encabezado e indicadores para mostrar más filas en 1280×720
- [x] Unificar filtros, contador y selector de vista en una sola franja
- [x] Priorizar Ruta, Total USD, Vigencia, Estado y Acciones sin superposición
- [x] Pulir densidad y jerarquía de la vista agrupada
- [ ] Validación focalizada, visual, versión, changelog y manifiesto

## Remate tarifas marítimas 13.823.266
- [x] MR-UI-02 P2 — Fondos opacos en celdas sticky Ruta/Acciones para filas pares, hover y selección
- [x] Regresión mínima y validación visual 1280×720 con fila par/impar y sidebar expandido/colapsado
- [x] Cierre: versión patch, changelog y manifiesto; sin publicar ni suites globales

## Bloque toasts (aprobado)
- [ ] Pulir sonner.tsx: X centrada verticalmente, quitar hueco ícono-texto, X con área de toque cómoda

## Bloque auditoría Cotizaciones/Embarques/Sidebar (13.823.251)
- [ ] VIS-CE-251-07 P1 — Cantidad decimal 1.5→15 en ConceptoRowMXN/ConceptoRowUSD
- [ ] VIS-CE-251-01 P2 — Alineación/importes recortados: StepCostosPrecios + ConceptoRowMXN
- [ ] VIS-CE-251-08 P2 — Unidad E48 invisible al editar (UnidadMedidaSelect)
- [ ] VIS-NAV-251-01 P2 — Scrollbar recorta iconos sidebar colapsado
- [ ] VIS-CE-251-02 P2 — Advertencia casi invisible en oscuro (ProductoServicioSelect)
- [ ] VIS-CE-251-03 P2 — Menú progreso esconde Cierre (Paso1ProgressSidebar)
- [ ] VIS-CE-251-05 P2 — UUID tipo contenedor en Demoras/Garantías
- [ ] VIS-CE-251-06 P2 — Cotización USD no explica IVA (CotizacionDetalleContenido)
- [ ] VIS-CE-251-04 P3 — Copy contradictorio proveedor en Subir factura
- [ ] VIS-CE-251-09 P3 — Conciliación muestra "dentro_rango"
- [ ] VIS-CE-251-10 P3 — EIR copy incorrecto en TabCierre
- [ ] MEJ-CE-251-01 P2 — Distribución listado embarques
- [ ] Observaciones: título navegador editor embarque; isDirty al avanzar a Paso3
- [ ] Cierre: versión/changelog/manifest consolidado, typecheck/lint/build focalizados

## Remate 13.823.259
- [x] Extraer medición/navegación de Paso1ProgressSidebar sin exceder 200 líneas
- [x] Dar una segunda fila legible a Subtotal, IVA y Total MXN
- [x] Cierre: patch, changelog y manifiesto; validación completa sólo en GitHub Actions

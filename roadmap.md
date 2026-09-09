# Roadmap

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
- [ ] Cierre: patch, changelog y manifiesto; validación completa sólo en GitHub Actions

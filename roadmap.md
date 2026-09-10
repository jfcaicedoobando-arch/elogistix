# Roadmap

## Integridad proformas 13.823.276
- [x] Restringir overrides de IVA a p_concepto_ids y rechazar ajenos (LC_OVERRIDE_FUERA_DE_SELECCION)
- [x] Prueba SQL de regresión (override ajeno rechazado, válido aplicado, atómico)
- [x] Cierre: versión, changelog y manifiesto; sin publicar ni suites globales


## Remate Cotizaciones 13.823.273
- [x] Pluralizar vigencia y demás contadores visibles de días
- [x] Omitir monedas sin conceptos en la barra de totales, sin alterar cálculos
- [x] Cierre: regresiones focalizadas, versión, changelog y manifiesto; sin publicar

## Remate Embarques/Proformas 13.823.272
- [x] Renumerar consecutivamente las fases visibles del checklist de cierre
- [x] Apilar el historial de proforma debajo en HD para no recortar importes
- [x] Cierre: regresiones focalizadas, versión, changelog y manifiesto; sin publicar

## Pulido visual de Tarifas marítimas 13.823.268
- [x] Compactar encabezado e indicadores para mostrar más filas en 1280×720
- [x] Unificar filtros, contador y selector de vista en una sola franja
- [x] Priorizar Ruta, Total USD, Vigencia, Estado y Acciones sin superposición
- [x] Pulir densidad y jerarquía de la vista agrupada
- [x] Validación focalizada, visual, versión, changelog y manifiesto

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

## 13.823.274 — P&L presupuesto con T/C congelado
- [x] `pnl_financiero_embarque`: presupuesto (venta/costo/seguro) usa `embarques.tipo_cambio_usd/eur`
- [x] Facturas reales conservan T/C documental con fallback del embarque
- [x] Prueba SQL `pnl_presupuesto_tc_congelado.sql` (mover ETA no cambia presupuesto)
- [x] Cierre: versión, changelog y manifiesto; suites completas sólo en GitHub Actions

## 13.823.277 — Permisos Cotizaciones → Embarques alineados con las RPC
- [x] `ACEPTAR_COTIZACION` y `CREAR_EMBARQUE_BORRADOR` en la matriz de permisos (espejo de las RPC)
- [x] `accionesCotizacionPermitidas`: aceptar/rechazar/enviar según la regla real; nuevo `crearEmbarque`
- [x] `visibilidadAcciones`: oculta Crear embarque y el aviso de venta faltante sin permiso
- [x] Pruebas por rol (contador, gerente_comercial, vendedor, ejecutivo_pricing, coordinador_logistico, gerente_operaciones)
- [x] Cierre: versión, changelog y manifiesto; suites completas sólo en GitHub Actions

## 13.823.278 — Permisos de proformas en embarque y listado
- [x] Pestaña Facturación del embarque usa el permiso específico de proformas (no el genérico)
- [x] Aviso de borrador inconsistente sólo con permiso de escritura
- [x] /proformas oculta casilla de selección y acción de fusionar sin permiso de emisión
- [x] Pruebas UI: sin permiso (vendedor/gerente comercial) vs con permiso (contador/operador)
- [x] Cierre: versión, changelog, manifiesto; suites completas en GitHub Actions

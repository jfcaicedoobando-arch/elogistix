# Roadmap

## En curso — lote 10 hallazgos (HEAD 05bea0cf)
- [ ] P1-1 Conciliación: vínculos sin TC = "Pendiente de tipo de cambio"
- [ ] P1-2 Actividades móvil: acciones con permisos
- [ ] P1-3 / P3-10 Leads móvil: selección en lote + aria-label
- [ ] P2-4 Listas CRM: sin filas obsoletas al filtrar
- [ ] P2-5 CxP: diálogo eliminar sigue abierto si falla
- [ ] P2-6 CxP: Programado 7d incluye EUR
- [ ] P2-7 TabCostos: etiquetas presupuestadas
- [ ] P2-8 Embarques: error de alertas no es cero
- [ ] P3-9 Embarques vacío: copy desde cotización

## Cerrado — P1 selección efectiva en compras
- [x] Limpiar selección y diálogo al cambiar la búsqueda.
- [x] Unificar filas efectivas visibles, pendientes y sin bloqueo SoD para toda acción en lote.
- [x] Impedir apertura, validación o aprobación de lotes vacíos.
- [x] Cubrir búsqueda y cambio de elegibilidad/SoD con pruebas focales.
- [x] Ejecutar test, typecheck y lint focal sin CI/RLS completos.

## En curso — pulido responsive/UI 691×763
- [x] 1. Compras por aprobar: selección individual accesible en tarjeta móvil con SoD.
- [x] 2–3. Costos de embarque: cotizado/facturado/ajuste y contenedor en móvil.
- [x] 4. Costeo agentes: restaurar clic de fila en escritorio sin romper menú móvil.
- [x] 5. Cotizaciones: menú móvil de Duplicar/Eliminar con permisos.
- [x] 6–9. CxP: ocultar columnas en móvil y apilar acciones del encabezado.
- [x] 10. Buzón de costos: ayuda neutra inicial y error sólo tras interacción.
- [x] Validaciones focales, typecheck/lint focal y vista 691×763/1280×720 (contenido poblado no reproducible: la vista quedó en carga).

## Cerrado — CI #4293
- [x] Extraer bloques cohesivos y dejar tablas de rutas/costos en ≤200 líneas.
- [x] Ajustar pruebas para las variantes móvil y escritorio renderizadas simultáneamente.
- [x] Actualizar contratos de overflow y fondos sticky sin restaurar clases obsoletas.
- [x] Validar pruebas focales, tipos, lint y sanity visual de Costeo.

## En curso — pulido responsive 691×763 (38 hallazgos)
- [x] QA focal: agentes sin botones anidados y con paridad de acciones móvil/escritorio.
- [x] Auditar cada hallazgo contra el código actual y conservar lo ya resuelto.
- [x] Corregir datos y acciones fuera de vista (1–12).
- [x] Corregir claridad, densidad y navegación (13–34).
- [x] Corregir patrones transversales pendientes (35–38).
- [x] Ejecutar pruebas focales, typecheck/lint focal y QA visual claro/oscuro a 691×763.
- [x] Ejecutar sanity visual a 1280×720 sin publicar ni cambiar versión.

## Cerrado — primera ronda visual (exactamente 10 mejoras)
- [x] 1. CRM Actividades: columnas críticas visibles y tipos humanizados.
- [x] 2. Facturación: navegación secundaria estable por grupos.
- [x] 3. KPIs: etiquetas y cifras principales legibles a 1280 px.
- [x] 4. Operaciones: cinco KPIs en composición equilibrada.
- [x] 5. KPIs: cero alertas/rechazos con tono neutro.
- [x] 6. Tablas: celdas sticky integradas con fondo de fila.
- [x] 7. Compras/Tesorería: filtros más densos y sin huecos.
- [x] 8. Rentabilidad: gráfica Top adaptable al número de filas.
- [x] 9. Costeo: aviso horizontal sólo con overflow real.
- [x] 10. CRM: etiquetas humanas y badges coherentes.
- [x] Validación focal: pruebas, tipos/reglas y smoke visual claro/oscuro a 1280×720.

## Cerrado — lote financiero D1–D6 (v13.823.382)
- [x] D1 — P&L: convertir notas de crédito a moneda de la factura antes de restar (cliente y proveedor) en `pnl_financiero_embarque`.
- [x] D2 — CxC: RPC atómica e idempotente para cobro individual (pago + movimiento espejo).
- [x] D3 — Traspasos: rechazar fecha nula o futura (fecha de negocio America/Mexico_City) en `registrar_traspaso_bancario`.
- [x] D4 — CxP pago individual: validar fecha (requerida, no futura, no anterior a emisión) en RPC y guard.
- [x] D5 — CxP edición: RPC transaccional de actualización de pago + reemplazo del movimiento sistema.
- [x] D6 — Proformas: hidratar facturas vinculadas (FK inversa + factura_id + secundaria) en detalle e historial.

## Pendiente
- [ ] P2 visual: tratamiento fiscal por renglón en detalle de cotización.
- [ ] P2 visual: Origen/Destino hasta dos líneas con tooltip.
- [ ] P2 visual: resumen de conceptos sin confundir conceptos con documentos.
- [ ] P2 visual: nombre de prospecto hasta dos líneas sin desplazar badge/acciones.
- [ ] P2 visual: contraste del selector fiscal en claro/oscuro y opción 8% deshabilitada.
- [ ] P2 visual: costos compactos debajo de 2xl, alineados a 1280/1440.
- [ ] Validación dirigida: pruebas focales, typecheck/lint y Playwright 1280/1440.

- [ ] UI/UX del modal "Traspaso entre cuentas propias": layout estable, tipo de cambio con 4 decimales, resumen legible del monto recibido.
- [x] Cotización: mostrar SAT 01 y Exento como tratamientos fiscales no editables en filas MXN/USD, con pruebas focalizadas.
- [x] Lote P1 de IVA: coherencia única `tipo_iva`/tasa en cotización, proforma→factura y emisión; bloqueo accionable en casos ambiguos; diagnóstico agregado de sólo lectura.
- [x] Lote P2 de IVA: etiqueta "Tasa 0%" separada de Exento, ayuda por tratamiento en el catálogo, 8% de frontera bajo configuración explícita, aviso "Tratamiento fiscal por definir", rechazo de tasas negativas y desglose fiscal por línea del CFDI de proveedor (sólo lectura).
- [x] Lote P1 de auditoría IVA: notas de crédito conservan tratamiento y tasa por renglón (16/8/0/exento/no objeto), reversan retenciones ISR/IVA, el atajo de saldo completo prorratea tratamientos mixtos y bloquea los indeterminados; el REP rechaza cualquier mezcla de tratamientos.

- [x] Auditoría IVA (P1 4 puntos + P2 4 puntos): NC con reglas de coherencia unificadas frontend/servidor (tasas canónicas, tipo ausente o tasa contradictoria bloquean), renglón manual de NC nace sin tratamiento y se elige explícitamente, REP sin inferencias (falla cerrado y sólo acepta respaldo de encabezado con tasa exacta), guard de IVA de CxP considera el IEPS en la base gravable, "IVA total" en factura manual, columna IVA de proformas con tratamiento real o "Por confirmar", detalle de factura lee la tasa exacta del snapshot ignorando retenciones y 8% de frontera oculto sin habilitación.
- [x] Auditoría IVA P1 (3 hallazgos, commit 6ce07be): "No objeto" (SAT 01) sin retenciones en UI, factura y NC (payload con `taxes` vacío); REP prorratea un grupo de impuestos por tratamiento en `related_documents[].taxes` (una PPD 16% + 0%/Exento/8% ya se cobra, sin tasas promedio) y bloquea sólo cuando faltan importes o el tratamiento es indeterminado; PPD + "No objeto" se impide antes de timbrar (no hay ruta soportada para `ObjetoImpDR = 01`, documentado en `docs/facturapi-go-live.md`).
- [x] Auditoría IVA P1 (3 hallazgos, commit 8d2644b): REP declara cada retención (ISR/IVA, varias tasas) con la base de sus propios renglones y la prorratea por pago, bloqueando sólo si falta el importe del renglón; `resolverTasaConcepto` y `consolidar_proformas` usan una sola tasa canónica por `tipo_iva` (8% y 0% ya no caen a la tasa general cuando falta la tasa numérica); los renglones legacy sin tratamiento quedan en "Por confirmar" y exigen elección explícita antes de guardar (nunca se supone 16%).


- [x] P2 IVA: seis ajustes de claridad por renglón; migración pendiente; pruebas y limitaciones reportadas.

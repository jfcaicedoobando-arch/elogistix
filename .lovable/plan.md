# Pendientes Pre-Facturación

## Ya implementado ✅
- **Quick wins A-E** (v13.48.0): Hueco visible, DateRange global, badges en tabs, filtros cliente/antigüedad en "Por aprobar", Tab Proyección expuesto.
- **G + I + J** (v13.49.0): Notas de crédito en Cobranza, conciliación TC en pagos, lazy fetching por tab activo.

## Pendientes

### Medianas
- **F. Acciones masivas en Facturas emitidas** — descargar PDFs en ZIP, enviar por email en lote, marcar "enviada al cliente". Bloqueado: requiere row selection en `DataTable`.
- **H. Recordatorios de cobranza desde UI** — botón "Enviar recordatorio" por fila + columna "Último recordatorio". La edge function `cxc-recordatorios` ya existe.

### Estructurales
- **K. Paso "Listo para facturar"** — estado intermedio entre Aprobada y Emitida: validar RFC/CSF, uso CFDI, serie/folio, método de pago, permitir editar antes de timbrar.
- **L. Consolidar Tab 1 + Tab 2** — una sola vista con toggle "Pendientes | Aprobadas | Todas" + columna estado (hoy duplican 80% lógica).
- **M. Extraer "Pagos a proveedores" a módulo CxP propio** — dashboard agrupado por proveedor, vencimientos, conciliación bancaria BBVA.
- **N. Dashboard ejecutivo del módulo** — card superior con "Facturado mes / Por facturar / Cobrado / Por cobrar / Vencido" + mini-tendencia.

## Sugerencia

**H** es el siguiente quick win de mayor impacto (cobranza activa, edge function ya existe — sólo UI). Después **N** (dashboard ejecutivo, alto valor visible) y luego abordar **K** que es el más estructural.

**F** queda bloqueado hasta habilitar selección de filas en `DataTable` — ¿lo abordamos primero como tarea técnica habilitadora?

¿Qué bloque construimos? Opciones:
1. **H** sólo (rápido, 1 día)
2. **H + N** (cobranza activa + visibilidad ejecutiva)
3. **K** (estructural, timbrado real)
4. **DataTable row selection + F** (desbloquear acciones masivas)

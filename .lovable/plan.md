## Contexto

El rediseño de `DialogDetallePagosProveedor` estableció un lenguaje visual con 5 piezas reutilizables:

1. **Header con chip-folio inline** (título + chip mono separado + meta muted en 2ª línea).
2. **StatusActionBar** contextual (`bg-accent/5`) con dot de estado + acción primaria contextual a la derecha + overflow `⋯` para secundarias.
3. **KPI grid** con énfasis `ring-2 ring-accent/30` en la métrica dominante según contexto.
4. **Info agrupada** en 2 columnas (adjuntos + programación) con tarjetas clickables completas y badge de tipo (XML/PDF).
5. **Historial collapsible** dentro del flujo.

Además ya tenemos primitivos reutilizables listos: `EstadoAprobacionDot`, `Kpi` (con `emphasis`), `HeaderWithTooltip` y `StatusActionBar`.

Este plan **no toca lógica** — es sólo UI/UX. Cambios acotados a `.tsx` de presentación.

## Modales candidatos (priorizados)

Barrí el árbol de `src/features/**/components/**/*Dialog*.tsx` y clasifiqué por tipo. Los **formularios/wizards** ya siguen `FormDialogShell` (regla activa en memoria) y quedan fuera de scope. Los **modales de detalle/inspección** son los que sí se benefician:

### Alta prioridad — mismo patrón "detalle con estado + KPIs + acciones"

**A. `DialogRegistrarPagoProveedor` (CxP)** · alto valor
Es el gemelo funcional del detalle. Hoy es un form plano.
- Header: chip inline con folio interno de la factura destino + meta (proveedor · saldo).
- StatusActionBar mini: dot "Aprobada · lista para pagar" + `Registrar pago` como primary submit.
- KPI grid superior con: Total, Pagado, **Saldo (énfasis)**, Días vencido.
- Reutiliza `EstadoAprobacionDot`, `Kpi`, `StatusActionBar` (variant read-only).

**B. `AgingDrillDownDialog` (CxP)** · alto valor
Drill-down de aging por proveedor. Hoy título simple + tabla.
- Header: nombre del proveedor + chip mono con RFC + meta con "N facturas · X cubetas".
- KPI grid: Total abierto, Vencido, Por vencer, **Cubeta 90+ (énfasis si >0)**.
- Filtros de cubeta como chips en la StatusActionBar en lugar del select actual.
- Botón "Exportar CSV" queda en overflow `⋯`.

**C. `EmbarquesEstadoDialog` (Operaciones)** · valor medio
Lista de embarques por operador/estado. Ya usa `FormDialogShell` pero se puede armonizar.
- Header ya tiene el ícono de estado + operador + estado + badge de total → migrar a chip-folio pattern + meta muted.
- Añadir KPI mini: Total, Filtrado (por búsqueda), **Truncado (énfasis si >0)**.
- `Search` queda en la actionbar (bg-accent/5) en lugar de flotar.

**D. `DialogConsultarFacturapi` (Facturación)** · valor medio
Diagnóstico lado-a-lado FacturApi vs Libre Carga.
- Header con chip inline con `numero` (folio de factura).
- StatusActionBar: dot con estado inferido del diagnóstico ("Sincronizado" / "Discrepancia" / "Error") + primary `Reintentar consulta`.
- Los 2 paneles de comparación agrupan como KPI-cards, dominante = el que difiere.

### Media prioridad — armonización de headers y actions

**E. `FacturaDetalleView` (ruta, no modal)**
Aunque es una ruta, ya usa `DetalleActionBar`. Podemos alinear:
- Migrar `FacturaDetalleHeader` a chip-folio pattern (folio como chip mono en vez de `text-2xl font-mono`).
- Añadir el `EstadoAprobacionDot`-equivalente para timbrar/cancelar (usando `deriveFacturaBadgeEstado` que ya existe).
- Actualmente el badge de estado ya está bien; el cambio sería sólo la línea muted secundaria y consolidar KPI de Total en un mini card.
- **Nota:** el usuario preguntó "modales", así que este es opcional — pedir confirmación.

**F. `EmbarqueDetalleHeader` (ruta, no modal)**
Igual que E: alinear el status chip + folio-chip.

### Baja prioridad / fuera de scope

- `DialogNuevaFacturaProveedor`, `DialogEditarFacturaProveedor`, `DialogSustituirFactura`, `DialogTimbrarFactura`, `DialogCrearNotaCredito` → **formularios/wizards**, ya usan `FormDialogShell`. No aplica.
- `DialogRegistrarPago`, `DialogEnviarCfdi`, `DialogPreviewCfdiPdf`, `DialogCancelarFactura`, `CerrarFacturaSinPagoDialog`, `CancelarFacturaProveedorDialog` → **confirmaciones/acciones puntuales**, usan `ConfirmActionDialog`/`FormDialogShell`. No aplica.
- `DemoAccessDialog`, `RoleChangeAlertDialog`, `ForgotPasswordDialog` → **flows de auth/marketing**, otro contexto visual.

## Recomendación

Ejecutar en el siguiente orden y bump de version por lote (2 archivos por lote para mantener PRs auditables):

- **Lote 1** — A (`DialogRegistrarPagoProveedor`) + B (`AgingDrillDownDialog`) → mismo módulo CxP, mismo mental model.
- **Lote 2** — C (`EmbarquesEstadoDialog`) + D (`DialogConsultarFacturapi`).
- **Lote 3 (opcional)** — E + F: armonización de headers de rutas (requiere confirmación del usuario).

Cada lote respeta:
- Reutilizar `EstadoAprobacionDot`, `Kpi`, `StatusActionBar`, `HeaderWithTooltip`, `dialogTokens`.
- Archivos ≤ 200 líneas (Power of 10).
- Sin cambios de lógica ni de datos.
- Actualizar `CHANGELOG.md` y bump `APP_VERSION` por lote.

## Pregunta antes de empezar

¿Con qué lote arrancamos? Si dices "Lote 1" empiezo con A+B en el siguiente turno.

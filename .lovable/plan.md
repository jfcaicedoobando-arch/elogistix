
## Respuesta corta

**Sí, en muchos lugares.** La app tiene **79 archivos** que usan `DialogContent + DialogHeader`. De esos, ~30-40 son **modales de formulario** que son candidatos directos al `FormDialogShell`. Los ~40 restantes son alerts/confirmaciones/popovers que **no deben** migrar (alteraría su intención: avisos cortos, no formularios).

## Candidatos clasificados

### Tier 1 — Pareja directa de los 3 ya migrados (impacto alto, riesgo bajo)

Son los "editar" equivalentes de lo que ya rehicimos. Mismo controller/datos, sólo cambia el modo. Ideal para mantener consistencia visual entre "Nuevo X" y "Editar X".

- `DialogEditarCliente` → icon `UserCog`
- `EditarProveedorDialog` → icon `Building2`
- `DialogEditarFacturaProveedor` → icon `FileSpreadsheet`

### Tier 2 — Formularios de entidades (impacto alto)

Modales tipo "crear/editar entidad" con varios campos. Ganarían mucho con el icon-tile + footer sticky.

- **CRM / Comercial**: `ConvertirLeadDialog`, `DialogConvertirProspecto`, `NuevaActividadDialog`, `EnviarCotizacionDialog`, `RecotizarModal`, `RevalidarTarifaModal`, `BuscarTarifaDialog`
- **Admin / Org**: `NuevaOrganizacionDialog`, `AgregarMiembroOrgDialog`, `NuevoUsuarioDialog` (ya tiene icon-tile a mano — migrar al shell elimina duplicación)
- **Clientes / Contactos**: `DialogContacto`, `EditarContactoDialog`, `PortalInviteDialog`
- **CXP / Facturación**: `DialogRegistrarPago`, `DialogRegistrarPagoProveedor`, `DialogNotaCreditoProveedor`, `DialogNuevaFacturaManual`, `DialogTimbrarFactura`, `DialogTimbrarRep`, `CrearProveedorDesdeCfdiDialog`
- **Embarques**: `DialogDuplicarEmbarque`, `DialogSeguroForm`, `DialogGenerarProforma`, `AgregarDocumentoDialog`
- **Costeo**: `RutaFormDialog`, `TarifaForm`, `CosteoAgenteFormDialog`
- **Presupuesto / Importadores**: `DialogCategoria`, `BulkImportDialog`, `ImportarLeadsCsvDialog`
- **Auth / Perfil**: `ForgotPasswordDialog`, `CambiarPasswordDialog`
- **Operaciones**: `DialogGenerarLiquidacion`

### Tier 3 — Wizards de varios pasos (mejor con `stepper`)

Donde el `FormDialogStepper` brilla más:

- `BulkImportDialog` (validar → mapear → confirmar)
- `ImportarLeadsCsvDialog`
- `DialogGenerarLiquidacion`
- `ConvertirLeadDialog`

### NO migrar (queda como está)

Son alerts/confirmaciones cortas, no formularios. Forzar el shell los volvería pesados:

- `DoubleConfirmDeleteDialog`, `ConfirmDeleteAlert`, `RoleChangeAlertDialog`, `TrackingConfirmFechaLlegadaDialog`, `DialogEliminarEmbarque`, `DialogMarcarFacturada`, `ErrorDetailsDialog`, `ReabrirEmbarqueButton` (confirm), `AvanzarEstadoButton` (confirm), `PortalCotizacionConfirmDialog`, `MarcarRevisadoDialog`, todo lo que use `alert-dialog`.

## Beneficios concretos de migrar

1. **Consistencia visual** — un mismo "lenguaje" para todo el back-office (header con icono semántico, footer sticky, stepper).
2. **Borrado neto de código** — cada migración quita ~15-30 líneas de boilerplate (`DialogContent` + `DialogHeader` + footer manual + clases de tamaño).
3. **Ayuda con Power-of-10** — varios de estos archivos están cerca del límite de 200 líneas; el shell les quita 20-40.
4. **Accesibilidad** — el shell garantiza `DialogTitle` y `DialogDescription` correctos.
5. **Refactors futuros más baratos** — cambiar un detalle visual (e.g. color del icon-tile, animación) se hace en un solo archivo.

## Recomendación

Migrar **por olas**, no todo de golpe:

- **Ola 1 (siguiente PR, ~1 hora)**: Tier 1 — los 3 "Editar" hermanos de los ya hechos. Garantiza paridad visual entre Nuevo/Editar.
- **Ola 2**: Tier 2 dividido en sub-grupos por dominio (1 PR por dominio: CRM, Admin, Clientes, CXP, Embarques, Costeo). Cada sub-grupo ~30-45 min.
- **Ola 3**: Tier 3 stepper-driven (los wizards de import/liquidación).

Además: agregar a `mem://` una regla "use `FormDialogShell` para modales tipo formulario" para que futuras pantallas no se construyan a mano.

## Pregunta antes de implementar

Necesito que me digas el alcance:

1. **Sólo la Ola 1** (los 3 modales "Editar" — paridad inmediata con lo recién hecho).
2. **Ola 1 + Ola 2 completa** (los ~25 formularios). Cambio grande pero acotado a presentación.
3. **Sólo dejar la guía + memoria** y que cada modal migre cuando lo toquemos por otra razón (adopción orgánica, riesgo cero).
4. **Sub-grupo específico** que tú elijas (e.g. "sólo los de CXP" o "sólo los de Admin").

No realizaré cambios hasta confirmar opción.

## Estado actual

**Ola 1: COMPLETA.** Migrados al `FormDialogShell` los 6 modales hermanos (Nuevo + Editar) de Cliente, Proveedor y Factura de proveedor.

```
src/components/shared/FormDialogShell.tsx
src/components/shared/FormDialogSection.tsx
src/components/shared/FormDialogStepper.tsx
src/features/cliente/components/NuevoClienteDialog.tsx
src/features/cliente/components/DialogEditarCliente.tsx
src/features/proveedor/components/NuevoProveedorDialog.tsx
src/features/proveedor/components/EditarProveedorDialog.tsx
src/features/cxp/components/DialogNuevaFacturaProveedor.tsx
src/features/cxp/components/DialogEditarFacturaProveedor.tsx
```

## Lo que quedó pendiente

### Ola 2 — Formularios de entidades (≈25 modales, agrupados por dominio)

Un sub-PR por dominio para que cada cambio sea revisable de forma aislada.

- **CRM / Comercial**: `ConvertirLeadDialog`, `DialogConvertirProspecto`, `NuevaActividadDialog`, `EnviarCotizacionDialog`, `RecotizarModal`, `RevalidarTarifaModal`, `BuscarTarifaDialog`.
- **Admin / Org**: `NuevaOrganizacionDialog`, `AgregarMiembroOrgDialog`, `NuevoUsuarioDialog` (ya tiene icon-tile hecho a mano — quitar duplicación).
- **Clientes / Contactos**: `DialogContacto`, `EditarContactoDialog`, `PortalInviteDialog`.
- **CXP / Facturación**: `DialogRegistrarPago`, `DialogRegistrarPagoProveedor`, `DialogNotaCreditoProveedor`, `DialogNuevaFacturaManual`, `DialogTimbrarFactura`, `DialogTimbrarRep`, `CrearProveedorDesdeCfdiDialog`.
- **Embarques**: `DialogDuplicarEmbarque`, `DialogSeguroForm`, `DialogGenerarProforma`, `AgregarDocumentoDialog`.
- **Costeo**: `RutaFormDialog`, `TarifaForm`, `CosteoAgenteFormDialog`.
- **Presupuesto**: `DialogCategoria`.
- **Auth / Perfil**: `ForgotPasswordDialog`, `CambiarPasswordDialog`.
- **Operaciones**: `DialogGenerarLiquidacion`.

### Ola 3 — Wizards multi-paso (con `FormDialogStepper`)

Donde el stepper aporta valor real:

- `BulkImportDialog` (validar → mapear → confirmar).
- `ImportarLeadsCsvDialog`.
- `DialogGenerarLiquidacion`.
- `ConvertirLeadDialog` (también aparece en Ola 2; va aquí si se trata como wizard).

### Memoria / convención (pendiente)

- Guardar regla en `mem://` que obligue a usar `FormDialogShell` para modales tipo formulario nuevos. Aún no se creó la memoria.

### NO migrar (recordatorio)

Alerts y confirmaciones cortas: `DoubleConfirmDeleteDialog`, `ConfirmDeleteAlert`, `RoleChangeAlertDialog`, `TrackingConfirmFechaLlegadaDialog`, `DialogEliminarEmbarque`, `DialogMarcarFacturada`, `ErrorDetailsDialog`, `PortalCotizacionConfirmDialog`, `MarcarRevisadoDialog` y todo lo basado en `alert-dialog`.

## Sugerencia de próximo paso

Pelar **Ola 2 por dominio** en este orden (de mayor a menor uso diario):

1. CXP (7 modales) — el dominio más tocado.
2. CRM (7).
3. Embarques (4).
4. Admin (3) + Clientes/Contactos (3).
5. Costeo (3) + Presupuesto/Auth/Operaciones (3).

Después Ola 3 (wizards) y por último guardar la memoria de convención.

## Pregunta

¿Por dónde arrancamos: **CXP primero**, **CRM primero**, **todo Ola 2 de corrido**, o **sólo guardar la memoria** y migrar orgánicamente?

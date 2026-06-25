## Auditoría: `<Input type="date">` nativo en la app

Hice un barrido completo. Encontré **30 ocurrencias** del input de fecha nativo en **22 archivos**. Todos sufren el mismo problema: en navegadores con locale en inglés muestran `MM/DD/YYYY` en vez del formato mexicano `DD/MM/YYYY`.

### Agrupación por módulo

**Costeo (tarifas, demoras, búsqueda) — 6 campos**
- `costeo/components/TarifaNumerosVigenciaFields.tsx` (vigente_desde, vigente_hasta)
- `costeo/components/BuscarTarifaDialog.tsx` (fecha)
- `costeo/components/NavieraCondicionForm.tsx` (1)
- `costeo/routes/CosteoDemorasVenta.tsx` (vigente_desde, vigente_hasta)
- `costeo/routes/CosteoBuscar.tsx` (fecha)

**CxP (facturas y filtros) — 6 campos**
- `cxp/components/FacturaProveedorFormFields.tsx` (emision, vencimiento)
- `cxp/components/DialogNotaCreditoProveedor.tsx` (fecha)
- `cxp/components/CxpFiltrosSheetFields.tsx` (fechaDesde, fechaHasta)

**Facturación — 3 campos**
- `facturacion/components/DialogMarcarFacturada.tsx` (1)
- `facturacion/components/PagoFormFields.tsx` (fecha)
- `facturacion/components/FacturaManualDatosFiscales.tsx` (fechaEmision)

**Embarques — 7 campos**
- `embarques/components/stepDatosRuta/StepDatosRutaFechas.tsx` (2)
- `embarques/components/TabDemoras.tsx` (2)
- `embarques/components/DialogSeguroForm.tsx` (vigencia_desde, vigencia_hasta)
- `embarques/components/tracking/TrackingNuevoEventoForm.tsx` (fecha)

**Cotización — 2 campos**
- `cotizacion/components/informativa/WizardInformativa.tsx` (vigenciaDesde, vigenciaHasta)

**CRM — 4 campos**
- `crm/components/nuevaOportunidad/OportunidadFormFields.tsx` (fecha_estimada_cierre)
- `crm/components/OportunidadesFiltersBar.tsx` (cierreDesde, cierreHasta)
- `crm/components/ConvertirLeadDialog.tsx` (fecha)

**Admin / Auditoría — 3 campos**
- `admin/components/DiagnosticoFilters.tsx` (2)
- `auditoria/components/marcarRevisado/SnoozeTab.tsx` (1)

### Plan de remediación

Reemplazar `<Input type="date" value={x} onChange={e => set(e.target.value)} />` por `<DatePickerMx value={x} onChange={set} />` en los 22 archivos. Conservar `className`/`id`/`title` cuando existan.

**Casos especiales que validaré antes de tocar**:
- `TrackingNuevoEventoForm.tsx` usa `register("fecha")` de react-hook-form → necesita `Controller` para conectar `DatePickerMx`.
- `FacturaProveedorFormFields.tsx` tiene un campo `vencimiento` con `readOnly` → si es solo lectura quizá conviene mostrarlo formateado en vez de un picker; lo dejaré como `DatePickerMx` deshabilitado para mantener consistencia visual.

### Versionado
- Bump `APP_VERSION` a `13.135.57`.
- Entrada en `CHANGELOG.md` listando los módulos afectados.

### Analogía
Es como cambiar todos los relojes de pared de la oficina al mismo formato 24h: el tiempo no cambia, pero ya nadie se confunde leyendo "03:00" pensando si es mañana o tarde.

### Confirmación
¿Aplico el reemplazo en los **22 archivos** de una vez, o prefieres que lo haga por módulo (Costeo → CxP → Facturación → Embarques → Cotización → CRM → Admin)?

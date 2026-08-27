# Cotizar directo desde el lead (CRM)

Hoy la ficha del lead (`/crm/leads/:id`) sólo tiene "Tomar lead", "Convertir" y "Eliminar". Crear una cotización sólo es posible desde una oportunidad o desde el wizard de cotizaciones, donde hay que volver a teclear los datos del prospecto y buscarlo a mano en "Vincular prospecto". Por eso no aparece la opción dentro del lead.

## Qué se va a construir

1. **Botón "Cotizar" en la ficha del lead**
   - Se agrega en el header del lead, junto a "Convertir".
   - Visible sólo para usuarios con permiso de escritura en cotizaciones; se oculta si el lead ya está en estado `Convertido` (ese caso ya es cliente y se cotiza desde Clientes).
   - Al presionarlo abre el wizard de nueva cotización con los datos del lead ya cargados.

2. **Prellenado del wizard desde el lead**
   - El wizard arranca en modo "Prospecto" con el lead ya vinculado (aparece el chip de vínculo), y con empresa, contacto, email, teléfono y RFC del lead precargados.
   - El usuario sólo captura ruta, modo y tarifa; no vuelve a teclear el destinatario.
   - Al guardar, la cotización queda ligada al lead y su oportunidad usando el mecanismo transaccional que ya existe (`crm_vincular_cotizacion`), y el folio sale con prefijo de prospecto (`COT-P-`).
   - No se crean clientes: se respeta el candado de alta de clientes.

3. **Tarjeta "Cotizaciones del lead"**
   - En la ficha del lead se muestra la lista de cotizaciones asociadas (folio, estado, monto, fecha) con clic para abrir el detalle, para que se vea el historial sin salir del CRM.

4. **Avance de etapa**
   - Al enviarse la cotización, el lead avanza automáticamente a `Prospecto` y, al aceptarse, a `Pendiente de alta` (el disparador de base de datos ya existe; no se cambia).

## Detalles técnicos

- `LeadHeaderActions.tsx`: nueva acción `onCotizar` (icono `FileText`), habilitada por permiso de cotizaciones.
- `LeadDetalle.tsx`: navega a `ROUTES.COTIZACION_NUEVA` pasando `state.prefillLead` (id, empresa, contacto, email, teléfono, RFC).
- `NuevaCotizacion.tsx`: al montar, si viene `state.prefillLead` y no se restauró borrador, aplica `setValue` con `{ shouldValidate: true, shouldDirty: true }` sobre `esProspecto`, `prospectoModo: "vincular"`, `leadId` y los campos `prospecto*`. No se usa `initialData` para no activar el modo edición.
- Lista de cotizaciones: servicio nuevo `fetchLeadCotizaciones(leadId)` en `src/features/crm/services/`, filtrando `deleted_at IS NULL`, con su query key en `src/features/crm/queryKeys.ts` y componente `leadDetalle/LeadCotizacionesCard.tsx` (reusa el patrón de `OportunidadCotizacionesList`).
- Sin cambios de esquema ni de RLS.
- Tests unitarios del servicio nuevo y del prellenado; `CHANGELOG.md` + bump de `APP_VERSION`.

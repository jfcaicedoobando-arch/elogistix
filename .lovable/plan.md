
## Integración CRM ↔ Cotizaciones (enfoque híbrido CRM-first con atajo)

**Principio:** el CRM nunca queda vacío. Toda cotización a prospecto se ancla a un lead + oportunidad. El vendedor puede vincular a uno existente o crearlo en línea desde el wizard.

---

### Fase 1 — Selector "vincular o crear" en `SeccionDestinatario`

Al elegir "Prospecto" en `src/components/cotizacion/SeccionDestinatario.tsx`, mostrar tres modos en lugar del formulario plano actual:

1. **Vincular a oportunidad existente** (default cuando hay matches)
   - Combobox con búsqueda debounced (200 ms) que reutilice `useCrmSearch` filtrado a `kind === "oportunidad"` y opcionalmente `kind === "lead"`.
   - Al seleccionar una oportunidad: precargar `prospectoEmpresa`, `prospectoContacto`, `prospectoEmail`, `prospectoTelefono` desde el lead/oportunidad y guardar `oportunidadId` + `leadId` en el form (campos nuevos).
   - Mostrar chip "Vinculado a OP-123 · Etapa: Calificación" con botón "Desvincular".

2. **Vincular a lead existente (aún sin oportunidad)**
   - Mismo combobox; al seleccionar un lead sin oportunidad, se creará la oportunidad al guardar (Fase 2).

3. **Crear nuevo prospecto** (atajo actual)
   - Formulario actual (empresa, contacto, email, teléfono).
   - Banner informativo: *"Se creará un lead y una oportunidad en CRM al guardar la cotización."*

**UX guardrail:** mientras el usuario escribe el nombre de empresa en modo "crear nuevo", correr la búsqueda en background; si hay match ≥ 80% por nombre, mostrar aviso inline *"¿Es la misma empresa que [Lead X]? Vincular"* para evitar duplicados.

---

### Fase 2 — Lógica de guardado en `useCotizacionWizardForm` / mutations

Al guardar una cotización con `esProspecto = true`:

- **Caso A — `oportunidadId` presente:** solo `UPDATE cotizaciones SET oportunidad_id = ...`. No tocar lead/oportunidad.
- **Caso B — solo `leadId` presente:** crear `crm_oportunidad` en etapa "Cotizando" vinculada al lead, luego asignar a la cotización.
- **Caso C — nada vinculado (crear nuevo):** crear `crm_lead` (estado "Nuevo", fuente "Otro" o configurable) + `crm_oportunidad` (etapa "Cotizando"), luego asignar a la cotización.

Idempotencia: si la cotización ya tiene `oportunidad_id` (edición), no recrear nada.

Archivos:
- `src/services/cotizacion/mutations/` — nuevo helper `vincularOCrearOportunidad.ts`.
- `src/hooks/cotizacion/useCotizacionWizardForm.ts` — invocar el helper antes/después del insert de cotización.
- `src/types/cotizacionForm.ts` — agregar `oportunidadId?: string`, `leadId?: string`, `modoVinculacion: "existente" | "nuevo"`.

---

### Fase 3 — Sincronización de estados cotización → oportunidad

En `src/hooks/cotizacion/useCotizacionDetalleHandlers.ts`, después de `actualizarEstado.mutateAsync`, si la cotización tiene `oportunidad_id` llamar `actualizarEtapaOportunidad` con mapeo configurable:

| Estado cotización | Etapa oportunidad (default) |
|---|---|
| Guardada | Cotizando |
| Enviada | Propuesta enviada |
| Aceptada | Ganada (prob 100, fecha_cierre = hoy) |
| Rechazada | Perdida |
| Convertida a embarque | Ganada + comentario "Operando" |

Llaves de configuración nuevas en `src/hooks/configuracion/configSchemas.ts`:
`crm.etapa_cotizando_id`, `crm.etapa_propuesta_id`, `crm.etapa_ganada_id`, `crm.etapa_perdida_id`.

---

### Fase 4 — Propagar conversión prospecto → cliente al CRM

En `src/services/cotizacion/conversiones/prospecto.ts`, después de crear el cliente:
- Si la cotización tiene `oportunidad_id`: `UPDATE crm_oportunidades SET cliente_id, cliente_nombre`.
- Si la oportunidad tiene `lead_id`: marcar lead como `Convertido`, llenar `cliente_convertido_id` y `oportunidad_convertida_id`.

---

### Fase 5 — Visibilidad cruzada

- `src/pages/cotizaciones/CotizacionDetalle.tsx`: chip "Oportunidad: OP-123" enlazando a `/crm/oportunidades/:id`.
- `src/pages/crm/OportunidadDetalle.tsx`: ya muestra cotizaciones vía `useOportunidadCotizaciones`; verificar que liste las nuevas creadas desde el wizard.

---

### Fase 6 — Backfill (one-shot)

Migración SQL: para `cotizaciones` con `es_prospecto = true` y `oportunidad_id IS NULL`, crear lead + oportunidad por cada una usando `prospecto_empresa/contacto/email/telefono` como datos.

---

### Out of scope

- No tocar el flujo inverso (`insertCotizacionDesdeOportunidad`) que ya funciona desde `OportunidadDetalle`.
- No cambiar permisos/RLS — se asume que quien crea cotizaciones tiene permiso de crear leads/oportunidades.
- No agregar workflow de aprobación previa a cotizar (queda como Fase futura si se quiere endurecer el proceso a CRM-first puro).

---

### Extras obligatorios al implementar

- Bump `APP_VERSION` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` describiendo: vinculación lead/oportunidad desde wizard, sincronización de estados, propagación de conversión.
- Memoria nueva: `mem://features/cotizacion-crm-integration` con las reglas de vinculación y el mapeo de estados.

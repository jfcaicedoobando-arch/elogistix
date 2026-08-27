# Rediseño del CRM: Lead → Prospecto → Oportunidad → (alta de cliente fuera del CRM)

## Embudo objetivo

```text
LEAD                 PROSPECTO                OPORTUNIDAD              FIN DEL CRM
primer contacto  →   califica el perfil   →   cotizaciones en el aire → handoff a Clientes
Nuevo                Prospecto                (una o varias por         "Pendiente de alta"
Contactado           Pendiente de alta         prospecto/cliente)        → alta fiscal en
Descalificado                                  Ganada / Perdida            el módulo Clientes
```

Regla dura que se mantiene: el CRM nunca crea clientes. Termina en "Pendiente de alta" y el alta ocurre en el módulo de Clientes con sus validaciones fiscales.

## Etapa 1 — Leads (queda casi igual)

- Los leads sólo viven como bandeja de primer contacto: estados `Nuevo`, `Contactado`, `Descalificado`.
- Se quitan de la vista de Leads los registros ya calificados: en cuanto un lead pasa a prospecto aparece en la vista de Prospectos, no en Leads.
- Desde el lead ya no se cotiza: primero hay que calificarlo.

## Etapa 2 — Prospectos (nuevo tab con puerta de calificación)

- Nueva vista **CRM → Prospectos** (`/crm/prospectos`) con su propia tabla: empresa, contacto, vendedor, sector, rutas/mercancía, oportunidades abiertas, monto en pipeline, última actividad, estado.
- Botón **"Calificar como prospecto"** en la ficha del lead. Abre un panel con la lista de requisitos de perfil (ICP) que hoy ya existen como campos del lead: sector, mercancía, rutas, volumen, frecuencia, dolor explícito y proveedor actual. Si faltan campos, el botón explica qué falta y no avanza.
- Al calificar: el lead pasa a estado `Prospecto`, se sella su resultado de perfil y queda registrado en la bitácora con quién lo calificó.
- La ficha del prospecto es la misma ficha del lead, pero con encabezado "Prospecto", banner de reglas y una sección de **Oportunidades del prospecto** con botón "Nueva oportunidad".
- El estado antiguo `Calificado` se unifica con `Prospecto` para que exista un solo lenguaje.

## Etapa 3 — Oportunidades (siempre colgadas de un prospecto o cliente)

- Ya no se pueden crear oportunidades "sueltas": toda oportunidad nace desde un prospecto (o desde un cliente existente para negocios nuevos de una cuenta que ya opera). El formulario de nueva oportunidad exige ese origen.
- En el tablero de oportunidades se muestra de qué prospecto/cliente viene, con badge para distinguir "Prospecto" de "Cliente".
- Desde la oportunidad se crea la cotización (ya existe). Las cotizaciones de prospecto siguen con folio `COT-P-` y quedan separadas de las de clientes.
- Vista de detalle de oportunidad: lista de cotizaciones, estado de cada una y cuál es la ganadora.

## Etapa 4 — Cierre del embudo

- Oportunidad marcada como **Ganada** con cotización aceptada:
  - si viene de un prospecto, el prospecto pasa a `Pendiente de alta` y se muestra un aviso con el paso siguiente: alta en el módulo de Clientes;
  - si viene de un cliente existente, la oportunidad se cierra sin más pasos.
- Cuando un usuario autorizado da de alta al cliente en el módulo de Clientes, el prospecto pasa a `Convertido` y su historial (oportunidades y cotizaciones) se re-vincula al cliente. Esto ya existe y sólo se conecta al nuevo flujo.
- Oportunidad **Perdida**: pide motivo (ya existe) y el prospecto puede volver a nutrición para futuras oportunidades.

## Tablero del CRM

- El dashboard muestra el embudo en 4 columnas con conteos y conversión entre etapas: Leads → Prospectos → Oportunidades abiertas → Pendientes de alta, con clic para ir a cada lista.

## Detalles técnicos

- Sin tabla nueva: el prospecto es el mismo registro `crm_leads` con `estado` en (`Prospecto`, `Pendiente de alta`). Se aprovechan sus campos ICP y `estatus_icp`.
- Migración: RPC `crm_calificar_prospecto(p_lead_id)` (SECURITY DEFINER, candado multi-tenant, sin `EXECUTE` para `anon`) que valida los campos de perfil, mueve el estado y escribe bitácora; ajuste al trigger `_crm_lead_avanzar_por_cotizacion` para que ya no promueva leads sin calificar; guard en `crm_oportunidades` que exige `lead_id` o `cliente_id`. Data-fix con run_sql para reencasillar `Calificado` → `Prospecto`.
- Frontend: nueva ruta `CRM_PROSPECTOS` + `routes/Prospectos.tsx` (patrón `DataTable` y filtros en URL como `Leads.tsx`), `prospectosColumns.tsx`, servicio/hook `useProspectos` con paginación server-side y `deleted_at IS NULL`; `CalificarProspectoDialog.tsx` con `FormDialogShell`; `LeadHeaderActions.tsx` gana la acción de calificar; `NuevaOportunidadDialog.tsx` exige origen; filtro de estados en `Leads.tsx`.
- Se respetan los tokens y el `docs/design-system.md`; componentes ≤200 líneas; tests unitarios de la RPC guard, del gate de calificación y de las columnas nuevas.
- `CHANGELOG.md` + bump de `APP_VERSION`.

## Fases de entrega

1. Prospectos: RPC de calificación + vista/tab + gate en la ficha del lead.
2. Oportunidades: origen obligatorio, badges y creación desde el prospecto.
3. Cierre: handoff a alta de cliente y embudo en el dashboard.

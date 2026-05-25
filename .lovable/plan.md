# CRM nativo para Libre Carga

Módulo CRM dentro de la app, multi-tenant (RLS por `organization_id`), reutilizando patrones existentes (DataTable, page-state, wizard, bitácora, auditoría). Las **Oportunidades** se convierten directamente en **Cotizaciones** existentes (sin duplicar el flujo).

## 1. Alcance funcional

### A. Leads (prospectos sin calificar)

- Lista con DataTable + filtros (estado, fuente, vendedor asignado, fecha).
- Campos: empresa, contacto, email, teléfono, país/ciudad, fuente (web, referido, campaña, llamada en frío, otro), interés (modo: Marítimo/Aéreo/Terrestre), notas, vendedor asignado, estado (Nuevo, Contactado, Calificado, Descalificado), score (1-5).
- Acciones: **Convertir → Cliente + Oportunidad**, descartar, reasignar vendedor.
- Wizard de alta similar a `NuevoCliente`.

### B. Oportunidades (pipeline)

- Vista **Kanban** (drag & drop entre etapas) + vista **Tabla**.
- Etapas configurables (default): Prospección → Cotizando → Negociación → Ganada → Perdida.
- Campos: nombre, cliente/lead vinculado, vendedor, monto estimado (MXN/USD), moneda, probabilidad %, fecha estimada de cierre, modo/tipo de carga, origen-destino, motivo de pérdida (si aplica).
- **Conversión a Cotización**: botón "Crear cotización" que prellena `NuevaCotizacion` con datos de la oportunidad (cliente, ruta, mercancía, modo). La cotización guarda `oportunidad_id` para trazabilidad inversa. Al ganar la oportunidad (cotización aceptada), se marca automáticamente como "Ganada".
- Forecast ponderado: `monto × probabilidad` agrupado por mes/vendedor.

### C. Actividades

- Tipos: Llamada, Email, Reunión, Tarea, Nota.
- Vinculadas a Lead, Oportunidad, Cliente o Contacto (polimórfica vía `entidad_tipo` + `entidad_id`).
- Campos: tipo, asunto, descripción, fecha programada, fecha completada, duración (min), resultado, responsable.
- Vista calendario + lista "Mis actividades pendientes" en dashboard del vendedor.
- Recordatorios visuales (badge en sidebar cuando hay vencidas).

### D. Forecast

- Tabla agrupable por vendedor / mes / etapa.
- Suma de monto estimado × probabilidad.
- Comparativa: pipeline vs. ganado vs. cuota (cuota mensual configurable por vendedor).
- Filtros por periodo y vendedor.

### E. Reportes CRM

- Embudo de conversión (Leads → Calificados → Oportunidades → Ganadas).
- Tasa de conversión por fuente y vendedor.
- Tiempo promedio por etapa (velocity).
- Ranking de vendedores (oportunidades ganadas, monto, # actividades).
- Motivos de pérdida (top 5).
- Export CSV/PDF reutilizando `exportCsv` y patrón de `rentabilidadPdf`.

## 2. Rol "vendedor"

- Agregar `'vendedor'` al enum `app_role` en BD.
- Permisos:
  - **Puede**: ver/crear/editar sus propios Leads, Oportunidades, Actividades; ver Clientes y Cotizaciones de sus cuentas; crear cotizaciones; ver Forecast/Reportes propios.
  - **No puede**: ver Embarques operativos completos, Pre-Facturación, Auditoría, Configuración, ni datos de otros vendedores (excepto si es admin).
- Admin/operador ven todo el CRM de su organización.
- Filtro automático `vendedor_id = auth.uid()` en RLS para rol vendedor (vía función `is_vendedor()`).

## 3. Base de datos (migración)

Tablas nuevas (todas con `organization_id`, `deleted_at`, RLS multi-tenant + filtro por vendedor):

- `crm_leads`
- `crm_oportunidades` (FK lógico a `clientes` y `cotizaciones`)
- `crm_etapas_pipeline` (configurable por organización, orden, probabilidad default)
- `crm_actividades` (polimórfica: `entidad_tipo` + `entidad_id`)
- `crm_cuotas_vendedor` (mensual, opcional)
- `crm_motivos_perdida` (catálogo)

Cambios a tablas existentes:

- `cotizaciones`: nueva columna nullable `oportunidad_id uuid` + índice.
- Enum `app_role`: agregar `'vendedor'`.
- Función `has_role` ya cubre el nuevo valor.

Triggers:

- Al aceptar cotización vinculada → marcar oportunidad como "Ganada".
- Bitácora automática en cambios de etapa.

## 4. UI / rutas

Nuevas rutas (lazy, dentro de `ProtectedRoute`):

- `/crm` → Dashboard CRM (KPIs, mis actividades, mi pipeline)
- `/crm/leads` y `/crm/leads/:id`
- `/crm/oportunidades` (Kanban + tabla) y `/crm/oportunidades/:id`
- `/crm/actividades` (lista + calendario)
- `/crm/forecast`
- `/crm/reportes`

Sidebar: nueva sección **"CRM"** con ítems Dashboard, Leads, Oportunidades, Actividades, Forecast, Reportes. Visible para `vendedor`, `operador`, `admin`, `super_admin`.

Componentes nuevos (reutilizando `DataTable`, `PageHeader`, `dialogTokens`, `Card`):

- `OportunidadKanban` (drag & drop con `@dnd-kit/core` — verificar si ya existe en deps).
- `ActividadTimeline` reutilizable en detalle de Lead/Oportunidad/Cliente.
- `ConvertirLeadDialog` (similar a `DialogConvertirProspecto`).
- `CrearCotizacionDesdeOportunidadButton`.

## 5. Integración con módulos existentes

- **Clientes**: detalle muestra tab "CRM" con oportunidades y actividades del cliente.
- **Cotizaciones**: si viene `oportunidad_id` en la URL/state, prellena wizard. Detalle muestra link a la oportunidad origen.
- **Bitácora**: registra todas las acciones CRM (módulo "CRM").
- **Auditoría**: opcional fase 2 — reglas para oportunidades estancadas > N días.

## 6. Fases de implementación

1. **Fase 1 — Fundación** (1 PR): migración BD (tablas, enum vendedor, RLS, triggers), tipos, hooks base, sidebar, rutas placeholder.
2. **Fase 2 — Leads**: CRUD, lista, wizard, conversión a cliente+oportunidad.
3. **Fase 3 — Oportunidades**: tabla, Kanban drag&drop, detalle, conversión a cotización (bidireccional).
4. **Fase 4 — Actividades**: CRUD polimórfico, timeline, badge sidebar de vencidas.
5. **Fase 5 — Forecast + Reportes**: agregaciones, export.
6. **Fase 6 — Rol vendedor refinado**: ajustes finos de permisos y dashboard personal.
7. Cada fase incluye su entrada en `Changelog.tsx` y bump de `APP_VERSION`.

## Detalles técnicos

- **Drag & drop Kanban**: usar `@dnd-kit/core` (ligero, accesible). Si no está instalado, agregarlo en Fase 3.
- **Calendario actividades**: vista mensual simple con grilla CSS (sin libs nuevas) o `react-day-picker` ya presente en shadcn.
- **RLS vendedor**: nueva función `is_vendedor(uuid)` + policies `(vendedor_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'operador'))`.
- **Polimorfismo actividades**: enum `crm_entidad_tipo` ('lead','oportunidad','cliente','contacto') + check de integridad vía trigger.
- **Conversión oportunidad → cotización**: navegación a `/cotizaciones/nueva?oportunidad=<id>`; hook `useCotizacionWizardForm` lee param y prellena.
- **Forecast**: vista materializada o RPC `crm_forecast_resumen(p_desde, p_hasta)` para performance.
- **Power of 10**: componentes ≤200 líneas, sin `any`, cleanup en effects, server-side pagination en listas grandes.

## Preguntas abiertas (puedo asumir defaults si prefieres)

1. ¿Las etapas del pipeline deben ser configurables por organización desde el inicio, o arrancamos con etapas fijas y lo hacemos configurable en fase 2? Deben de ser configurables.
2. ¿El vendedor debe poder crear embarques también, o solo cotizaciones (y luego el operador convierte a embarque)? El operador convierte a embarque.
3. ¿Necesitas integración de email saliente (envío real desde la app) o por ahora basta con registrar la actividad manualmente? Basta con registrar actividad manual. 
# Migrar el CRM del equipo comercial (Excel Hunter) al CRM del ERP

## Respuesta corta

Sí pueden migrar, pero falta pulir. El CRM del ERP ya cubre ~70% del Excel (pipeline kanban, leads con conversión, actividades, dashboard, analítica/forecast, cuotas por vendedor, motivos de pérdida, plantillas, importación CSV de leads). Lo que el Excel hace y el ERP hoy **no**:

1. **Perfil ICP del prospecto**: mercancía, rutas, incoterm, volumen, frecuencia, aduana/puerto, dolor explícito, consecuencia, proveedor actual, sector, sitio web, años establecida, estatus ICP y motivo/fecha de nutrición. Hoy el lead solo guarda datos genéricos (`modo`, `origen`, `destino`).
2. **Higiene del pipeline**: no hay "días sin movimiento" ni SLA por etapa con semáforo, ni el tablero `06_Higiene` (registros completos, seguimiento oportuno, oportunidades vencidas). Solo existen avisos sueltos de "próxima mejor acción".
3. **Historial de cambios de etapa**: no se guardan las transiciones, así que no se puede medir conversión etapa a etapa ni por cohorte (hoja `08_Historial_Etapas` y la columna "Conversión desde etapa anterior" del dashboard).
4. **Presupuesto de la organización Jul–Dic y cobertura**: el ERP solo tiene cuota por vendedor/mes. Falta el presupuesto mensual global, la **cobertura ponderada** (pipeline ponderado / presupuesto, meta 3x) y la proyección de cierre.
5. **Metas de actividad y calidad de contacto**: metas 30/60/90 y semanales (ICP validados, contactadas, reuniones, cotizaciones) y las banderas **contacto efectivo** / **reunión calificada** por actividad.
6. **Etapas del embudo del Excel**: Sospechoso, Prospecto ICP, Calificado, Cotización, Negociación, Cerrado ganado, Activo, Cerrado perdido, Nutrición — con su probabilidad guía y SLA.
7. **Carga inicial**: hoy solo se importan leads desde CSV; el archivo es `.xlsx` con 3 hojas de datos (clientes, pipeline, actividades).

## Plan por etapas

### Etapa 1 — Perfil ICP y embudo del Excel
- Campos ICP nuevos en prospecto/oportunidad, agrupados en una sección "Perfil ICP" del detalle del lead: sector, sitio web, años establecida, mercancía, rutas, aduana/puerto, incoterm, volumen, frecuencia, dolor explícito, consecuencia, proveedor actual, estatus ICP, motivo de nutrición/descarte y fecha de nutrición.
- Semilla de etapas con las 9 del Excel, su probabilidad guía y sus días de SLA, editables en Configuración del CRM.
- Los campos ICP se arrastran al crear la oportunidad y al generar cotización, para no recapturar.

### Etapa 2 — Higiene y trazabilidad del pipeline
- Cálculo de "último movimiento" y "días sin movimiento" por oportunidad, contra el SLA de su etapa, con semáforo (En tiempo / Por vencer / Vencida).
- Registro automático de cada cambio de etapa (etapa origen, etapa destino, fecha, usuario, días en etapa).
- Nueva pestaña **Higiene** en Analítica: indicadores del Excel (oportunidades abiertas, registros completos, % higiene, % seguimiento oportuno, vencidas, sin movimiento) más el listado accionable para trabajarlas una por una.
- Filtro "requieren atención" en el listado y kanban de oportunidades.

### Etapa 3 — Metas, cobertura y calidad de actividad
- Presupuesto mensual por organización (captura por mes y moneda) y KPIs de dashboard: pipeline bruto, pipeline ponderado, cobertura ponderada vs meta 3x, proyección de cierre del periodo.
- Embudo con conversión etapa a etapa usando el historial de la Etapa 2.
- Metas de actividad (semanal y 30/60/90) y banderas contacto efectivo / reunión calificada en la captura de actividad, con avance vs meta por vendedor.

### Etapa 4 — Migración de los datos actuales
- Importador `.xlsx` que lee las hojas `02_Clientes`, `03_Pipeline` y `04_Actividades`, muestra vista previa con validaciones (ID de cliente existente, etapa válida, duplicados por razón social) y carga en lote.
- Guía corta de arranque para el equipo comercial y congelamiento del Excel una vez validada la carga.

## Detalles técnicos

- **Base de datos** (una migración por etapa, con `GRANT` en tablas nuevas y RLS por `organization_id`):
  - Etapa 1: columnas ICP en `crm_leads` y las heredables en `crm_oportunidades`; sin tablas nuevas.
  - Etapa 2: tabla `crm_historial_etapas` (oportunidad_id, etapa_origen_id, etapa_destino_id, dias_en_etapa, usuario, fecha) alimentada por trigger en `crm_oportunidades`; columna `ultimo_movimiento_at`; RPC `crm_higiene_pipeline(p_organization_id)` que devuelve los indicadores de la hoja `06_Higiene`. SLA reutiliza `crm_etapas_pipeline.dias_seguimiento`.
  - Etapa 3: tabla `crm_presupuesto_mensual` (anio, mes, monto, moneda) y `crm_metas_actividad`; banderas `contacto_efectivo` y `reunion_calificada` en `crm_actividades`; RPC de embudo con conversión desde el historial.
- **Frontend**: se extiende lo existente — `LeadDetalle`, `NuevoLeadDialog`, `OportunidadKanban`, `OportunidadesFiltersBar`, `Analitica` (nueva pestaña `higiene`), `CrmDashboard` (tarjetas de cobertura), `Configuracion` (etapas, presupuesto, metas). Modales nuevos con `FormDialogShell`. Importador nuevo junto a `ImportarLeadsCsvDialog`, con parseo `.xlsx`.
- **Cálculos**: monto ponderado y cobertura viven en `src/features/crm/domain/**` (funciones puras con pruebas unitarias); nada de números derivados hardcodeados en componentes.
- **Registro**: entrada en `CHANGELOG.md` y bump de `APP_VERSION` por etapa.

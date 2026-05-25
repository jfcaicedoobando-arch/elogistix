# Sprint D — Integración comercial CRM ↔ Cotizaciones/Embarques (v11.6.0)

Sprint C (Automatizaciones) está cerrado en v11.5.0. El siguiente paso natural es cerrar el ciclo comercial: que las oportunidades CRM se conecten de forma fluida con cotizaciones, embarques y métricas de vendedor.

## Objetivos

1. Trazabilidad bidireccional oportunidad ↔ cotización ↔ embarque.
2. Productividad del vendedor: vista 360° del cliente y atajos comerciales.
3. Métricas de cierre reales (no sólo pipeline ponderado), con comparativo cuota vs. logrado.

## Alcance

### 1. Vista 360° del cliente en CRM

- Nuevo tab "CRM" dentro de `ClienteDetalle.tsx` (o sección en página existente) que muestre:
  - Oportunidades abiertas y ganadas del cliente.
  - Actividades recientes (timeline reutilizando `ActividadTimeline`).
  - Última cotización y último embarque con link directo.
- Hook `useCliente360.ts` que agrega los datos en una sola query optimizada.

### 2. Conversión Oportunidad → Cotización mejorada

- Botón "Crear cotización" en `OportunidadDetalle.tsx` ya existe; ampliarlo:
  - Pre-llenar modo de transporte, cliente, contacto, valor estimado e Incoterm desde la oportunidad.
  - Al crear, dejar la oportunidad en etapa "Cotizando" automáticamente (configurable en pipeline).
- Mostrar en `OportunidadDetalle` la lista de cotizaciones vinculadas (`cotizaciones.oportunidad_id`) con estatus y monto.

### 3. Cierre Oportunidad → Embarque

- Cuando una cotización vinculada a oportunidad se acepta:
  - Trigger ya marca oportunidad como "Ganada" (existe). Extender para registrar `valor_real` con el monto final de la cotización.
  - Si se crea un embarque desde la cotización, mostrar el embarque en `OportunidadDetalle`.
- Nuevo campo `valor_real` (numeric, nullable) en `crm_oportunidades`.

### 4. Métricas reales del vendedor

- `useForecastReportes.ts`: agregar bloques de "Cerrado mes" y "Cerrado YTD" usando `valor_real` de oportunidades ganadas.
- `Reportes.tsx`: tarjeta de cumplimiento de cuota (`crm_cuotas_vendedor` ya existe) con barra de progreso y % vs. meta mensual/trimestral.
- Tabla de leaderboard de vendedores (admin/operador), oculta para rol vendedor.

### 5. Comentarios en oportunidad

- Nueva tabla `crm_comentarios_oportunidad` (id, oportunidad_id, autor_id, texto, created_at) con RLS multi-tenant.
- Sección "Comentarios" en `OportunidadDetalle.tsx` con input + listado cronológico.
- Notificación automática (usa `crm_notificaciones`) al vendedor responsable cuando alguien más comenta.

### 6. Versionado y changelog

- `APP_VERSION` → `11.6.0`.
- Entrada nueva en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.

## Detalles técnicos

- **Migración**: agregar `valor_real numeric` en `crm_oportunidades`; crear `crm_comentarios_oportunidad` con RLS por `organization_id` y `is_vendedor()`.
- **Trigger**: extender `crm_marcar_oportunidad_ganada` para setear `valor_real = NEW.total` cuando la cotización es aceptada.
- **Hooks**: `useCliente360.ts`, `useComentariosOportunidad.ts` (paginado), extender `useForecastReportes.ts`.
- **Componentes nuevos** (≤200 líneas, sin `any`):
  - `Cliente360Panel.tsx` (vista CRM dentro del cliente)
  - `OportunidadCotizacionesList.tsx`
  - `OportunidadEmbarquesList.tsx`
  - `ComentariosOportunidad.tsx`
  - `LeaderboardVendedores.tsx`
- **Reutilización**: `ActividadTimeline`, `DataTable`, `formatCurrency`, `useTasaIVA` cuando aplique.
- **Performance**: queries con `select` explícito (regla `optimizacion-consultas`); paginación en comentarios y leaderboard.
- **RLS**: comentarios siguen las mismas reglas de la oportunidad (lectura/escritura por organización y por vendedor responsable).

## Fuera de alcance

- Workflows visuales tipo BPMN.
- Edge functions de email/WhatsApp reales (Sprint C ya definió `mailto:`/`wa.me/`).
- Reportes exportables a Excel/PDF (queda para Sprint E).

## Sprints siguientes (no implementar aún)

- **Sprint E — Importación masiva y exportes**: importar leads vía CSV avanzado con mapeo de columnas, exporte de reportes a Excel/PDF. Esto no sera necesario. 
- **Sprint F — Integraciones**: webhooks salientes, integración con Outlook/Gmail vía OAuth.  Explicame mas esto

¿Procedo a implementar el Sprint D?
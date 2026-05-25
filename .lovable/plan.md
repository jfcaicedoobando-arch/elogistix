# Cierre Sprint C — Automatizaciones CRM (v11.5.0)

Quedan pendientes los puntos de UI/integración del sprint ya iniciado. La base (migración, hooks, campanita, plantillas) ya está implementada.

## Pendientes

1. **Configuración del pipeline editable**
   - En `EtapasPipelineEditor.tsx`: agregar inputs para `crea_tarea_seguimiento` (switch) y `dias_seguimiento` (number, 1–30) por etapa.
   - Actualizar `useEtapasPipeline.ts` mutation para persistir los nuevos campos.

2. **Tab "Plantillas" en /crm/configuracion**
   - Agregar tab nuevo en `src/pages/crm/Configuracion.tsx` que monte `PlantillasMensajeEditor`.

3. **Integrar `PlantillaSelector` en `ContactActions`**
   - En `src/components/crm/ContactActions.tsx`: junto a los botones email/WhatsApp, dropdown de plantillas activas filtradas por canal, que renderiza variables (`{{contacto}}`, `{{empresa}}`, etc.) y abre `mailto:` / `wa.me/`.

4. **Recordatorios de actividades vencidas**
   - Nuevo hook `useActividadesVencidas.ts` (count + lista, filtrado por `responsable_id` cuando es vendedor).
   - Badge rojo en item "Actividades" del sidebar `CrmLayout`.
   - Banner en `CrmDashboard` con CTA "Ver vencidas" → `/crm/actividades?filtro=vencidas`.
   - Soporte de query param `filtro` en `Actividades.tsx`.

5. **Auto-creación de actividad inicial**
   - Checkbox "Crear actividad de seguimiento" en `NuevoLeadDialog` (llamada, hoy+1) y `NuevaOportunidadDialog` (tarea "Preparar propuesta", hoy+1).
   - Crear `crm_actividades` en la misma mutation tras insertar el lead/oportunidad.

6. **Versionado y changelog**
   - `APP_VERSION` → `11.5.0`.
   - Entrada nueva en `src/content/changelog/v11/chunks/` describiendo automatizaciones, notificaciones in-app, plantillas, recordatorios.
   - Actualizar `src/content/changelogData.ts`.

## Detalles técnicos

- Todos los componentes nuevos ≤200 líneas; sin `any`; cleanups en `useEffect`.
- Mutaciones usan `useMutation` con `invalidateQueries` para `crm_etapas_pipeline`, `crm_actividades`, `crm_plantillas_mensaje`.
- `useActividadesVencidas`: query `crm_actividades` con `fecha_programada < now()` y `fecha_completada is null`, GC time estándar.
- Variables de plantilla resueltas vía `renderPlantilla(plantilla, ctx)` ya disponible en `usePlantillasMensaje.ts`.
- Respetar RLS existentes; no se requieren nuevas migraciones.

## Fuera de alcance

- Workflows visuales, edge functions de email/WhatsApp reales, push notifications.

¿Procedo a implementar?
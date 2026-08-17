# Auditoría del CRM: veredicto y plan para cerrar brechas

## Veredicto corto

Sí, el CRM ya se puede usar para el día a día del equipo comercial, y está casi a la altura del resto del ERP. Tiene lo esencial: leads con campos ICP, embudo con etapas configurables y criterios de salida, actividades, dashboard, "Mi día", higiene de pipeline, analítica con forecast y leaderboard, importación de leads por CSV, plantillas de mensaje, presupuesto y metas, y sincronización en ambos sentidos con cotizaciones. Además tiene paginación en servidor y buena cobertura de pruebas.

Lo que lo deja un escalón por debajo de módulos como Compras o Facturación son cuatro cosas que sí se sienten en el uso diario:

1. Nada sale del CRM por correo: las plantillas sólo abren el correo del usuario o WhatsApp Web; no hay envío ni recordatorios automáticos como los que ya existen en Cobranza.
2. La importación CSV no detecta duplicados, así que dos cargas del mismo archivo crean leads repetidos.
3. Al marcar una oportunidad como perdida no se pide el motivo, aunque el catálogo existe: la analítica de pérdidas queda vacía.
4. El historial de cambios de etapa se guarda en la base pero ninguna pantalla lo muestra, y leads/oportunidades no aparecen en la búsqueda global (Ctrl+K del ERP), sólo en el buscador propio del CRM.

Faltantes menores: no se pueden adjuntar archivos a un lead u oportunidad, la llamada se registra como actividad de texto libre (sin duración ni resultado) y no hay secuencias de seguimiento automáticas ni lectura de correo entrante.

## Qué propongo construir (por olas)

### Ola A — Higiene de datos y disciplina comercial
- Al mover una oportunidad a una etapa de tipo "perdida" (kanban o detalle), se abre un diálogo que exige elegir motivo de pérdida y permite una nota. Sin motivo no se guarda.
- La importación de leads detecta duplicados por correo, teléfono y nombre de empresa normalizado: en la vista previa cada renglón se marca como "nuevo", "posible duplicado" (con el lead existente al lado) o "duplicado exacto", y el usuario decide importar, omitir o actualizar el existente.
- Aviso de duplicado también al crear un lead a mano.

### Ola B — Seguimiento que sí avisa
- Recordatorio diario por correo a cada vendedor con sus tareas del día y vencidas, más un resumen semanal al gerente comercial (mismas piezas de correo que ya usa Cobranza).
- Envío real de correo desde el CRM con las plantillas existentes (queda registrado como actividad en la oportunidad/lead). WhatsApp sigue abriendo `wa.me`, pero también deja la actividad registrada.

### Ola C — Trazabilidad y visibilidad
- Pestaña/tarjeta "Historial de etapas" en el detalle de oportunidad: de qué etapa a cuál, quién y cuándo, con días en cada etapa (los datos ya se están guardando).
- Leads y oportunidades disponibles en la búsqueda global del ERP (Ctrl+K).
- Exportar a CSV los listados de leads, oportunidades y actividades, con los filtros aplicados, como en el resto del ERP.

### Ola D — Detalle de operación comercial
- Registro de llamada con duración y resultado (contactó / no contestó / reagendó), y botón de "reagendar" que crea la siguiente tarea.
- Adjuntos en lead y oportunidad (tarifario recibido, RFC, correo en PDF) usando el almacenamiento y las reglas de acceso por organización que ya existen.

## Detalle técnico

- Ola A: nuevo `DialogMotivoPerdida` consumido desde `useMoverOportunidadEtapa.ts` y desde el detalle; validación también en base con un trigger que rechace `etapa tipo perdida` sin `motivo_perdida_id` (código `LC_MOTIVO_PERDIDA_REQUERIDO` en el catálogo de mensajes). Dedupe: función pura en `src/features/crm/domain/` (normalización de correo/teléfono/razón social) + RPC de búsqueda por lote consumida por `useImportarLeadsCsv.ts` y `ImportarLeadsCsvPreview.tsx`.
- Ola B: edge function `crm-recordatorios-diarios` siguiendo el patrón de `cxc-recordatorios` (cron + `process-email-queue`), plantilla transaccional nueva; envío de plantillas vía `send-transactional-email` con registro en `crm_actividades` y bitácora.
- Ola C: lectura de `crm_historial_etapas` (ya poblada por el trigger `_crm_registrar_cambio_etapa`) en un hook nuevo; ampliar la RPC `busqueda_global` y `src/types/search.ts` con los tipos `lead` y `oportunidad`; exportación con los generadores CSV existentes en `src/generators/exportCsv.ts`.
- Ola D: columnas nuevas en `crm_actividades` (duración, resultado) y tabla `crm_adjuntos` con RLS por organización más bucket de storage con la validación de tenancy por `EXISTS` que ya usa el proyecto.
- Todo respeta Power of 10 (componentes ≤200 líneas, sin `any`, cleanup en effects, manejo de `error` de Supabase), `FormDialogShell` para los modales, pruebas unitarias de la lógica nueva, y `CHANGELOG.md` + bump de `APP_VERSION` por ola.

## Sugerencia

Empezaría por la Ola A y la Ola B: son las que más duelen hoy (datos sucios y falta de avisos). Si prefieres otro orden o quieres sólo una ola, dímelo y ajusto.

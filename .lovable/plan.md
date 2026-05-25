
# Sprint G — Pulido UX del CRM (v11.7.0)

Auditoría honesta del workflow actual y propuesta para simplificar. El CRM ya tiene piezas potentes (Kanban, automatizaciones, notificaciones, plantillas, leaderboard) pero está disperso en 7 pestañas y duplica información entre Dashboard / Forecast / Reportes. La meta es **menos clics, menos pestañas, más foco en lo que el vendedor tiene que hacer hoy**.

## Diagnóstico — qué le falta y qué sobra

### Pestañas redundantes
- **Forecast** y **Reportes** son dos pantallas que cuentan lo mismo desde ángulos diferentes (pipeline / ponderado / ganado vs. embudo / conversión / motivos / leaderboard). Hay overlap visual con el mini-embudo del Dashboard. → **Fusionar en una sola pestaña "Analítica"** con sub-tabs (Forecast · Embudo · Pérdidas · Vendedores).
- **Dashboard** y **Actividades** se solapan en "Mis actividades de hoy" y "Vencidas". El Dashboard tiene tantos widgets que deja de ser un panel de acción y se vuelve un reporte. → Reorientar Dashboard como **"Inicio"**: lo que tengo que hacer hoy, arriba; KPIs abajo.

### Huecos funcionales
- **LeadDetalle no muestra timeline de actividades** (las oportunidades sí). El esquema lo soporta (`crm_actividades.entidad_tipo='lead'`) pero la UI no lo expone.
- **OportunidadDetalle no expone plantillas / contacto rápido**. Sólo el lead tiene los botones email/WhatsApp con `PlantillaSelector`. El vendedor abre una oportunidad y no puede escribirle al contacto sin ir al lead.
- **Próxima actividad** no se muestra en cards de oportunidad ni en filas de lead. Es la información más útil de un CRM ("¿qué sigue?") y hoy hay que entrar al detalle para verla.
- **Quick-add global ausente**: para crear lead/oportunidad/actividad hay que navegar a la pestaña correspondiente y abrir el dialog.
- **Bell de notificaciones vive sólo dentro de `/crm`**. Si el vendedor está en `/cotizaciones` o `/clientes` no se entera de comentarios o tareas asignadas.

### Fricción de uso
- OportunidadDetalle apila 6 cards verticalmente (Header → KPIs → Datos → Cotizaciones → Comentarios → Lineage → Timeline). Mucho scroll para encontrar el comentario o la próxima actividad.
- Empty states pasivos ("Sin datos" / "Sin oportunidades"): no hay CTA accionable.
- Configuración con permiso `admin` es correcta, pero el ícono y el label la hacen verse como tab principal en vez de "ajustes".

## Cambios propuestos

### 1. Reducir de 7 → 5 pestañas

```text
ANTES                          DESPUÉS
─────────────────────────      ─────────────────────────
Dashboard                      Inicio
Leads                          Leads
Oportunidades                  Oportunidades
Actividades                    Actividades
Forecast            ┐
Reportes            ├─────►    Analítica  (sub-tabs)
                               Configuración (icono ⚙, derecha)
```

- `Forecast.tsx` y `Reportes.tsx` se consolidan en `Analitica.tsx` con `Tabs`: Forecast · Embudo · Pérdidas · Vendedores. Los hooks `useForecast` y `useReportesCRM` se mantienen.
- Ruta legacy `/crm/forecast` y `/crm/reportes` redirigen a `/crm/analitica?tab=forecast|embudo`.
- "Configuración" se separa visualmente en el `CrmLayout` (alineado a la derecha con ícono solo, sin label), para que las 5 tabs reales no compitan con ella.

### 2. "Inicio" enfocado en hoy (rediseño de `CrmDashboard`)

Orden y peso visual:
1. **Banner de vencidas** (ya existe).
2. **Mis actividades de hoy** — primera card, ancho completo, con botón inline "Completar" y "Posponer +1d".
3. **Cerrando esta semana** + **Leads sin contactar** — fila de 2.
4. **KPIs** (4 tarjetas) — bajan al final como contexto, no como foco.
5. **Mini-embudo** se elimina del Inicio (queda en Analítica → Embudo) para reducir duplicación.

### 3. Quick-add global en el header del CRM

Botón `+ Nuevo` con menú desplegable (`DropdownMenu`):
- Nuevo lead
- Nueva oportunidad
- Nueva actividad (abre dialog reusando `useCrearActividad` con selector de entidad)

Disponible desde cualquier sub-ruta de `/crm`.

### 4. Notificaciones a nivel global

Mover `CrmNotificacionesBell` del header de `CrmLayout` al header global de la app (`AppLayout` o equivalente). Sólo se monta si el rol tiene `canEditCrm`. Así las notificaciones de comentarios y vencidas llegan al vendedor esté donde esté.

### 5. Cerrar huecos en detalles

- **LeadDetalle**: agregar `<ActividadTimeline entidadTipo="lead" entidadId={lead.id} />` debajo de Lineage. Permite ver y crear actividades sobre el lead.
- **OportunidadDetalle**: agregar `<ContactActions>` con `PlantillaSelector` en el card de "Datos comerciales" (resuelve email/teléfono desde `cliente_id` → `clientes` → contacto principal). Variables de plantilla: `contacto`, `empresa`, `vendedor`, `etapa`, `monto`.
- **OportunidadDetalle**: reorganizar en **tabs internas**: 
  - `Resumen` (KPIs + Datos comerciales + Cotizaciones)
  - `Comunicación` (Contacto rápido + Comentarios + Timeline de actividades)
  - `Trazabilidad` (Lineage)

### 6. "Próxima actividad" visible sin entrar al detalle

- Nuevo hook `useProximaActividadPorEntidad(entidades: {tipo, id}[])` que en una sola query trae la actividad pendiente más próxima por entidad.
- En cards Kanban de `OportunidadKanban`: línea inferior con `📅 Llamar mañana 10:00` o `⚠ Sin próxima acción` (link para crear).
- En tabla de Leads: nueva columna "Próxima" con la misma info.

### 7. Empty states accionables

Pantallas: Leads (vacío), Oportunidades (vacío), Actividades (vacío), Cliente360Panel sin oportunidades, OportunidadCotizacionesList vacía. Pasar de `"Sin datos"` a card con icono + CTA primario ("Crear primer lead" / "Importar CSV" / "Nueva oportunidad").

### 8. Versionado y changelog

- `APP_VERSION` → `11.7.0`.
- Entrada en `changelog/v8/chunks/0.ts` + `changelogData.ts`.

## Fuera de alcance (no tocar)

- Lógica de RLS / triggers (Sprint D ya los dejó cerrados).
- Migraciones nuevas (todo es UI/UX sobre datos existentes).
- Sprint F (Integraciones — Webhooks, OAuth Outlook/Gmail, Calendario): sigue pendiente como acordamos.
- Refactor del Kanban DnD.

## Detalles técnicos

- **Archivos nuevos**:
  - `src/pages/crm/Analitica.tsx` (sustituye Forecast + Reportes).
  - `src/components/crm/QuickAddMenu.tsx` (botón + menú).
  - `src/components/crm/NuevaActividadDialog.tsx` (dialog reusable con selector de entidad).
  - `src/hooks/crm/useProximasActividades.ts` (batch lookup).
  - `src/components/shared/EmptyState.tsx` (si no existe ya — comprobar antes de crear).

- **Archivos editados**:
  - `src/pages/crm/CrmLayout.tsx` — tabs reducidos a 5 + QuickAdd + Configuración separada.
  - `src/pages/crm/CrmDashboard.tsx` → renombrar visualmente a "Inicio", reordenar.
  - `src/pages/crm/OportunidadDetalle.tsx` — tabs internas + ContactActions.
  - `src/pages/crm/LeadDetalle.tsx` — añadir ActividadTimeline.
  - `src/components/crm/OportunidadKanban.tsx` — pintar próxima actividad.
  - `src/pages/crm/Leads.tsx` — columna "Próxima".
  - `src/App.tsx` — rutas: `/crm/analitica`, redirects legacy de `/crm/forecast` y `/crm/reportes`.
  - Header global (a localizar — probable `AppLayout` o `AppShell`) para mover el `CrmNotificacionesBell`.

- **Reglas Power of 10**: componentes ≤200 líneas, `select` explícito en hooks, sin `any`, cleanup en effects que abran canales.

- **Compatibilidad**: ningún componente fuera del CRM se ve afectado salvo el header global (sólo se agrega el bell).

## Resultado esperado

Vendedor abre Lovable → ve campanita global con pendientes → entra a CRM → "Inicio" le dice qué hacer hoy → un click en quick-add para crear lead/oportunidad/actividad → cada oportunidad tiene su "próxima acción" visible → al abrir una oportunidad puede escribirle al contacto sin salir → comentarios y actividades en tabs limpios. Menos pestañas, menos scroll, menos clics.

¿Procedo con Sprint G?

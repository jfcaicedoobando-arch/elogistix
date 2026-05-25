# Plan: Segunda ola de reducción de fricción CRM

La v11.49.0 limpió el chrome (header, dashboard, tabs). Esta ola ataca la fricción que queda **dentro de los flujos** (crear, mover, cerrar, dar seguimiento). Objetivo: que un vendedor cierre el día sin abrir un solo modal innecesario.

## Diagnóstico restante

1. **Crear Lead/Oportunidad/Actividad** sigue siendo un modal de 8–12 campos. La mayoría se llena con 2 datos (nombre + teléfono / título + cliente).
2. **Mover etapa** en Kanban abre modal de confirmación incluso cuando no hay cambios de estado críticos.
3. **Completar actividad** abre diálogo con notas obligatorias — debería ser un check inline.
4. **Detalle de oportunidad** tiene 5 tabs (Resumen, Cotizaciones, Actividades, Notas, Historial) — Notas e Historial casi nunca se usan; Resumen duplica datos del header.
5. **Detalle de lead** pide convertir a oportunidad en pantalla aparte, perdiendo contexto.
6. **No hay vista "Mi día"**: el vendedor entra al dashboard pero tiene que saltar entre Actividades, NBA y Leads para saber qué hacer.
7. **Búsqueda**: no hay forma rápida de saltar a un lead/oportunidad por nombre desde el CRM (Ctrl+K global existe pero no prioriza entidades CRM cuando estás en /crm).
8. **Toasts ruidosos**: cada cambio de estado/etapa dispara toast verde — satura.

## Cambios propuestos

### 1. Quick-create de 2 campos
- `QuickAddMenu` abre **popover inline** (no Dialog) con solo:
  - Lead: Nombre + Teléfono/Email
  - Oportunidad: Título + Cliente
  - Actividad: Título + Fecha (default hoy 17:00)
- Botón "Más campos →" abre el dialog completo solo si se necesita.
- Reduce creación de ~20s a ~3s.

### 2. Kanban sin fricción
- Drag & drop entre etapas: **sin modal**, optimistic update + toast con "Deshacer" (5s).
- Modal de confirmación solo al mover a **Ganada** (pide cotización ganadora) o **Perdida** (pide motivo).

### 3. Actividades inline
- Checkbox en lista/dashboard completa la actividad directo (sin pedir notas).
- Si el usuario quiere agregar nota, click en la fila abre panel lateral (`Sheet`), no modal full-screen.
- Reprogramar con menú contextual rápido: "Mañana", "En 3 días", "Próx. semana".

### 4. Tabs de OportunidadDetalle: 5 → 3
- **Resumen + Notas + Historial** → unificados en una sola columna scrolleable "Resumen".
- Quedan: **Resumen** | **Cotizaciones** | **Actividades**.
- Header conserva banner ganada/perdida.

### 5. Convertir Lead → Oportunidad inline
- Botón "Convertir" en `LeadDetalle` abre `Sheet` con campos mínimos (cliente, valor estimado, etapa inicial). No navega fuera.
- Al guardar: cierra sheet, navega a oportunidad nueva.

### 6. Vista "Mi día" como pestaña inicial
- Nueva ruta `/crm/mi-dia` (default landing si el usuario tiene rol vendedor).
- 3 secciones colapsables:
  1. **Hoy** (actividades del día + NBA top 3)
  2. **Esta semana** (oportunidades cerrando ≤7d + cotizaciones sin respuesta)
  3. **Pipeline** (mini stat strip)
- Dashboard actual se renombra a "Resumen" (para admins/supervisores).

### 7. Búsqueda contextual CRM
- `Cmd/Ctrl+P` dentro de /crm abre `Command` palette que busca **solo entidades CRM** (leads, oportunidades, actividades, cotizaciones vinculadas). Más rápido que el global.

### 8. Toasts silenciados
- Cambios inline (estado lead, completar actividad, mover etapa) → toast minimalista bottom-right con auto-dismiss 2s + acción "Deshacer".
- Eliminar toasts de éxito redundantes en operaciones que ya muestran feedback visual (badge cambia, fila se tacha, etc.).

## Archivos

### Nuevos
- `src/components/crm/quickCreate/QuickCreateLeadPopover.tsx`
- `src/components/crm/quickCreate/QuickCreateOportunidadPopover.tsx`
- `src/components/crm/quickCreate/QuickCreateActividadPopover.tsx`
- `src/components/crm/actividades/ActividadQuickReschedule.tsx`
- `src/components/crm/actividades/ActividadSidePanel.tsx` (Sheet)
- `src/components/crm/leadDetalle/ConvertirLeadSheet.tsx`
- `src/components/crm/CrmCommandPalette.tsx`
- `src/pages/crm/MiDia.tsx`
- `src/hooks/crm/useUndoToast.ts`
- `src/hooks/crm/useCrmSearch.ts`

### Modificados
- `QuickAddMenu.tsx` → invoca popovers en lugar de dialogs
- `OportunidadKanban.tsx` / `useMoverEtapa.ts` → optimistic + undo, modal solo en Ganada/Perdida
- `OportunidadDetalleContent.tsx` → 3 tabs, mergea Resumen+Notas+Historial
- `LeadDetalle.tsx` → botón convertir abre Sheet
- `CrmLayout.tsx` → agrega tab "Mi día", reordena, registra `Cmd+P`
- `useCrmHotkeys.ts` → agrega `Cmd+P`, atajos de reprogramar (`T`, `3`, `W`)
- `Actividades.tsx` / columnas → checkbox inline + menú reprogramar
- `appVersion.ts` → `11.50.0`
- `CHANGELOG.md`

### Sin tocar
- Lógica de scoring NBA, triggers Supabase, RLS, permisos, estructura de cotizaciones/embarques.

## Detalles técnicos

- **Optimistic updates**: usar `queryClient.setQueryData` antes del `mutate`, rollback en `onError`. Patrón ya usado en `useActualizarLead`.
- **Undo**: `useUndoToast` guarda snapshot pre-cambio en ref, sonner toast con action button que dispara mutación inversa antes de invalidate.
- **Cmd+P**: listener en `CrmLayout`, abre `<Command>` shadcn con `useCrmSearch` (debounced 200ms, `.or()` query sobre leads + oportunidades + actividades, limit 8 c/u).
- **Mi día default**: en `CrmLayout`, si `pathname === '/crm'` y rol == vendedor → redirect a `/crm/mi-dia`. Admins van a `/crm/inicio` (resumen).
- **Power of 10**: cada componente nuevo ≤200 líneas, sin `any`, cleanup en effects de listeners de teclado.

## Fuera de alcance
- Cambios de schema, nuevos campos forwarder-specific, permisos, integraciones email/calendar, automatizaciones de workflow.

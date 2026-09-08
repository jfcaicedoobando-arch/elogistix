# Plan: Renombrar "Fuente" a "Origen" y reducir opciones en CRM

## Objetivo
En el módulo CRM cambiar el campo "Fuente" a "Origen" y dejar únicamente tres opciones en sus dropdowns: **Prospección**, **Finkargo** y **Referido**. Migrar los leads históricos a esos valores y actualizar toda la UI, CSV, filtros, exportación y tests.

## Alcance confirmado
- Renombre aplica en todo el módulo CRM: formulario de alta, ficha de lead, filtros, tabla, exportación CSV.
- Se migran datos históricos; no se eliminan los valores viejos del enum de PostgreSQL, solo se agregan los dos nuevos y se actualizan las filas.
- Nombres exactos de opciones: Prospección, Finkargo, Referido.

## Decisión pendiente: mapeo de fuentes históricas
Propuesta por omisión. Confirmar antes de ejecutar:

```text
Web            → Prospección
Campaña        → Prospección
Llamada en frío → Prospección
Evento         → Referido
Otro           → Prospección
Referido       → Referido
Finkargo       → Finkargo (nuevo)
```

## Pasos

### 1. Base de datos
1.1. **Migración de esquema**: agregar `Prospección` y `Finkargo` al enum `public.crm_lead_fuente` (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`). No tocar `Referido` porque ya existe. No eliminar valores viejos del enum para no romper datos/demo existentes.

1.2. **Actualización de datos**: vía `run_sql`, aplicar el mapeo confirmado en `public.crm_leads.fuente` para todas las organizaciones.

### 2. Frontend — catálogo y defaults
2.1. Actualizar `src/features/crm/domain/leads/constants.ts`:
   - `LEAD_FUENTES` = `["Prospección", "Finkargo", "Referido"]`.

2.2. Cambiar defaults de `"Otro"` a `"Prospección"` en:
   - `src/features/crm/components/NuevoLeadDialog.tsx` (`EMPTY`).
   - `src/types/crm/leadEditForm.ts` (`EMPTY_LEAD_EDIT_FORM`).
   - `src/features/crm/domain/leads/leadPayload.ts` (default del payload).
   - `src/features/crm/domain/leads/quickCreateInput.ts` (alta rápida).

### 3. Frontend — labels "Fuente" → "Origen"
3.1. Reemplazar labels y textos visibles:
   - `NuevoLeadForm.tsx`: `<Label>Fuente</Label>` → `<Label>Origen</Label>`.
   - `LeadDatosCard.tsx`: mismo label.
   - `LeadsFiltrosPrimarios.tsx`: `"Todas las fuentes"` → `"Todos los orígenes"`.
   - `Leads.tsx`: `filterLabels.fuente` de `"Fuente"` a `"Origen"`.
   - `leadsColumns.tsx`: header de columna `"Fuente"` → `"Origen"`.
   - `crmCsvExport.ts`: header `"Fuente"` → `"Origen"`.

### 4. Frontend — importación CSV
4.1. Actualizar `src/lib/csv/leadsCsv.ts`:
   - Mantener alias `fuente`/`source`.
   - Mapear valores legacy (`Web`, `Campaña`, `Llamada en frío`, `Evento`, `Otro`) a los nuevos valores.
   - Valor desconocido → `"Prospección"` (o `"Referido"` si el equipo define otra regla).

### 5. Tests y fixtures
5.1. Ajustar tests que mockean o asumen `LEAD_FUENTES`/`"Otro"`/`"Web"`:
   - `src/features/crm/components/__tests__/altasExpressBorrador.test.tsx`
   - `src/features/crm/components/__tests__/NuevoLeadDialog.emailValidacion.test.tsx`
   - `src/features/crm/components/__tests__/NuevoLeadDialog.cancelReset.test.tsx`
   - `src/features/crm/components/__tests__/ImportarLeadsCsvDialog.cancelReset.test.tsx`
   - `src/features/crm/domain/__tests__/leadEditDirty.test.ts`
   - `src/features/crm/domain/__tests__/forecast.test.ts`
   - `src/features/crm/services/leads/__tests__/queries.test.ts`
   - `src/features/crm/services/leads/__tests__/listLeads.test.ts`
   - `src/features/crm/services/leads/__tests__/bulk.test.ts`
   - `src/features/crm/services/__tests__/crmCsvExport.test.ts`
   - `src/features/crm/hooks/__tests__/useLeadEditForm.test.tsx`
   - `src/features/crm/hooks/__tests__/useLeadEditForm.gate.test.tsx`
   - `src/features/crm/domain/leads/__tests__/editForm.test.ts`
   - `src/features/crm/services/leads/__tests__/correoCanonico.test.tsx`

5.2. Actualizar fixtures de prueba que usen `"Web"`/`"Otro"` a `"Prospección"` o `"Referido"` según corresponda.

### 6. Tipos de Supabase
6.1. Regenerar `src/integrations/supabase/types.ts` para reflejar los nuevos valores del enum.

### 7. Versionado y changelog
7.1. Bump de `APP_VERSION` y entrada en `CHANGELOG.md` siguiendo el formato del proyecto.

### 8. Validación focalizada (local/Lovable)
8.1. Typecheck (`bunx tsgo --noEmit -p tsconfig.app.json`).
8.2. ESLint sobre archivos CRM modificados y tests.
8.3. Build local.

No se ejecutarán CI/RLS/Vitest/E2E completos en Lovable; esos corren en GitHub Actions.

## Riesgos mitigados
- No se eliminan valores viejos del enum para evitar ruptura de seeds/demo y migraciones históricas.
- El mapeo de datos se aplica con `run_sql` separado de la migración de esquema.
- Los valores viejos quedan inaccesibles para nuevas capturas porque el frontend solo renderiza los 3 nuevos.

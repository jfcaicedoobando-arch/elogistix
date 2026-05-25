
# Sprint B — CRM 11.4.0

5 mejoras enfocadas en eficiencia operativa, sin cambios de schema.

## 1. Configuración del pipeline (`/crm/configuracion`)

- Nueva pestaña "Configuración" en `CrmLayout` (sólo `canEditCrm`).
- Nueva página `src/pages/crm/Configuracion.tsx` con dos secciones en cards:
  - **Etapas del pipeline**: tabla editable de `crm_etapas_pipeline` con columnas Nombre, Tipo (abierta/ganada/perdida), % por defecto, Color, Orden (botones ↑/↓), Activa (switch). Edición inline + guardar por fila usando `useActualizarEtapa` ya existente.
  - **Motivos de pérdida**: lista simple de `crm_motivos_perdida` con activar/desactivar.
- Nueva ruta `/crm/configuracion` en `App.tsx`.

## 2. Filtros avanzados en Oportunidades

En `src/pages/crm/Oportunidades.tsx` agregar barra de filtros sobre la búsqueda actual:
- Etapa (Select alimentado por `useEtapasPipeline`, opción "Todas").
- Vendedor (Select alimentado por hook ligero `useVendedoresCrm` que ya existe o se reutiliza el de `VendedorSelect`).
- Rango de cierre estimado (date pickers desde/hasta) → filtro cliente sobre los 500 ya cargados (no hace falta tocar el hook).
- Monto mínimo (input numérico) → filtro cliente.
- Botón "Limpiar".

Filtros aplicados afectan tanto la vista Kanban como la Tabla. El header sigue mostrando el conteo y pipeline filtrado.

## 3. Selección múltiple + acciones en Leads

En `src/pages/crm/Leads.tsx`:
- Checkbox por fila + checkbox "Seleccionar todos" en header (`DataTable` ya soporta `selection` si existe; si no, manejar estado local con `Set<string>` y columna custom).
- Barra contextual (aparece al haber selección) con:
  - **Cambiar estado** (Select con `LEAD_ESTADOS`).
  - **Asignar vendedor** (reuso `VendedorSelect`).
  - **Eliminar** (doble confirmación).
- Nuevo hook `useActualizarLeadsBulk` (update por `.in("id", ids)`) y `useEliminarLeadsBulk` (soft-delete por `.in("id", ids)`).

## 4. Datos accionables

En `LeadDetalle` y nuevo bloque en `OportunidadDetalle`:
- Email → `<a href="mailto:">` con icono Mail y botón Copiar (clipboard).
- Teléfono → `<a href="tel:">` con icono Phone, formato visual, botón Copiar.
- Cualquier campo vacío muestra "—" sin link.

## 5. Import CSV de Leads

- Botón "Importar CSV" en header de `/crm/leads` (sólo `canEditCrm`).
- Nuevo dialog `ImportarLeadsCsvDialog`:
  - Drop-zone para `.csv` UTF-8 (parseo en cliente, sin nuevas deps si ya está `papaparse`; si no, parseador simple por split — confirmar al implementar).
  - Mapeo automático por nombre de columna (case-insensitive): `empresa, contacto, email, telefono, ciudad, pais, fuente, estado, score, notas`.
  - Preview de primeras 10 filas + validaciones (empresa obligatoria; fuente/estado deben pertenecer a los enums, si no → "Otro"/"Nuevo").
  - Insert por batches de 100 vía `useCrearLeadsBulk` (`supabase.from("crm_leads").insert([...])`).
  - Toast final con `{insertados, errores}` y refresh de la lista.

## Versionado y changelog

- Bump `APP_VERSION` a `11.4.0`.
- Entrada nueva en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.

## Detalles técnicos

- Sin migraciones. Todo se resuelve con políticas RLS existentes (insert/update sobre `crm_leads` y `crm_etapas_pipeline` ya las usa la UI actual).
- Componentes nuevos ≤200 líneas (se extraen `EtapasPipelineEditor`, `MotivosPerdidaEditor`, `LeadsBulkBar`, `OportunidadesFiltersBar`, `ContactActions`).
- Sin `any`, manejo de `error` de Supabase, `e.stopPropagation()` en acciones dentro de filas.
- Para CSV: usar `papaparse` si ya está; si no, agregarlo (`bun add papaparse`).

¿Procedo?

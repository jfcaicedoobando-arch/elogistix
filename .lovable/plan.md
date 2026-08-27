# Fase 2 del rediseño CRM: toda oportunidad nace de un Prospecto o de un Cliente

Hoy el formulario de "Nueva oportunidad" sólo deja elegir **Cliente** (o "Sin cliente"), aunque la base de datos ya exige un origen (`LC_OPORTUNIDAD_SIN_ORIGEN`: `lead_id` o `cliente_id`). Resultado: desde el CRM no se puede crear una oportunidad para un prospecto, y "Sin cliente" produce un error crudo al guardar.

## Qué se va a construir

### 1. Selector de origen en el alta de oportunidad
En el diálogo de oportunidad, arriba de todo, un selector de origen con dos opciones obligatorias:

- **Prospecto** — busca entre los leads calificados (etapas Calificado, Prospecto, Pendiente de alta).
- **Cliente actual** — busca en el directorio de clientes ya dados de alta.

Se elimina la opción "Sin cliente": ya no se puede guardar una oportunidad huérfana. Al elegir prospecto se prellena el nombre sugerido de la oportunidad (empresa + ruta) y el vendedor asignado al prospecto.

En modo edición el origen se muestra como dato de sólo lectura (cambiar el origen de una oportunidad viva rompe la trazabilidad del embudo).

### 2. Botón "Nueva oportunidad" desde la ficha del prospecto
En la ficha del lead, cuando ya es prospecto, aparece el botón **Nueva oportunidad**, que abre el diálogo con el origen prefijado en ese prospecto. También se agrega el botón en la lista `/crm/prospectos` (acción por fila).

### 3. Panel de oportunidades del prospecto
En la ficha del prospecto, una tarjeta con sus oportunidades (nombre, etapa, monto, fecha estimada) para ver de un golpe cuántos negocios están en el aire con ese prospecto.

### 4. Endurecimiento en base de datos
El guard de origen se refuerza: si la oportunidad viene de un lead, ese lead debe estar calificado (etapas de prospecto). Un lead "Nuevo"/"Contactado"/"Descalificado" no puede tener oportunidades — error `LC_OPORTUNIDAD_ORIGEN_NO_CALIFICADO`. También se valida que lead y cliente pertenezcan a la misma organización.

### 5. Mensajes claros
Los errores del guard se traducen en la interfaz a texto entendible ("La oportunidad necesita un prospecto calificado o un cliente del directorio") en lugar del código interno.

## Detalles técnicos

- `src/features/crm/domain/oportunidadFormState.ts`: agregar `origen_tipo: "prospecto" | "cliente"`, `lead_id`, `lead_nombre`.
- `src/features/crm/domain/oportunidadFormPayload.ts`: enviar `lead_id`; validar origen en `validarOportunidadForm`.
- Nuevo `src/features/crm/components/nuevaOportunidad/SelectorOrigenOportunidad.tsx` (combobox con búsqueda; reutiliza `listLeads` con `estadoIn: LEAD_ESTADOS_ETAPA_PROSPECTO` y `useClientesForSelect`).
- Nuevo hook `useProspectosForSelect` en `src/features/crm/hooks` (paginado corto + búsqueda con debounce, siguiendo Power of 10).
- `NuevaOportunidadDialog.tsx`: nueva prop opcional `origenInicial` para el prefijo desde la ficha del prospecto; se mantiene ≤200 LOC delegando en el nuevo selector.
- Ficha de lead (`leadDetalle`): botón nuevo en `LeadHeaderActions.tsx` + tarjeta `OportunidadesDelProspecto.tsx` usando `listOportunidades` filtrado por `lead_id`.
- Migración: reemplazar `public._crm_oportunidad_requiere_origen()` por una versión que valide etapa del lead y consistencia de `organization_id`; sincronizar `supabase/schema/baseline.sql` y el manifiesto de migraciones.
- Catálogo de errores: agregar `LC_OPORTUNIDAD_ORIGEN_NO_CALIFICADO` al mapeo de mensajes del CRM.
- Tests: payload/validación del origen, selector (render y cambio de tipo), y guard vía suite de RLS/triggers.
- `CHANGELOG.md` + `APP_VERSION` → `13.767.0`.

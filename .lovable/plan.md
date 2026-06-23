## Problema

En el portal del agente, el modal "Nueva tarifa (queda en borrador)" tiene 3 fallos:

1. **Agente vacío**: El Select de agente está bloqueado pero no muestra el nombre. Causa: el form usa `useCosteoAgentes()` que depende de `useOrganization()`, y el usuario agente no tiene esa organización en contexto → la lista llega vacía → el `SelectValue` no encuentra label.
2. **Ruta no funciona**: Mismo problema con `useCosteoRutas()` — el dropdown se renderiza vacío.
3. **Flechitas (spinners) en "Días libres demoras"**: el `<Input type="number">` muestra los controles nativos del navegador.

## Cambios (sólo UI / capa de presentación)

### 1. `AgenteTarifaForm.tsx` — inyectar datos desde el contexto del agente
- Obtener `agenteNombre` y `organizationId` del `useAgenteContext()`.
- Llamar a los servicios `fetchCosteoRutas(orgId)` y `fetchNavieras()` / `fetchTiposContenedor()` ya existentes, vía `useQuery` propio del portal, usando la `organizationId` del agente (no la del `OrganizationContext`).
- Pasar `rutas`, `navieras`, `tipos` y `agenteNombre` como nuevos props opcionales a `TarifaForm`.

### 2. `TarifaForm.tsx` — aceptar overrides opcionales
Nuevos props opcionales (no rompen el uso actual desde operaciones):
- `rutasOverride?`, `navierasOverride?`, `tiposOverride?` — si vienen, se usan en lugar de los hooks internos.
- `agenteNombreFijo?: string` — cuando `agenteIdFijo` está presente, se renderiza un `<Input disabled>` con el nombre del agente en vez del `<Select>`.

### 3. `TarifaFormFields.tsx` — dos ajustes visuales
- En `EntidadesFields`, si llega `agenteNombreFijo`, reemplazar el Select por un Input readonly con el nombre (mantiene el `agente_id` ya seteado en el form).
- En `NumerosFields`, al Input de "Días libres demoras" agregar las clases de Tailwind que ocultan los spinners:
  ```
  [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
  ```
  (aplicar también al de "Tránsito (días)" y "Flete base" para consistencia visual).

### 4. Sin migración, sin cambios de lógica de negocio
RLS ya permite al agente leer `costeo_rutas`, `navieras` y `tipos_contenedor` de su organización vinculada (las consultas funcionan; sólo faltaba pasarles la `organizationId` correcta).

### 5. Versión + changelog
- `APP_VERSION` → `13.130.1` (patch UI).
- Entrada en `CHANGELOG.md` describiendo los 3 fixes.

## Fuera de alcance
- No se toca el flujo de aprobación ni la lógica de mutaciones.
- No se modifica el formulario para el editor de operaciones (`/costeo/tarifas`).

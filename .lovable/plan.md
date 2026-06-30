# Por qué no aparecen las tarifas del agente en /costeo/tarifas

**Diagnóstico (verificado en BD):**

Existen 5 tarifas en estado `borrador` que el usuario subió desde `/agente/tarifas`, pero quedaron guardadas con `organization_id = a1ddadc4…` (la organización **"Mi organización"**), cuando el agente "Chino El Agente" pertenece a **"Chino Cochino"** (`organization_id = beff6600…`).

Resultado: los operadores de "Chino Cochino" entran a `/costeo/tarifas` y no las ven porque las políticas de RLS filtran por su `organization_id`. Para ellos no existen.

**Analogía:** es como si el agente metiera sus tarifas en el buzón de la oficina equivocada. Llegan, sí, pero a una sucursal donde nadie las espera.

**Causa raíz:** En `AgenteTarifaForm.tsx`, el envío usa `useCosteoTarifaMutations`, que toma `organizationId` de `useOrganization()` (el contexto general del usuario). Para el usuario agente, ese contexto resuelve a una organización donde es miembro por `organization_members`, no a la organización del operador dueño del agente (que vive en `agente_users.organization_id` / `current_agente_org()`). La RPC `get_current_agente_context()` ya devuelve el `organizationId` correcto, pero el formulario no lo está usando al insertar.

---

## Cambios propuestos

### 1. Reparar los 5 registros existentes (migración `INSERT/UPDATE`)

Actualizar las tarifas mal asignadas para que su `organization_id` coincida con el de su `agente`:

```sql
UPDATE public.costeo_tarifas t
   SET organization_id = a.organization_id
  FROM public.costeo_agentes a
 WHERE a.id = t.agente_id
   AND t.organization_id <> a.organization_id;
```

Esto las hará visibles para "Chino Cochino" en `/costeo/tarifas` (filtro "Pendientes").

### 2. Forzar el `organization_id` correcto desde el portal

Refactor mínimo:

- Añadir un parámetro opcional `organizationIdOverride` a `useCosteoTarifaMutations` (en `src/features/costeo/hooks/useCosteoTarifas.ts`).
- Cuando se pasa, `crear` / `crearMultiples` / `actualizar` lo usan en lugar de `useOrganization().organizationId`.
- `AgenteTarifaForm.tsx` lee `ctx.organizationId` de `useAgenteContext()` y lo inyecta como override en el `TarifaForm`.
- `TarifaForm` recibe un prop opcional `organizationIdOverride` que pasa al hook de mutaciones.

Operaciones internas no se ven afectadas: si no se pasa override, el comportamiento actual se mantiene.

### 3. Defensa en profundidad (migración SQL)

Trigger `BEFORE INSERT OR UPDATE` en `public.costeo_tarifas` que, si `organization_id` no coincide con el del `costeo_agentes` referenciado, lo corrige automáticamente (o lanza error). Esto blinda futuras inserciones aunque alguien olvide pasar el override.

```text
trigger: costeo_tarifas_match_agente_org
  BEFORE INSERT OR UPDATE
  → NEW.organization_id := (SELECT organization_id FROM costeo_agentes WHERE id = NEW.agente_id)
```

### 4. Verificación

- Recargar `/costeo/tarifas` logueado como operador de "Chino Cochino": deben aparecer las 5 tarifas en el filtro **Pendientes** con badge "Borrador".
- Probar subir una nueva tarifa desde `/agente/tarifas`: debe quedar con `organization_id = beff6600…` (el del agente), no con la del usuario agente.
- Aprobar una con el botón ✓: pasa a `vigente` y se hace visible en cotizaciones.

---

## Archivos a tocar

- **Migración SQL #1**: corrige los 5 registros existentes.
- **Migración SQL #2**: agrega trigger `costeo_tarifas_match_agente_org`.
- `src/features/costeo/hooks/useCosteoTarifas.ts`: aceptar `organizationIdOverride` opcional.
- `src/features/costeo/components/TarifaForm.tsx`: prop opcional + propagación al hook.
- `src/features/costeo/components/TarifaFormUbicaciones.tsx` / wrappers: ningún cambio funcional.
- `src/features/portal-agente/components/AgenteTarifaForm.tsx`: pasar `organizationIdOverride={ctx.organizationId}`.
- `CHANGELOG.md` + `src/constants/appVersion.ts`: bump de versión.

## Out of scope (lo dejo para después si lo quieres)

- Email al agente cuando aprueban/rechazan (hoy sólo notificación in-app).
- Bandeja dedicada de aprobaciones con comentarios y diff.

## Diagnóstico

El timeline de Bitácora (`FilaEntrada`) construye el hyperlink así:

```ts
const linkEntidad = rutaModulo && entrada.entidad_id ? `${rutaModulo}/${entrada.entidad_id}` : undefined;
```

Si no hay `entidad_id`, renderiza el nombre como `<span>` sin link. Confirmado con consulta directa a `bitacora_actividad`:

- **149 registros** `modulo='embarques' accion='crear'` con `entidad_id = NULL` pero `entidad_nombre` con el expediente (ej. `ELIMP00275`).
- Otros módulos no tienen este problema en datos reales (sólo `auth.login`, que no necesita link).

**Causa raíz** — `src/features/embarques/hooks/useEmbarqueSubmitOrchestrator.ts` línea 147-159: tras crear el embarque, la llamada a `registrarActividad.mutate({...})` omite `entidad_id`, aunque el id (`embarqueCreadoId`) ya está disponible en scope desde la Fase 3.

## Cambios

### 1. Fix forward (`useEmbarqueSubmitOrchestrator.ts`)
Incluir `entidad_id: embarqueCreadoId ?? undefined` en el payload de bitácora de creación. Sin tocar otras fases.

### 2. Backfill de registros legacy (migración SQL)
Actualizar los 149 registros existentes uniendo por `entidad_nombre = embarques.expediente` dentro de la misma organización:

```sql
UPDATE public.bitacora_actividad ba
SET entidad_id = e.id
FROM public.embarques e
WHERE ba.modulo = 'embarques'
  AND ba.entidad_id IS NULL
  AND ba.entidad_nombre IS NOT NULL
  AND e.expediente = ba.entidad_nombre
  AND e.organization_id = ba.organization_id;
```

Migración idempotente (sólo afecta filas NULL).

### 3. Sin cambios en la UI
`FilaEntrada` ya muestra el link correctamente cuando `entidad_id` existe — no requiere modificación.

### 4. Changelog + bump `APP_VERSION` (`13.66.18`)

## Verificación

- Crear un embarque nuevo desde la app y confirmar que la entrada en `/bitacora` aparece como link clickeable hacia `/embarques/<id>`.
- Re-consultar `bitacora_actividad` para validar que las filas legacy quedaron con `entidad_id` poblado.

## Fuera de alcance

- No se rediseña la fila de bitácora.
- No se tocan otros módulos (no presentan el bug en datos reales).
- No se modifica `fetchBitacoraEmbarque`; el OR por `entidad_nombre` deja de ser necesario tras el backfill pero se mantiene como defensa.

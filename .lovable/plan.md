
# Continuación — cierre Fase 4b + Fase 5 (`12.16.9`)

Quedan los ítems mecánicos diferidos y la limpieza estética. Sin tocar lógica de negocio.

---

## Bloque A — Migraciones mecánicas restantes (Fase 4b)

1. **Aplicar `FILTER_ALL`** en los ~15 call sites que aún usan el literal `'todos'` (filtros de Embarques, Facturación, Portal, Cotizaciones, Admin). Conserva el valor exacto → no rompe URLs serializadas.
2. **`CARRIER_TRACKING_URLS`** → nuevo `src/constants/carriers.ts`. Mover las 10 URLs hardcoded desde `services/.../externalTracking.ts` y consumir el mapa.
3. **Aplicar `uniqueSorted`** en los 6 call sites pendientes (admin/facturación/portal/auditoría) que aún hacen `Array.from(new Set(...)).filter(Boolean).sort()`.

## Bloque B — Limpieza estética (Fase 5)

4. **Renombres PascalCase** restantes:
   - `cotizacion/columnsParts/accionesCell.tsx` → `AccionesCell.tsx`
   - `cotizacion/columnsParts/estadoVigenciaCell.tsx` → `EstadoVigenciaCell.tsx`
   - Actualizar imports en `cotizacionesColumns.tsx`.
5. **Borrar código muerto:**
   - Import comentado en `src/integrations/supabase/client.ts:9`
   - Section headers vacíos en `useTabProformasController.ts:55-67`
   - Bloques `(legacy)` en `pdf/theme/stylesContent.ts` (verificar 0 referencias antes de borrar)

## Fuera de alcance (confirmado)

- God-component controllers (`Papelera`, `Portal*`, `Clientes`) — diferidos por riesgo medio; se abordarán en pase dedicado.
- `supabase/types.ts` (autogenerado).
- `sidebar.tsx` (shadcn vendored).

## Entregables

- Bump `APP_VERSION` → **`12.16.9`**
- Entrada en `CHANGELOG.md` con bullets de A y B
- `bun run lint` limpio y `bunx vitest run` 781/781 verde

```text
Bloque A (mecánico, bajo riesgo) → Bloque B (cosmético) → verificación
```

## Detalles técnicos

- `FILTER_ALL`: import `import { FILTER_ALL } from "@/constants/filters"`. Reemplazar tanto en defaults de state como en comparaciones (`=== 'todos'` → `=== FILTER_ALL`). Mantener serialización a URL idéntica.
- `CARRIER_TRACKING_URLS`: tipo `Record<string, string>` con keys normalizadas (lowercase). El lookup en `externalTracking.ts` queda como `CARRIER_TRACKING_URLS[carrier.toLowerCase()]`.
- Renombres PascalCase: usar dos pasos (case-insensitive FS safety): rename a `_tmp` y luego al destino, o `git mv` case-sensitive si está disponible vía el tooling de edición.

## Decisión pendiente

¿Aplico **todo el plan en un solo turno** (Bloques A + B juntos) o prefieres **solo Bloque A** y dejar el B para otro pase?

## Problema

En `/auditoria`, la tarjeta **"Tiempo medio de resolución"** siempre muestra **"Sin datos"** aunque hay 355 hallazgos marcados como *revisado*.

La causa: el cálculo actual exige que la revisión tenga **ambos** `asignado_at` y `revisado_at`. En la BD sólo 1 de 357 revisiones tiene `asignado_at` — en la práctica los operadores marcan directamente el hallazgo como *revisado* sin pasar por un paso explícito de asignación, así que el promedio nunca acumula muestras.

## Solución

Usar la fecha en que **apareció** el hallazgo (`asignado_at ?? created_at`) como punto de partida del MTTR. Esto refleja mejor la métrica real de negocio: *"cuánto tarda el equipo desde que la auditoría detecta un problema hasta que lo marca como revisado"*, y funciona con el flujo actual donde la asignación explícita es opcional.

### Cambios

1. **`src/features/auditoria/domain/ejecutivoRanking.ts`**
   - En `procesarRevisionEnOperador`, usar `r.asignado_at ?? r.created_at` como fecha de inicio para `diffHoras(...)`.
   - Mantener el filtro sanidad `horas >= 0 && horas < 24 * 90` (descarta outliers > 90 días).

2. **`src/features/auditoria/components/AuditoriaOperadoresCard.tsx`**
   - Actualizar el subtítulo de la tarjeta de *"Desde asignación hasta marca de revisado"* a **"Desde detección hasta marca de revisado"** para reflejar la nueva semántica.

3. **Tests**
   - Ajustar `ejecutivoRanking.test.ts` y `ejecutivoAgregados.test.ts` para cubrir el nuevo fallback (revisiones sin `asignado_at` pero con `created_at` sí cuentan para MTTR).
   - Verificar que el test existente "usa revisado_at para MTTR" siga verde con la nueva prioridad `asignado_at ?? created_at`.

4. **`CHANGELOG.md` + `APP_VERSION`** → bump a `13.299.20`.

## Detalles técnicos

El tipo `AuditoriaRevision` ya incluye `created_at` (columna existente en `auditoria_revisiones`), así que no se requiere migración de BD ni cambios en tipos generados. Es un cambio puramente de lógica de agregado + copy.

## Analogía para el usuario

Es como medir cuánto tarda un mesero en atender una mesa: hoy sólo contamos las mesas donde alguien anotó explícitamente *"asignada a Juan a las 8:00"*, pero casi nadie lo apunta. Cambiamos la referencia al momento en que **entró el cliente** (la detección del hallazgo), que sí siempre queda registrado. Así la métrica deja de estar vacía y refleja la operación real.

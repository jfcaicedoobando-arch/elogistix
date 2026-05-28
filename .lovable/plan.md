## Plan: Reconciliación de embarques huérfanos (v12.13.1, hotfix)

### Objetivo
Restaurar los datos mínimos visibles en 12 embarques marítimos que quedaron incompletos. **No** son una regresión de Fase 5; vienen de conversiones cotización→embarque previas al fix 12.10.0 + el seed automático de `embarque_contenedores` de Fase A.

### Alcance (estrictamente acotado)
- 12 embarques con `contenedor` vacío.
- 4 embarques con `bl_master` vacío (subconjunto del anterior + algún caso aéreo).
- Embarques con `conceptos_venta` ausentes pero con `cotizacion_id` que sí tiene `conceptos_venta` jsonb.
- Hijos de `embarque_contenedores` con `numero_contenedor=''` sembrados por la migración Fase A.

### Pasos

**1. Auditoría detallada (read-only)**
Script `scripts/audit-embarques-huerfanos.ts` que reporte por embarque:
- `id`, `expediente`, `cliente_nombre`
- Campos vacíos en `embarques`: `bl_master`, `contenedor`, `tipo_contenedor`, `puerto_origen`, `puerto_destino`, `naviera`
- Conteo de hijos `embarque_contenedores` reales vs vacíos
- ¿Tiene `cotizacion_id`? ¿La cotización origen tiene datos útiles (`tipo_contenedor`, `origen`, `destino`, `conceptos_venta`)?
- ¿Tiene `conceptos_venta` cargados? ¿La cotización origen los tiene?

Output: tabla Markdown a `/mnt/documents/embarques-huerfanos-report.md`.

**2. Reconciliación automática (script `scripts/reconciliar-embarques-huerfanos.ts`)**
Para cada embarque huérfano, sólo aplica acciones **seguras y reversibles**:

| Acción | Condición | Resultado |
|---|---|---|
| Backfill `tipo_contenedor` y `tipo_carga` del padre | embarque.tipo_contenedor IS NULL AND cotizacion.tipo_contenedor IS NOT NULL | UPDATE embarques |
| Backfill `tipo_contenedor` del hijo orphan | hijo.tipo_contenedor='' AND cotizacion.tipo_contenedor IS NOT NULL | UPDATE embarque_contenedores |
| Backfill `puerto_origen`/`destino` del padre | son NULL AND cotización tiene `origen`/`destino` | UPDATE embarques |
| Insertar `conceptos_venta` faltantes | conceptos_venta=[] AND cotizacion.conceptos_venta jsonb tiene N>0 | INSERT bulk en `conceptos_venta` (mismas reglas que `convertirCotizacionAEmbarques`) |
| Soft-delete hijo vacío | hijo.numero_contenedor='' AND hijo.tipo_contenedor='' AND NO se pudo backfillar tipo del cotización | UPDATE embarque_contenedores SET deleted_at=now() |

**Nunca** se inventa `bl_master` ni `numero_contenedor` (datos que sólo el operador conoce). Esos quedan vacíos y el reporte los marca como "requiere captura manual".

**3. Verificación post-reconciliación**
- Re-correr el script de auditoría → confirmar que los embarques que sí tenían fuente quedaron completos.
- Validar embarque ELIMP00231 en preview: BL Master sigue vacío (no había fuente) PERO el hijo orphan ya está soft-deleted y los conceptos_venta aparecen si la cotización los tiene.
- Subir reporte final a `/mnt/documents/`.

**4. Hardening preventivo (1 cambio mínimo de código)**
En `convertirCotizacionAEmbarques` (ya parchado en 12.10.0), añadir **assertion defensiva**: si la cotización no tiene `tipo_contenedor` o `conceptos_venta` poblados, **no** sembrar un hijo vacío en `embarque_contenedores` — dejar el embarque sin hijos hasta que el operador capture el contenedor en el wizard. Esto evita que se vuelvan a generar huérfanos en futuras conversiones.

**5. Documentación**
- `CHANGELOG.md` → `## [12.13.1]` con bullet hotfix y mención del reporte.
- `APP_VERSION` → `12.13.1`.

### Detalles técnicos

- **Sin migración SQL nueva** — todo via `code--exec` + supabase service-role client, porque son UPDATEs/INSERTs de datos.
- Los UPDATEs van con `WHERE` defensivos (`IS NULL` / `=''`) para que el script sea **idempotente**: re-correrlo no pisa datos que el operador ya capturó.
- Cada modificación se loguea en `bitacora_actividad` con `accion='reconciliacion_huerfano_v12.13.1'` para trazabilidad.

### Out of scope
- No tocamos embarques aéreos sin BL master (otro fix, otro día).
- No tocamos el caso ELIMP00219 (N embarques de 1 contenedor — eso ya es la realidad histórica antes del modelo 1+N).
- No iniciamos Fase 6 — eso sigue después del hotfix.

### Entregables
1. `scripts/audit-embarques-huerfanos.ts` (read-only).
2. `scripts/reconciliar-embarques-huerfanos.ts` (idempotente).
3. Reporte en `/mnt/documents/embarques-huerfanos-report.md`.
4. 1 cambio en `convertirCotizacionAEmbarques` (assertion defensiva).
5. Bump versión `12.13.1` + CHANGELOG.
